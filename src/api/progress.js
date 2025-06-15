import express from "express"
import { StudentManager } from "../model/bkt.js"
import { getDatabase } from "../model/database.js"
import { getRecommendedTopics, getAllTopics } from "../model/topics.js"

const router = express.Router()

// Inicializar gestor de estudiantes
let studentManager = null

async function initializeStudentManager() {
  if (!studentManager) {
    const db = getDatabase()
    studentManager = new StudentManager(db)
  }
  return studentManager
}

// GET /progress?userId=... - Obtener progreso del estudiante
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
        example: "/progress?userId=user123",
      })
    }

    console.log(`📊 Getting progress for user: ${userId}`)

    const manager = await initializeStudentManager()
    const proficiency = await manager.getProficiency(userId)
    const stats = await manager.getStudentStats(userId)
    const recommendations = getRecommendedTopics(
      Object.fromEntries(Object.entries(proficiency.proficiency).map(([key, value]) => [key, value.probability])),
    )

    res.json({
      ...proficiency,
      stats,
      recommendations,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Progress error:", error)
    res.status(500).json({
      error: "Error retrieving student progress",
      message: error.message,
    })
  }
})

// POST /progress/update - Actualizar progreso manualmente
router.post("/update", async (req, res) => {
  try {
    const { userId, topicId, correct, metadata } = req.body

    if (!userId || !topicId || typeof correct !== "boolean") {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["userId", "topicId", "correct"],
        example: {
          userId: "user123",
          topicId: "introduction",
          correct: true,
          metadata: { source: "quiz", questionId: "q1" },
        },
      })
    }

    console.log(`📈 Updating progress: ${userId} - ${topicId} - ${correct}`)

    const manager = await initializeStudentManager()
    const result = await manager.updateModel(userId, topicId, correct, metadata)

    res.json({
      success: true,
      update: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Progress update error:", error)
    res.status(500).json({
      error: "Error updating student progress",
      message: error.message,
    })
  }
})

// GET /progress/stats?userId=... - Obtener estadísticas detalladas
router.get("/stats", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const manager = await initializeStudentManager()
    const stats = await manager.getStudentStats(userId)

    if (!stats) {
      return res.status(404).json({
        error: "Student not found",
        message: "Initialize student progress first",
      })
    }

    res.json(stats)
  } catch (error) {
    console.error("Stats error:", error)
    res.status(500).json({
      error: "Error retrieving student statistics",
      message: error.message,
    })
  }
})

// GET /progress/topics - Obtener información de todos los temas
router.get("/topics", (req, res) => {
  try {
    const topics = getAllTopics()
    res.json({
      topics,
      totalTopics: topics.length,
    })
  } catch (error) {
    console.error("Topics error:", error)
    res.status(500).json({
      error: "Error retrieving topics",
      message: error.message,
    })
  }
})

// POST /progress/reset?userId=... - Resetear progreso de un estudiante
router.post("/reset", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    const manager = await initializeStudentManager()
    const db = getDatabase()

    await db.read()
    if (db.data.students[userId]) {
      delete db.data.students[userId]
      await db.write()
    }

    // Reinicializar estudiante
    await manager.initializeStudent(userId)

    res.json({
      success: true,
      message: `Progress reset for user ${userId}`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Reset error:", error)
    res.status(500).json({
      error: "Error resetting student progress",
      message: error.message,
    })
  }
})

export { router as progressRoute }
