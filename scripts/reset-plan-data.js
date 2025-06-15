#!/usr/bin/env node
/**
 * Script to reset all plan data
 * Usage: npm run reset-plans
 */

import { initializeDatabase, resetPlanData } from "../src/model/database.js"

async function main() {
  try {
    console.log("🔄 Resetting plan data...")

    await initializeDatabase()
    await resetPlanData()

    console.log("✅ Plan data reset successfully!")
    console.log("All study plans and reminders have been cleared.")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error resetting plan data:", error)
    process.exit(1)
  }
}

main()
