/**
 * Topic Extractor - Identifies topics from chunks and questions
 * Maps content to learning objectives and concepts
 */

export class TopicExtractor {
  constructor() {
    // Predefined topic mappings for mathematics
    this.topicMappings = {
      // Calculus topics
      derivadas: ["calculus", "derivatives", "differentiation"],
      integrales: ["calculus", "integrals", "integration"],
      límites: ["calculus", "limits"],
      continuidad: ["calculus", "continuity"],

      // Algebra topics
      ecuaciones: ["algebra", "equations"],
      funciones: ["algebra", "functions"],
      polinomios: ["algebra", "polynomials"],
      logaritmos: ["algebra", "logarithms"],

      // Geometry topics
      geometría: ["geometry", "shapes"],
      trigonometría: ["geometry", "trigonometry"],
      vectores: ["geometry", "vectors"],
      coordenadas: ["geometry", "coordinates"],

      // Statistics topics
      probabilidad: ["statistics", "probability"],
      estadística: ["statistics", "descriptive"],
      distribuciones: ["statistics", "distributions"],
    }

    // Topic hierarchy (prerequisite relationships)
    this.prerequisites = {
      derivatives: ["functions", "limits"],
      integrals: ["derivatives", "functions"],
      trigonometry: ["functions", "geometry"],
      vectors: ["geometry", "coordinates"],
    }
  }

  /**
   * Extract topics from text content
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of identified topics
   */
  extractTopicsFromText(text) {
    const textLower = text.toLowerCase()
    const foundTopics = []

    // Check for direct topic matches
    for (const [keyword, topics] of Object.entries(this.topicMappings)) {
      if (textLower.includes(keyword)) {
        foundTopics.push(...topics)
      }
    }

    // Advanced pattern matching
    const patterns = {
      derivatives: /derivad[ao]s?|diferencial|d\/dx|f'|derivar/gi,
      integrals: /integral|integrar|∫|antiderivada/gi,
      functions: /función|funciones|f$$x$$|dominio|rango/gi,
      equations: /ecuación|ecuaciones|resolver|=|igualdad/gi,
      geometry: /triángulo|círculo|área|perímetro|volumen/gi,
      limits: /límite|límites|tiende|aproxima|lim/gi,
    }

    for (const [topic, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        foundTopics.push(topic)
      }
    }

    // Remove duplicates and return
    return [...new Set(foundTopics)]
  }

  /**
   * Extract topics from a quiz question and answer
   * @param {string} question - Quiz question
   * @param {string} answer - Student answer
   * @param {boolean} isCorrect - Whether answer was correct
   * @returns {Object} - Topic analysis
   */
  analyzeQuizInteraction(question, answer, isCorrect) {
    const questionTopics = this.extractTopicsFromText(question)
    const answerTopics = this.extractTopicsFromText(answer)

    // Combine and prioritize question topics
    const allTopics = [...new Set([...questionTopics, ...answerTopics])]

    // Determine primary topic (most specific)
    const primaryTopic = this.selectPrimaryTopic(allTopics, question)

    return {
      primaryTopic,
      allTopics,
      difficulty: this.estimateDifficulty(question),
      conceptsInvolved: this.identifyConcepts(question),
      isCorrect,
    }
  }

  /**
   * Select the most specific/relevant topic
   */
  selectPrimaryTopic(topics, context) {
    if (topics.length === 0) return "general_math"
    if (topics.length === 1) return topics[0]

    // Prioritize more specific topics
    const specificity = {
      derivatives: 3,
      integrals: 3,
      trigonometry: 3,
      functions: 2,
      equations: 2,
      geometry: 2,
      algebra: 1,
      calculus: 1,
      statistics: 1,
    }

    return topics.sort((a, b) => (specificity[b] || 0) - (specificity[a] || 0))[0]
  }

  /**
   * Estimate difficulty based on question complexity
   */
  estimateDifficulty(question) {
    const complexityIndicators = {
      beginner: ["básico", "simple", "qué es", "definir", "concepto"],
      intermediate: ["calcular", "resolver", "aplicar", "demostrar"],
      advanced: ["analizar", "optimizar", "demostrar", "generalizar", "derivar"],
    }

    const questionLower = question.toLowerCase()

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some((indicator) => questionLower.includes(indicator))) {
        return level
      }
    }

    // Default based on length and mathematical notation
    if (question.length > 200 || /∫|∑|∏|∂/.test(question)) {
      return "advanced"
    } else if (question.length > 100 || /[fx]\(|d\/dx/.test(question)) {
      return "intermediate"
    }

    return "beginner"
  }

  /**
   * Identify specific mathematical concepts
   */
  identifyConcepts(text) {
    const concepts = []
    const conceptPatterns = {
      chain_rule: /regla.*cadena|chain.*rule/gi,
      product_rule: /regla.*producto|product.*rule/gi,
      quotient_rule: /regla.*cociente|quotient.*rule/gi,
      fundamental_theorem: /teorema.*fundamental/gi,
      substitution: /sustitución|substitution/gi,
      integration_by_parts: /integración.*partes|integration.*parts/gi,
    }

    for (const [concept, pattern] of Object.entries(conceptPatterns)) {
      if (pattern.test(text)) {
        concepts.push(concept)
      }
    }

    return concepts
  }

  /**
   * Get learning path based on current topics and mastery
   */
  suggestLearningPath(currentTopics, masteryLevels) {
    const path = []

    for (const topic of currentTopics) {
      const prerequisites = this.prerequisites[topic] || []
      const unmetPrereqs = prerequisites.filter((prereq) => !masteryLevels[prereq] || masteryLevels[prereq] < 0.6)

      if (unmetPrereqs.length > 0) {
        path.push({
          action: "review_prerequisites",
          topic: topic,
          prerequisites: unmetPrereqs,
          message: `Antes de ${topic}, repasa: ${unmetPrereqs.join(", ")}`,
        })
      } else {
        path.push({
          action: "continue",
          topic: topic,
          message: `Continúa con ${topic}`,
        })
      }
    }

    return path
  }
}
