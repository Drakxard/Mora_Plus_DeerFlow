/**
 * Intelligent Planner for Mora + DeerFlow
 * Advanced planning logic using BKT progress and user patterns
 */

import { agentCoordinator } from "./coordinator.js"
import { getDatabase } from "../model/database.js"
import { StudentManager } from "../model/bkt.js"
import { PlanModel } from "../planner/planModel.js"
import { getAllTopics } from "../model/topics.js"
import dayjs from "dayjs"

/**
 * Intelligent Study Planner
 */
export class IntelligentPlanner {
  constructor() {
    this.coordinator = agentCoordinator
    this.studentManager = null
    this.planModel = null
  }

  /**
   * Initialize planner with database connections
   */
  async initialize() {
    const db = getDatabase()
    this.studentManager = new StudentManager(db)
    this.planModel = new PlanModel(db)
  }

  /**
   * Generate intelligent study plan for user
   * @param {string} userId - User ID
   * @param {Object} preferences - User preferences
   * @returns {Object} Generated plan
   */
  async generateIntelligentPlan(userId, preferences = {}) {
    await this.initialize()

    console.log(`🧠 IntelligentPlanner: Generating plan for user ${userId}`)

    try {
      // Step 1: Analyze current progress
      const bktProgress = await this.studentManager.getProficiency(userId)
      const currentPlan = await this.planModel.getPlan(userId)

      // Step 2: Get agent recommendations
      const plannerAnalysis = await this.coordinator.executeAgent("PlannerAgent", {
        action: "optimize_plan",
        userId,
        planData: currentPlan,
        bktProgress,
        metadata: preferences,
      })

      // Step 3: Generate topic sequence
      const topicSequence = await this.generateOptimalTopicSequence(userId, bktProgress, preferences)

      // Step 4: Create time-based schedule
      const schedule = await this.createOptimalSchedule(topicSequence, preferences)

      // Step 5: Add adaptive elements
      const adaptivePlan = await this.addAdaptiveElements(schedule, bktProgress)

      const intelligentPlan = {
        userId,
        planType: "intelligent",
        generatedAt: new Date().toISOString(),
        preferences,
        analysis: plannerAnalysis.result,
        topicSequence,
        schedule: adaptivePlan,
        metadata: {
          totalTopics: topicSequence.length,
          estimatedDuration: this.calculateTotalDuration(adaptivePlan),
          difficultyProgression: this.analyzeDifficultyProgression(topicSequence),
          adaptiveFeatures: ["difficulty_adjustment", "pacing_optimization", "review_scheduling"],
        },
      }

      return intelligentPlan
    } catch (error) {
      console.error("Error generating intelligent plan:", error)
      throw error
    }
  }

  /**
   * Generate optimal topic sequence based on progress and dependencies
   */
  async generateOptimalTopicSequence(userId, bktProgress, preferences) {
    const allTopics = getAllTopics()
    const userProgress = bktProgress?.proficiency || {}

    // Sort topics by readiness score
    const topicsWithReadiness = allTopics.map((topic) => {
      const progress = userProgress[topic.id]
      const readinessScore = this.calculateTopicReadiness(topic, progress, userProgress)

      return {
        ...topic,
        currentProgress: progress?.probability || 0,
        readinessScore,
        estimatedTime: this.estimateTopicTime(topic, progress),
        priority: this.calculateTopicPriority(topic, progress, preferences),
      }
    })

    // Sort by readiness and priority
    const sortedTopics = topicsWithReadiness.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // Higher priority first
      }
      return b.readinessScore - a.readinessScore // Higher readiness first
    })

    // Filter out already mastered topics (unless review is needed)
    const filteredTopics = sortedTopics.filter((topic) => {
      const needsReview = topic.currentProgress > 0.8 && Math.random() < 0.3 // 30% chance of review
      return topic.currentProgress < 0.8 || needsReview
    })

    return filteredTopics.slice(0, preferences.maxTopics || 10)
  }

  /**
   * Calculate topic readiness score
   */
  calculateTopicReadiness(topic, progress, allProgress) {
    let readinessScore = 0.5 // Base score

    // Check prerequisites
    if (topic.prerequisites && topic.prerequisites.length > 0) {
      const prereqScores = topic.prerequisites.map((prereqId) => {
        const prereqProgress = allProgress[prereqId]
        return prereqProgress?.probability || 0
      })

      const avgPrereqScore = prereqScores.reduce((sum, score) => sum + score, 0) / prereqScores.length
      readinessScore = avgPrereqScore * 0.8 // Prerequisites heavily influence readiness
    }

    // Adjust for current progress
    const currentProgress = progress?.probability || 0
    if (currentProgress > 0.8) {
      readinessScore *= 0.3 // Lower priority for mastered topics
    } else if (currentProgress > 0.4) {
      readinessScore *= 1.2 // Higher priority for partially learned topics
    }

    // Adjust for difficulty
    const difficultyFactor = 1 - (topic.difficulty - 1) * 0.1 // Easier topics get slight boost
    readinessScore *= difficultyFactor

    return Math.max(0, Math.min(1, readinessScore))
  }

  /**
   * Estimate time needed for topic
   */
  estimateTopicTime(topic, progress) {
    const baseTime = 30 // Base 30 minutes
    const difficultyMultiplier = topic.difficulty * 0.5
    const progressMultiplier = progress?.probability ? 1 - progress.probability * 0.5 : 1

    return Math.round(baseTime * (1 + difficultyMultiplier) * progressMultiplier)
  }

  /**
   * Calculate topic priority
   */
  calculateTopicPriority(topic, progress, preferences) {
    let priority = 0.5

    // User preferences
    if (preferences.focusAreas && preferences.focusAreas.includes(topic.id)) {
      priority += 0.3
    }

    // Current progress (partially learned topics get higher priority)
    const currentProgress = progress?.probability || 0
    if (currentProgress > 0.2 && currentProgress < 0.7) {
      priority += 0.2
    }

    // Difficulty preference
    if (preferences.preferredDifficulty) {
      const difficultyMatch = 1 - Math.abs(topic.difficulty - preferences.preferredDifficulty) / 3
      priority += difficultyMatch * 0.1
    }

    return Math.max(0, Math.min(1, priority))
  }

  /**
   * Create optimal schedule with time distribution
   */
  async createOptimalSchedule(topicSequence, preferences) {
    const startDate = dayjs(preferences.startDate || new Date())
    const daysPerWeek = preferences.daysPerWeek || 5
    const hoursPerDay = preferences.hoursPerDay || 1

    const schedule = []
    let currentDate = startDate
    let dayIndex = 0

    for (const topic of topicSequence) {
      // Skip weekends if not included
      if (!preferences.includeWeekends && (currentDate.day() === 0 || currentDate.day() === 6)) {
        currentDate = currentDate.add(1, "day")
        continue
      }

      // Check if we've reached the daily limit
      if (dayIndex >= daysPerWeek) {
        currentDate = currentDate.add(1, "day")
        dayIndex = 0
        continue
      }

      const scheduleItem = {
        topicId: topic.id,
        topicName: topic.name,
        date: currentDate.format("YYYY-MM-DD"),
        estimatedMinutes: topic.estimatedTime,
        difficulty: topic.difficulty,
        priority: topic.priority,
        readinessScore: topic.readinessScore,
        sessionType: this.determineSessionType(topic),
        goals: this.generateTopicGoals(topic),
      }

      schedule.push(scheduleItem)

      // Move to next day or next topic slot
      if (topic.estimatedTime > hoursPerDay * 60) {
        // Topic needs multiple days
        currentDate = currentDate.add(1, "day")
        dayIndex = 0
      } else {
        dayIndex++
        if (dayIndex >= daysPerWeek) {
          currentDate = currentDate.add(1, "day")
          dayIndex = 0
        }
      }
    }

    return schedule
  }

  /**
   * Determine optimal session type for topic
   */
  determineSessionType(topic) {
    if (topic.currentProgress < 0.3) {
      return "introduction"
    } else if (topic.currentProgress < 0.6) {
      return "practice"
    } else if (topic.currentProgress < 0.8) {
      return "application"
    } else {
      return "review"
    }
  }

  /**
   * Generate learning goals for topic
   */
  generateTopicGoals(topic) {
    const goals = []

    switch (topic.difficulty) {
      case 1:
        goals.push("Understand basic concepts", "Complete introductory exercises")
        break
      case 2:
        goals.push("Apply concepts to examples", "Solve intermediate problems")
        break
      case 3:
        goals.push("Master advanced techniques", "Solve complex problems")
        break
    }

    if (topic.currentProgress > 0.5) {
      goals.push("Achieve 80% quiz accuracy")
    }

    return goals
  }

  /**
   * Add adaptive elements to schedule
   */
  async addAdaptiveElements(schedule, bktProgress) {
    const adaptiveSchedule = schedule.map((item, index) => {
      const adaptiveItem = { ...item }

      // Add review sessions for previous topics
      if (index > 0 && index % 3 === 0) {
        adaptiveItem.includeReview = true
        adaptiveItem.reviewTopics = schedule.slice(Math.max(0, index - 3), index).map((s) => s.topicId)
      }

      // Add quiz recommendations
      if (item.sessionType === "practice" || item.sessionType === "application") {
        adaptiveItem.recommendQuiz = true
        adaptiveItem.quizDifficulty = this.calculateQuizDifficulty(item, bktProgress)
      }

      // Add break recommendations
      if (item.estimatedMinutes > 45) {
        adaptiveItem.recommendBreaks = true
        adaptiveItem.breakIntervals = Math.ceil(item.estimatedMinutes / 25) // Pomodoro-style
      }

      return adaptiveItem
    })

    return adaptiveSchedule
  }

  /**
   * Calculate recommended quiz difficulty
   */
  calculateQuizDifficulty(scheduleItem, bktProgress) {
    const topicProgress = bktProgress?.proficiency[scheduleItem.topicId]
    const probability = topicProgress?.probability || 0.1

    if (probability < 0.4) return "easy"
    if (probability < 0.7) return "medium"
    return "hard"
  }

  /**
   * Calculate total duration of plan
   */
  calculateTotalDuration(schedule) {
    const totalMinutes = schedule.reduce((sum, item) => sum + item.estimatedMinutes, 0)
    const totalDays = new Set(schedule.map((item) => item.date)).size

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalDays,
      averageMinutesPerDay: Math.round(totalMinutes / totalDays),
    }
  }

  /**
   * Analyze difficulty progression
   */
  analyzeDifficultyProgression(topicSequence) {
    const difficulties = topicSequence.map((topic) => topic.difficulty)
    const avgDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length

    return {
      averageDifficulty: Math.round(avgDifficulty * 10) / 10,
      progression: difficulties,
      isProgressive: this.isProgressiveSequence(difficulties),
      difficultySpread: Math.max(...difficulties) - Math.min(...difficulties),
    }
  }

  /**
   * Check if difficulty sequence is progressive
   */
  isProgressiveSequence(difficulties) {
    let increasing = 0
    let decreasing = 0

    for (let i = 1; i < difficulties.length; i++) {
      if (difficulties[i] > difficulties[i - 1]) increasing++
      else if (difficulties[i] < difficulties[i - 1]) decreasing++
    }

    return increasing >= decreasing // More increasing than decreasing
  }

  /**
   * Suggest next optimal action for user
   * @param {string} userId - User ID
   * @returns {Object} Next action suggestion
   */
  async suggestNextAction(userId) {
    await this.initialize()

    try {
      const currentPlan = await this.planModel.getPlan(userId)
      const bktProgress = await this.studentManager.getProficiency(userId)

      if (!currentPlan) {
        return {
          action: "create_plan",
          reason: "No study plan found",
          priority: "high",
          estimatedTime: 5,
        }
      }

      // Use coordinator to get comprehensive suggestion
      const workflowResult = await this.coordinator.executeWorkflow("daily_planning", {
        userId,
      })

      return {
        action: workflowResult.result.suggestion.action,
        topic: workflowResult.result.suggestion.topic,
        reason: workflowResult.result.suggestion.reason,
        priority: workflowResult.result.priority,
        estimatedTime: workflowResult.result.estimatedTime.total,
        details: workflowResult.result,
      }
    } catch (error) {
      console.error("Error suggesting next action:", error)
      return {
        action: "study",
        reason: "Default recommendation",
        priority: "medium",
        estimatedTime: 30,
      }
    }
  }

  /**
   * Optimize existing plan based on performance
   * @param {string} userId - User ID
   * @returns {Object} Optimization suggestions
   */
  async optimizeExistingPlan(userId) {
    await this.initialize()

    try {
      const currentPlan = await this.planModel.getPlan(userId)
      const bktProgress = await this.studentManager.getProficiency(userId)

      if (!currentPlan) {
        throw new Error("No plan to optimize")
      }

      const optimization = await this.coordinator.executeAgent("PlannerAgent", {
        action: "optimize_plan",
        userId,
        planData: currentPlan,
        bktProgress,
      })

      return optimization.result
    } catch (error) {
      console.error("Error optimizing plan:", error)
      throw error
    }
  }
}

// Export singleton instance
export const intelligentPlanner = new IntelligentPlanner()
