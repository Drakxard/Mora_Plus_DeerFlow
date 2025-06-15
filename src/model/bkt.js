/**
 * Bayesian Knowledge Tracing (BKT) Implementation
 * For student modeling in Mora + DeerFlow
 */

import { getAllTopics } from "./topics.js"

// Parámetros BKT por defecto
export const DEFAULT_BKT_PARAMS = {
  // P(L0) - Probabilidad inicial de conocimiento
  initialKnowledge: 0.1,

  // P(T) - Probabilidad de transición (aprender)
  learnRate: 0.3,

  // P(S) - Probabilidad de slip (saber pero fallar)
  slipRate: 0.1,

  // P(G) - Probabilidad de guess (no saber pero acertar)
  guessRate: 0.2,
}

/**
 * Clase BKT para modelado de estudiante
 */
export class BKTModel {
  constructor(params = DEFAULT_BKT_PARAMS) {
    this.params = { ...DEFAULT_BKT_PARAMS, ...params }
  }

  /**
   * Calcula la probabilidad de conocimiento después de una observación
   * @param {number} currentProb - Probabilidad actual de conocimiento
   * @param {boolean} correct - Si la respuesta fue correcta
   * @returns {number} Nueva probabilidad de conocimiento
   */
  updateKnowledge(currentProb, correct) {
    const { learnRate, slipRate, guessRate } = this.params

    // P(L_t+1 | evidence)
    let newProb

    if (correct) {
      // Respuesta correcta
      const numerator = currentProb * (1 - slipRate)
      const denominator = currentProb * (1 - slipRate) + (1 - currentProb) * guessRate

      const probKnowGivenCorrect = numerator / denominator
      newProb = probKnowGivenCorrect + (1 - probKnowGivenCorrect) * learnRate
    } else {
      // Respuesta incorrecta
      const numerator = currentProb * slipRate
      const denominator = currentProb * slipRate + (1 - currentProb) * (1 - guessRate)

      const probKnowGivenIncorrect = numerator / denominator
      newProb = probKnowGivenIncorrect + (1 - probKnowGivenIncorrect) * learnRate
    }

    // Asegurar que esté en el rango [0, 1]
    return Math.max(0, Math.min(1, newProb))
  }

  /**
   * Calcula la probabilidad de respuesta correcta dado el conocimiento actual
   * @param {number} knowledgeProb - Probabilidad actual de conocimiento
   * @returns {number} Probabilidad de respuesta correcta
   */
  predictCorrectness(knowledgeProb) {
    const { slipRate, guessRate } = this.params
    return knowledgeProb * (1 - slipRate) + (1 - knowledgeProb) * guessRate
  }

  /**
   * Obtiene el nivel de dominio basado en la probabilidad
   * @param {number} probability - Probabilidad de conocimiento
   * @returns {Object} Información del nivel de dominio
   */
  getMasteryLevel(probability) {
    if (probability >= 0.8) {
      return { level: "mastered", label: "Dominado", color: "#4CAF50" }
    } else if (probability >= 0.6) {
      return { level: "proficient", label: "Competente", color: "#FF9800" }
    } else if (probability >= 0.4) {
      return { level: "developing", label: "En Desarrollo", color: "#2196F3" }
    } else if (probability >= 0.2) {
      return { level: "beginning", label: "Principiante", color: "#9C27B0" }
    } else {
      return { level: "novice", label: "Novato", color: "#F44336" }
    }
  }
}

/**
 * Gestor de estudiantes con persistencia
 */
export class StudentManager {
  constructor(db) {
    this.db = db
    this.bkt = new BKTModel()
    this.initializeDatabase()
  }

  /**
   * Inicializa la base de datos con estructura por defecto
   */
  async initializeDatabase() {
    await this.db.read()

    if (!this.db.data) {
      this.db.data = { students: {} }
      await this.db.write()
    }
  }

  /**
   * Inicializa un nuevo estudiante
   * @param {string} userId - ID del usuario
   * @returns {Object} Estado inicial del estudiante
   */
  async initializeStudent(userId) {
    await this.db.read()

    if (!this.db.data.students[userId]) {
      const topics = getAllTopics()
      const initialState = {}

      // Inicializar cada tema con probabilidad inicial
      topics.forEach((topic) => {
        initialState[topic.id] = this.bkt.params.initialKnowledge
      })

      this.db.data.students[userId] = {
        knowledge: initialState,
        interactions: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }

      await this.db.write()
    }

    return this.db.data.students[userId]
  }

  /**
   * Actualiza el modelo BKT después de una interacción
   * @param {string} userId - ID del usuario
   * @param {string} topicId - ID del tema
   * @param {boolean} correct - Si la respuesta fue correcta
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Object} Estado actualizado
   */
  async updateModel(userId, topicId, correct, metadata = {}) {
    await this.db.read()

    // Inicializar estudiante si no existe
    if (!this.db.data.students[userId]) {
      await this.initializeStudent(userId)
    }

    const student = this.db.data.students[userId]
    const currentProb = student.knowledge[topicId] || this.bkt.params.initialKnowledge

    // Actualizar probabilidad usando BKT
    const newProb = this.bkt.updateKnowledge(currentProb, correct)
    student.knowledge[topicId] = newProb

    // Registrar interacción
    const interaction = {
      topicId,
      correct,
      previousProb: currentProb,
      newProb,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    student.interactions.push(interaction)
    student.lastUpdated = new Date().toISOString()

    await this.db.write()

    return {
      topicId,
      previousProbability: currentProb,
      newProbability: newProb,
      masteryLevel: this.bkt.getMasteryLevel(newProb),
      interaction,
    }
  }

  /**
   * Obtiene el progreso completo de un estudiante
   * @param {string} userId - ID del usuario
   * @returns {Object} Progreso del estudiante
   */
  async getProficiency(userId) {
    await this.db.read()

    if (!this.db.data.students[userId]) {
      await this.initializeStudent(userId)
    }

    const student = this.db.data.students[userId]
    const topics = getAllTopics()

    const proficiency = {}

    topics.forEach((topic) => {
      const probability = student.knowledge[topic.id] || this.bkt.params.initialKnowledge
      const masteryLevel = this.bkt.getMasteryLevel(probability)
      const predictedCorrectness = this.bkt.predictCorrectness(probability)

      proficiency[topic.id] = {
        topic: topic,
        probability,
        masteryLevel,
        predictedCorrectness,
        interactions: student.interactions.filter((i) => i.topicId === topic.id).length,
      }
    })

    return {
      userId,
      proficiency,
      totalInteractions: student.interactions.length,
      overallProgress: this.calculateOverallProgress(proficiency),
      lastUpdated: student.lastUpdated,
      createdAt: student.createdAt,
    }
  }

  /**
   * Calcula el progreso general del estudiante
   * @param {Object} proficiency - Datos de competencia por tema
   * @returns {Object} Progreso general
   */
  calculateOverallProgress(proficiency) {
    const topics = Object.values(proficiency)
    const totalProbability = topics.reduce((sum, topic) => sum + topic.probability, 0)
    const averageProbability = totalProbability / topics.length

    const masteredTopics = topics.filter((t) => t.masteryLevel.level === "mastered").length
    const proficientTopics = topics.filter((t) => t.masteryLevel.level === "proficient").length

    return {
      averageProbability,
      masteryLevel: this.bkt.getMasteryLevel(averageProbability),
      masteredTopics,
      proficientTopics,
      totalTopics: topics.length,
      completionPercentage: Math.round((masteredTopics / topics.length) * 100),
    }
  }

  /**
   * Obtiene estadísticas del estudiante
   * @param {string} userId - ID del usuario
   * @returns {Object} Estadísticas detalladas
   */
  async getStudentStats(userId) {
    await this.db.read()

    if (!this.db.data.students[userId]) {
      return null
    }

    const student = this.db.data.students[userId]
    const interactions = student.interactions

    const correctAnswers = interactions.filter((i) => i.correct).length
    const totalAnswers = interactions.length
    const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : 0

    // Progreso por día
    const dailyProgress = {}
    interactions.forEach((interaction) => {
      const date = interaction.timestamp.split("T")[0]
      if (!dailyProgress[date]) {
        dailyProgress[date] = { correct: 0, total: 0 }
      }
      dailyProgress[date].total++
      if (interaction.correct) {
        dailyProgress[date].correct++
      }
    })

    return {
      userId,
      accuracy,
      totalInteractions: totalAnswers,
      correctAnswers,
      incorrectAnswers: totalAnswers - correctAnswers,
      dailyProgress,
      averageImprovement: this.calculateAverageImprovement(interactions),
      mostImprovedTopic: this.getMostImprovedTopic(interactions),
      weakestTopic: this.getWeakestTopic(student.knowledge),
    }
  }

  /**
   * Calcula la mejora promedio por interacción
   * @param {Array} interactions - Lista de interacciones
   * @returns {number} Mejora promedio
   */
  calculateAverageImprovement(interactions) {
    if (interactions.length === 0) return 0

    const improvements = interactions.map((i) => i.newProb - i.previousProb)
    return improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
  }

  /**
   * Obtiene el tema con mayor mejora
   * @param {Array} interactions - Lista de interacciones
   * @returns {Object} Información del tema con mayor mejora
   */
  getMostImprovedTopic(interactions) {
    const topicImprovements = {}

    interactions.forEach((interaction) => {
      const improvement = interaction.newProb - interaction.previousProb
      if (!topicImprovements[interaction.topicId]) {
        topicImprovements[interaction.topicId] = []
      }
      topicImprovements[interaction.topicId].push(improvement)
    })

    let bestTopic = null
    let bestImprovement = Number.NEGATIVE_INFINITY

    Object.entries(topicImprovements).forEach(([topicId, improvements]) => {
      const avgImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
      if (avgImprovement > bestImprovement) {
        bestImprovement = avgImprovement
        bestTopic = topicId
      }
    })

    return bestTopic ? { topicId: bestTopic, improvement: bestImprovement } : null
  }

  /**
   * Obtiene el tema más débil
   * @param {Object} knowledge - Estado de conocimiento
   * @returns {Object} Información del tema más débil
   */
  getWeakestTopic(knowledge) {
    let weakestTopic = null
    let lowestProb = Number.POSITIVE_INFINITY

    Object.entries(knowledge).forEach(([topicId, probability]) => {
      if (probability < lowestProb) {
        lowestProb = probability
        weakestTopic = topicId
      }
    })

    return weakestTopic ? { topicId: weakestTopic, probability: lowestProb } : null
  }
}
