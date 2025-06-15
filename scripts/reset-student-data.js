#!/usr/bin/env node
/**
 * Script to reset all student data
 * Usage: npm run reset-progress
 */

import { initializeDatabase, resetStudentData } from "../src/model/database.js"

async function main() {
  try {
    console.log("🔄 Resetting student data...")

    await initializeDatabase()
    await resetStudentData()

    console.log("✅ Student data reset successfully!")
    console.log("All student progress has been cleared.")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error resetting student data:", error)
    process.exit(1)
  }
}

main()
