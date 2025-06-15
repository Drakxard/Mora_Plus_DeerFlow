/**
 * Intelligent Model Selector for Groq API
 * Automatically detects available models and selects the best for each task
 */

import { groqConfig } from "./groq.js"

/**
 * Model capabilities and scoring system
 */
const modelCapabilities = {
  // Llama models
  "llama-3.1-8b-instant": {
    speed: 9,
    quality: 7,
    reasoning: 7,
    structured: 6,
    maxTokens: 8192,
    costEfficiency: 9,
    bestFor: ["chat", "quick_analysis", "simple_tasks"],
  },
  "llama-3.1-70b-versatile": {
    speed: 6,
    quality: 9,
    reasoning: 9,
    structured: 8,
    maxTokens: 8192,
    costEfficiency: 6,
    bestFor: ["complex_analysis", "academic", "reports"],
  },
  "llama-3.2-1b-preview": {
    speed: 10,
    quality: 5,
    reasoning: 5,
    structured: 4,
    maxTokens: 8192,
    costEfficiency: 10,
    bestFor: ["simple_chat", "basic_tasks"],
  },
  "llama-3.2-3b-preview": {
    speed: 9,
    quality: 6,
    reasoning: 6,
    structured: 5,
    maxTokens: 8192,
    costEfficiency: 9,
    bestFor: ["chat", "moderate_tasks"],
  },

  // Mixtral models
  "mixtral-8x7b-32768": {
    speed: 7,
    quality: 8,
    reasoning: 8,
    structured: 9,
    maxTokens: 32768,
    costEfficiency: 7,
    bestFor: ["quiz", "structured_generation", "long_context"],
  },

  // Gemma models
  "gemma-7b-it": {
    speed: 8,
    quality: 7,
    reasoning: 6,
    structured: 7,
    maxTokens: 8192,
    costEfficiency: 8,
    bestFor: ["instructions", "tutorials", "planning"],
  },
  "gemma2-9b-it": {
    speed: 7,
    quality: 8,
    reasoning: 7,
    structured: 8,
    maxTokens: 8192,
    costEfficiency: 7,
    bestFor: ["planning", "analysis", "structured_tasks"],
  },
}

/**
 * Task requirements for different sections
 */
const taskRequirements = {
  chat: {
    priority: ["speed", "quality"],
    minSpeed: 7,
    minQuality: 6,
    preferredTokens: 2048,
    description: "Conversational AI with quick responses",
  },
  quiz: {
    priority: ["structured", "reasoning"],
    minStructured: 7,
    minReasoning: 6,
    preferredTokens: 1500,
    description: "Structured question generation and evaluation",
  },
  academic: {
    priority: ["quality", "reasoning"],
    minQuality: 7,
    minReasoning: 7,
    preferredTokens: 1200,
    description: "Academic research and analysis",
  },
  reports: {
    priority: ["quality", "structured"],
    minQuality: 7,
    minStructured: 7,
    preferredTokens: 2048,
    description: "Detailed progress reports and insights",
  },
  planning: {
    priority: ["reasoning", "structured"],
    minReasoning: 6,
    minStructured: 6,
    preferredTokens: 800,
    description: "Study plan optimization and scheduling",
  },
  agents: {
    priority: ["reasoning", "quality"],
    minReasoning: 7,
    minQuality: 7,
    preferredTokens: 1500,
    description: "Complex agent workflows and coordination",
  },
}

/**
 * Model Selector Class
 */
export class ModelSelector {
  constructor() {
    this.availableModels = new Set()
    this.modelScores = new Map()
    this.selectedModels = new Map()
    this.lastScan = null
    this.scanInterval = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Scan available models from Groq API
   */
  async scanAvailableModels() {
    console.log("🔍 Scanning available Groq models...")

    try {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${groqConfig.apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        const models = data.data?.map((model) => model.id) || []

        this.availableModels = new Set(models)
        this.lastScan = new Date()

        console.log(`✅ Found ${models.length} available models:`)
        models.forEach((model) => {
          const known = modelCapabilities[model] ? "✓" : "?"
          console.log(`   ${known} ${model}`)
        })

        return models
      } else {
        throw new Error(`API responded with ${response.status}`)
      }
    } catch (error) {
      console.warn("⚠️ Could not fetch models from API, using fallback detection")

      // Fallback: test common models
      const commonModels = ["llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "gemma-7b-it"]

      const available = []
      for (const model of commonModels) {
        if (await this.testModel(model)) {
          available.push(model)
        }
      }

      this.availableModels = new Set(available)
      this.lastScan = new Date()

      console.log(`✅ Detected ${available.length} working models via testing`)
      return available
    }
  }

  /**
   * Test if a model is working
   */
  async testModel(modelId) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
          temperature: 0.1,
        }),
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Calculate model score for a specific task
   */
  calculateModelScore(modelId, taskType) {
    const capabilities = modelCapabilities[modelId]
    const requirements = taskRequirements[taskType]

    if (!capabilities || !requirements) {
      return 0
    }

    let score = 0
    let weight = 0

    // Check minimum requirements
    for (const [req, minValue] of Object.entries(requirements)) {
      if (req.startsWith("min") && capabilities[req.replace("min", "").toLowerCase()] < minValue) {
        return 0 // Doesn't meet minimum requirements
      }
    }

    // Calculate weighted score based on priorities
    requirements.priority.forEach((criterion, index) => {
      const criterionWeight = requirements.priority.length - index
      const criterionScore = capabilities[criterion] || 0

      score += criterionScore * criterionWeight
      weight += criterionWeight
    })

    // Add bonus for cost efficiency
    score += capabilities.costEfficiency * 0.5

    // Add bonus if model is specifically recommended for this task
    if (capabilities.bestFor.includes(taskType) || capabilities.bestFor.some((task) => taskType.includes(task))) {
      score += 10
    }

    return weight > 0 ? score / weight : 0
  }

  /**
   * Select best models for all tasks
   */
  async selectOptimalModels() {
    // Scan models if needed
    if (!this.lastScan || Date.now() - this.lastScan.getTime() > this.scanInterval) {
      await this.scanAvailableModels()
    }

    console.log("🎯 Selecting optimal models for each task...")

    const selections = {}

    for (const [taskType, requirements] of Object.entries(taskRequirements)) {
      let bestModel = null
      let bestScore = 0

      for (const modelId of this.availableModels) {
        if (modelCapabilities[modelId]) {
          const score = this.calculateModelScore(modelId, taskType)

          if (score > bestScore) {
            bestScore = score
            bestModel = modelId
          }
        }
      }

      if (bestModel) {
        selections[taskType] = {
          model: bestModel,
          score: bestScore.toFixed(2),
          capabilities: modelCapabilities[bestModel],
          reason: this.getSelectionReason(bestModel, taskType),
        }

        this.selectedModels.set(taskType, bestModel)
        console.log(`   📋 ${taskType}: ${bestModel} (score: ${bestScore.toFixed(2)})`)
      } else {
        console.warn(`   ⚠️ ${taskType}: No suitable model found`)
      }
    }

    return selections
  }

  /**
   * Get reason for model selection
   */
  getSelectionReason(modelId, taskType) {
    const capabilities = modelCapabilities[modelId]
    const requirements = taskRequirements[taskType]

    const strengths = []

    requirements.priority.forEach((criterion) => {
      const score = capabilities[criterion]
      if (score >= 8) strengths.push(`excellent ${criterion}`)
      else if (score >= 7) strengths.push(`good ${criterion}`)
    })

    if (capabilities.bestFor.includes(taskType)) {
      strengths.push("specifically designed for this task")
    }

    return strengths.length > 0 ? strengths.join(", ") : "best available option"
  }

  /**
   * Get model for specific task
   */
  getModelForTask(taskType) {
    return this.selectedModels.get(taskType) || groqConfig.model
  }

  /**
   * Get all selected models
   */
  getSelectedModels() {
    return Object.fromEntries(this.selectedModels)
  }

  /**
   * Force rescan of models
   */
  async forceRescan() {
    this.lastScan = null
    return await this.selectOptimalModels()
  }

  /**
   * Get selector status
   */
  getStatus() {
    return {
      availableModels: Array.from(this.availableModels),
      selectedModels: Object.fromEntries(this.selectedModels),
      lastScan: this.lastScan,
      totalKnownModels: Object.keys(modelCapabilities).length,
      scanInterval: this.scanInterval,
    }
  }
}

// Export singleton instance
export const modelSelector = new ModelSelector()
