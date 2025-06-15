/**
 * Adaptive Quiz Generator for Mora + DeerFlow
 * Generates personalized quizzes based on BKT student progress
 */

import { v4 as uuidv4 } from "uuid"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { getTopicInfo } from "../model/topics.js"

/**
 * Clase para generar quizzes adaptativos
 */
export class QuizGenerator {
  constructor(studentManager, embeddingsIndex) {
    this.studentManager = studentManager
    this.embeddingsIndex = embeddingsIndex
  }

  /**
   * Genera un quiz adaptativo para un usuario
   * @param {string} userId - ID del usuario
   * @param {string} topicId - ID del tema (opcional, si no se especifica se selecciona automáticamente)
   * @param {number} nQuestions - Número de preguntas (default: 5)
   * @returns {Object} Quiz generado
   */
  async generateQuiz(userId, topicId = null, nQuestions = 5) {
    try {
      console.log(`🎯 Generating adaptive quiz for user: ${userId}`)

      // 1. Obtener progreso del estudiante
      const progress = await this.studentManager.getProficiency(userId)

      // 2. Seleccionar tema si no se especificó
      if (!topicId) {
        topicId = this.selectOptimalTopic(progress.proficiency)
      }

      const topicInfo = getTopicInfo(topicId)
      if (!topicInfo) {
        throw new Error(`Topic ${topicId} not found`)
      }

      console.log(`📚 Selected topic: ${topicInfo.name}`)

      // 3. Obtener chunks relevantes para el tema
      const relevantChunks = await this.getRelevantChunksForTopic(topicId, nQuestions * 2) // Obtener más chunks para tener opciones

      if (relevantChunks.length === 0) {
        throw new Error(`No content found for topic: ${topicId}`)
      }

      // 4. Seleccionar chunks basado en dificultad adaptativa
      const selectedChunks = this.selectAdaptiveChunks(relevantChunks, progress.proficiency[topicId], nQuestions)

      // 5. Generar preguntas para cada chunk
      const questions = await this.generateQuestionsFromChunks(selectedChunks, topicInfo)

      // 6. Crear objeto quiz
      const quiz = {
        quizId: uuidv4(),
        userId,
        topicId,
        topicName: topicInfo.name,
        questions,
        totalQuestions: questions.length,
        createdAt: new Date().toISOString(),
        status: "active",
        currentQuestion: 0,
        answers: {},
        score: 0,
        adaptiveLevel: this.calculateAdaptiveLevel(progress.proficiency[topicId]),
      }

      console.log(`✅ Quiz generated: ${quiz.quizId} with ${questions.length} questions`)

      return quiz
    } catch (error) {
      console.error("Error generating quiz:", error)
      throw error
    }
  }

  /**
   * Selecciona el tema óptimo basado en el progreso del estudiante
   * @param {Object} proficiency - Datos de competencia por tema
   * @returns {string} ID del tema seleccionado
   */
  selectOptimalTopic(proficiency) {
    // Priorizar temas con progreso medio (0.3-0.7) para máximo aprendizaje
    const topics = Object.entries(proficiency)
      .filter(([_, data]) => data.probability >= 0.2 && data.probability <= 0.8)
      .sort((a, b) => {
        // Priorizar temas con más interacciones recientes pero no dominados
        const scoreA = (0.5 - Math.abs(a[1].probability - 0.5)) * (1 + a[1].interactions * 0.1)
        const scoreB = (0.5 - Math.abs(b[1].probability - 0.5)) * (1 + b[1].interactions * 0.1)
        return scoreB - scoreA
      })

    return topics.length > 0 ? topics[0][0] : "introduction"
  }

  /**
   * Obtiene chunks relevantes para un tema específico
   * @param {string} topicId - ID del tema
   * @param {number} maxChunks - Número máximo de chunks
   * @returns {Array} Array de chunks relevantes
   */
  async getRelevantChunksForTopic(topicId, maxChunks = 10) {
    if (!this.embeddingsIndex || !this.embeddingsIndex.texts) {
      throw new Error("Embeddings index not available")
    }

    const topicInfo = getTopicInfo(topicId)
    const topicKeywords = this.getTopicKeywords(topicId)

    // Filtrar chunks que contengan keywords del tema
    const relevantChunks = this.embeddingsIndex.texts
      .map((text, index) => ({
        text,
        index,
        relevanceScore: this.calculateTopicRelevance(text, topicKeywords),
      }))
      .filter((chunk) => chunk.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxChunks)

    return relevantChunks
  }

  /**
   * Obtiene keywords para un tema específico
   * @param {string} topicId - ID del tema
   * @returns {Array} Array de keywords
   */
  getTopicKeywords(topicId) {
    const keywordMap = {
      introduction: ["introducción", "básico", "fundamentos", "qué es", "definición", "conceptos", "primeros pasos"],
      intermediate: ["intermedio", "desarrollo", "implementación", "proceso", "metodología", "técnicas"],
      advanced: ["avanzado", "complejo", "especializado", "optimización", "performance", "arquitectura"],
      configuration: ["configuración", "setup", "instalación", "parámetros", "ajustes", "settings"],
      troubleshooting: ["error", "problema", "solución", "debug", "troubleshooting", "diagnóstico"],
      best_practices: ["mejores prácticas", "recomendaciones", "buenas prácticas", "tips", "consejos"],
    }

    return keywordMap[topicId] || []
  }

  /**
   * Calcula la relevancia de un chunk para un tema
   * @param {string} text - Texto del chunk
   * @param {Array} keywords - Keywords del tema
   * @returns {number} Score de relevancia (0-1)
   */
  calculateTopicRelevance(text, keywords) {
    const textLower = text.toLowerCase()
    const matches = keywords.filter((keyword) => textLower.includes(keyword.toLowerCase()))
    return matches.length / keywords.length
  }

  /**
   * Selecciona chunks adaptativos basado en el nivel del estudiante
   * @param {Array} chunks - Chunks disponibles
   * @param {Object} topicProgress - Progreso en el tema
   * @param {number} nQuestions - Número de preguntas deseadas
   * @returns {Array} Chunks seleccionados
   */
  selectAdaptiveChunks(chunks, topicProgress, nQuestions) {
    const probability = topicProgress?.probability || 0.1
    const adaptiveLevel = this.calculateAdaptiveLevel(topicProgress)

    // Ajustar selección basada en nivel adaptativo
    let selectedChunks = []

    if (adaptiveLevel === "beginner") {
      // Seleccionar chunks más básicos y claros
      selectedChunks = chunks.filter((chunk) => chunk.text.length < 200).slice(0, nQuestions)
    } else if (adaptiveLevel === "intermediate") {
      // Mezcla de chunks básicos y complejos
      const basicChunks = chunks.filter((chunk) => chunk.text.length < 300).slice(0, Math.ceil(nQuestions / 2))
      const complexChunks = chunks.filter((chunk) => chunk.text.length >= 300).slice(0, Math.floor(nQuestions / 2))
      selectedChunks = [...basicChunks, ...complexChunks].slice(0, nQuestions)
    } else {
      // Chunks más complejos y desafiantes
      selectedChunks = chunks.filter((chunk) => chunk.text.length >= 200).slice(0, nQuestions)
    }

    // Si no hay suficientes chunks, tomar los disponibles
    if (selectedChunks.length < nQuestions) {
      selectedChunks = chunks.slice(0, nQuestions)
    }

    return selectedChunks
  }

  /**
   * Calcula el nivel adaptativo del estudiante
   * @param {Object} topicProgress - Progreso en el tema
   * @returns {string} Nivel adaptativo
   */
  calculateAdaptiveLevel(topicProgress) {
    const probability = topicProgress?.probability || 0.1

    if (probability < 0.4) return "beginner"
    if (probability < 0.7) return "intermediate"
    return "advanced"
  }

  /**
   * Genera preguntas de opción múltiple a partir de chunks
   * @param {Array} chunks - Chunks seleccionados
   * @param {Object} topicInfo - Información del tema
   * @returns {Array} Array de preguntas generadas
   */
  async generateQuestionsFromChunks(chunks, topicInfo) {
    const questions = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        console.log(`🤖 Generating question ${i + 1}/${chunks.length}`)

        const question = await this.generateSingleQuestion(chunk.text, topicInfo, i + 1)
        questions.push({
          id: uuidv4(),
          questionNumber: i + 1,
          chunkText: chunk.text,
          chunkIndex: chunk.index,
          topicId: topicInfo.id,
          ...question,
        })
      } catch (error) {
        console.error(`Error generating question ${i + 1}:`, error)
        // Continuar con las otras preguntas
      }
    }

    return questions
  }

  /**
   * Genera una pregunta individual usando IA
   * @param {string} chunkText - Texto del chunk
   * @param {Object} topicInfo - Información del tema
   * @param {number} questionNumber - Número de la pregunta
   * @returns {Object} Pregunta generada
   */
  async generateSingleQuestion(chunkText, topicInfo, questionNumber) {
    const prompt = `Basándote en el siguiente texto sobre "${topicInfo.name}", genera una pregunta de opción múltiple educativa:

TEXTO:
"${chunkText}"

INSTRUCCIONES:
1. Crea una pregunta clara y específica sobre el contenido
2. Genera exactamente 4 opciones de respuesta (A, B, C, D)
3. Solo UNA opción debe ser correcta
4. Las opciones incorrectas deben ser plausibles pero claramente incorrectas
5. La pregunta debe evaluar comprensión, no memorización literal

FORMATO DE RESPUESTA (JSON):
{
  "question": "¿Pregunta aquí?",
  "options": {
    "A": "Primera opción",
    "B": "Segunda opción", 
    "C": "Tercera opción",
    "D": "Cuarta opción"
  },
  "correctAnswer": "A",
  "explanation": "Breve explicación de por qué la respuesta correcta es correcta"
}

Responde SOLO con el JSON, sin texto adicional:`

    const { text: response } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 400,
      temperature: 0.7,
    })

    try {
      // Limpiar respuesta y parsear JSON
      const cleanResponse = response.trim().replace(/```json\n?|\n?```/g, "")
      const questionData = JSON.parse(cleanResponse)

      // Validar estructura
      if (!questionData.question || !questionData.options || !questionData.correctAnswer) {
        throw new Error("Invalid question structure")
      }

      return questionData
    } catch (parseError) {
      console.error("Error parsing generated question:", parseError)
      console.error("Raw response:", response)

      // Fallback: generar pregunta básica
      return this.generateFallbackQuestion(chunkText, questionNumber)
    }
  }

  /**
   * Genera una pregunta de respaldo si falla la generación con IA
   * @param {string} chunkText - Texto del chunk
   * @param {number} questionNumber - Número de la pregunta
   * @returns {Object} Pregunta de respaldo
   */
  generateFallbackQuestion(chunkText, questionNumber) {
    const shortText = chunkText.substring(0, 100) + "..."

    return {
      question: `Según el texto proporcionado, ¿cuál de las siguientes afirmaciones es más precisa?`,
      options: {
        A: "La información presentada es completamente teórica",
        B: "El contenido se enfoca en aspectos prácticos",
        C: "Se trata de información histórica únicamente",
        D: "Es una descripción técnica detallada",
      },
      correctAnswer: "B",
      explanation:
        "Esta es una pregunta generada automáticamente. La respuesta correcta se basa en el análisis del contenido.",
      fallback: true,
    }
  }

  /**
   * Valida una respuesta de quiz
   * @param {Object} question - Pregunta del quiz
   * @param {string} selectedOption - Opción seleccionada por el usuario
   * @returns {Object} Resultado de la validación
   */
  validateAnswer(question, selectedOption) {
    const isCorrect = selectedOption === question.correctAnswer
    const selectedText = question.options[selectedOption] || "Opción no válida"

    return {
      questionId: question.id,
      selectedOption,
      selectedText,
      correctAnswer: question.correctAnswer,
      correctText: question.options[question.correctAnswer],
      isCorrect,
      explanation: question.explanation,
      chunkText: question.chunkText,
    }
  }
}
