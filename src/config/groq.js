/**
 * Groq API Configuration with Intelligent Model Selection
 */

import { modelSelector } from "./model_selector.js"


export const groqConfig = {
  apiKey: "gsk_mi_clave_por_defecto",
  baseUrl: "https://api.groq.com/openai/v1",
  model: "llama-3.1-8b-instant", 
  maxTokens: Number.parseInt(process.env.GROQ_MAX_TOKENS) || 2048,
  temperature: Number.parseFloat(process.env.GROQ_TEMPERATURE) || 0.7,
  timeout: Number.parseInt(process.env.GROQ_TIMEOUT) || 30000,
}

/**
 * Enhanced Groq Client with Automatic Model Selection
 */
export const groqClient = {
  chat: {
    completions: {
      async create(options) {
        try {
          // Use specified model or get optimal model for task
          const model = options.model || groqConfig.model

          const response = await fetch(`${groqConfig.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqConfig.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: groqConfig.maxTokens,
              temperature: groqConfig.temperature,
              ...options,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Groq API error (${response.status}): ${JSON.stringify(errorData)}`)
          }

          const data = await response.json()
          return {
            choices: data.choices || [],
            usage: data.usage || {},
            content: data.choices?.[0]?.message?.content || "",
          }
        } catch (error) {
          console.error("Groq API Error:", error)
          throw error
        }
      },
    },
  },
}

/**
 * Get optimal model configuration for specific task
 */
export async function getOptimalModelConfig(taskType) {
  const selectedModel = modelSelector.getModelForTask(taskType)

  // Task-specific configurations
  const taskConfigs = {
    chat: {
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
    },
    quiz: {
      maxTokens: 1500,
      temperature: 0.8,
      topP: 0.95,
    },
    academic: {
      maxTokens: 1200,
      temperature: 0.5,
      topP: 0.8,
    },
    reports: {
      maxTokens: 2048,
      temperature: 0.6,
      topP: 0.85,
    },
    planning: {
      maxTokens: 800,
      temperature: 0.4,
      topP: 0.75,
    },
    agents: {
      maxTokens: 1500,
      temperature: 0.6,
      topP: 0.8,
    },
  }

  return {
    model: selectedModel,
    ...(taskConfigs[taskType] || taskConfigs.chat),
  }
}

/**
 * Enhanced API call with automatic model selection
 */
export async function callGroqWithOptimalModel(taskType, messages, options = {}) {
  const config = await getOptimalModelConfig(taskType)

  console.log(`🤖 Using ${config.model} for ${taskType} task`)

  return await groqClient.chat.completions.create({
    ...config,
    messages,
    ...options,
  })
}

/**
 * Prompt templates optimized for different models
 */
export const promptTemplates = {
  chat: (query) => `You are a helpful AI assistant specialized in educational content. 
Provide a clear, concise response to: ${query}`,

  quiz: (topic, difficulty, count) => `Generate ${count} ${difficulty} level quiz questions about ${topic}.
Format as JSON with: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}]}`,

  academic: (query) => `As an academic research assistant, provide a scholarly analysis of: ${query}
Include key concepts, current research, and practical applications.`,

  reports: (data) => `Generate a comprehensive progress report based on this data: ${JSON.stringify(data)}
Include insights, trends, and actionable recommendations.`,

  planning: (goals, timeframe) => `Create an optimal study plan for these goals: ${goals}
Timeframe: ${timeframe}. Include schedule, milestones, and adaptive elements.`,

  agents: (task, context) => `Execute this agent task: ${task}
Context: ${JSON.stringify(context)}
Provide structured analysis and recommendations.`,

  // Specialized templates for different model types
  llama: {
    system: "You are a helpful, harmless, and honest AI assistant.",
    format: "Provide clear, structured responses with practical examples.",
  },

  mixtral: {
    system: "You are an expert AI assistant capable of complex reasoning and structured output.",
    format: "Use detailed analysis and provide comprehensive, well-organized responses.",
  },

  gemma: {
    system: "You are a knowledgeable AI tutor focused on educational excellence.",
    format: "Explain concepts clearly with step-by-step reasoning and examples.",
  },
}

/**
 * Initialize model selection on startup
 */
export async function initializeModelSelection() {
  console.log("🚀 Initializing intelligent model selection...")

  try {
    const selections = await modelSelector.selectOptimalModels()

    console.log("✅ Model selection completed:")
    Object.entries(selections).forEach(([task, info]) => {
      console.log(`   🎯 ${task}: ${info.model} (${info.reason})`)
    })

    return selections
  } catch (error) {
    console.error("❌ Model selection failed:", error)
    console.log("🔄 Falling back to default configuration")
    return null
  }
}

/**
 * Error handler for Groq API
 */
export function handleGroqError(error) {
  console.error("Groq Error:", error)

  if (error.message.includes("API key")) {
    return {
      error: "Invalid or missing Groq API key",
      suggestion: "Check your GROQ_API_KEY environment variable",
    }
  }

  if (error.message.includes("model_decommissioned")) {
    return {
      error: "Model has been decommissioned",
      suggestion: "The system will automatically select an alternative model",
    }
  }

  if (error.message.includes("rate limit")) {
    return {
      error: "Rate limit exceeded",
      suggestion: "Please wait a moment before trying again",
    }
  }

  if (error.message.includes("timeout")) {
    return {
      error: "Request timeout",
      suggestion: "The request took too long. Please try again",
    }
  }

  return {
    error: "Groq API error",
    details: error.message,
    suggestion: "Please check your configuration and try again",
  }
}

/**
 * Validate Groq configuration
 */
export function validateGroqConfig() {
  const issues = []

  if (!groqConfig.apiKey) {
    issues.push("Missing GROQ_API_KEY")
  }

  if (!groqConfig.apiKey?.startsWith("gsk_")) {
    issues.push("Invalid GROQ_API_KEY format (should start with 'gsk_')")
  }

  return {
    valid: issues.length === 0,
    issues,
    config: groqConfig,
  }
}
