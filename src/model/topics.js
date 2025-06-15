/**
 * Topics and Skills Definition for Mora + DeerFlow
 * Maps content chunks to learning topics for BKT modeling
 */

// Definición de temas principales
export const TOPICS = {
  INTRODUCTION: {
    id: "introduction",
    name: "Introducción",
    description: "Conceptos básicos y fundamentos",
    color: "#4CAF50",
    prerequisites: [],
    difficulty: 1,
  },
  INTERMEDIATE: {
    id: "intermediate",
    name: "Intermedio",
    description: "Conceptos de nivel medio",
    color: "#FF9800",
    prerequisites: ["introduction"],
    difficulty: 2,
  },
  ADVANCED: {
    id: "advanced",
    name: "Avanzado",
    description: "Conceptos avanzados y especializados",
    color: "#F44336",
    prerequisites: ["introduction", "intermediate"],
    difficulty: 3,
  },
  CONFIGURATION: {
    id: "configuration",
    name: "Configuración",
    description: "Configuración y setup del sistema",
    color: "#2196F3",
    prerequisites: ["introduction"],
    difficulty: 2,
  },
  TROUBLESHOOTING: {
    id: "troubleshooting",
    name: "Resolución de Problemas",
    description: "Diagnóstico y solución de problemas",
    color: "#9C27B0",
    prerequisites: ["introduction", "configuration"],
    difficulty: 3,
  },
  BEST_PRACTICES: {
    id: "best_practices",
    name: "Mejores Prácticas",
    description: "Recomendaciones y buenas prácticas",
    color: "#607D8B",
    prerequisites: ["intermediate"],
    difficulty: 2,
  },
}

// Keywords para clasificación automática de chunks
export const TOPIC_KEYWORDS = {
  introduction: [
    "introducción",
    "básico",
    "fundamentos",
    "qué es",
    "definición",
    "conceptos",
    "primeros pasos",
    "inicio",
    "overview",
    "resumen",
  ],
  intermediate: [
    "intermedio",
    "medio",
    "desarrollo",
    "implementación",
    "proceso",
    "metodología",
    "técnicas",
    "estrategias",
    "aplicación",
  ],
  advanced: [
    "avanzado",
    "complejo",
    "especializado",
    "experto",
    "optimización",
    "performance",
    "escalabilidad",
    "arquitectura",
    "algoritmos",
  ],
  configuration: [
    "configuración",
    "setup",
    "instalación",
    "parámetros",
    "ajustes",
    "settings",
    "opciones",
    "personalización",
    "variables",
  ],
  troubleshooting: [
    "error",
    "problema",
    "solución",
    "debug",
    "troubleshooting",
    "diagnóstico",
    "fix",
    "resolver",
    "issue",
    "bug",
  ],
  best_practices: [
    "mejores prácticas",
    "recomendaciones",
    "buenas prácticas",
    "tips",
    "consejos",
    "guidelines",
    "estándares",
    "calidad",
    "eficiencia",
  ],
}

/**
 * Clasifica un chunk de texto en uno o más temas
 * @param {string} text - Texto del chunk
 * @returns {Array} Array de topic IDs
 */
export function classifyChunk(text) {
  const textLower = text.toLowerCase()
  const matchedTopics = []

  // Buscar keywords en el texto
  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const matches = keywords.filter((keyword) => textLower.includes(keyword))
    if (matches.length > 0) {
      matchedTopics.push({
        topicId,
        confidence: matches.length / keywords.length,
        matchedKeywords: matches,
      })
    }
  }

  // Si no hay matches específicos, asignar a introducción por defecto
  if (matchedTopics.length === 0) {
    return ["introduction"]
  }

  // Ordenar por confianza y retornar los más relevantes
  return matchedTopics
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2) // Máximo 2 temas por chunk
    .map((match) => match.topicId)
}

/**
 * Obtiene información completa de un tema
 * @param {string} topicId - ID del tema
 * @returns {Object} Información del tema
 */
export function getTopicInfo(topicId) {
  return Object.values(TOPICS).find((topic) => topic.id === topicId) || null
}

/**
 * Obtiene todos los temas disponibles
 * @returns {Array} Array de todos los temas
 */
export function getAllTopics() {
  return Object.values(TOPICS)
}

/**
 * Verifica si un tema tiene prerrequisitos cumplidos
 * @param {string} topicId - ID del tema
 * @param {Object} userProgress - Progreso del usuario
 * @param {number} threshold - Umbral mínimo de dominio (default: 0.7)
 * @returns {boolean} True si los prerrequisitos están cumplidos
 */
export function hasPrerequisites(topicId, userProgress, threshold = 0.7) {
  const topic = getTopicInfo(topicId)
  if (!topic || !topic.prerequisites.length) return true

  return topic.prerequisites.every((prereqId) => {
    return userProgress[prereqId] && userProgress[prereqId] >= threshold
  })
}

/**
 * Obtiene temas recomendados para el usuario basado en su progreso
 * @param {Object} userProgress - Progreso del usuario
 * @returns {Array} Array de temas recomendados
 */
export function getRecommendedTopics(userProgress) {
  const allTopics = getAllTopics()

  return allTopics
    .filter((topic) => {
      // Filtrar temas que ya están dominados
      const currentProficiency = userProgress[topic.id] || 0
      if (currentProficiency >= 0.8) return false

      // Verificar prerrequisitos
      return hasPrerequisites(topic.id, userProgress, 0.6)
    })
    .sort((a, b) => {
      // Ordenar por dificultad y progreso actual
      const progressA = userProgress[a.id] || 0
      const progressB = userProgress[b.id] || 0

      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty
      }

      return progressB - progressA
    })
    .slice(0, 3) // Máximo 3 recomendaciones
}
