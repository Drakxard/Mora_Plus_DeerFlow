import express from "express"
import Ajv from "ajv"
import { agentCoordinator } from "../agents/coordinator.js"
import { agentRegistry } from "../agents/agentConfig.js"
import { intelligentPlanner } from "../agents/planner.js"

const router = express.Router()

// Configurar validador AJV
const ajv = new Ajv()

// Esquemas de validación
const executeAgentSchema = {
  type: "object",
  properties: {
    agentName: { type: "string", minLength: 1 },
    userId: { type: "string", minLength: 1 },
    action: { type: "string", minLength: 1 },
    payload: { type: "object" },
  },
  required: ["agentName", "userId", "action"],
  additionalProperties: false,
}

const executeWorkflowSchema = {
  type: "object",
  properties: {
    workflowName: { type: "string", minLength: 1 },
    userId: { type: "string", minLength: 1 },
    context: { type: "object" },
  },
  required: ["workflowName", "userId"],
  additionalProperties: false,
}

const generatePlanSchema = {
  type: "object",
  properties: {
    userId: { type: "string", minLength: 1 },
    preferences: {
      type: "object",
      properties: {
        maxTopics: { type: "integer", minimum: 1, maximum: 20 },
        daysPerWeek: { type: "integer", minimum: 1, maximum: 7 },
        hoursPerDay: { type: "number", minimum: 0.5, maximum: 8 },
        preferredDifficulty: { type: "integer", minimum: 1, maximum: 3 },
        focusAreas: { type: "array", items: { type: "string" } },
        includeWeekends: { type: "boolean" },
        startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      },
      additionalProperties: false,
    },
  },
  required: ["userId"],
  additionalProperties: false,
}

const validateExecuteAgent = ajv.compile(executeAgentSchema)
const validateExecuteWorkflow = ajv.compile(executeWorkflowSchema)
const validateGeneratePlan = ajv.compile(generatePlanSchema)

// POST /agents/execute - Execute single agent
router.post("/execute", (req, res) => {
  const { agentName, userId, payload } = req.body

  if (!agentName || !userId) {
    return res.status(400).json({
      error: 'Fields "agentName" and "userId" are required',
      example: { agentName: "AcademicAgent", userId: "user123", payload: {} },
    })
  }

  // TODO: Implement actual agent execution
  res.json({
    agentName,
    userId,
    result: `Agent ${agentName} executed successfully for user ${userId}`,
    timestamp: new Date().toISOString(),
  })
})

// POST /agents/workflow - Execute workflow
router.post("/workflow", async (req, res) => {
  try {
    // Validar entrada
    if (!validateExecuteWorkflow(req.body)) {
      return res.status(400).json({
        error: "Invalid workflow execution request",
        details: validateExecuteWorkflow.errors,
        example: {
          workflowName: "daily_planning",
          userId: "demo-user",
          context: { preferences: { focusAreas: ["introduction"] } },
        },
      })
    }

    const { workflowName, userId, context = {} } = req.body

    console.log(`🔄 Executing workflow: ${workflowName} for user: ${userId}`)

    // Añadir userId al contexto
    const workflowContext = {
      userId,
      ...context,
    }

    // Ejecutar workflow
    const result = await agentCoordinator.executeWorkflow(workflowName, workflowContext)

    res.json({
      success: true,
      workflowName,
      workflowId: result.workflowId,
      result: result.result,
      executionTime: result.executionTime,
    })
  } catch (error) {
    console.error("Error executing workflow:", error)

    let errorMessage = "Error executing workflow"
    if (error.message.includes("Unknown workflow")) {
      errorMessage = "Workflow not found"
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
    })
  }
})

// GET /agents/status - Get agent registry status
router.get("/status", (req, res) => {
  try {
    const registryStatus = agentRegistry.getStatus()
    const coordinatorStatus = agentCoordinator.getStatus()

    res.json({
      registry: registryStatus,
      coordinator: coordinatorStatus,
      availableAgents: registryStatus.agents.map((agent) => ({
        name: agent.name,
        description: agent.description,
        capabilities: agent.capabilities,
        isActive: agent.isActive,
      })),
      availableWorkflows: ["daily_planning", "quiz_analysis", "progress_review", "academic_research"],
    })
  } catch (error) {
    console.error("Error getting agent status:", error)
    res.status(500).json({
      error: "Error retrieving agent status",
      details: error.message,
    })
  }
})

// POST /agents/plan/generate - Generate intelligent study plan
router.post("/plan/generate", async (req, res) => {
  try {
    // Validar entrada
    if (!validateGeneratePlan(req.body)) {
      return res.status(400).json({
        error: "Invalid plan generation request",
        details: validateGeneratePlan.errors,
        example: {
          userId: "demo-user",
          preferences: {
            maxTopics: 8,
            daysPerWeek: 5,
            hoursPerDay: 1.5,
            preferredDifficulty: 2,
            focusAreas: ["introduction", "intermediate"],
            includeWeekends: false,
            startDate: "2024-01-15",
          },
        },
      })
    }

    const { userId, preferences = {} } = req.body

    console.log(`🧠 Generating intelligent plan for user: ${userId}`)

    // Generar plan inteligente
    const intelligentPlan = await intelligentPlanner.generateIntelligentPlan(userId, preferences)

    res.json({
      success: true,
      plan: intelligentPlan,
      message: `Intelligent plan generated with ${intelligentPlan.topicSequence.length} topics`,
    })
  } catch (error) {
    console.error("Error generating intelligent plan:", error)
    res.status(500).json({
      error: "Error generating intelligent plan",
      details: error.message,
    })
  }
})

// GET /agents/plan/next-action - Get next recommended action
router.get("/plan/next-action", async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        error: 'Parameter "userId" is required',
      })
    }

    console.log(`🎯 Getting next action for user: ${userId}`)

    const nextAction = await intelligentPlanner.suggestNextAction(userId)

    res.json({
      userId,
      nextAction,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting next action:", error)
    res.status(500).json({
      error: "Error getting next action",
      details: error.message,
    })
  }
})

// POST /agents/plan/optimize - Optimize existing plan
router.post("/plan/optimize", async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        error: 'Field "userId" is required',
      })
    }

    console.log(`⚡ Optimizing plan for user: ${userId}`)

    const optimization = await intelligentPlanner.optimizeExistingPlan(userId)

    res.json({
      success: true,
      userId,
      optimization,
      optimizedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error optimizing plan:", error)

    let errorMessage = "Error optimizing plan"
    if (error.message === "No plan to optimize") {
      errorMessage = "No study plan found to optimize"
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
    })
  }
})

// GET /agents/workflows/history - Get workflow execution history
router.get("/workflows/history", (req, res) => {
  try {
    const { limit = 10 } = req.query

    const history = agentCoordinator.getWorkflowHistory(Number.parseInt(limit))

    res.json({
      history,
      totalWorkflows: history.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting workflow history:", error)
    res.status(500).json({
      error: "Error retrieving workflow history",
      details: error.message,
    })
  }
})

// GET /agents/workflows/active - Get active workflows
router.get("/workflows/active", (req, res) => {
  try {
    const activeWorkflows = agentCoordinator.getActiveWorkflows()

    res.json({
      activeWorkflows,
      count: activeWorkflows.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting active workflows:", error)
    res.status(500).json({
      error: "Error retrieving active workflows",
      details: error.message,
    })
  }
})

export { router as agentsRoute }
