import express from "express"
import Ajv from "ajv"
import { QuizGenerator } from "../quiz/quizGenerator.js"
import { FeedbackGenerator } from "../feedback/feedbackGenerator.js"
import { StudentManager } from "../model/bkt.js"
import { getDatabase } from "../model/database.js"
import { getAllTopics } from "../model/topics.js"
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { groqClient, modelConfigs, promptTemplates, handleGroqError } from "../config/groq.js"

const router = express.Router()

// Configurar validador AJV
const ajv = new Ajv()

// Esquemas de validación
const quizRequestSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    topicId: { type: "string" },
    nQuestions: { type: "integer", minimum: 1, maximum: 20 },
  },
  required: ["userId"],
  additionalProperties: false,
}

const answerRequestSchema = {
  type: "object",
  properties: {
    questionId: { type: "string", minLength: 1 },
    selectedOption: { type: "string", pattern: "^[A-D]$" },
  },
  required: ["questionId", "selectedOption"],
  additionalProperties: false,
}

const validateQuizRequest = ajv.compile(quizRequestSchema)
const validateAnswerRequest = ajv.compile(answerRequestSchema)

// Inicializar componentes
let quizGenerator = null
let feedbackGenerator = null
let studentManager = null

async function initializeComponents() {
  if (!studentManager) {
    const db = getDatabase()
    studentManager = new StudentManager(db)
  }

  if (!feedbackGenerator) {
    feedbackGenerator = new FeedbackGenerator(studentManager)
  }

  if (!quizGenerator) {
    // Cargar índice de embeddings
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const projectRoot = join(__dirname, "../..")
    const indexPath = join(projectRoot, "embeddings/index.json")

    let embeddingsIndex = null
    if (existsSync(indexPath)) {
      try {
        embeddingsIndex = JSON.parse(readFileSync(indexPath, "utf8"))
      } catch (error) {
        console.error("Error loading embeddings index:", error)
      }
    }

    quizGenerator = new QuizGenerator(studentManager, embeddingsIndex)
  }

  return { quizGenerator, feedbackGenerator, studentManager }
}

// POST /quiz - Crear nuevo quiz
router.post("/", async (req, res) => {
  try {
    const { topic, difficulty = "medium", questionCount = 5 } = req.body

    if (!topic) {
      return res.status(400).json({
        error: 'Field "topic" is required',
        example: { topic: "JavaScript basics", difficulty: "medium", questionCount: 5 },
      })
    }

    console.log(`🎯 Generating quiz for topic: "${topic}"`)

    const prompt = `Generate a ${difficulty} difficulty quiz about "${topic}" with ${questionCount} multiple choice questions. 
Format as JSON with this structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "Why this is correct"
    }
  ]
}`

    const response = await groqClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: promptTemplates.quiz.system,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      ...modelConfigs.quiz,
    })

    const quizContent = response.choices[0]?.message?.content || "{}"

    try {
      const quiz = JSON.parse(quizContent)
      res.json({
        topic,
        difficulty,
        quiz,
        timestamp: new Date().toISOString(),
      })
    } catch (parseError) {
      console.error("Quiz parsing error:", parseError)
      res.status(500).json({
        error: "Failed to parse quiz response",
        details: parseError.message,
      })
    }
  } catch (error) {
    console.error("Quiz generation error:", error)
    const errorResponse = handleGroqError(error)
    res.status(500).json(errorResponse)
  }
})

// GET /quiz/:quizId - Obtener quiz existente
router.get("/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params

    const db = getDatabase()
    await db.read()

    const quiz = db.data.quizzes?.[quizId]

    if (!quiz) {
      return res.status(404).json({
        error: "Quiz not found",
        quizId,
      })
    }

    // Respuesta sin las respuestas correctas
    const publicQuiz = {
      quizId: quiz.quizId,
      topicId: quiz.topicId,
      topicName: quiz.topicName,
      totalQuestions: quiz.totalQuestions,
      currentQuestion: quiz.currentQuestion,
      adaptiveLevel: quiz.adaptiveLevel,
      score: quiz.score,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        questionNumber: q.questionNumber,
        question: q.question,
        options: q.options,
        // Incluir si ya fue respondida
        answered: quiz.answers[q.id] ? true : false,
        selectedOption: quiz.answers[q.id]?.selectedOption,
      })),
      createdAt: quiz.createdAt,
      status: quiz.status,
    }

    res.json(publicQuiz)
  } catch (error) {
    console.error("Error retrieving quiz:", error)
    res.status(500).json({
      error: "Error retrieving quiz",
      details: error.message,
    })
  }
})

// POST /quiz/:quizId/answer - Responder pregunta
router.post("/:quizId/answer", async (req, res) => {
  try {
    const { quizId } = req.params
    const { questionId, selectedOption } = req.body

    // Validar entrada
    if (!validateAnswerRequest(req.body)) {
      return res.status(400).json({
        error: "Invalid answer data",
        details: validateAnswerRequest.errors,
        example: {
          questionId: "question-uuid",
          selectedOption: "A", // A, B, C, o D
        },
      })
    }

    console.log(`📝 Processing answer for quiz: ${quizId}`)

    const { feedbackGenerator: generator, studentManager: manager } = await initializeComponents()

    // Cargar quiz
    const db = getDatabase()
    await db.read()

    const quiz = db.data.quizzes?.[quizId]
    if (!quiz) {
      return res.status(404).json({
        error: "Quiz not found",
        quizId,
      })
    }

    // Encontrar pregunta
    const question = quiz.questions.find((q) => q.id === questionId)
    if (!question) {
      return res.status(404).json({
        error: "Question not found",
        questionId,
      })
    }

    // Verificar si ya fue respondida
    if (quiz.answers[questionId]) {
      return res.status(400).json({
        error: "Question already answered",
        questionId,
      })
    }

    // Validar respuesta
    const answerResult = quizGenerator.validateAnswer(question, selectedOption)

    // Actualizar modelo BKT
    await manager.updateModel(quiz.userId, quiz.topicId, answerResult.isCorrect, {
      source: "quiz",
      quizId,
      questionId,
      selectedOption,
    })

    // Obtener progreso actualizado
    const userProgress = await manager.getProficiency(quiz.userId)
    const topicProgress = userProgress.proficiency[quiz.topicId]

    // Generar feedback adaptativo
    const feedback = await generator.generateFeedback(answerResult, topicProgress, quiz.adaptiveLevel)

    // Guardar respuesta en quiz
    quiz.answers[questionId] = {
      selectedOption,
      isCorrect: answerResult.isCorrect,
      timestamp: new Date().toISOString(),
      feedback,
    }

    // Actualizar puntaje y progreso
    if (answerResult.isCorrect) {
      quiz.score++
    }

    quiz.currentQuestion = Math.min(quiz.currentQuestion + 1, quiz.totalQuestions)

    // Verificar si el quiz está completo
    const answeredQuestions = Object.keys(quiz.answers).length
    if (answeredQuestions >= quiz.totalQuestions) {
      quiz.status = "completed"
      quiz.completedAt = new Date().toISOString()

      // Generar resumen del quiz
      const allAnswers = quiz.questions.map((q) => ({
        ...quiz.answers[q.id],
        questionId: q.id,
        topicId: q.topicId,
      }))

      quiz.summary = await generator.generateQuizSummary(allAnswers, userProgress)
    }

    await db.write()

    // Respuesta
    res.json({
      success: true,
      result: {
        questionId,
        isCorrect: answerResult.isCorrect,
        selectedOption: answerResult.selectedOption,
        correctAnswer: answerResult.correctAnswer,
        explanation: answerResult.explanation,
      },
      feedback,
      progress: {
        currentQuestion: quiz.currentQuestion,
        totalQuestions: quiz.totalQuestions,
        score: quiz.score,
        percentage: Math.round((quiz.score / answeredQuestions) * 100),
      },
      quizStatus: quiz.status,
      summary: quiz.status === "completed" ? quiz.summary : null,
    })
  } catch (error) {
    console.error("Error processing answer:", error)
    res.status(500).json({
      error: "Error processing answer",
      details: error.message,
    })
  }
})

// GET /quiz/:quizId/results - Obtener resultados del quiz
router.get("/:quizId/results", async (req, res) => {
  try {
    const { quizId } = req.params

    const db = getDatabase()
    await db.read()

    const quiz = db.data.quizzes?.[quizId]

    if (!quiz) {
      return res.status(404).json({
        error: "Quiz not found",
        quizId,
      })
    }

    if (quiz.status !== "completed") {
      return res.status(400).json({
        error: "Quiz not completed yet",
        currentQuestion: quiz.currentQuestion,
        totalQuestions: quiz.totalQuestions,
      })
    }

    // Preparar resultados detallados
    const detailedResults = quiz.questions.map((question) => {
      const answer = quiz.answers[question.id]
      return {
        questionNumber: question.questionNumber,
        question: question.question,
        options: question.options,
        selectedOption: answer?.selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect: answer?.isCorrect,
        explanation: question.explanation,
        feedback: answer?.feedback,
      }
    })

    res.json({
      quizId,
      userId: quiz.userId,
      topicName: quiz.topicName,
      summary: quiz.summary,
      detailedResults,
      completedAt: quiz.completedAt,
      totalTime: quiz.completedAt ? new Date(quiz.completedAt) - new Date(quiz.createdAt) : null,
    })
  } catch (error) {
    console.error("Error retrieving quiz results:", error)
    res.status(500).json({
      error: "Error retrieving quiz results",
      details: error.message,
    })
  }
})

// GET /quiz/user/:userId - Obtener quizzes de un usuario
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params
    const { status, limit = 10 } = req.query

    const db = getDatabase()
    await db.read()

    if (!db.data.quizzes) {
      return res.json({ quizzes: [] })
    }

    let userQuizzes = Object.values(db.data.quizzes)
      .filter((quiz) => quiz.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // Filtrar por estado si se especifica
    if (status) {
      userQuizzes = userQuizzes.filter((quiz) => quiz.status === status)
    }

    // Limitar resultados
    userQuizzes = userQuizzes.slice(0, Number.parseInt(limit))

    // Preparar respuesta pública
    const publicQuizzes = userQuizzes.map((quiz) => ({
      quizId: quiz.quizId,
      topicName: quiz.topicName,
      totalQuestions: quiz.totalQuestions,
      score: quiz.score,
      status: quiz.status,
      createdAt: quiz.createdAt,
      completedAt: quiz.completedAt,
      percentage: quiz.status === "completed" ? Math.round((quiz.score / quiz.totalQuestions) * 100) : null,
    }))

    res.json({
      userId,
      quizzes: publicQuizzes,
      total: publicQuizzes.length,
    })
  } catch (error) {
    console.error("Error retrieving user quizzes:", error)
    res.status(500).json({
      error: "Error retrieving user quizzes",
      details: error.message,
    })
  }
})

// GET /quiz/topics - Obtener temas disponibles para quizzes
router.get("/topics", (req, res) => {
  try {
    const topics = getAllTopics().map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      difficulty: topic.difficulty,
      color: topic.color,
    }))

    res.json({
      topics,
      totalTopics: topics.length,
    })
  } catch (error) {
    console.error("Error retrieving quiz topics:", error)
    res.status(500).json({
      error: "Error retrieving quiz topics",
      details: error.message,
    })
  }
})

// DELETE /quiz/:quizId - Eliminar quiz
router.delete("/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params

    const db = getDatabase()
    await db.read()

    if (!db.data.quizzes?.[quizId]) {
      return res.status(404).json({
        error: "Quiz not found",
        quizId,
      })
    }

    delete db.data.quizzes[quizId]
    await db.write()

    res.json({
      success: true,
      message: "Quiz deleted successfully",
      quizId,
    })
  } catch (error) {
    console.error("Error deleting quiz:", error)
    res.status(500).json({
      error: "Error deleting quiz",
      details: error.message,
    })
  }
})

export { router as quizRoute }
