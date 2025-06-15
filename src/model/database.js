/**
 * Database initialization and management for student data
 */

import { Low } from "lowdb"
import { JSONFile } from "lowdb/node"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { existsSync, mkdirSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "../..")

// Crear directorio de datos si no existe
const dataDir = join(projectRoot, "data")
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

// Configurar base de datos
const dbPath = join(dataDir, "students.json")
const adapter = new JSONFile(dbPath)
const db = new Low(adapter, { students: {}, quizzes: {} })

/**
 * Inicializa la base de datos
 */
export async function initializeDatabase() {
  await db.read()

  if (!db.data) {
    db.data = { students: {}, quizzes: {}, plans: {}, reminders: {} }
    await db.write()
  }

  // Asegurar que existan las estructuras necesarias
  if (!db.data.students) {
    db.data.students = {}
  }
  if (!db.data.quizzes) {
    db.data.quizzes = {}
  }
  if (!db.data.plans) {
    db.data.plans = {}
  }
  if (!db.data.reminders) {
    db.data.reminders = {}
  }

  await db.write()

  console.log(`📊 Database initialized at: ${dbPath}`)
  return db
}

/**
 * Obtiene la instancia de la base de datos
 */
export function getDatabase() {
  return db
}

/**
 * Resetea todos los datos de estudiantes
 */
export async function resetStudentData() {
  await db.read()
  db.data.students = {}
  await db.write()
  console.log("🔄 Student data reset successfully")
}

/**
 * Resetea todos los datos de quizzes
 */
export async function resetQuizData() {
  await db.read()
  db.data.quizzes = {}
  await db.write()
  console.log("🔄 Quiz data reset successfully")
}

/**
 * Resetea todos los datos de planes
 */
export async function resetPlanData() {
  await db.read()
  db.data.plans = {}
  db.data.reminders = {}
  await db.write()
  console.log("🔄 Plan data reset successfully")
}

/**
 * Resetea todos los datos
 */
export async function resetAllData() {
  await db.read()
  db.data = { students: {}, quizzes: {}, plans: {}, reminders: {} }
  await db.write()
  console.log("🔄 All data reset successfully")
}

/**
 * Exporta datos de estudiantes para backup
 */
export async function exportStudentData() {
  await db.read()
  return {
    exportDate: new Date().toISOString(),
    data: db.data,
  }
}

/**
 * Importa datos de estudiantes desde backup
 */
export async function importStudentData(backupData) {
  if (backupData && backupData.data) {
    db.data = backupData.data
    await db.write()
    console.log("📥 Student data imported successfully")
  } else {
    throw new Error("Invalid backup data format")
  }
}

/**
 * Obtiene estadísticas de la base de datos
 */
export async function getDatabaseStats() {
  await db.read()

  const studentCount = Object.keys(db.data.students || {}).length
  const quizCount = Object.keys(db.data.quizzes || {}).length
  const planCount = Object.keys(db.data.plans || {}).length

  const completedQuizzes = Object.values(db.data.quizzes || {}).filter((quiz) => quiz.status === "completed").length
  const activePlans = Object.values(db.data.plans || {}).filter((plan) => plan.status === "active").length

  return {
    students: studentCount,
    totalQuizzes: quizCount,
    completedQuizzes,
    activeQuizzes: quizCount - completedQuizzes,
    totalPlans: planCount,
    activePlans,
    lastUpdated: new Date().toISOString(),
  }
}
