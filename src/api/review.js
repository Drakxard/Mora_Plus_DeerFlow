import express from "express"
import Ajv from "ajv"
import { agentCoordinator } from "../agents/coordinator.js"
import { intelligentPlanner } from "../agents/planner.js"
import { getDatabase } from "../model/database.js"
import { PlanModel } from "../planner/planModel.js"

const router = express.Router()

// Configurar validador AJV
const ajv = new Ajv()

// Esquemas de validación
const reviewPlanSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    planData: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 500 },
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topicId: { type: "string", minLength: 1 },
              targetDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
              estimatedMinutes: { type: "integer", minimum: 5, maximum: 480 },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              notes: { type: "string" },
              approved: { type: "boolean" },
            },
            required: ["topicId", "targetDate"],
            additionalProperties: false,
          },
        },
        settings: {
          type: "object",
          properties: {
            reminderTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            reminderEnabled: { type: "boolean" },
            autoAdvance: { type: "boolean" },
          },
          additionalProperties: false,
        },
        humanFeedback: { type: "string", maxLength: 1000 },
        approved: { type: "boolean" },
      },
      required: ["topics"],
      additionalProperties: false,
    },
  },
  required: ["userId", "planData"],
  additionalProperties: false,
}

const reviewQuizSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    quizId: { type: "string", minLength: 1 },
    feedback: {
      type: "object",
      properties: {
        difficulty: { type: "string", enum: ["too_easy", "appropriate", "too_hard"] },
        relevance: { type: "string", enum: ["low", "medium", "high"] },
        clarity: { type: "string", enum: ["poor", "good", "excellent"] },
        suggestions: { type: "string", maxLength: 500 },
        rating: { type: "integer", minimum: 1, maximum: 5 },
      },
      additionalProperties: false,
    },
    approved: { type: "boolean" },
  },
  required: ["userId", "quizId", "feedback"],
  additionalProperties: false,
}

const validateReviewPlan = ajv.compile(reviewPlanSchema)
const validateReviewQuiz = ajv.compile(reviewQuizSchema)

// GET /review/plan - Get plan for human review
router.get("/plan", (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({
      error: 'Query parameter "userId" is required',
      example: "/review/plan?userId=user123",
    })
  }

  // TODO: Implement actual review functionality
  res.json({
    userId,
    planReview: {
      status: "pending_review",
      suggestions: ["Focus more on practical exercises", "Add more quiz sessions"],
      lastModified: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  })
})

// POST /review/plan - Submit plan review and approval
router.post("/plan", async (req, res) => {
  try {
    // Validar entrada
    if (!validateReviewPlan(req.body)) {
      return res.status(400).json({
        error: "Invalid plan review data",
        details: validateReviewPlan.errors,
        example: {
          userId: "demo-user",
          planData: {
            title: "Mi Plan Revisado",
            topics: [
              {
                topicId: "introduction",
                targetDate: "2024-01-20",
                estimatedMinutes: 45,
                priority: "high",
                approved: true,
              },
            ],
            humanFeedback: "El plan se ve bien, pero necesito más tiempo para temas avanzados",
            approved: true,
          },
        },
      })
    }

    const { userId, planData } = req.body

    console.log(`✅ Processing plan review for user: ${userId}`)

    // Obtener plan actual
    const db = getDatabase()
    const planModel = new PlanModel(db)
    const currentPlan = await planModel.getPlan(userId)

    if (!currentPlan) {
      return res.status(404).json({
        error: "No study plan found to review",
        userId,
      })
    }

    // Procesar cambios humanos
    const humanModifications = {
      title: planData.title || currentPlan.title,
      description: planData.description || currentPlan.description,
      topics: planData.topics.map((topic) => ({
        ...topic,
        humanApproved: topic.approved !== false,
        humanModified: true,
      })),
      settings: { ...currentPlan.settings, ...planData.settings },
      humanFeedback: planData.humanFeedback || "",
      humanApproved: planData.approved !== false,
      reviewedAt: new Date().toISOString(),
    }

    // Actualizar plan con modificaciones humanas
    const updatedPlan = await planModel.updatePlan(userId, humanModifications)

    // Registrar revisión en historial
    await this.recordHumanReview(userId, "plan", {
      originalPlan: currentPlan,
      modifications: humanModifications,
      approved: planData.approved,
      feedback: planData.humanFeedback,
    })

    // Si fue aprobado, ejecutar workflow de optimización
    let optimizationResult = null
    if (planData.approved) {
      try {
        optimizationResult = await intelligentPlanner.optimizeExistingPlan(userId)
      } catch (error) {
        console.warn("Could not optimize plan after approval:", error.message)
      }
    }

    res.json({
      success: true,
      userId,
      updatedPlan: {
        planId: updatedPlan.planId,
        title: updatedPlan.title,
        description: updatedPlan.description,
        topics: updatedPlan.topics,
        settings: updatedPlan.settings,
        status: updatedPlan.status,
        humanApproved: humanModifications.humanApproved,
        reviewedAt: humanModifications.reviewedAt,
      },
      optimization: optimizationResult,
      message: planData.approved ? "Plan approved and optimized" : "Plan updated with human feedback",
    })
  } catch (error) {
    console.error("Error processing plan review:", error)
    res.status(500).json({
      error: "Error processing plan review",
      details: error.message,
    })
  }
})

// GET /review/quiz - Get quiz for human review
router.get("/quiz", async (req, res) => {
  try {
    const { userId, quizId } = req.query

    if (!userId || !quizId) {
      return res.status(400).json({
        error: 'Parameters "userId" and "quizId" are required',
        example: "/review/quiz?userId=demo-user&quizId=quiz-123",
      })
    }

    console.log(`👁️ Getting quiz for review: ${quizId}`)

    // Obtener quiz de la base de datos
    const db = getDatabase()
    await db.read()

    const quiz = db.data.quizzes?.[quizId]
    if (!quiz || quiz.userId !== userId) {
      return res.status(404).json({
        error: "Quiz not found",
        quizId,
        userId,
      })
    }

    // Obtener análisis del agente
    const quizAnalysis = await agentCoordinator.executeAgent("QuizAgent", {
      action: "analyze_performance",
      userId,
      quizData: quiz,
    })

    // Preparar datos para revisión
    const reviewData = {
      quiz: {
        quizId: quiz.quizId,
        topicName: quiz.topicName,
        totalQuestions: quiz.totalQuestions,
        score: quiz.score,
        status: quiz.status,
        adaptiveLevel: quiz.adaptiveLevel,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          userAnswer: quiz.answers[q.id]?.selectedOption,
          isCorrect: quiz.answers[q.id]?.isCorrect,
        })),
        completedAt: quiz.completedAt,
      },
      agentAnalysis: quizAnalysis.result.analysis,
      reviewCriteria: [
        {
          id: "question_quality",
          label: "Calidad de las preguntas",
          description: "¿Las preguntas son claras y bien formuladas?",
        },
        {
          id: "difficulty_appropriateness",
          label: "Dificultad apropiada",
          description: "¿La dificultad es adecuada para el nivel del estudiante?",
        },
        {
          id: "content_relevance",
          label: "Relevancia del contenido",
          description: "¿Las preguntas son relevantes para el tema?",
        },
        {
          id: "explanation_clarity",
          label: "Claridad de explicaciones",
          description: "¿Las explicaciones son útiles y comprensibles?",
        },
      ],
    }

    res.json({
      userId,
      quizId,
      reviewData,
      instructions: {
        purpose: "Review the AI-generated quiz quality and appropriateness",
        focus: [
          "Question clarity and accuracy",
          "Appropriate difficulty level",
          "Relevance to learning objectives",
          "Quality of explanations",
        ],
      },
    })
  } catch (error) {
    console.error("Error getting quiz for review:", error)
    res.status(500).json({
      error: "Error retrieving quiz for review",
      details: error.message,
    })
  }
})

// POST /review/quiz - Submit quiz review
router.post("/quiz", async (req, res) => {
  try {
    // Validar entrada
    if (!validateReviewQuiz(req.body)) {
      return res.status(400).json({
        error: "Invalid quiz review data",
        details: validateReviewQuiz.errors,
        example: {
          userId: "demo-user",
          quizId: "quiz-123",
          feedback: {
            difficulty: "appropriate",
            relevance: "high",
            clarity: "good",
            suggestions: "Consider adding more practical examples",
            rating: 4,
          },
          approved: true,
        },
      })
    }

    const { userId, quizId, feedback, approved } = req.body

    console.log(`✅ Processing quiz review for quiz: ${quizId}`)

    // Registrar revisión
    await this.recordHumanReview(userId, "quiz", {
      quizId,
      feedback,
      approved,
      reviewedAt: new Date().toISOString(),
    })

    // Si no fue aprobado, marcar para regeneración
    if (!approved) {
      const db = getDatabase()
      await db.read()

      if (db.data.quizzes?.[quizId]) {
        db.data.quizzes[quizId].humanReview = {
          approved: false,
          feedback,
          needsRegeneration: true,
          reviewedAt: new Date().toISOString(),
        }
        await db.write()
      }
    }

    res.json({
      success: true,
      userId,
      quizId,
      review: {
        feedback,
        approved,
        reviewedAt: new Date().toISOString(),
      },
      message: approved ? "Quiz approved" : "Quiz marked for improvement",
      nextSteps: approved
        ? ["Continue with current quiz settings"]
        : ["Quiz will be regenerated with feedback", "Difficulty will be adjusted"],
    })
  } catch (error) {
    console.error("Error processing quiz review:", error)
    res.status(500).json({
      error: "Error processing quiz review",
      details: error.message,
    })
  }
})

// GET /review/history - Get human review history
router.get("/history", async (req, res) => {
  try {
    const { userId, type, limit = 10 } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const db = getDatabase()
    await db.read()

    if (!db.data.humanReviews) {
      db.data.humanReviews = {}
    }

    let reviews = db.data.humanReviews[userId] || []

    // Filtrar por tipo si se especifica
    if (type) {
      reviews = reviews.filter((review) => review.type === type)
    }

    // Limitar resultados
    reviews = reviews.slice(-Number.parseInt(limit)).reverse()

    res.json({
      userId,
      reviews,
      totalReviews: reviews.length,
      types: ["plan", "quiz"],
    })
  } catch (error) {
    console.error("Error getting review history:", error)
    res.status(500).json({
      error: "Error retrieving review history",
      details: error.message,
    })
  }
})

// GET /review/pending - Get pending reviews
router.get("/pending", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const pendingReviews = []

    // Verificar planes pendientes de revisión
    const db = getDatabase()
    const planModel = new PlanModel(db)
    const currentPlan = await planModel.getPlan(userId)

    if (currentPlan && !currentPlan.humanApproved) {
      pendingReviews.push({
        type: "plan",
        id: currentPlan.planId,
        title: "Study Plan Review",
        description: "AI-generated study plan needs human approval",
        priority: "medium",
        estimatedTime: 10,
        createdAt: currentPlan.createdAt,
      })
    }

    // Verificar quizzes pendientes de revisión
    await db.read()
    if (db.data.quizzes) {
      const userQuizzes = Object.values(db.data.quizzes)
        .filter((quiz) => quiz.userId === userId && quiz.status === "completed")
        .filter((quiz) => !quiz.humanReview || quiz.humanReview.needsRegeneration)

      userQuizzes.forEach((quiz) => {
        pendingReviews.push({
          type: "quiz",
          id: quiz.quizId,
          title: `Quiz Review: ${quiz.topicName}`,
          description: "Quiz quality needs human evaluation",
          priority: "low",
          estimatedTime: 5,
          createdAt: quiz.completedAt,
        })
      })
    }

    // Ordenar por prioridad y fecha
    pendingReviews.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

    res.json({
      userId,
      pendingReviews,
      totalPending: pendingReviews.length,
      estimatedTotalTime: pendingReviews.reduce((sum, review) => sum + review.estimatedTime, 0),
    })
  } catch (error) {
    console.error("Error getting pending reviews:", error)
    res.status(500).json({
      error: "Error retrieving pending reviews",
      details: error.message,
    })
  }
})

/**
 * Record human review in database
 */
async function recordHumanReview(userId, type, reviewData) {
  try {
    const db = getDatabase()
    await db.read()

    if (!db.data.humanReviews) {
      db.data.humanReviews = {}
    }

    if (!db.data.humanReviews[userId]) {
      db.data.humanReviews[userId] = []
    }

    const review = {
      id: `review_${Date.now()}`,
      type,
      userId,
      ...reviewData,
      recordedAt: new Date().toISOString(),
    }

    db.data.humanReviews[userId].push(review)

    // Mantener solo las últimas 50 revisiones por usuario
    if (db.data.humanReviews[userId].length > 50) {
      db.data.humanReviews[userId] = db.data.humanReviews[userId].slice(-50)
    }

    await db.write()

    console.log(`📝 Human review recorded: ${type} for user ${userId}`)
  } catch (error) {
    console.error("Error recording human review:", error)
  }
}

export { router as reviewRoute }
