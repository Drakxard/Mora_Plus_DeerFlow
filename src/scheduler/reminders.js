/**
 * Study Reminders Scheduler for Mora + DeerFlow
 * Manages daily reminders and notifications for study plans
 */

import cron from "node-cron"
import dayjs from "dayjs"
import { PlanModel } from "../planner/planModel.js"
import { getDatabase } from "../model/database.js"

/**
 * Clase para gestionar recordatorios de estudio
 */
export class ReminderScheduler {
  constructor() {
    this.planModel = null
    this.scheduledJobs = new Map()
    this.isInitialized = false
  }

  /**
   * Inicializa el scheduler de recordatorios
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      const db = getDatabase()
      this.planModel = new PlanModel(db)

      // Programar job diario por defecto (8:00 AM)
      this.scheduleDefaultReminder()

      // Programar jobs personalizados para usuarios existentes
      await this.scheduleUserReminders()

      this.isInitialized = true
      console.log("📅 Reminder scheduler initialized successfully")
    } catch (error) {
      console.error("Error initializing reminder scheduler:", error)
    }
  }

  /**
   * Programa el recordatorio diario por defecto
   */
  scheduleDefaultReminder() {
    // Ejecutar todos los días a las 8:00 AM
    const defaultJob = cron.schedule(
      "0 8 * * *",
      async () => {
        console.log("📅 Running daily reminder check...")
        await this.sendDailyReminders()
      },
      {
        scheduled: true,
        timezone: "America/Mexico_City", // Ajustar según necesidad
      },
    )

    this.scheduledJobs.set("default", defaultJob)
    console.log("📅 Default daily reminder scheduled for 8:00 AM")
  }

  /**
   * Programa recordatorios personalizados para usuarios
   */
  async scheduleUserReminders() {
    try {
      const db = getDatabase()
      await db.read()

      if (!db.data.plans) return

      const users = Object.keys(db.data.plans)
      console.log(`📅 Scheduling reminders for ${users.length} users`)

      for (const userId of users) {
        const plan = db.data.plans[userId]
        if (plan.settings.reminderEnabled && plan.status === "active") {
          this.scheduleUserReminder(userId, plan.settings.reminderTime)
        }
      }
    } catch (error) {
      console.error("Error scheduling user reminders:", error)
    }
  }

  /**
   * Programa un recordatorio personalizado para un usuario
   * @param {string} userId - ID del usuario
   * @param {string} reminderTime - Hora del recordatorio (HH:MM)
   */
  scheduleUserReminder(userId, reminderTime) {
    try {
      // Cancelar job anterior si existe
      if (this.scheduledJobs.has(userId)) {
        this.scheduledJobs.get(userId).stop()
        this.scheduledJobs.delete(userId)
      }

      const [hour, minute] = reminderTime.split(":")
      const cronExpression = `${minute} ${hour} * * *`

      const userJob = cron.schedule(
        cronExpression,
        async () => {
          console.log(`📅 Sending personalized reminder to user: ${userId}`)
          await this.sendUserReminder(userId)
        },
        {
          scheduled: true,
          timezone: "America/Mexico_City",
        },
      )

      this.scheduledJobs.set(userId, userJob)
      console.log(`📅 Personalized reminder scheduled for user ${userId} at ${reminderTime}`)
    } catch (error) {
      console.error(`Error scheduling reminder for user ${userId}:`, error)
    }
  }

  /**
   * Cancela el recordatorio de un usuario
   * @param {string} userId - ID del usuario
   */
  cancelUserReminder(userId) {
    if (this.scheduledJobs.has(userId)) {
      this.scheduledJobs.get(userId).stop()
      this.scheduledJobs.delete(userId)
      console.log(`📅 Reminder cancelled for user: ${userId}`)
    }
  }

  /**
   * Envía recordatorios diarios a todos los usuarios
   */
  async sendDailyReminders() {
    try {
      const db = getDatabase()
      await db.read()

      if (!db.data.plans) return

      const users = Object.keys(db.data.plans)
      let remindersSent = 0

      for (const userId of users) {
        const plan = db.data.plans[userId]

        // Solo enviar si está activo y no tiene recordatorio personalizado
        if (plan.status === "active" && plan.settings.reminderEnabled && !this.scheduledJobs.has(userId)) {
          await this.sendUserReminder(userId)
          remindersSent++
        }
      }

      console.log(`📅 Daily reminders sent to ${remindersSent} users`)
    } catch (error) {
      console.error("Error sending daily reminders:", error)
    }
  }

  /**
   * Envía recordatorio a un usuario específico
   * @param {string} userId - ID del usuario
   */
  async sendUserReminder(userId) {
    try {
      if (!this.planModel) return

      const todaysTopics = await this.planModel.getTodaysTopics(userId)
      const overdueTopics = await this.planModel.getOverdueTopics(userId)
      const plan = await this.planModel.getPlan(userId)

      if (!plan) return

      const totalTopics = todaysTopics.length + overdueTopics.length

      if (totalTopics === 0) {
        console.log(`📅 No topics scheduled for user ${userId} today`)
        return
      }

      // Generar mensaje de recordatorio
      const reminder = this.generateReminderMessage(userId, plan, todaysTopics, overdueTopics)

      // Enviar recordatorio (por ahora solo log, pero se puede extender)
      await this.deliverReminder(userId, reminder)

      console.log(`📅 Reminder sent to user ${userId}: ${totalTopics} topics`)
    } catch (error) {
      console.error(`Error sending reminder to user ${userId}:`, error)
    }
  }

  /**
   * Genera el mensaje de recordatorio
   * @param {string} userId - ID del usuario
   * @param {Object} plan - Plan del usuario
   * @param {Array} todaysTopics - Temas de hoy
   * @param {Array} overdueTopics - Temas atrasados
   * @returns {Object} Mensaje de recordatorio
   */
  generateReminderMessage(userId, plan, todaysTopics, overdueTopics) {
    const today = dayjs().format("dddd, MMMM D, YYYY")
    const totalTopics = todaysTopics.length + overdueTopics.length

    let message = `🌅 ¡Buenos días! Es hora de estudiar.\n\n`
    message += `📅 Hoy es ${today}\n`
    message += `📚 Plan: ${plan.title}\n\n`

    if (todaysTopics.length > 0) {
      message += `📖 Temas programados para hoy (${todaysTopics.length}):\n`
      todaysTopics.forEach((topic, index) => {
        message += `${index + 1}. ${topic.topicName} (${topic.estimatedMinutes} min)\n`
      })
      message += `\n`
    }

    if (overdueTopics.length > 0) {
      message += `⚠️ Temas atrasados (${overdueTopics.length}):\n`
      overdueTopics.forEach((topic, index) => {
        const daysOverdue = dayjs().diff(dayjs(topic.targetDate), "day")
        message += `${index + 1}. ${topic.topicName} (${daysOverdue} día${daysOverdue > 1 ? "s" : ""} atrasado)\n`
      })
      message += `\n`
    }

    message += `💪 ¡Vamos! Tu progreso te está esperando.\n`
    message += `🎯 Racha actual: ${plan.stats.streakDays} día${plan.stats.streakDays !== 1 ? "s" : ""}`

    return {
      userId,
      type: "daily_reminder",
      title: "📚 Recordatorio de Estudio",
      message,
      topics: {
        today: todaysTopics,
        overdue: overdueTopics,
      },
      stats: {
        totalTopics,
        todayCount: todaysTopics.length,
        overdueCount: overdueTopics.length,
        streakDays: plan.stats.streakDays,
      },
      timestamp: new Date().toISOString(),
      actionUrl: `http://localhost:3000/?userId=${userId}&action=study`,
    }
  }

  /**
   * Entrega el recordatorio al usuario
   * @param {string} userId - ID del usuario
   * @param {Object} reminder - Mensaje de recordatorio
   */
  async deliverReminder(userId, reminder) {
    try {
      // Por ahora solo log en consola
      // En el futuro se puede extender para:
      // - Enviar email
      // - Push notifications
      // - Webhook a sistema externo
      // - Guardar en base de datos para mostrar en UI

      console.log(`\n${"=".repeat(60)}`)
      console.log(`📅 RECORDATORIO DE ESTUDIO`)
      console.log(`Usuario: ${userId}`)
      console.log(`Hora: ${dayjs().format("HH:mm:ss")}`)
      console.log(`${"=".repeat(60)}`)
      console.log(reminder.message)
      console.log(`${"=".repeat(60)}\n`)

      // Guardar recordatorio en base de datos para historial
      await this.saveReminderHistory(reminder)

      // Aquí se pueden añadir otros métodos de entrega:
      // await this.sendEmail(userId, reminder)
      // await this.sendPushNotification(userId, reminder)
      // await this.callWebhook(userId, reminder)
    } catch (error) {
      console.error(`Error delivering reminder to user ${userId}:`, error)
    }
  }

  /**
   * Guarda el historial de recordatorios
   * @param {Object} reminder - Recordatorio a guardar
   */
  async saveReminderHistory(reminder) {
    try {
      const db = getDatabase()
      await db.read()

      if (!db.data.reminders) {
        db.data.reminders = {}
      }

      if (!db.data.reminders[reminder.userId]) {
        db.data.reminders[reminder.userId] = []
      }

      // Mantener solo los últimos 30 recordatorios por usuario
      db.data.reminders[reminder.userId].push(reminder)
      if (db.data.reminders[reminder.userId].length > 30) {
        db.data.reminders[reminder.userId] = db.data.reminders[reminder.userId].slice(-30)
      }

      await db.write()
    } catch (error) {
      console.error("Error saving reminder history:", error)
    }
  }

  /**
   * Obtiene el historial de recordatorios de un usuario
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de recordatorios a devolver
   * @returns {Array} Historial de recordatorios
   */
  async getReminderHistory(userId, limit = 10) {
    try {
      const db = getDatabase()
      await db.read()

      const reminders = db.data.reminders?.[userId] || []
      return reminders.slice(-limit).reverse() // Más recientes primero
    } catch (error) {
      console.error("Error getting reminder history:", error)
      return []
    }
  }

  /**
   * Actualiza la configuración de recordatorios de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} settings - Nueva configuración
   */
  async updateUserReminderSettings(userId, settings) {
    try {
      const plan = await this.planModel.getPlan(userId)
      if (!plan) return

      // Actualizar configuración en el plan
      await this.planModel.updatePlan(userId, { settings })

      // Reprogramar recordatorio
      if (settings.reminderEnabled && settings.reminderTime) {
        this.scheduleUserReminder(userId, settings.reminderTime)
      } else {
        this.cancelUserReminder(userId)
      }

      console.log(`📅 Reminder settings updated for user: ${userId}`)
    } catch (error) {
      console.error(`Error updating reminder settings for user ${userId}:`, error)
    }
  }

  /**
   * Detiene todos los recordatorios
   */
  stopAllReminders() {
    console.log("📅 Stopping all reminders...")

    for (const [jobId, job] of this.scheduledJobs) {
      job.stop()
      console.log(`📅 Stopped reminder job: ${jobId}`)
    }

    this.scheduledJobs.clear()
    this.isInitialized = false

    console.log("📅 All reminders stopped")
  }

  /**
   * Obtiene estadísticas de recordatorios
   * @returns {Object} Estadísticas
   */
  getSchedulerStats() {
    return {
      isInitialized: this.isInitialized,
      activeJobs: this.scheduledJobs.size,
      jobIds: Array.from(this.scheduledJobs.keys()),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}

// Instancia global del scheduler
let reminderScheduler = null

/**
 * Obtiene la instancia del scheduler
 * @returns {ReminderScheduler} Instancia del scheduler
 */
export function getReminderScheduler() {
  if (!reminderScheduler) {
    reminderScheduler = new ReminderScheduler()
  }
  return reminderScheduler
}

/**
 * Inicializa el scheduler de recordatorios
 */
export async function initializeReminders() {
  const scheduler = getReminderScheduler()
  await scheduler.initialize()
  return scheduler
}
