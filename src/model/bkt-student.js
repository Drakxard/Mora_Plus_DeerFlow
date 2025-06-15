/**
 * Bayesian Knowledge Tracing (BKT) Student Model
 * Tracks student mastery probability for each topic/concept
 */

export class BKTStudentModel {
  constructor() {
    // BKT Parameters (can be tuned)
    this.params = {
      // Prior probability of knowing the skill initially
      L0: 0.1,
      // Probability of learning the skill on each opportunity
      T: 0.3,
      // Probability of guessing correctly when not knowing
      G: 0.2,
      // Probability of slipping (making mistake when knowing)
      S: 0.1,
    }

    // Student state: { topicId: { mastery: probability, attempts: count, lastUpdate: timestamp } }
    this.studentState = {}
  }

  /**
   * Initialize or get topic mastery state
   */
  getTopicState(topicId) {
    if (!this.studentState[topicId]) {
      this.studentState[topicId] = {
        mastery: this.params.L0, // Start with prior probability
        attempts: 0,
        correctAnswers: 0,
        lastUpdate: new Date().toISOString(),
        difficulty: "beginner", // beginner, intermediate, advanced
        interactions: [],
      }
    }
    return this.studentState[topicId]
  }

  /**
   * Update mastery probability based on student response
   * @param {string} topicId - Topic identifier
   * @param {boolean} isCorrect - Whether student answered correctly
   * @param {string} interactionType - 'quiz', 'chat', 'exercise'
   * @param {Object} metadata - Additional context
   */
  updateMastery(topicId, isCorrect, interactionType = "quiz", metadata = {}) {
    const state = this.getTopicState(topicId)

    // Record interaction
    state.interactions.push({
      timestamp: new Date().toISOString(),
      type: interactionType,
      correct: isCorrect,
      metadata,
    })

    state.attempts++
    if (isCorrect) state.correctAnswers++

    // BKT Update Formula
    const L_prev = state.mastery
    const { T, G, S } = this.params

    let L_new
    if (isCorrect) {
      // Student answered correctly
      L_new = (L_prev * (1 - S)) / (L_prev * (1 - S) + (1 - L_prev) * G)
    } else {
      // Student answered incorrectly
      L_new = (L_prev * S) / (L_prev * S + (1 - L_prev) * (1 - G))
    }

    // Apply learning opportunity (chance to learn from this interaction)
    L_new = L_new + (1 - L_new) * T

    // Ensure bounds [0, 1]
    state.mastery = Math.max(0, Math.min(1, L_new))
    state.lastUpdate = new Date().toISOString()

    // Update difficulty level based on mastery
    if (state.mastery < 0.3) {
      state.difficulty = "beginner"
    } else if (state.mastery < 0.7) {
      state.difficulty = "intermediate"
    } else {
      state.difficulty = "advanced"
    }

    console.log(`📊 BKT Update: ${topicId} - Mastery: ${(state.mastery * 100).toFixed(1)}% (${state.difficulty})`)

    return state
  }

  /**
   * Get adaptive content difficulty for a topic
   */
  getAdaptiveDifficulty(topicId) {
    const state = this.getTopicState(topicId)
    return {
      level: state.difficulty,
      mastery: state.mastery,
      recommendation: this.getRecommendation(state),
    }
  }

  /**
   * Get learning recommendation based on mastery
   */
  getRecommendation(state) {
    if (state.mastery < 0.2) {
      return {
        action: "review_basics",
        message: "Necesitas repasar los conceptos fundamentales",
        contentType: "explanation",
      }
    } else if (state.mastery < 0.5) {
      return {
        action: "practice",
        message: "Practica con ejercicios guiados",
        contentType: "guided_practice",
      }
    } else if (state.mastery < 0.8) {
      return {
        action: "challenge",
        message: "Intenta problemas más desafiantes",
        contentType: "advanced_problems",
      }
    } else {
      return {
        action: "mastery",
        message: "¡Excelente dominio! Puedes enseñar a otros",
        contentType: "teaching_mode",
      }
    }
  }

  /**
   * Get overall student progress summary
   */
  getProgressSummary() {
    const topics = Object.keys(this.studentState)
    if (topics.length === 0) return null

    const totalMastery = topics.reduce((sum, topic) => sum + this.studentState[topic].mastery, 0)
    const avgMastery = totalMastery / topics.length

    const topicsByLevel = {
      beginner: topics.filter((t) => this.studentState[t].difficulty === "beginner"),
      intermediate: topics.filter((t) => this.studentState[t].difficulty === "intermediate"),
      advanced: topics.filter((t) => this.studentState[t].difficulty === "advanced"),
    }

    return {
      overallMastery: avgMastery,
      topicsCount: topics.length,
      distribution: {
        beginner: topicsByLevel.beginner.length,
        intermediate: topicsByLevel.intermediate.length,
        advanced: topicsByLevel.advanced.length,
      },
      recommendations: this.getGlobalRecommendations(topicsByLevel, avgMastery),
    }
  }

  /**
   * Get global learning recommendations
   */
  getGlobalRecommendations(topicsByLevel, avgMastery) {
    const recommendations = []

    if (topicsByLevel.beginner.length > topicsByLevel.intermediate.length + topicsByLevel.advanced.length) {
      recommendations.push({
        priority: "high",
        message: "Enfócate en dominar los conceptos básicos antes de avanzar",
        topics: topicsByLevel.beginner.slice(0, 3),
      })
    }

    if (avgMastery > 0.7 && topicsByLevel.advanced.length > 0) {
      recommendations.push({
        priority: "medium",
        message: "Estás listo para contenido más avanzado",
        topics: topicsByLevel.advanced.slice(0, 2),
      })
    }

    if (avgMastery < 0.3) {
      recommendations.push({
        priority: "high",
        message: "Considera revisar los fundamentos o cambiar el enfoque de estudio",
        topics: [],
      })
    }

    return recommendations
  }

  /**
   * Export student data for persistence
   */
  exportData() {
    return {
      studentState: this.studentState,
      params: this.params,
      exportDate: new Date().toISOString(),
    }
  }

  /**
   * Import student data from persistence
   */
  importData(data) {
    if (data.studentState) {
      this.studentState = data.studentState
    }
    if (data.params) {
      this.params = { ...this.params, ...data.params }
    }
  }
}
