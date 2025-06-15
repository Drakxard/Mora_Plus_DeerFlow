/**
 * Agent Coordinator for Mora + DeerFlow
 * Orchestrates agent workflows and manages complex academic flows
 */

import { agentRegistry } from "./agentConfig.js"
import { getDatabase } from "../model/database.js"
import { StudentManager } from "../model/bkt.js"
import { PlanModel } from "../planner/planModel.js"

/**
 * Agent Coordinator - Orchestrates multi-agent workflows
 */
export class AgentCoordinator {
  constructor() {
    this.registry = agentRegistry
    this.activeWorkflows = new Map()
    this.workflowHistory = []
  }

  /**
   * Execute a single agent with context
   * @param {string} agentName - Name of the agent to execute
   * @param {Object} context - Execution context
   * @returns {Object} Execution result
   */
  async executeAgent(agentName, context) {
    try {
      console.log(`🤖 Coordinator: Executing agent ${agentName}`)

      const result = await this.registry.executeAgent(agentName, context)

      // Log execution
      this.logExecution(agentName, context, result)

      return result
    } catch (error) {
      console.error(`Error executing agent ${agentName}:`, error)
      throw error
    }
  }

  /**
   * Execute a workflow involving multiple agents
   * @param {string} workflowName - Name of the workflow
   * @param {Object} context - Initial context
   * @returns {Object} Workflow result
   */
  async executeWorkflow(workflowName, context) {
    const workflowId = `${workflowName}_${Date.now()}`
    console.log(`🔄 Coordinator: Starting workflow ${workflowName} (${workflowId})`)

    try {
      this.activeWorkflows.set(workflowId, {
        name: workflowName,
        startedAt: new Date().toISOString(),
        context,
        steps: [],
        status: "running",
      })

      let result
      switch (workflowName) {
        case "daily_planning":
          result = await this.executeDailyPlanningWorkflow(context, workflowId)
          break
        case "quiz_analysis":
          result = await this.executeQuizAnalysisWorkflow(context, workflowId)
          break
        case "progress_review":
          result = await this.executeProgressReviewWorkflow(context, workflowId)
          break
        case "academic_research":
          result = await this.executeAcademicResearchWorkflow(context, workflowId)
          break
        default:
          throw new Error(`Unknown workflow: ${workflowName}`)
      }

      // Mark workflow as completed
      const workflow = this.activeWorkflows.get(workflowId)
      workflow.status = "completed"
      workflow.completedAt = new Date().toISOString()
      workflow.result = result

      // Move to history
      this.workflowHistory.push(workflow)
      this.activeWorkflows.delete(workflowId)

      console.log(`✅ Coordinator: Workflow ${workflowName} completed`)

      return {
        workflowId,
        workflowName,
        result,
        executionTime: Date.now() - new Date(workflow.startedAt).getTime(),
      }
    } catch (error) {
      console.error(`Error in workflow ${workflowName}:`, error)

      // Mark workflow as failed
      const workflow = this.activeWorkflows.get(workflowId)
      if (workflow) {
        workflow.status = "failed"
        workflow.error = error.message
        workflow.failedAt = new Date().toISOString()

        this.workflowHistory.push(workflow)
        this.activeWorkflows.delete(workflowId)
      }

      throw error
    }
  }

  /**
   * Daily Planning Workflow
   * Analyzes user progress and suggests optimal daily plan
   */
  async executeDailyPlanningWorkflow(context, workflowId) {
    const { userId } = context
    const workflow = this.activeWorkflows.get(workflowId)

    // Step 1: Get current plan and progress
    const db = getDatabase()
    const planModel = new PlanModel(db)
    const studentManager = new StudentManager(db)

    const currentPlan = await planModel.getPlan(userId)
    const bktProgress = await studentManager.getProficiency(userId)

    workflow.steps.push({
      step: "data_collection",
      completedAt: new Date().toISOString(),
      data: { hasPlan: !!currentPlan, hasProgress: !!bktProgress },
    })

    // Step 2: Get planner agent suggestions
    const plannerResult = await this.executeAgent("PlannerAgent", {
      action: "next_step",
      userId,
      planData: currentPlan,
      bktProgress,
    })

    workflow.steps.push({
      step: "planner_analysis",
      completedAt: new Date().toISOString(),
      result: plannerResult,
    })

    // Step 3: Get today's topics and recommendations
    const todaysTopics = currentPlan ? await planModel.getTodaysTopics(userId) : []
    const overdueTopics = currentPlan ? await planModel.getOverdueTopics(userId) : []

    workflow.steps.push({
      step: "topic_analysis",
      completedAt: new Date().toISOString(),
      data: { todaysTopics, overdueTopics },
    })

    // Step 4: Generate comprehensive daily plan
    const dailyPlan = {
      userId,
      date: new Date().toISOString().split("T")[0],
      suggestion: plannerResult.result.suggestion,
      topics: {
        scheduled: todaysTopics,
        overdue: overdueTopics,
        recommended: plannerResult.result.suggestion.topic ? [plannerResult.result.suggestion.topic] : [],
      },
      estimatedTime: {
        total: (todaysTopics.length + overdueTopics.length) * 20 + (plannerResult.result.suggestion.estimatedTime || 0),
        breakdown: {
          study: todaysTopics.length * 20,
          review: overdueTopics.length * 15,
          assessment: plannerResult.result.suggestion.estimatedTime || 0,
        },
      },
      priority: this.calculateDailyPriority(todaysTopics, overdueTopics, bktProgress),
      generatedAt: new Date().toISOString(),
    }

    return dailyPlan
  }

  /**
   * Quiz Analysis Workflow
   * Comprehensive analysis of quiz performance with recommendations
   */
  async executeQuizAnalysisWorkflow(context, workflowId) {
    const { userId, quizData } = context
    const workflow = this.activeWorkflows.get(workflowId)

    // Step 1: Analyze quiz performance
    const quizAnalysis = await this.executeAgent("QuizAgent", {
      action: "analyze_performance",
      userId,
      quizData,
    })

    workflow.steps.push({
      step: "performance_analysis",
      completedAt: new Date().toISOString(),
      result: quizAnalysis,
    })

    // Step 2: Generate intelligent feedback
    const feedbackResult = await this.executeAgent("QuizAgent", {
      action: "generate_feedback",
      quizData,
    })

    workflow.steps.push({
      step: "feedback_generation",
      completedAt: new Date().toISOString(),
      result: feedbackResult,
    })

    // Step 3: Optimize difficulty for next quiz
    const difficultyOptimization = await this.executeAgent("QuizAgent", {
      action: "optimize_difficulty",
      userId,
      topicId: quizData.topicId,
      metadata: { currentLevel: quizData.adaptiveLevel },
    })

    workflow.steps.push({
      step: "difficulty_optimization",
      completedAt: new Date().toISOString(),
      result: difficultyOptimization,
    })

    // Step 4: Update study plan if needed
    const plannerSuggestions = await this.executeAgent("PlannerAgent", {
      action: "suggest_adjustments",
      userId,
      planData: { quizPerformance: quizData },
    })

    workflow.steps.push({
      step: "plan_adjustment",
      completedAt: new Date().toISOString(),
      result: plannerSuggestions,
    })

    return {
      userId,
      quizId: quizData.quizId,
      analysis: quizAnalysis.result.analysis,
      feedback: feedbackResult.result.feedback,
      optimization: difficultyOptimization.result.optimization,
      planSuggestions: plannerSuggestions.result.adjustments,
      completedAt: new Date().toISOString(),
    }
  }

  /**
   * Progress Review Workflow
   * Comprehensive progress analysis and reporting
   */
  async executeProgressReviewWorkflow(context, workflowId) {
    const { userId, period = "week" } = context
    const workflow = this.activeWorkflows.get(workflowId)

    // Step 1: Generate progress report
    const progressReport = await this.executeAgent("ReportAgent", {
      action: "generate_report",
      userId,
      period,
      format: "detailed",
    })

    workflow.steps.push({
      step: "progress_report",
      completedAt: new Date().toISOString(),
      result: progressReport,
    })

    // Step 2: Analyze learning trends
    const trendAnalysis = await this.executeAgent("ReportAgent", {
      action: "analyze_trends",
      userId,
      period,
    })

    workflow.steps.push({
      step: "trend_analysis",
      completedAt: new Date().toISOString(),
      result: trendAnalysis,
    })

    // Step 3: Create learning insights
    const learningInsights = await this.executeAgent("ReportAgent", {
      action: "create_insights",
      userId,
    })

    workflow.steps.push({
      step: "learning_insights",
      completedAt: new Date().toISOString(),
      result: learningInsights,
    })

    // Step 4: Review and adjust goals
    const db = getDatabase()
    const planModel = new PlanModel(db)
    const currentPlan = await planModel.getPlan(userId)

    const goalReview = await this.executeAgent("PlannerAgent", {
      action: "review_goals",
      userId,
      planData: currentPlan,
    })

    workflow.steps.push({
      step: "goal_review",
      completedAt: new Date().toISOString(),
      result: goalReview,
    })

    return {
      userId,
      period,
      report: progressReport.result,
      trends: trendAnalysis.result.trends,
      insights: learningInsights.result.insights,
      goalReview: goalReview.result.goalReview,
      completedAt: new Date().toISOString(),
    }
  }

  /**
   * Academic Research Workflow
   * Advanced academic content search and analysis
   */
  async executeAcademicResearchWorkflow(context, workflowId) {
    const { query, userId } = context
    const workflow = this.activeWorkflows.get(workflowId)

    // Step 1: Search academic content
    const academicSearch = await this.executeAgent("AcademicAgent", {
      action: "search_academic",
      query,
      userId,
    })

    workflow.steps.push({
      step: "academic_search",
      completedAt: new Date().toISOString(),
      result: academicSearch,
    })

    // Step 2: Analyze found content
    const papers = academicSearch.result.papers || []
    const analysisResults = []

    for (const paper of papers.slice(0, 2)) {
      // Analyze top 2 papers
      const analysis = await this.executeAgent("AcademicAgent", {
        action: "analyze_content",
        content: paper.abstract,
        metadata: { paper: paper.title },
      })

      analysisResults.push({
        paper: paper.title,
        analysis: analysis.result.analysis,
      })
    }

    workflow.steps.push({
      step: "content_analysis",
      completedAt: new Date().toISOString(),
      result: analysisResults,
    })

    // Step 3: Generate recommendations
    const recommendations = await this.executeAgent("AcademicAgent", {
      action: "recommend_papers",
      userId,
      query,
    })

    workflow.steps.push({
      step: "recommendations",
      completedAt: new Date().toISOString(),
      result: recommendations,
    })

    return {
      query,
      userId,
      searchResults: academicSearch.result,
      contentAnalysis: analysisResults,
      recommendations: recommendations.result.recommendations,
      completedAt: new Date().toISOString(),
    }
  }

  /**
   * Calculate daily priority based on topics and progress
   */
  calculateDailyPriority(todaysTopics, overdueTopics, bktProgress) {
    let priority = "medium"

    if (overdueTopics.length > 2) {
      priority = "high"
    } else if (todaysTopics.length === 0 && overdueTopics.length === 0) {
      priority = "low"
    }

    return priority
  }

  /**
   * Log agent execution
   */
  logExecution(agentName, context, result) {
    const logEntry = {
      agentName,
      context: { ...context, timestamp: new Date().toISOString() },
      result: result.success ? "success" : "failure",
      executedAt: new Date().toISOString(),
    }

    // In a real implementation, this would be stored in database
    console.log(`📝 Agent execution logged: ${agentName} - ${result.success ? "✅" : "❌"}`)
  }

  /**
   * Get coordinator status
   */
  getStatus() {
    return {
      activeWorkflows: this.activeWorkflows.size,
      completedWorkflows: this.workflowHistory.length,
      agentRegistry: this.registry.getStatus(),
      lastActivity: new Date().toISOString(),
    }
  }

  /**
   * Get workflow history
   */
  getWorkflowHistory(limit = 10) {
    return this.workflowHistory.slice(-limit).reverse()
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values())
  }
}

// Export singleton instance
export const agentCoordinator = new AgentCoordinator()
