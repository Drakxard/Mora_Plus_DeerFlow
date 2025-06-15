/**
 * Study Plan Model for Mora + DeerFlow
 * Manages personalized study plans and session tracking
 */

import { v4 as uuidv4 } from "uuid"
import dayjs from "dayjs"
import { getTopicInfo } from "../model/topics.js"

/**
 * Clase para gestionar planes de estudio
 */
export class PlanModel {
  constructor(db) {
    this.db = db
    this.initializeDatabase()
  }

  /**
   * Inicializa la estructura de la base de datos para planes
   */
  async initializeDatabase() {
    await this.db.read()

    if (!this.db.data.plans) {
      this.db.data.plans = {}
      await this.db.write()
    }
  }

  /**
   * Crea un nuevo plan de estudio para un usuario
   * @param {string} userId - ID del usuario
   * @param {Array} topicsWithDates - Array de { topicId, targetDate } o { topicId, daysAhead }
   * @param {Object} options - Opciones adicionales del plan
   * @returns {Object} Plan creado
   */
  async createPlan(userId, topicsWithDates, options = {}) {
    try {
      await this.db.read()

      // Procesar fechas
      const processedTopics = topicsWithDates.map((item) => {
        let targetDate

        if (item.targetDate) {
          targetDate = dayjs(item.targetDate).format("YYYY-MM-DD")
        } else if (item.daysAhead !== undefined) {
          targetDate = dayjs().add(item.daysAhead, "day").format("YYYY-MM-DD")
        } else {
          // Default: distribuir en los próximos 7 días
          const index = topicsWithDates.indexOf(item)
          targetDate = dayjs()
            .add(index + 1, "day")
            .format("YYYY-MM-DD")
        }

        const topicInfo = getTopicInfo(item.topicId)
        if (!topicInfo) {
          throw new Error(`Topic ${item.topicId} not found`)
        }

        return {
          topicId: item.topicId,
          topicName: topicInfo.name,
          targetDate,
          status: "pending", // pending, in_progress, completed, skipped
          sessions: [],
          estimatedMinutes: item.estimatedMinutes || 30,
          priority: item.priority || "medium", // low, medium, high
          notes: item.notes || "",
        }
      })

      // Ordenar por fecha
      processedTopics.sort((a, b) => dayjs(a.targetDate).diff(dayjs(b.targetDate)))

      const plan = {
        planId: uuidv4(),
        userId,
        title: options.title || "Mi Plan de Estudio",
        description: options.description || "Plan personalizado de aprendizaje",
        topics: processedTopics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active", // active, paused, completed, cancelled
        settings: {
          reminderTime: options.reminderTime || "08:00",
          reminderEnabled: options.reminderEnabled !== false,
          autoAdvance: options.autoAdvance !== false,
          weekendsIncluded: options.weekendsIncluded !== false,
        },
        stats: {
          totalTopics: processedTopics.length,
          completedTopics: 0,
          totalSessions: 0,
          totalMinutesStudied: 0,
          streakDays: 0,
          lastStudyDate: null,
        },
      }

      // Eliminar plan anterior si existe
      if (this.db.data.plans[userId]) {
        console.log(`📋 Replacing existing plan for user: ${userId}`)
      }

      this.db.data.plans[userId] = plan
      await this.db.write()

      console.log(`📋 Plan created for user: ${userId} with ${processedTopics.length} topics`)

      return plan
    } catch (error) {
      console.error("Error creating plan:", error)
      throw error
    }
  }

  /**
   * Obtiene el plan de estudio de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Plan del usuario o null si no existe
   */
  async getPlan(userId) {
    try {
      await this.db.read()
      return this.db.data.plans?.[userId] || null
    } catch (error) {
      console.error("Error getting plan:", error)
      throw error
    }
  }

  /**
   * Actualiza un plan de estudio existente
   * @param {string} userId - ID del usuario
   * @param {Object} modifications - Modificaciones a aplicar
   * @returns {Object} Plan actualizado
   */
  async updatePlan(userId, modifications) {
    try {
      await this.db.read()

      const plan = this.db.data.plans?.[userId]
      if (!plan) {
        throw new Error("Plan not found")
      }

      // Aplicar modificaciones
      if (modifications.title) plan.title = modifications.title
      if (modifications.description) plan.description = modifications.description
      if (modifications.status) plan.status = modifications.status
      if (modifications.settings) {
        plan.settings = { ...plan.settings, ...modifications.settings }
      }

      // Actualizar temas si se proporcionan
      if (modifications.topics) {
        plan.topics = modifications.topics.map((topic) => {
          const existingTopic = plan.topics.find((t) => t.topicId === topic.topicId)
          return {
            ...existingTopic,
            ...topic,
            topicName: getTopicInfo(topic.topicId)?.name || topic.topicName,
          }
        })
        plan.stats.totalTopics = plan.topics.length
      }

      plan.updatedAt = new Date().toISOString()

      this.db.data.plans[userId] = plan
      await this.db.write()

      console.log(`📋 Plan updated for user: ${userId}`)

      return plan
    } catch (error) {
      console.error("Error updating plan:", error)
      throw error
    }
  }

  /**
   * Elimina el plan de un usuario
   * @param {string} userId - ID del usuario
   * @returns {boolean} True si se eliminó correctamente
   */
  async deletePlan(userId) {
    try {
      await this.db.read()

      if (!this.db.data.plans?.[userId]) {
        return false
      }

      delete this.db.data.plans[userId]
      await this.db.write()

      console.log(`📋 Plan deleted for user: ${userId}`)

      return true
    } catch (error) {
      console.error("Error deleting plan:", error)
      throw error
    }
  }

  /**
   * Registra una sesión de estudio
   * @param {string} userId - ID del usuario
   * @param {string} topicId - ID del tema estudiado
   * @param {Object} sessionData - Datos de la sesión
   * @returns {Object} Plan actualizado
   */
  async recordSession(userId, topicId, sessionData) {
    try {
      await this.db.read()

      const plan = this.db.data.plans?.[userId]
      if (!plan) {
        throw new Error("Plan not found")
      }

      const topic = plan.topics.find((t) => t.topicId === topicId)
      if (!topic) {
        throw new Error("Topic not found in plan")
      }

      const session = {
        sessionId: uuidv4(),
        startTime: sessionData.startTime || new Date().toISOString(),
        endTime: sessionData.endTime || new Date().toISOString(),
        durationMinutes: sessionData.durationMinutes || 0,
        type: sessionData.type || "study", // study, quiz, chat, review
        score: sessionData.score || null,
        completed: sessionData.completed !== false,
        notes: sessionData.notes || "",
        metadata: sessionData.metadata || {},
      }

      topic.sessions.push(session)

      // Actualizar estado del tema
      if (session.completed && topic.status === "pending") {
        topic.status = "in_progress"
      }

      // Actualizar estadísticas del plan
      plan.stats.totalSessions++
      plan.stats.totalMinutesStudied += session.durationMinutes
      plan.stats.lastStudyDate = session.startTime.split("T")[0]

      // Calcular racha de días
      this.updateStreak(plan)

      // Verificar si el tema está completado
      this.checkTopicCompletion(topic)

      plan.updatedAt = new Date().toISOString()

      this.db.data.plans[userId] = plan
      await this.db.write()

      console.log(`📋 Session recorded for user: ${userId}, topic: ${topicId}`)

      return plan
    } catch (error) {
      console.error("Error recording session:", error)
      throw error
    }
  }

  /**
   * Obtiene los temas programados para hoy
   * @param {string} userId - ID del usuario
   * @returns {Array} Temas programados para hoy
   */
  async getTodaysTopics(userId) {
    try {
      const plan = await this.getPlan(userId)
      if (!plan) return []

      const today = dayjs().format("YYYY-MM-DD")

      return plan.topics.filter((topic) => {
        return topic.targetDate === today && topic.status !== "completed"
      })
    } catch (error) {
      console.error("Error getting today's topics:", error)
      return []
    }
  }

  /**
   * Obtiene temas atrasados
   * @param {string} userId - ID del usuario
   * @returns {Array} Temas atrasados
   */
  async getOverdueTopics(userId) {
    try {
      const plan = await this.getPlan(userId)
      if (!plan) return []

      const today = dayjs().format("YYYY-MM-DD")

      return plan.topics.filter((topic) => {
        return dayjs(topic.targetDate).isBefore(today) && topic.status !== "completed"
      })
    } catch (error) {
      console.error("Error getting overdue topics:", error)
      return []
    }
  }

  /**
   * Obtiene próximos temas (siguientes 7 días)
   * @param {string} userId - ID del usuario
   * @returns {Array} Próximos temas
   */
  async getUpcomingTopics(userId) {
    try {
      const plan = await this.getPlan(userId)
      if (!plan) return []

      const today = dayjs()
      const nextWeek = today.add(7, "day")

      return plan.topics.filter((topic) => {
        const topicDate = dayjs(topic.targetDate)
        return topicDate.isAfter(today) && topicDate.isBefore(nextWeek) && topic.status !== "completed"
      })
    } catch (error) {
      console.error("Error getting upcoming topics:", error)
      return []
    }
  }

  /**
   * Actualiza la racha de días de estudio
   * @param {Object} plan - Plan del usuario
   */
  updateStreak(plan) {
    if (!plan.stats.lastStudyDate) {
      plan.stats.streakDays = 1
      return
    }

    const lastStudy = dayjs(plan.stats.lastStudyDate)
    const today = dayjs()

    if (lastStudy.isSame(today, "day")) {
      // Mismo día, mantener racha
      return
    } else if (lastStudy.add(1, "day").isSame(today, "day")) {
      // Día consecutivo, incrementar racha
      plan.stats.streakDays++
    } else {
      // Se rompió la racha
      plan.stats.streakDays = 1
    }
  }

  /**
   * Verifica si un tema está completado
   * @param {Object} topic - Tema a verificar
   */
  checkTopicCompletion(topic) {
    const completedSessions = topic.sessions.filter((s) => s.completed).length
    const hasQuizPassed = topic.sessions.some((s) => s.type === "quiz" && s.score >= 80)

    if (completedSessions >= 2 || hasQuizPassed) {
      topic.status = "completed"
    }
  }

  /**
   * Genera estadísticas del plan
   * @param {string} userId - ID del usuario
   * @returns {Object} Estadísticas detalladas
   */
  async getPlanStats(userId) {
    try {
      const plan = await this.getPlan(userId)
      if (!plan) return null

      const today = dayjs()
      const completedTopics = plan.topics.filter((t) => t.status === "completed").length
      const overdueTopics = plan.topics.filter(
        (t) => dayjs(t.targetDate).isBefore(today) && t.status !== "completed",
      ).length

      const weeklyMinutes = plan.topics
        .flatMap((t) => t.sessions)
        .filter((s) => dayjs(s.startTime).isAfter(today.subtract(7, "day")))
        .reduce((sum, s) => sum + s.durationMinutes, 0)

      return {
        ...plan.stats,
        completedTopics,
        overdueTopics,
        completionRate: Math.round((completedTopics / plan.stats.totalTopics) * 100),
        weeklyMinutes,
        averageSessionMinutes:
          plan.stats.totalSessions > 0 ? Math.round(plan.stats.totalMinutesStudied / plan.stats.totalSessions) : 0,
        planProgress: {
          total: plan.stats.totalTopics,
          completed: completedTopics,
          inProgress: plan.topics.filter((t) => t.status === "in_progress").length,
          pending: plan.topics.filter((t) => t.status === "pending").length,
        },
      }
    } catch (error) {
      console.error("Error getting plan stats:", error)
      return null
    }
  }

  /**
   * Genera recomendaciones de estudio basadas en el plan y progreso BKT
   * @param {string} userId - ID del usuario
   * @param {Object} bktProgress - Progreso BKT del usuario
   * @returns {Array} Recomendaciones
   */
  generateStudyRecommendations(plan, bktProgress) {
    const recommendations = []
    const today = dayjs()

    // Temas de hoy
    const todaysTopics = plan.topics.filter((t) => t.targetDate === today.format("YYYY-MM-DD"))
    if (todaysTopics.length > 0) {
      recommendations.push({
        type: "daily",
        priority: "high",
        title: "Temas programados para hoy",
        topics: todaysTopics.map((t) => t.topicId),
        action: "study",
      })
    }

    // Temas atrasados
    const overdueTopics = plan.topics.filter((t) => dayjs(t.targetDate).isBefore(today) && t.status !== "completed")
    if (overdueTopics.length > 0) {
      recommendations.push({
        type: "overdue",
        priority: "high",
        title: "Temas atrasados que necesitan atención",
        topics: overdueTopics.map((t) => t.topicId),
        action: "catch_up",
      })
    }

    // Temas con bajo progreso BKT
    if (bktProgress) {
      const weakTopics = Object.entries(bktProgress.proficiency)
        .filter(([_, data]) => data.probability < 0.4)
        .map(([topicId]) => topicId)
        .filter((topicId) => plan.topics.some((t) => t.topicId === topicId))

      if (weakTopics.length > 0) {
        recommendations.push({
          type: "reinforcement",
          priority: "medium",
          title: "Temas que necesitan refuerzo",
          topics: weakTopics,
          action: "practice",
        })
      }
    }

    return recommendations
  }
}
