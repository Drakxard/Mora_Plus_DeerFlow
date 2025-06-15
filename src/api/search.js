import express from "express"
const router = express.Router()

// Agregar una ruta GET básica para búsqueda:

// GET /search - Búsqueda semántica básica
router.get("/", async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query

    if (!query) {
      return res.status(400).json({
        error: "Query parameter 'q' is required",
        example: "/search?q=machine+learning",
      })
    }

    console.log(`🔍 Search query: "${query}"`)

    // Simular búsqueda básica si no hay embeddings
    const results = [
      {
        id: "demo-1",
        content: `Información sobre: ${query}`,
        source: "demo-content",
        relevance: 0.95,
        metadata: {
          type: "demo",
          timestamp: new Date().toISOString(),
        },
      },
    ]

    res.json({
      query,
      results,
      total: results.length,
      processingTime: "50ms",
    })
  } catch (error) {
    console.error("Search error:", error)
    res.status(500).json({
      error: "Search failed",
      details: error.message,
    })
  }
})

export { router as searchRoute }
