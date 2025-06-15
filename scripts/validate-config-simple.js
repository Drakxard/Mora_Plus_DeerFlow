#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

console.log("🔧 Mora + DeerFlow Configuration Validator\n")

// Check if .env exists
const envPath = path.join(__dirname, "..", ".env")
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found!")
  console.log("💡 Create .env file with your configuration")
  process.exit(1)
}

console.log("✅ .env file found")

// Read .env file manually
const envContent = fs.readFileSync(envPath, "utf8")
const envVars = {}

// Parse .env file
envContent.split("\n").forEach((line) => {
  line = line.trim()
  if (line && !line.startsWith("#")) {
    const [key, ...valueParts] = line.split("=")
    if (key && valueParts.length > 0) {
      let value = valueParts.join("=").trim()
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      envVars[key.trim()] = value
    }
  }
})

console.log("✅ .env file parsed")

// Check critical variables
const critical = {
  GROQ_API_KEY: envVars.GROQ_API_KEY,
  APP_ENV: envVars.APP_ENV || "development",
}

const optional = {
  TAVILY_API_KEY: envVars.TAVILY_API_KEY,
  SEARCH_API: envVars.SEARCH_API || "tavily",
  DEBUG: envVars.DEBUG || "false",
  NEXT_PUBLIC_API_URL: envVars.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
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
