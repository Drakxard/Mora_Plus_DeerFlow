#!/usr/bin/env node

import { modelSelector } from "../src/config/model-selector.js"
import { validateGroqConfig } from "../src/config/groq.js"

/**
 * Model Management CLI Tool
 */
class ModelManager {
  async run() {
    const command = process.argv[2]

    switch (command) {
      case "scan":
        await this.scanModels()
        break
      case "select":
        await this.selectModels()
        break
      case "status":
        await this.showStatus()
        break
      case "test":
        await this.testModels()
        break
      case "benchmark":
        await this.benchmarkModels()
        break
      default:
        this.showHelp()
    }
  }

  async scanModels() {
    console.log("🔍 Scanning available models...")
    const models = await modelSelector.scanAvailableModels()

    console.log(`\n✅ Found ${models.length} available models`)
    return models
  }

  async selectModels() {
    console.log("🎯 Selecting optimal models...")
    const selections = await modelSelector.selectOptimalModels()

    console.log("\n📋 Optimal model selections:")
    Object.entries(selections).forEach(([task, info]) => {
      console.log(`\n🎯 ${task.toUpperCase()}:`)
      console.log(`   Model: ${info.model}`)
      console.log(`   Score: ${info.score}`)
      console.log(`   Reason: ${info.reason}`)
      console.log(`   Speed: ${info.capabilities.speed}/10`)
      console.log(`   Quality: ${info.capabilities.quality}/10`)
    })

    return selections
  }

  async showStatus() {
    console.log("📊 Model Selector Status:")
    const status = modelSelector.getStatus()

    console.log(`\n🤖 Available Models: ${status.availableModels.length}`)
    status.availableModels.forEach((model) => {
      console.log(`   - ${model}`)
    })

    console.log(`\n🎯 Selected Models:`)
    Object.entries(status.selectedModels).forEach(([task, model]) => {
      console.log(`   ${task}: ${model}`)
    })

    console.log(`\n⏰ Last Scan: ${status.lastScan || "Never"}`)
    console.log(`📈 Known Models: ${status.totalKnownModels}`)
  }

  async testModels() {
    console.log("🧪 Testing model connectivity...")

    const config = validateGroqConfig()
    if (!config.valid) {
      console.error("❌ Invalid Groq configuration:")
      config.issues.forEach((issue) => console.error(`   - ${issue}`))
      return
    }

    const models = await modelSelector.scanAvailableModels()

    for (const model of models.slice(0, 3)) {
      // Test first 3 models
      console.log(`\n🔬 Testing ${model}...`)
      const works = await modelSelector.testModel(model)
      console.log(`   ${works ? "✅" : "❌"} ${model}: ${works ? "Working" : "Failed"}`)
    }
  }

  async benchmarkModels() {
    console.log("⚡ Benchmarking model performance...")

    const testPrompt = "Explain quantum computing in simple terms."
    const models = await modelSelector.scanAvailableModels()

    for (const model of models.slice(0, 2)) {
      // Benchmark first 2 models
      console.log(`\n⏱️ Benchmarking ${model}...`)

      const startTime = Date.now()
      try {
        const works = await modelSelector.testModel(model)
        const endTime = Date.now()

        if (works) {
          console.log(`   ✅ ${model}: ${endTime - startTime}ms`)
        } else {
          console.log(`   ❌ ${model}: Failed`)
        }
      } catch (error) {
        console.log(`   ❌ ${model}: Error - ${error.message}`)
      }
    }
  }

  showHelp() {
    console.log(`
🤖 Model Manager CLI

Usage: node scripts/model-manager.js <command>

Commands:
  scan        Scan for available models
  select      Select optimal models for each task
  status      Show current model selector status
  test        Test model connectivity
  benchmark   Benchmark model performance
  
Examples:
  node scripts/model-manager.js scan
  node scripts/model-manager.js select
  node scripts/model-manager.js status
`)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new ModelManager()
  manager.run().catch(console.error)
}

export { ModelManager }
