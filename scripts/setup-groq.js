#!/usr/bin/env node

/**
 * Groq Setup Script for Mora + DeerFlow
 * Validates Groq configuration and tests API connectivity
 */

import { groqConfig, modelConfigs, handleGroqError } from "../src/config/groq.js"
import { generateText } from "ai"

async function validateGroqSetup() {
  console.log("🔧 Validating Groq configuration for Mora + DeerFlow...")
  console.log("=".repeat(60))

  // Check environment variables
  console.log("📋 Checking environment variables...")
  const requiredVars = ["GROQ_API_KEY"]
  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:")
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.log("\n💡 Please set these variables in your .env file")
    process.exit(1)
  }

  console.log("✅ All required environment variables are set")

  // Display configuration
  console.log("\n⚙️  Current Groq configuration:")
  console.log(`   Model: ${groqConfig.model}`)
  console.log(`   Base URL: ${groqConfig.baseUrl}`)
  console.log(`   Tool Calling: ${groqConfig.useToolCalling}`)
  console.log(`   Max Tokens: ${groqConfig.maxTokens}`)
  console.log(`   Temperature: ${groqConfig.temperature}`)

  // Test API connectivity
  console.log("\n🔌 Testing Groq API connectivity...")

  try {
    const testPrompt =
      "Hello! Please respond with 'Groq API is working correctly for Mora + DeerFlow' to confirm connectivity."

    const { text } = await generateText({
      model: modelConfigs.chat.model,
      prompt: testPrompt,
      maxTokens: 50,
      temperature: 0.1,
    })

    console.log("✅ Groq API connectivity test successful!")
    console.log(`   Response: ${text.substring(0, 100)}...`)
  } catch (error) {
    console.error("❌ Groq API connectivity test failed:")
    const errorInfo = handleGroqError(error)
    console.error(`   ${errorInfo.message}`)

    if (errorInfo.details) {
      console.error(`   Details: ${errorInfo.details}`)
    }

    console.log("\n💡 Troubleshooting tips:")
    console.log("   1. Verify your GROQ_API_KEY is correct")
    console.log("   2. Check your internet connection")
    console.log("   3. Ensure you have Groq API credits available")
    console.log("   4. Try again in a few minutes if rate limited")

    process.exit(1)
  }

  // Test different model configurations
  console.log("\n🧪 Testing model configurations...")

  const testConfigs = [
    { name: "Chat", config: modelConfigs.chat },
    { name: "Quiz", config: modelConfigs.quiz },
    { name: "Academic", config: modelConfigs.academic },
  ]

  for (const { name, config } of testConfigs) {
    try {
      const { text } = await generateText({
        model: config.model,
        prompt: `Test ${name.toLowerCase()} configuration. Respond with "OK".`,
        maxTokens: 10,
        temperature: config.temperature,
      })

      console.log(`   ✅ ${name} configuration: Working`)
    } catch (error) {
      console.log(`   ⚠️  ${name} configuration: ${error.message}`)
    }
  }

  // Performance recommendations
  console.log("\n🚀 Performance recommendations:")
  console.log("   • Enable caching for better response times")
  console.log("   • Use batching for multiple requests")
  console.log("   • Monitor rate limits (30 RPM for free tier)")
  console.log("   • Consider upgrading to Groq Pro for higher limits")

  console.log("\n🎉 Groq setup validation completed successfully!")
  console.log("   Your Mora + DeerFlow system is ready to use with Groq/Llama")
  console.log("\n🚀 Next steps:")
  console.log("   1. Run 'npm run index:fast' to generate embeddings")
  console.log("   2. Run 'npm run dev' to start development server")
  console.log("   3. Run 'npm test' to verify all systems")
}

// Run validation
validateGroqSetup().catch((error) => {
  console.error("💥 Setup validation failed:", error.message)
  process.exit(1)
})
