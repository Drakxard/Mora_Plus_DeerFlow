#!/usr/bin/env node
/**
 * Script to reset all quiz data
 * Usage: npm run reset-quizzes
 */

import { initializeDatabase, resetQuizData } from "../src/model/database.js"

async function main() {
  try {
    console.log("🔄 Resetting quiz data...")

    await initializeDatabase()
    await resetQuizData()

    console.log("✅ Quiz data reset successfully!")
    console.log("All quiz data has been cleared.")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error resetting quiz data:", error)
    process.exit(1)
  }
}

main()
