import { groqClient, modelConfigs, promptTemplates } from "../config/groq.js"

/**
 * Base Agent class for DeerFlow agents
 */
export class BaseAgent {
  constructor(name, description, capabilities = []) {
    this.name = name
    this.description = description
    this.capabilities = capabilities
    this.isActive = true
    this.lastExecution = null
    this.executionCount = 0
  }

  /**
   * Execute agent with given context
   * @param {Object} context - Execution context
   * @returns {Object} Execution result
   */
  async execute(context) {
    this.lastExecution = new Date().toISOString()
    this.executionCount++

    try {
      const result = await this._execute(context)
      return {
        success: true,
        agent: this.name,
        result,
        executedAt: this.lastExecution,
        executionTime: Date.now() - new Date(this.lastExecution).getTime(),
      }
    } catch (error) {
      console.error(`Error executing agent ${this.name}:`, error)
      return {
        success: false,
        agent: this.name,
        error: error.message,
        executedAt: this.lastExecution,
      }
    }
  }

  /**
   * Abstract method to be implemented by specific agents
   * @param {Object} context - Execution context
   */
  async _execute(context) {
    throw new Error(`Agent ${this.name} must implement _execute method`)
  }

  /**
   * Get agent status and metrics
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      isActive: this.isActive,
      lastExecution: this.lastExecution,
      executionCount: this.executionCount,
    }
  }
}

/**
 * Academic Agent - Handles advanced searches and academic content
 */
export class AcademicAgent extends BaseAgent {
  constructor() {
    super("AcademicAgent", "Manages advanced academic searches and content analysis", [
      "arxiv_search",
      "document_analysis",
      "citation_extraction",
      "academic_recommendations",
    ])
  }

  async _execute(context) {
    const { action, query, userId, metadata = {} } = context

    switch (action) {
      case "search_academic":
        return await this.searchAcademic(query, metadata)
      case "analyze_content":
        return await this.analyzeContent(context.content, metadata)
      case "recommend_papers":
        return await this.recommendPapers(userId, query, metadata)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  /**
   * Search academic content (simulated ArXiv search)
   */
  async searchAcademic(query, metadata = {}) {
    console.log(`🔬 AcademicAgent: Searching academic content for "${query}"`)

    // Simulate academic search with AI-generated results
    const prompt = promptTemplates.academicSearch(query)

    try {
      const { content: response } = await groqClient.chat.completions.create({
        model: modelConfigs.academic.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: modelConfigs.academic.maxTokens,
        temperature: modelConfigs.academic.temperature,
      })

      const papers = JSON.parse(response.trim())

      return {
        query,
        papers,
        totalResults: papers.length,
        searchTime: new Date().toISOString(),
        source: "academic_search",
      }
    } catch (error) {
      console.error("Error in academic search:", error)
      return {
        query,
        papers: [],
        error: "Failed to search academic content",
      }
    }
  }

  /**
   * Analyze academic content
   */
  async analyzeContent(content, metadata = {}) {
    console.log(`🔬 AcademicAgent: Analyzing content (${content.length} chars)`)

    const prompt = promptTemplates.analyzeContent(content.substring(0, 1000))

    try {
      const { content: response } = await groqClient.chat.completions.create({
        model: modelConfigs.academic.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: modelConfigs.academic.maxTokens,
        temperature: modelConfigs.academic.temperature,
      })

      const analysis = JSON.parse(response.trim())

      return {
        analysis,
        contentLength: content.length,
        analyzedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error analyzing content:", error)
      return {
        error: "Failed to analyze content",
        contentLength: content.length,
      }
    }
  }

  /**
   * Recommend academic papers based on user progress
   */
  async recommendPapers(userId, topic, metadata = {}) {
    console.log(`🔬 AcademicAgent: Recommending papers for user ${userId} on topic "${topic}"`)

    // This would integrate with user's BKT progress in a real implementation
    const recommendations = [
      {
        title: `Advanced ${topic} Techniques`,
        reason: "Matches your current learning level",
        priority: "high",
        estimatedTime: 30,
      },
      {
        title: `${topic} Applications in Practice`,
        reason: "Practical applications of your studies",
        priority: "medium",
        estimatedTime: 20,
      },
    ]

    return {
      userId,
      topic,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Quiz Agent - Coordinates quiz generation and evaluation
 */
export class QuizAgent extends BaseAgent {
  constructor() {
    super("QuizAgent", "Coordinates adaptive quiz generation and intelligent evaluation", [
      "adaptive_generation",
      "difficulty_adjustment",
      "performance_analysis",
      "feedback_optimization",
    ])
  }

  async _execute(context) {
    const { action, userId, topicId, quizData, metadata = {} } = context

    switch (action) {
      case "generate_adaptive":
        return await this.generateAdaptiveQuiz(userId, topicId, metadata)
      case "analyze_performance":
        return await this.analyzePerformance(userId, quizData, metadata)
      case "optimize_difficulty":
        return await this.optimizeDifficulty(userId, topicId, metadata)
      case "generate_feedback":
        return await this.generateIntelligentFeedback(quizData, metadata)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  /**
   * Generate adaptive quiz based on user progress
   */
  async generateAdaptiveQuiz(userId, topicId, metadata = {}) {
    console.log(`🎯 QuizAgent: Generating adaptive quiz for user ${userId}, topic ${topicId}`)

    // This would integrate with the existing quiz system
    const quizConfig = {
      userId,
      topicId,
      adaptiveLevel: metadata.currentLevel || "intermediate",
      questionCount: metadata.questionCount || 5,
      focusAreas: metadata.weakAreas || [],
      avoidAreas: metadata.strongAreas || [],
    }

    return {
      quizConfig,
      recommendations: {
        difficulty: "medium",
        focusTopics: ["fundamentals", "applications"],
        estimatedTime: 15,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Analyze quiz performance patterns
   */
  async analyzePerformance(userId, quizData, metadata = {}) {
    console.log(`🎯 QuizAgent: Analyzing performance for user ${userId}`)

    const analysis = {
      overallScore: quizData.score || 0,
      strengths: ["pattern_recognition", "basic_concepts"],
      weaknesses: ["advanced_applications", "problem_solving"],
      learningStyle: "visual",
      recommendedActions: [
        "Focus on practical applications",
        "Review fundamental concepts",
        "Practice with similar problems",
      ],
      nextDifficultyLevel: "intermediate",
    }

    return {
      userId,
      analysis,
      analyzedAt: new Date().toISOString(),
    }
  }

  /**
   * Optimize difficulty for future quizzes
   */
  async optimizeDifficulty(userId, topicId, metadata = {}) {
    console.log(`🎯 QuizAgent: Optimizing difficulty for user ${userId}, topic ${topicId}`)

    const optimization = {
      currentLevel: metadata.currentLevel || "intermediate",
      recommendedLevel: "intermediate-advanced",
      adjustmentReason: "User shows consistent improvement",
      confidenceScore: 0.85,
      nextQuizConfig: {
        difficulty: 0.7,
        questionTypes: ["application", "analysis"],
        timeLimit: 20,
      },
    }

    return {
      userId,
      topicId,
      optimization,
      optimizedAt: new Date().toISOString(),
    }
  }

  /**
   * Generate intelligent feedback
   */
  async generateIntelligentFeedback(quizData, metadata = {}) {
    console.log(`🎯 QuizAgent: Generating intelligent feedback`)

    const prompt = promptTemplates.generateFeedback(quizData)

    try {
      const { content: response } = await groqClient.chat.completions.create({
        model: modelConfigs.academic.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: modelConfigs.academic.maxTokens,
        temperature: modelConfigs.academic.temperature,
      })

      const feedback = JSON.parse(response.trim())

      return {
        feedback,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error generating feedback:", error)
      return {
        feedback: {
          message: "Great effort! Keep practicing to improve your skills.",
          strengths: ["Persistence", "Effort"],
          improvements: ["Continue studying"],
          nextSteps: ["Review materials", "Practice more"],
          motivation: "Every step forward is progress!",
        },
      }
    }
  }
}

/**
 * Report Agent - Creates progress reports and insights
 */
export class ReportAgent extends BaseAgent {
  constructor() {
    super("ReportAgent", "Generates comprehensive progress reports and learning insights", [
      "progress_analysis",
      "trend_identification",
      "recommendation_generation",
      "report_formatting",
    ])
  }

  async _execute(context) {
    const { action, userId, period, format, metadata = {} } = context

    switch (action) {
      case "generate_report":
        return await this.generateProgressReport(userId, period, format, metadata)
      case "analyze_trends":
        return await this.analyzeLearningTrends(userId, period, metadata)
      case "create_insights":
        return await this.createLearningInsights(userId, metadata)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  /**
   * Generate comprehensive progress report
   */
  async generateProgressReport(userId, period = "week", format = "text", metadata = {}) {
    console.log(`📊 ReportAgent: Generating ${period} report for user ${userId}`)

    // This would integrate with actual user data
    const reportData = {
      userId,
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalStudyTime: 120, // minutes
        quizzesCompleted: 5,
        averageScore: 78,
        topicsStudied: 3,
        streakDays: 7,
      },
      progress: {
        improvement: "+15%",
        strongestTopic: "Introduction",
        weakestTopic: "Advanced Concepts",
        recommendedFocus: "Intermediate Topics",
      },
      insights: [
        "Consistent daily practice is showing results",
        "Quiz performance improved significantly",
        "Ready to advance to intermediate level",
      ],
      recommendations: [
        "Continue daily study routine",
        "Focus on practical applications",
        "Consider advanced topics next week",
      ],
    }

    if (format === "detailed") {
      return await this.generateDetailedReport(reportData)
    }

    return reportData
  }

  /**
   * Generate detailed report with AI insights
   */
  async generateDetailedReport(reportData) {
    const prompt = promptTemplates.generateDetailedReport(reportData)

    try {
      const { content: detailedReport } = await groqClient.chat.completions.create({
        model: modelConfigs.academic.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: modelConfigs.academic.maxTokens,
        temperature: modelConfigs.academic.temperature,
      })

      return {
        ...reportData,
        detailedReport,
        format: "detailed",
      }
    } catch (error) {
      console.error("Error generating detailed report:", error)
      return {
        ...reportData,
        error: "Could not generate detailed report",
      }
    }
  }

  /**
   * Analyze learning trends
   */
  async analyzeLearningTrends(userId, period, metadata = {}) {
    console.log(`📊 ReportAgent: Analyzing learning trends for user ${userId}`)

    const trends = {
      studyConsistency: {
        trend: "improving",
        score: 0.8,
        description: "Study sessions are becoming more regular",
      },
      performanceGrowth: {
        trend: "stable",
        score: 0.75,
        description: "Steady improvement in quiz scores",
      },
      topicMastery: {
        trend: "accelerating",
        score: 0.9,
        description: "Rapid progress in core topics",
      },
      engagement: {
        trend: "high",
        score: 0.85,
        description: "High engagement with learning materials",
      },
    }

    return {
      userId,
      period,
      trends,
      analyzedAt: new Date().toISOString(),
    }
  }

  /**
   * Create learning insights
   */
  async createLearningInsights(userId, metadata = {}) {
    console.log(`📊 ReportAgent: Creating learning insights for user ${userId}`)

    const insights = {
      learningStyle: "Visual and practical learner",
      optimalStudyTime: "Morning sessions (8-10 AM)",
      preferredTopicTypes: ["Hands-on applications", "Real-world examples"],
      challengeAreas: ["Abstract concepts", "Theoretical frameworks"],
      motivationFactors: ["Progress tracking", "Achievement badges"],
      recommendations: [
        "Use more visual aids in learning",
        "Schedule study sessions in the morning",
        "Focus on practical applications",
        "Break down abstract concepts into smaller parts",
      ],
    }

    return {
      userId,
      insights,
      createdAt: new Date().toISOString(),
    }
  }
}

/**
 * Planner Agent - Reviews and adjusts study plans
 */
export class PlannerAgent extends BaseAgent {
  constructor() {
    super("PlannerAgent", "Intelligent study plan optimization and adjustment", [
      "plan_optimization",
      "schedule_adjustment",
      "goal_setting",
      "progress_tracking",
    ])
  }

  async _execute(context) {
    const { action, userId, planData, bktProgress, metadata = {} } = context

    switch (action) {
      case "optimize_plan":
        return await this.optimizeStudyPlan(userId, planData, bktProgress, metadata)
      case "suggest_adjustments":
        return await this.suggestPlanAdjustments(userId, planData, metadata)
      case "next_step":
        return await this.suggestNextStep(userId, planData, bktProgress, metadata)
      case "review_goals":
        return await this.reviewLearningGoals(userId, planData, metadata)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  /**
   * Optimize study plan based on progress
   */
  async optimizeStudyPlan(userId, planData, bktProgress, metadata = {}) {
    console.log(`📋 PlannerAgent: Optimizing study plan for user ${userId}`)

    const optimization = {
      currentPlan: planData,
      suggestions: [
        {
          type: "schedule_adjustment",
          description: "Move advanced topics to later in the week",
          priority: "medium",
          impact: "Better learning progression",
        },
        {
          type: "topic_reordering",
          description: "Focus on weak areas identified in BKT",
          priority: "high",
          impact: "Improved knowledge retention",
        },
        {
          type: "time_allocation",
          description: "Increase time for challenging topics",
          priority: "medium",
          impact: "Better mastery of difficult concepts",
        },
      ],
      estimatedImprovement: "15-20% better learning outcomes",
      confidence: 0.82,
    }

    return {
      userId,
      optimization,
      optimizedAt: new Date().toISOString(),
    }
  }

  /**
   * Suggest plan adjustments
   */
  async suggestPlanAdjustments(userId, planData, metadata = {}) {
    console.log(`📋 PlannerAgent: Suggesting plan adjustments for user ${userId}`)

    const adjustments = [
      {
        type: "pacing",
        current: "5 topics per week",
        suggested: "4 topics per week",
        reason: "Allow more time for deep understanding",
      },
      {
        type: "difficulty",
        current: "Linear progression",
        suggested: "Adaptive difficulty",
        reason: "Match user's actual progress rate",
      },
      {
        type: "review",
        current: "No review sessions",
        suggested: "Weekly review sessions",
        reason: "Improve long-term retention",
      },
    ]

    return {
      userId,
      adjustments,
      suggestedAt: new Date().toISOString(),
    }
  }

  /**
   * Suggest next step based on current progress
   */
  async suggestNextStep(userId, planData, bktProgress, metadata = {}) {
    console.log(`📋 PlannerAgent: Suggesting next step for user ${userId}`)

    // Analyze current state and suggest optimal next action
    const currentTime = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    let suggestion = {
      action: "study",
      topic: "introduction",
      reason: "Continue with planned topic",
      estimatedTime: 30,
      priority: "medium",
    }

    // Simple logic for demonstration
    if (currentTime >= 8 && currentTime <= 10) {
      suggestion = {
        action: "quiz",
        topic: "current_topic",
        reason: "Optimal time for assessment",
        estimatedTime: 15,
        priority: "high",
      }
    } else if (currentTime >= 14 && currentTime <= 16) {
      suggestion = {
        action: "chat",
        topic: "review",
        reason: "Good time for interactive learning",
        estimatedTime: 20,
        priority: "medium",
      }
    }

    return {
      userId,
      suggestion,
      context: {
        currentTime,
        dayOfWeek,
        planProgress: planData?.stats || {},
      },
      suggestedAt: new Date().toISOString(),
    }
  }

  /**
   * Review learning goals
   */
  async reviewLearningGoals(userId, planData, metadata = {}) {
    console.log(`📋 PlannerAgent: Reviewing learning goals for user ${userId}`)

    const goalReview = {
      currentGoals: planData?.goals || ["Complete basic topics", "Improve quiz scores"],
      progress: {
        "Complete basic topics": {
          status: "in_progress",
          completion: 0.6,
          onTrack: true,
        },
        "Improve quiz scores": {
          status: "achieved",
          completion: 1.0,
          onTrack: true,
        },
      },
      suggestedNewGoals: ["Master intermediate concepts", "Achieve 90% quiz accuracy", "Complete advanced topics"],
      adjustments: [
        "Extend timeline for complex topics",
        "Add practical application goals",
        "Include peer learning objectives",
      ],
    }

    return {
      userId,
      goalReview,
      reviewedAt: new Date().toISOString(),
    }
  }
}

/**
 * Agent Registry - Manages all available agents
 */
export class AgentRegistry {
  constructor() {
    this.agents = new Map()
    this.initializeAgents()
  }

  /**
   * Initialize all available agents
   */
  initializeAgents() {
    const agents = [new AcademicAgent(), new QuizAgent(), new ReportAgent(), new PlannerAgent()]

    agents.forEach((agent) => {
      this.agents.set(agent.name, agent)
    })

    console.log(`🤖 Initialized ${agents.length} DeerFlow agents`)
  }

  /**
   * Get agent by name
   */
  getAgent(name) {
    return this.agents.get(name)
  }

  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values())
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability) {
    return this.getAllAgents().filter((agent) => agent.capabilities.includes(capability))
  }

  /**
   * Execute agent with context
   */
  async executeAgent(agentName, context) {
    const agent = this.getAgent(agentName)
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`)
    }

    if (!agent.isActive) {
      throw new Error(`Agent ${agentName} is not active`)
    }

    return await agent.execute(context)
  }

  /**
   * Get registry status
   */
  getStatus() {
    const agents = this.getAllAgents()
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.isActive).length,
      agents: agents.map((a) => a.getStatus()),
      lastUpdate: new Date().toISOString(),
    }
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry()
