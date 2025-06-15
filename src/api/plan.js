import express from "express"
import Ajv from "ajv"
import { PlanModel } from "../planner/planModel.js"
import { StudentManager } from "../model/bkt.js"
import { getDatabase } from "../model/database.js"
import { getAllTopics, getTopicInfo } from "../model/topics.js"
import dayjs from "dayjs"

const router = express.Router()

// Configurar validador AJV
const ajv = new Ajv()

// Esquemas de validación
const createPlanSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicId: { type: "string", minLength: 1 },
          daysAhead: { type: "integer", minimum: 0, maximum: 365 },
          targetDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          estimatedMinutes: { type: "integer", minimum: 5, maximum: 480 },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
        },
        required: ["topicId"],
        additionalProperties: false,
      },
      minItems: 1,
    },
    title: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 500 },
    settings: {
      type: "object",
      properties: {
        reminderTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        reminderEnabled: { type: "boolean" },
        autoAdvance: { type: "boolean" },
        weekendsIncluded: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  required: ["userId", "topics"],
  additionalProperties: false,
}

const updatePlanSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    title: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 500 },
    status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicId: { type: "string", minLength: 1 },
          targetDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "skipped"] },
          estimatedMinutes: { type: "integer", minimum: 5, maximum: 480 },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
        },
        required: ["topicId"],
        additionalProperties: false,
      },
    },
    settings: {
      type: "object",
      properties: {
        reminderTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        reminderEnabled: { type: "boolean" },
        autoAdvance: { type: "boolean" },
        weekendsIncluded: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  required: ["userId"],
  additionalProperties: false,
}

const sessionSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    topicId: { type: "string", minLength: 1 },
    durationMinutes: { type: "integer", minimum: 1, maximum: 480 },
    type: { type: "string", enum: ["study", "quiz", "chat", "review"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    completed: { type: "boolean" },
    notes: { type: "string", maxLength: 500 },
    metadata: { type: "object" },
  },
  required: ["userId", "topicId"],
  additionalProperties: false,
}

const validateCreatePlan = ajv.compile(createPlanSchema)
const validateUpdatePlan = ajv.compile(updatePlanSchema)
const validateSession = ajv.compile(sessionSchema)

// Inicializar componentes
let planModel = null
let studentManager = null

async function initializeComponents() {
  if (!planModel) {
    const db = getDatabase()
    planModel = new PlanModel(db)
  }

  if (!studentManager) {
    const db = getDatabase()
    studentManager = new StudentManager(db)
  }

  return { planModel, studentManager }
}

// GET /plan - Get user study plan
router.get("/", (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({
      error: 'Query parameter "userId" is required',
      example: "/plan?userId=user123",
    })
  }

  // TODO: Implement actual study planning
  res.json({
    userId,
    plan: {
      currentWeek: 1,
      totalWeeks: 8,
      dailyGoals: [
        { day: "Monday", topic: "JavaScript Basics", duration: 60, completed: true },
        { day: "Tuesday", topic: "Functions", duration: 45, completed: false },
        { day: "Wednesday", topic: "Arrays", duration: 50, completed: false },
      ],
    },
    timestamp: new Date().toISOString(),
  })
})

// POST /plan - Crear nuevo plan de estudio
router.post("/", async (req, res) => {
  try {
    // Validar entrada
    if (!validateCreatePlan(req.body)) {
      return res.status(400).json({
        error: "Invalid plan data",
        details: validateCreatePlan.errors,
        example: {
          userId: "demo-user",
          topics: [
            {
              topicId: "introduction",
              daysAhead: 1,
              estimatedMinutes: 30,
              priority: "high",
            },
            {
              topicId: "intermediate",
              targetDate: "2024-01-20",
              estimatedMinutes: 45,
            },
          ],
          title: "Mi Plan de Estudio",
          settings: {
            reminderTime: "08:00",
            reminderEnabled: true,
          },
        },
      })
    }

    const { userId, topics, title, description, settings } = req.body

    console.log(`📋 Creating study plan for user: ${userId}`)

    const { planModel: model } = await initializeComponents()

    // Crear plan
    const plan = await model.createPlan(userId, topics, {
      title,
      description,
      ...settings,
    })

    res.json({
      success: true,
      plan: {
        planId: plan.planId,
        userId: plan.userId,
        title: plan.title,
        description: plan.description,
        topics: plan.topics,
        settings: plan.settings,
        stats: plan.stats,
        createdAt: plan.createdAt,
        status: plan.status,
      },
      message: `Plan creado con ${plan.topics.length} temas`,
    })
  } catch (error) {
    console.error("Error creating plan:", error)

    let errorMessage = "Error creating study plan"
    if (error.message.includes("Topic") && error.message.includes("not found")) {
      errorMessage = "Uno o más temas especificados no existen"
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
    })
  }
})

// PUT /plan - Actualizar plan de estudio
router.put("/", async (req, res) => {
  try {
    // Validar entrada
    if (!validateUpdatePlan(req.body)) {
      return res.status(400).json({
        error: "Invalid update data",
        details: validateUpdatePlan.errors,
        example: {
          userId: "demo-user",
          title: "Mi Plan Actualizado",
          topics: [
            {
              topicId: "introduction",
              targetDate: "2024-01-25",
              status: "completed",
            },
          ],
          settings: {
            reminderTime: "09:00",
          },
        },
      })
    }

    const { userId, ...modifications } = req.body

    console.log(`📋 Updating study plan for user: ${userId}`)

    const { planModel: model } = await initializeComponents()

    const updatedPlan = await model.updatePlan(userId, modifications)

    res.json({
      success: true,
      plan: {
        planId: updatedPlan.planId,
        userId: updatedPlan.userId,
        title: updatedPlan.title,
        description: updatedPlan.description,
        topics: updatedPlan.topics,
        settings: updatedPlan.settings,
        stats: updatedPlan.stats,
        status: updatedPlan.status,
        updatedAt: updatedPlan.updatedAt,
      },
      message: "Plan actualizado correctamente",
    })
  } catch (error) {
    console.error("Error updating plan:", error)

    const errorMessage = "Error updating study plan"
    if (error.message === "Plan not found") {
      return res.status(404).json({
        error: "Study plan not found",
        message: "Create a study plan first",
      })
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
    })
  }
})

// DELETE /plan - Eliminar plan de estudio
router.delete("/", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    console.log(`📋 Deleting study plan for user: ${userId}`)

    const { planModel: model } = await initializeComponents()

    const deleted = await model.deletePlan(userId)

    if (!deleted) {
      return res.status(404).json({
        error: "Study plan not found",
        userId,
      })
    }

    res.json({
      success: true,
      message: "Study plan deleted successfully",
      userId,
    })
  } catch (error) {
    console.error("Error deleting plan:", error)
    res.status(500).json({
      error: "Error deleting study plan",
      details: error.message,
    })
  }
})

// POST /plan/session - Registrar sesión de estudio
router.post("/session", async (req, res) => {
  try {
    // Validar entrada
    if (!validateSession(req.body)) {
      return res.status(400).json({
        error: "Invalid session data",
        details: validateSession.errors,
        example: {
          userId: "demo-user",
          topicId: "introduction",
          durationMinutes: 30,
          type: "study",
          completed: true,
          notes: "Revisé conceptos básicos",
        },
      })
    }

    const { userId, topicId, ...sessionData } = req.body

    console.log(`📋 Recording study session: ${userId} - ${topicId}`)

    const { planModel: model } = await initializeComponents()

    const updatedPlan = await model.recordSession(userId, topicId, {
      ...sessionData,
      startTime: sessionData.startTime || new Date().toISOString(),
      endTime: sessionData.endTime || new Date().toISOString(),
    })

    // Obtener estadísticas actualizadas
    const stats = await model.getPlanStats(userId)

    res.json({
      success: true,
      message: "Study session recorded successfully",
      stats,
      topicStatus: updatedPlan.topics.find((t) => t.topicId === topicId)?.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error recording session:", error)

    let errorMessage = "Error recording study session"
    if (error.message === "Plan not found") {
      errorMessage = "Study plan not found"
    } else if (error.message === "Topic not found in plan") {
      errorMessage = "Topic not found in study plan"
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
    })
  }
})

// GET /plan/today - Obtener temas de hoy
router.get("/today", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const { planModel: model, studentManager: manager } = await initializeComponents()

    const todaysTopics = await model.getTodaysTopics(userId)
    const overdueTopics = await model.getOverdueTopics(userId)

    // Obtener progreso BKT para cada tema
    let bktProgress = null
    try {
      bktProgress = await manager.getProficiency(userId)
    } catch (error) {
      console.warn("Could not get BKT progress:", error.message)
    }

    const enrichedTopics = [...todaysTopics, ...overdueTopics].map((topic) => {
      const topicInfo = getTopicInfo(topic.topicId)
      const progress = bktProgress?.proficiency[topic.topicId]

      return {
        ...topic,
        topicInfo,
        bktProgress: progress
          ? {
              probability: progress.probability,
              masteryLevel: progress.masteryLevel,
              predictedCorrectness: progress.predictedCorrectness,
            }
          : null,
        isOverdue: overdueTopics.some((t) => t.topicId === topic.topicId),
      }
    })

    res.json({
      date: dayjs().format("YYYY-MM-DD"),
      topics: enrichedTopics,
      summary: {
        total: enrichedTopics.length,
        today: todaysTopics.length,
        overdue: overdueTopics.length,
      },
    })
  } catch (error) {
    console.error("Error getting today's topics:", error)
    res.status(500).json({
      error: "Error retrieving today's topics",
      details: error.message,
    })
  }
})

// GET /plan/stats - Obtener estadísticas del plan
router.get("/stats", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const { planModel: model } = await initializeComponents()

    const stats = await model.getPlanStats(userId)

    if (!stats) {
      return res.status(404).json({
        error: "Study plan not found",
        userId,
      })
    }

    res.json({
      userId,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting plan stats:", error)
    res.status(500).json({
      error: "Error retrieving plan statistics",
      details: error.message,
    })
  }
})

// GET /plan/topics - Obtener temas disponibles para planificación
router.get("/topics", (req, res) => {
  try {
    const topics = getAllTopics().map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      difficulty: topic.difficulty,
      color: topic.color,
      prerequisites: topic.prerequisites,
      estimatedMinutes: 30, // Default
    }))

    res.json({
      topics,
      totalTopics: topics.length,
    })
  } catch (error) {
    console.error("Error retrieving plan topics:", error)
    res.status(500).json({
      error: "Error retrieving plan topics",
      details: error.message,
    })
  }
})

export { router as planRoute }
