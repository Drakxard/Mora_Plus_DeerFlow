#!/usr/bin/env node

import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { existsSync } from "fs"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, "..")

console.log("🔧 Mora + DeerFlow Configuration Validator\n")

// Check if .env exists
const envPath = join(rootDir, ".env")
if (!existsSync(envPath)) {
  console.error("❌ .env file not found!")
  console.log("💡 Run: cp .env.example .env")
  process.exit(1)
}

// Load environment variables
dotenv.config({ path: envPath })

console.log("✅ .env file found and loaded")

// Check critical variables
const critical = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  APP_ENV: process.env.APP_ENV || "development",
}

const optional = {
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  SEARCH_API: process.env.SEARCH_API || "tavily",
  DEBUG: process.env.DEBUG || "false",
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
}

console.log("\n🔑 Critical Configuration:")
let hasErrors = false

for (const [key, value] of Object.entries(critical)) {
  if (!value || value === "xxx") {
    console.log(`   ❌ ${key}: Missing or invalid`)
    hasErrors = true
  } else {
    console.log(`   ✅ ${key}: Configured`)
  }
}

console.log("\n⚙️  Optional Configuration:")
for (const [key, value] of Object.entries(optional)) {
  if (!value || value === "xxx") {
    console.log(`   ⚠️  ${key}: Not configured (using defaults)`)
  } else {
    console.log(`   ✅ ${key}: ${value}`)
  }
}

console.log("\n🎯 Feature Status:")
console.log(`   Chat & Agents: ${critical.GROQ_API_KEY ? "✅ Enabled" : "❌ Disabled (missing GROQ_API_KEY)"}`)
console.log(`   Search: ${optional.TAVILY_API_KEY ? "✅ Enhanced" : "⚠️  Basic (missing TAVILY_API_KEY)"}`)
console.log(`   Environment: ${critical.APP_ENV}`)
console.log(`   Debug Mode: ${optional.DEBUG}`)

// Check port configuration
const apiUrl = optional.NEXT_PUBLIC_API_URL
if (apiUrl.includes(":8000")) {
  console.log("\n⚠️  Port Configuration:")
  console.log("   Your NEXT_PUBLIC_API_URL uses port 8000")
  console.log("   Mora + DeerFlow runs on port 3000 by default")
  console.log("   Consider changing to: http://localhost:3000/api")
}

if (hasErrors) {
  console.log("\n❌ Configuration has errors!")
  console.log("\n🔧 Quick fixes:")
  console.log("   1. Set your GROQ_API_KEY in .env")
  console.log("   2. Optionally set TAVILY_API_KEY for better search")
  process.exit(1)
} else {
  console.log("\n✅ Configuration validation passed!")
  console.log("\n🚀 Ready to start Mora + DeerFlow!")
  console.log("   Run: npm start")
}
