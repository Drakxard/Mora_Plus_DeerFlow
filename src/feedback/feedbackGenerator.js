/**
 * Adaptive Feedback Generator for Mora + DeerFlow
 * Generates personalized feedback based on quiz responses and BKT progress
 */

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

/**
 * Clase para generar feedback adaptativo
 */
export class FeedbackGenerator {
  constructor(studentManager) {
    this.studentManager = studentManager
  }

  /**
   * Genera feedback adaptativo para una respuesta de quiz
   * @param {Object} answerResult - Resultado de la respuesta
   * @param {Object} userProgress - Progreso del usuario en el tema
   * @param {string} adaptiveLevel - Nivel adaptativo del usuario
   * @returns {Object} Feedback generado
   */
  async generateFeedback(answerResult, userProgress, adaptiveLevel = "intermediate") {
    try {
      const { isCorrect, chunkText, explanation, selectedText, correctText } = answerResult

      // Generar feedback personalizado usando IA
      const feedback = await this.generatePersonalizedFeedback(
        isCorrect,
        chunkText,
        explanation,
        selectedText,
        correctText,
        adaptiveLevel,
      )

      // Generar sugerencias de estudio
      const studySuggestions = await this.generateStudySuggestions(chunkText, isCorrect, userProgress)

      return {
        type: isCorrect ? "success" : "improvement",
        message: feedback,
        studySuggestions,
        encouragement: this.generateEncouragement(isCorrect, userProgress),
        nextSteps: this.generateNextSteps(isCorrect, adaptiveLevel),
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error generating feedback:", error)
      return this.generateFallbackFeedback(answerResult.isCorrect)
    }
  }

  /**
   * Genera feedback personalizado usando IA
   * @param {boolean} isCorrect - Si la respuesta fue correcta
   * @param {string} chunkText - Texto del chunk original
   * @param {string} explanation - Explicación de la respuesta correcta
   * @param {string} selectedText - Texto de la opción seleccionada
   * @param {string} correctText - Texto de la respuesta correcta
   * @param {string} adaptiveLevel - Nivel adaptativo del usuario
   * @returns {string} Feedback personalizado
   */
  async generatePersonalizedFeedback(isCorrect, chunkText, explanation, selectedText, correctText, adaptiveLevel) {
    const prompt = `Genera feedback educativo personalizado para un estudiante de nivel ${adaptiveLevel}:

CONTEXTO:
- Respuesta del estudiante: ${isCorrect ? "CORRECTA" : "INCORRECTA"}
- Opción seleccionada: "${selectedText}"
- Respuesta correcta: "${correctText}"
- Explicación: "${explanation}"
- Texto de referencia: "${chunkText.substring(0, 200)}..."

INSTRUCCIONES:
1. ${
      isCorrect
        ? "Felicita al estudiante y refuerza el aprendizaje"
        : "Explica gentilmente por qué la respuesta no es correcta"
    }
2. Proporciona una explicación clara y educativa
3. Usa un tono ${adaptiveLevel === "beginner" ? "muy alentador y simple" : adaptiveLevel === "advanced" ? "técnico pero motivador" : "equilibrado y constructivo"}
4. Mantén el feedback entre 2-3 oraciones
5. No uses formato markdown, solo texto plano

Responde SOLO con el feedback, sin introducción:`

    const { text: feedback } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 150,
      temperature: 0.7,
    })

    return feedback.trim()
  }

  /**
   * Genera sugerencias de estudio personalizadas
   * @param {string} chunkText - Texto del chunk
   * @param {boolean} isCorrect - Si la respuesta fue correcta
   * @param {Object} userProgress - Progreso del usuario
   * @returns {Array} Array de sugerencias
   */
  async generateStudySuggestions(chunkText, isCorrect, userProgress) {
    if (isCorrect && userProgress?.probability > 0.7) {
      return [
        "¡Excelente! Considera explorar temas más avanzados relacionados",
        "Podrías ayudar a otros estudiantes con este tema",
        "Intenta aplicar este conocimiento en casos prácticos",
      ]
    }

    if (!isCorrect || userProgress?.probability < 0.5) {
      return [
        "Revisa el material de referencia nuevamente",
        "Practica con preguntas similares sobre este tema",
        "Considera repasar los conceptos fundamentales",
        "Busca ejemplos adicionales para reforzar el aprendizaje",
      ]
    }

    return [
      "Continúa practicando para consolidar el conocimiento",
      "Explora aspectos relacionados del tema",
      "Intenta conectar este concepto con otros que ya dominas",
    ]
  }

  /**
   * Genera mensaje de aliento basado en el progreso
   * @param {boolean} isCorrect - Si la respuesta fue correcta
   * @param {Object} userProgress - Progreso del usuario
   * @returns {string} Mensaje de aliento
   */
  generateEncouragement(isCorrect, userProgress) {
    const probability = userProgress?.probability || 0.1
    const interactions = userProgress?.interactions || 0

    if (isCorrect) {
      if (probability > 0.8) {
        return "¡Eres un experto en este tema! 🌟"
      } else if (probability > 0.6) {
        return "¡Muy bien! Estás progresando excelentemente 📈"
      } else {
        return "¡Correcto! Cada respuesta te acerca más al dominio 🎯"
      }
    } else {
      if (interactions < 3) {
        return "¡No te preocupes! Estás empezando a aprender 🌱"
      } else if (probability < 0.3) {
        return "Sigue intentando, cada error es una oportunidad de aprender 💪"
      } else {
        return "Casi lo tienes, sigue practicando 🔄"
      }
    }
  }

  /**
   * Genera pasos siguientes recomendados
   * @param {boolean} isCorrect - Si la respuesta fue correcta
   * @param {string} adaptiveLevel - Nivel adaptativo del usuario
   * @returns {Array} Array de pasos siguientes
   */
  generateNextSteps(isCorrect, adaptiveLevel) {
    if (isCorrect) {
      switch (adaptiveLevel) {
        case "beginner":
          return ["Continúa con la siguiente pregunta", "Repasa este concepto una vez más"]
        case "intermediate":
          return ["Avanza a preguntas más desafiantes", "Conecta este tema con otros relacionados"]
        case "advanced":
          return ["Explora aplicaciones avanzadas", "Considera casos de uso complejos"]
        default:
          return ["Continúa con el siguiente desafío"]
      }
    } else {
      return [
        "Revisa el material de referencia",
        "Intenta responder preguntas similares",
        "Consulta recursos adicionales si es necesario",
      ]
    }
  }

  /**
   * Genera feedback de respaldo si falla la generación con IA
   * @param {boolean} isCorrect - Si la respuesta fue correcta
   * @returns {Object} Feedback de respaldo
   */
  generateFallbackFeedback(isCorrect) {
    return {
      type: isCorrect ? "success" : "improvement",
      message: isCorrect
        ? "¡Correcto! Has demostrado un buen entendimiento del tema."
        : "No es la respuesta correcta, pero cada intento es una oportunidad de aprender.",
      studySuggestions: [
        "Revisa el material relacionado",
        "Practica con más preguntas del tema",
        "Consulta recursos adicionales si es necesario",
      ],
      encouragement: isCorrect ? "¡Sigue así! 🎉" : "¡No te rindas! 💪",
      nextSteps: ["Continúa con la siguiente pregunta"],
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Genera resumen de feedback para un quiz completo
   * @param {Array} answers - Array de respuestas del quiz
   * @param {Object} finalProgress - Progreso final del usuario
   * @returns {Object} Resumen de feedback
   */
  async generateQuizSummary(answers, finalProgress) {
    const totalQuestions = answers.length
    const correctAnswers = answers.filter((a) => a.isCorrect).length
    const score = Math.round((correctAnswers / totalQuestions) * 100)

    const performanceLevel = this.getPerformanceLevel(score)
    const improvementAreas = this.identifyImprovementAreas(answers)

    return {
      score,
      totalQuestions,
      correctAnswers,
      performanceLevel,
      improvementAreas,
      overallFeedback: await this.generateOverallFeedback(score, performanceLevel, finalProgress),
      recommendations: this.generateQuizRecommendations(score, improvementAreas),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Determina el nivel de rendimiento basado en el puntaje
   * @param {number} score - Puntaje del quiz (0-100)
   * @returns {Object} Información del nivel de rendimiento
   */
  getPerformanceLevel(score) {
    if (score >= 90) {
      return { level: "excellent", label: "Excelente", color: "#4CAF50", emoji: "🌟" }
    } else if (score >= 80) {
      return { level: "good", label: "Muy Bien", color: "#8BC34A", emoji: "👍" }
    } else if (score >= 70) {
      return { level: "satisfactory", label: "Satisfactorio", color: "#FF9800", emoji: "👌" }
    } else if (score >= 60) {
      return { level: "needs_improvement", label: "Necesita Mejora", color: "#FF5722", emoji: "📚" }
    } else {
      return { level: "needs_practice", label: "Necesita Práctica", color: "#F44336", emoji: "💪" }
    }
  }

  /**
   * Identifica áreas de mejora basado en las respuestas
   * @param {Array} answers - Array de respuestas del quiz
   * @returns {Array} Array de áreas de mejora
   */
  identifyImprovementAreas(answers) {
    const incorrectAnswers = answers.filter((a) => !a.isCorrect)
    const areas = []

    if (incorrectAnswers.length > 0) {
      // Agrupar por patrones comunes
      const patterns = {}
      incorrectAnswers.forEach((answer) => {
        const key = answer.topicId || "general"
        if (!patterns[key]) patterns[key] = 0
        patterns[key]++
      })

      Object.entries(patterns).forEach(([area, count]) => {
        areas.push({
          area,
          count,
          percentage: Math.round((count / answers.length) * 100),
        })
      })
    }

    return areas
  }

  /**
   * Genera feedback general para el quiz completo
   * @param {number} score - Puntaje del quiz
   * @param {Object} performanceLevel - Nivel de rendimiento
   * @param {Object} finalProgress - Progreso final
   * @returns {string} Feedback general
   */
  async generateOverallFeedback(score, performanceLevel, finalProgress) {
    const prompt = `Genera un feedback motivador y constructivo para un estudiante que completó un quiz:

RESULTADOS:
- Puntaje: ${score}%
- Nivel: ${performanceLevel.label}
- Progreso general: ${Math.round((finalProgress?.averageProbability || 0.1) * 100)}%

INSTRUCCIONES:
1. Reconoce el esfuerzo del estudiante
2. ${score >= 80 ? "Celebra el buen rendimiento" : "Motiva para mejorar sin desanimar"}
3. Proporciona perspectiva sobre el progreso de aprendizaje
4. Mantén un tono positivo y constructivo
5. 2-3 oraciones máximo
6. No uses formato markdown

Responde SOLO con el feedback:`

    try {
      const { text: feedback } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        maxTokens: 100,
        temperature: 0.7,
      })

      return feedback.trim()
    } catch (error) {
      console.error("Error generating overall feedback:", error)
      return this.getFallbackOverallFeedback(score)
    }
  }

  /**
   * Genera feedback general de respaldo
   * @param {number} score - Puntaje del quiz
   * @returns {string} Feedback de respaldo
   */
  getFallbackOverallFeedback(score) {
    if (score >= 80) {
      return "¡Excelente trabajo! Has demostrado un sólido entendimiento del tema. Continúa con este gran progreso."
    } else if (score >= 60) {
      return "Buen esfuerzo. Hay algunas áreas donde puedes mejorar, pero estás en el camino correcto."
    } else {
      return "Cada quiz es una oportunidad de aprender. Revisa el material y vuelve a intentarlo cuando te sientas listo."
    }
  }

  /**
   * Genera recomendaciones basadas en el rendimiento del quiz
   * @param {number} score - Puntaje del quiz
   * @param {Array} improvementAreas - Áreas de mejora identificadas
   * @returns {Array} Array de recomendaciones
   */
  generateQuizRecommendations(score, improvementAreas) {
    const recommendations = []

    if (score >= 90) {
      recommendations.push("Considera tomar quizzes de temas más avanzados")
      recommendations.push("Explora aplicaciones prácticas de estos conceptos")
      recommendations.push("Ayuda a otros estudiantes con este tema")
    } else if (score >= 70) {
      recommendations.push("Repasa los conceptos donde tuviste dificultades")
      recommendations.push("Practica con más preguntas del mismo tema")
      recommendations.push("Conecta estos conceptos con conocimientos previos")
    } else {
      recommendations.push("Dedica más tiempo a estudiar el material base")
      recommendations.push("Busca recursos adicionales sobre el tema")
      recommendations.push("Considera repasar conceptos fundamentales")
      recommendations.push("No dudes en pedir ayuda si la necesitas")
    }

    // Añadir recomendaciones específicas por área de mejora
    improvementAreas.forEach((area) => {
      if (area.percentage > 50) {
        recommendations.push(`Enfócate especialmente en mejorar: ${area.area}`)
      }
    })

    return recommendations.slice(0, 4) // Máximo 4 recomendaciones
  }
}
