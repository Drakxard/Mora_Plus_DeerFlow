/**
 * Student Manager - Integrates BKT with persistence and API
 * Manages student profiles, progress tracking, and adaptive recommendations
 */

import { AdaptiveLearningEngine } from "./adaptive-engine.js"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { dirname } from "path"

export class StudentManager {
  constructor(dataPath = "data/students.json") {
    this.dataPath = dataPath
    this.students = new Map() // studentId -> AdaptiveLearningEngine
    this.loadStudentData()
  }

  /**
   * Load student data from persistence
   */
  loadStudentData() {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, "utf8"))

        for (const [studentId, studentData] of Object.entries(data)) {
          const engine = new AdaptiveLearningEngine()
          engine.importData(studentData)
          this.students.set(studentId, engine)
        }

        console.log(`📚 Loaded ${this.students.size} student profiles`)
      } else {
        console.log("📚 No existing student data found, starting fresh")
      }
    } catch (error) {
      console.error("❌ Error loading student data:", error)
    }
  }

  /**
   * Save student data to persistence
   */
  saveStudentData() {
    try {
      const data = {}
      for (const [studentId, engine] of this.students.entries()) {
        data[studentId] = engine.exportData()
      }

      // Ensure directory exists
      const dir = dirname(this.dataPath)
      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2))
      console.log(`💾 Saved data for ${this.students.size} students`)
    } catch (error) {
      console.error("❌ Error saving student data:", error)
    }
  }

  /**
   * Get or create student engine
   */
  getStudentEngine(studentId) {
    if (!this.students.has(studentId)) {
      console.log(`👤 Creating new student profile: ${studentId}`)
      this.students.set(studentId, new AdaptiveLearningEngine())
    }
    return this.students.get(studentId)
  }

  /**
   * Process student interaction and get adaptive response
   */
  processStudentInteraction(studentId, interaction) {
    const engine = this.getStudentEngine(studentId)
    const result = engine.processInteraction(interaction)

    // Auto-save after each interaction
    this.saveStudentData()

    console.log(
      `📊 Processed interaction for ${studentId}: ${interaction.type} - ${interaction.isCorrect ? "✅" : "❌"}`,
    )

    return result
  }

  /**
   * Get student dashboard with comprehensive analytics
   */
  getStudentDashboard(studentId) {
    const engine = this.getStudentEngine(studentId)
    const dashboard = engine.getStudentDashboard()

    return {
      studentId,
      dashboard,
      lastUpdate: new Date().toISOString(),
      profileAge: this.getProfileAge(studentId),
    }
  }

  /**
   * Get adaptive content recommendations for student
   */
  getAdaptiveRecommendations(studentId, currentTopic = null) {
    const engine = this.getStudentEngine(studentId)

    if (currentTopic) {
      return engine.generateRecommendations(currentTopic)
    }

    // Get global recommendations
    return engine.getGlobalRecommendations()
  }

  /**
   * Get student's mastery levels for all topics
   */
  getStudentMastery(studentId) {
    const engine = this.getStudentEngine(studentId)
    const bktModel = engine.bktModel

    const mastery = {}
    for (const [topicId, state] of Object.entries(bktModel.studentState)) {
      mastery[topicId] = {
        level: Math.round(state.mastery * 100),
        difficulty: state.difficulty,
        attempts: state.attempts,
        accuracy: state.attempts > 0 ? Math.round((state.correctAnswers / state.attempts) * 100) : 0,
        lastUpdate: state.lastUpdate,
      }
    }

    return mastery
  }

  /**
   * Generate adaptive quiz for student
   */
  generateAdaptiveQuiz(studentId, requestedTopic = null, questionCount = 3) {
    const engine = this.getStudentEngine(studentId)
    const mastery = this.getStudentMastery(studentId)

    // Select optimal topic if not specified
    let targetTopic = requestedTopic
    if (!targetTopic) {
      targetTopic = this.selectOptimalTopic(mastery)
    }

    // Get adaptive difficulty for the topic
    const adaptive = engine.bktModel.getAdaptiveDifficulty(targetTopic)

    return {
      studentId,
      targetTopic,
      adaptiveLevel: adaptive.level,
      currentMastery: Math.round(adaptive.mastery * 100),
      recommendation: adaptive.recommendation,
      questionCount,
      metadata: {
        selectedReason: requestedTopic ? "user_requested" : "adaptive_selection",
        difficulty: adaptive.level,
        masteryLevel: adaptive.mastery,
      },
    }
  }

  /**
   * Select optimal topic for practice based on mastery levels
   */
  selectOptimalTopic(mastery) {
    const topics = Object.keys(mastery)

    if (topics.length === 0) {
      return "general_math" // Default for new students
    }

    // Find topics in the "sweet spot" (30-70% mastery) for optimal learning
    const optimalTopics = topics.filter((topic) => {
      const level = mastery[topic].level
      return level >= 20 && level <= 80
    })

    if (optimalTopics.length > 0) {
      // Select topic with lowest mastery in optimal range
      return optimalTopics.sort((a, b) => mastery[a].level - mastery[b].level)[0]
    }

    // If no optimal topics, select lowest mastery topic
    return topics.sort((a, b) => mastery[a].level - mastery[b].level)[0]
  }

  /**
   * Create personalized study plan
   */
  createPersonalizedPlan(studentId, duration = 7, dailyTime = 30) {
    const engine = this.getStudentEngine(studentId)
    const mastery = this.getStudentMastery(studentId)
    const recommendations = engine.getGlobalRecommendations()

    const plan = {
      studentId,
      duration: `${duration} days`,
      dailyTime: `${dailyTime} minutes`,
      createdAt: new Date().toISOString(),
      schedule: [],
      goals: [],
    }

    // Create daily schedule based on mastery levels
    for (let day = 1; day <= duration; day++) {
      const dayPlan = this.createDayPlan(mastery, day, dailyTime)
      plan.schedule.push(dayPlan)
    }

    // Set learning goals based on current state
    plan.goals = this.generateLearningGoals(mastery, recommendations)

    return plan
  }

  /**
   * Create plan for a specific day
   */
  createDayPlan(mastery, dayNumber, dailyTime) {
    const topics = Object.keys(mastery)

    if (topics.length === 0) {
      return {
        day: dayNumber,
        focus: "introduction",
        activities: [
          {
            type: "introduction",
            topic: "general_math",
            time: dailyTime,
            description: "Introducción a conceptos básicos",
          },
        ],
        totalTime: dailyTime,
      }
    }

    // Prioritize topics based on mastery and learning theory
    const prioritizedTopics = this.prioritizeTopicsForDay(mastery, dayNumber)

    const activities = []
    let remainingTime = dailyTime

    for (const topic of prioritizedTopics) {
      if (remainingTime <= 0) break

      const topicMastery = mastery[topic]
      const timeAllocation = Math.min(remainingTime, this.calculateTimeAllocation(topicMastery, remainingTime))

      activities.push({
        type: this.selectActivityType(topicMastery),
        topic: topic,
        time: timeAllocation,
        description: this.generateActivityDescription(topic, topicMastery),
        targetMastery: Math.min(100, topicMastery.level + 10), // Aim for 10% improvement
      })

      remainingTime -= timeAllocation
    }

    return {
      day: dayNumber,
      focus: prioritizedTopics[0] || "general",
      activities,
      totalTime: dailyTime - remainingTime,
    }
  }

  /**
   * Prioritize topics for a specific day
   */
  prioritizeTopicsForDay(mastery, dayNumber) {
    const topics = Object.keys(mastery)

    // Different strategies for different days
    if (dayNumber <= 2) {
      // First days: focus on weakest topics
      return topics.sort((a, b) => mastery[a].level - mastery[b].level)
    } else if (dayNumber <= 5) {
      // Middle days: balanced approach
      return topics.sort((a, b) => {
        const scoreA = mastery[a].level + mastery[a].attempts * 5
        const scoreB = mastery[b].level + mastery[b].attempts * 5
        return scoreA - scoreB
      })
    } else {
      // Final days: reinforce strong topics and challenge
      return topics.sort((a, b) => mastery[b].level - mastery[a].level)
    }
  }

  /**
   * Calculate time allocation for a topic
   */
  calculateTimeAllocation(topicMastery, remainingTime) {
    const { level } = topicMastery

    if (level < 30) {
      // Weak topics need more time
      return Math.min(remainingTime, 20)
    } else if (level < 70) {
      // Moderate topics get standard time
      return Math.min(remainingTime, 15)
    } else {
      // Strong topics get maintenance time
      return Math.min(remainingTime, 10)
    }
  }

  /**
   * Select activity type based on mastery
   */
  selectActivityType(topicMastery) {
    const { level, accuracy } = topicMastery

    if (level < 30 || accuracy < 50) {
      return "review"
    } else if (level < 60) {
      return "practice"
    } else if (level < 80) {
      return "challenge"
    } else {
      return "mastery"
    }
  }

  /**
   * Generate activity description
   */
  generateActivityDescription(topic, topicMastery) {
    const { level, difficulty } = topicMastery
    const activityType = this.selectActivityType(topicMastery)

    const descriptions = {
      review: `Repasa conceptos básicos de ${topic} (nivel ${difficulty})`,
      practice: `Practica ejercicios de ${topic} (${level}% dominado)`,
      challenge: `Resuelve problemas desafiantes de ${topic}`,
      mastery: `Aplica ${topic} en contextos avanzados`,
    }

    return descriptions[activityType] || `Estudia ${topic}`
  }

  /**
   * Generate learning goals based on current state
   */
  generateLearningGoals(mastery, recommendations) {
    const goals = []
    const topics = Object.keys(mastery)

    if (topics.length === 0) {
      return [
        { type: "foundation", description: "Establecer base sólida en matemáticas", target: "30% mastery in 3 topics" },
      ]
    }

    // Goal 1: Improve weakest topic
    const weakestTopic = topics.sort((a, b) => mastery[a].level - mastery[b].level)[0]
    if (mastery[weakestTopic].level < 60) {
      goals.push({
        type: "improvement",
        description: `Mejorar dominio en ${weakestTopic}`,
        current: `${mastery[weakestTopic].level}%`,
        target: `${Math.min(100, mastery[weakestTopic].level + 20)}%`,
        priority: "high",
      })
    }

    // Goal 2: Maintain strong topics
    const strongTopics = topics.filter((topic) => mastery[topic].level > 70)
    if (strongTopics.length > 0) {
      goals.push({
        type: "maintenance",
        description: `Mantener nivel alto en ${strongTopics.length} tema(s)`,
        current: `${strongTopics.length} temas > 70%`,
        target: "Mantener o mejorar",
        priority: "medium",
      })
    }

    // Goal 3: Overall progress
    const avgMastery = topics.reduce((sum, topic) => sum + mastery[topic].level, 0) / topics.length
    goals.push({
      type: "overall",
      description: "Progreso general en matemáticas",
      current: `${Math.round(avgMastery)}% promedio`,
      target: `${Math.min(100, Math.round(avgMastery) + 15)}% promedio`,
      priority: "medium",
    })

    return goals
  }

  /**
   * Get profile age in days
   */
  getProfileAge(studentId) {
    const engine = this.getStudentEngine(studentId)
    const sessions = engine.sessionHistory

    if (sessions.length === 0) return 0

    const firstSession = new Date(sessions[0].timestamp)
    const now = new Date()
    return Math.floor((now - firstSession) / (1000 * 60 * 60 * 24))
  }

  /**
   * Get all students summary
   */
  getAllStudentsSummary() {
    const summary = {
      totalStudents: this.students.size,
      students: [],
      globalStats: {
        totalInteractions: 0,
        avgMastery: 0,
        activeStudents: 0,
      },
    }

    let totalMastery = 0
    let totalInteractions = 0

    for (const [studentId, engine] of this.students.entries()) {
      const dashboard = engine.getStudentDashboard()
      const mastery = this.getStudentMastery(studentId)

      const studentSummary = {
        studentId,
        profileAge: this.getProfileAge(studentId),
        topicsCount: Object.keys(mastery).length,
        avgMastery: dashboard.overall?.overallMastery ? Math.round(dashboard.overall.overallMastery * 100) : 0,
        totalInteractions: engine.sessionHistory.length,
        lastActive:
          engine.sessionHistory.length > 0 ? engine.sessionHistory[engine.sessionHistory.length - 1].timestamp : null,
      }

      summary.students.push(studentSummary)
      totalMastery += studentSummary.avgMastery
      totalInteractions += studentSummary.totalInteractions

      if (studentSummary.totalInteractions > 0) {
        summary.globalStats.activeStudents++
      }
    }

    if (summary.totalStudents > 0) {
      summary.globalStats.avgMastery = Math.round(totalMastery / summary.totalStudents)
    }
    summary.globalStats.totalInteractions = totalInteractions

    return summary
  }
}
