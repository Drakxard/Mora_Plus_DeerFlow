#!/usr/bin/env node
/**
 * Script to reset all data (students, quizzes, plans, reminders)
 * Usage: npm run reset-all
 */

import { initializeDatabase, resetAllData } from "../src/model/database.js"

async function main() {
  try {
    console.log("🔄 Resetting ALL data...")
    console.log("This will delete:")
    console.log("- Student progress data")
    console.log("- Quiz data")
    console.log("- Study plans")
    console.log("- Reminder history")
    console.log("- Human review data")

    await initializeDatabase()
    await resetAllData()

    console.log("✅ All data reset successfully!")
    console.log("The system has been restored to initial state.")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error resetting all data:", error)
    process.exit(1)
  }
}

main()
