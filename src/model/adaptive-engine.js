/**
 * Adaptive Learning Engine
 * Combines BKT model with content selection and difficulty adjustment
 */

import { BKTStudentModel } from "./bkt-student.js"
import { TopicExtractor } from "./topic-extractor.js"

export class AdaptiveLearningEngine {
  constructor() {
    this.bktModel = new BKTStudentModel()
    this.topicExtractor = new TopicExtractor()
    this.sessionHistory = []
  }

  /**
   * Process a student interaction and update models
   * @param {Object} interaction - Student interaction data
   * @returns {Object} - Updated state and recommendations
   */
  processInteraction(interaction) {
    const { question, answer, isCorrect, type, metadata = {} } = interaction

    // Extract topics from the interaction
    const topicAnalysis = this.topicExtractor.analyzeQuizInteraction(question, answer, isCorrect)

    // Update BKT model for primary topic
    const updatedState = this.bktModel.updateMastery(topicAnalysis.primaryTopic, isCorrect, type, {
      ...metadata,
      ...topicAnalysis,
    })

    // Record session history
    this.sessionHistory.push({
      timestamp: new Date().toISOString(),
      topic: topicAnalysis.primaryTopic,
      isCorrect,
      type,
      mastery: updatedState.mastery,
      difficulty: updatedState.difficulty,
    })

    // Generate adaptive recommendations
    const recommendations = this.generateRecommendations(topicAnalysis.primaryTopic)

    return {
      topicAnalysis,
      updatedState,
      recommendations,
      nextAction: this.suggestNextAction(topicAnalysis.primaryTopic),
    }
  }

  /**
   * Generate personalized content recommendations
   */
  generateRecommendations(topicId) {
    const state = this.bktModel.getTopicState(topicId)
    const adaptive = this.bktModel.getAdaptiveDifficulty(topicId)

    const recommendations = {
      immediate: adaptive.recommendation,
      content: this.selectAdaptiveContent(topicId, state),
      study: this.suggestStudyStrategy(state),
      next_topics: this.suggestNextTopics(topicId, state.mastery),
    }

    return recommendations
  }

  /**
   * Select content based on student's current level
   */
  selectAdaptiveContent(topicId, state) {
    const { mastery, difficulty } = state

    if (mastery < 0.3) {
      return {
        type: "explanation",
        difficulty: "basic",
        focus: "conceptual_understanding",
        message: "Enfócate en entender los conceptos fundamentales",
      }
    } else if (mastery < 0.6) {
      return {
        type: "guided_practice",
        difficulty: "intermediate",
        focus: "skill_building",
        message: "Practica con ejercicios paso a paso",
      }
    } else if (mastery < 0.8) {
      return {
        type: "problem_solving",
        difficulty: "advanced",
        focus: "application",
        message: "Resuelve problemas más complejos",
      }
    } else {
      return {
        type: "mastery_challenge",
        difficulty: "expert",
        focus: "synthesis",
        message: "Explora aplicaciones avanzadas y enseña a otros",
      }
    }
  }

  /**
   * Suggest study strategy based on performance
   */
  suggestStudyStrategy(state) {
    const recentInteractions = state.interactions.slice(-5)
    const recentCorrect = recentInteractions.filter((i) => i.correct).length
    const accuracy = recentCorrect / Math.max(recentInteractions.length, 1)

    if (accuracy < 0.4) {
      return {
        strategy: "review_and_reinforce",
        message: "Tómate tiempo para revisar conceptos básicos",
        timeRecommendation: "15-20 minutos de repaso antes de continuar",
      }
    } else if (accuracy < 0.7) {
      return {
        strategy: "mixed_practice",
        message: "Alterna entre repaso y nuevos problemas",
        timeRecommendation: "10 minutos repaso + 15 minutos práctica nueva",
      }
    } else {
      return {
        strategy: "advance_and_challenge",
        message: "Estás listo para contenido más desafiante",
        timeRecommendation: "20-30 minutos de problemas avanzados",
      }
    }
  }

  /**
   * Suggest next topics based on mastery and prerequisites
   */
  suggestNextTopics(currentTopic, mastery) {
    const suggestions = []

    if (mastery > 0.7) {
      // Student has good mastery, suggest advanced topics
      const advancedTopics = {
        derivatives: ["integrals", "differential_equations"],
        functions: ["derivatives", "trigonometry"],
        algebra: ["calculus", "linear_algebra"],
        geometry: ["vectors", "analytical_geometry"],
      }

      if (advancedTopics[currentTopic]) {
        suggestions.push(...advancedTopics[currentTopic])
      }
    } else if (mastery < 0.4) {
      // Student needs more foundation, suggest prerequisites
      const prerequisites = {
        derivatives: ["functions", "limits"],
        integrals: ["derivatives", "functions"],
        trigonometry: ["geometry", "functions"],
      }

      if (prerequisites[currentTopic]) {
        suggestions.push(...prerequisites[currentTopic])
      }
    }

    return suggestions
  }

  /**
   * Suggest next action for the student
   */
  suggestNextAction(topicId) {
    const state = this.bktModel.getTopicState(topicId)
    const { mastery, attempts } = state

    if (attempts < 3) {
      return {
        action: "continue_practice",
        message: "Continúa practicando para evaluar mejor tu nivel",
        confidence: "low",
      }
    }

    if (mastery < 0.4) {
      return {
        action: "review_concepts",
        message: "Repasa los conceptos fundamentales antes de continuar",
        confidence: "high",
      }
    } else if (mastery < 0.7) {
      return {
        action: "guided_practice",
        message: "Practica con ejercicios guiados",
        confidence: "medium",
      }
    } else {
      return {
        action: "advance_topic",
        message: "Estás listo para avanzar al siguiente nivel",
        confidence: "high",
      }
    }
  }

  /**
   * Get comprehensive student dashboard
   */
  getStudentDashboard() {
    const progressSummary = this.bktModel.getProgressSummary()
    const recentSession = this.sessionHistory.slice(-10)

    return {
      overall: progressSummary,
      recent_performance: this.analyzeRecentPerformance(recentSession),
      learning_trajectory: this.analyzeLearningTrajectory(),
      recommendations: this.getGlobalRecommendations(),
    }
  }

  /**
   * Analyze recent performance trends
   */
  analyzeRecentPerformance(recentSession) {
    if (recentSession.length === 0) return null

    const accuracy = recentSession.filter((s) => s.isCorrect).length / recentSession.length
    const avgMastery = recentSession.reduce((sum, s) => sum + s.mastery, 0) / recentSession.length

    const trend = this.calculateTrend(recentSession.map((s) => s.mastery))

    return {
      accuracy: Math.round(accuracy * 100),
      avgMastery: Math.round(avgMastery * 100),
      trend: trend > 0.05 ? "improving" : trend < -0.05 ? "declining" : "stable",
      sessionsCount: recentSession.length,
    }
  }

  /**
   * Calculate learning trajectory
   */
  analyzeLearningTrajectory() {
    const topicProgression = {}

    for (const session of this.sessionHistory) {
      if (!topicProgression[session.topic]) {
        topicProgression[session.topic] = []
      }
      topicProgression[session.topic].push(session.mastery)
    }

    const trajectories = {}
    for (const [topic, masteryHistory] of Object.entries(topicProgression)) {
      trajectories[topic] = {
        trend: this.calculateTrend(masteryHistory),
        current: masteryHistory[masteryHistory.length - 1],
        sessions: masteryHistory.length,
      }
    }

    return trajectories
  }

  /**
   * Calculate trend from array of values
   */
  calculateTrend(values) {
    if (values.length < 2) return 0

    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  }

  /**
   * Get global recommendations for the student
   */
  getGlobalRecommendations() {
    const dashboard = this.bktModel.getProgressSummary()
    if (!dashboard) return []

    const recommendations = []

    if (dashboard.overallMastery < 0.3) {
      recommendations.push({
        priority: "high",
        type: "foundation",
        message: "Enfócate en dominar los conceptos fundamentales",
        action: "review_basics",
      })
    }

    if (dashboard.distribution.beginner > dashboard.distribution.intermediate + dashboard.distribution.advanced) {
      recommendations.push({
        priority: "medium",
        type: "progression",
        message: "Considera avanzar gradualmente a temas intermedios",
        action: "gradual_advancement",
      })
    }

    return recommendations
  }

  /**
   * Export all adaptive learning data
   */
  exportData() {
    return {
      bktModel: this.bktModel.exportData(),
      sessionHistory: this.sessionHistory,
      exportDate: new Date().toISOString(),
    }
  }

  /**
   * Import adaptive learning data
   */
  importData(data) {
    if (data.bktModel) {
      this.bktModel.importData(data.bktModel)
    }
    if (data.sessionHistory) {
      this.sessionHistory = data.sessionHistory
    }
  }
}
