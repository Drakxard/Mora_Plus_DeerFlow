import express from "express"

const router = express.Router()

// GET /quiz/topics - Temas disponibles para quiz
router.get("/quiz/topics", (req, res) => {
  res.json({
    topics: [
      { id: "ml", name: "Machine Learning", description: "Conceptos básicos de ML" },
      { id: "ai", name: "Inteligencia Artificial", description: "Fundamentos de IA" },
      { id: "python", name: "Python", description: "Programación en Python" },
      { id: "data", name: "Ciencia de Datos", description: "Análisis de datos" },
    ],
    total: 4,
    timestamp: new Date().toISOString(),
  })
})

// GET /search/status - Estado de búsqueda
router.get("/search/status", (req, res) => {
  res.json({
    status: "active",
    engine: "semantic_search",
    indexed_documents: 1,
    last_update: new Date().toISOString(),
  })
})

// GET /chat/status - Estado del chat
router.get("/chat/status", (req, res) => {
  res.json({
    status: "active",
    features: ["semantic_search", "rag_chat"],
    requirements: {
      groq_api_key: !!process.env.GROQ_API_KEY,
      openai_api_key: !!process.env.OPENAI_API_KEY,
      embeddings_index: true,
    },
    timestamp: new Date().toISOString(),
  })
})

// POST /chat - Chat básico
router.post("/chat", async (req, res) => {
  try {
    const { question } = req.body

    if (!question) {
      return res.status(400).json({
        error: "Question is required",
        example: { question: "¿Qué es machine learning?" },
      })
    }

    // Respuesta básica si no hay API configurada
    const answer = `Respuesta sobre: "${question}". Para respuestas más detalladas, configura GROQ_API_KEY en tu archivo .env.`

    res.json({
      question,
      answer,
      timestamp: new Date().toISOString(),
      source: "basic_response",
    })
  } catch (error) {
    res.status(500).json({
      error: "Chat error",
      details: error.message,
    })
  }
})

// GET /search - Búsqueda básica
router.get("/search", (req, res) => {
  const { q: query } = req.query

  if (!query) {
    return res.status(400).json({
      error: "Query parameter 'q' is required",
      example: "/search?q=machine+learning",
    })
  }

  // Respuesta básica de búsqueda
  res.json({
    query,
    results: [
      {
        text: `Información relacionada con: ${query}`,
        score: 0.85,
        relevance: "high",
        source: "demo_content",
      },
    ],
    metadata: {
      totalChunks: 1,
      searchTime: new Date().toISOString(),
    },
  })
})

export { router as basicRoutes }
