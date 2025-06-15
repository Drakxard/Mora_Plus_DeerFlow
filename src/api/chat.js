import express from "express"
const router = express.Router()

// Agregar ruta GET para status del chat:

// GET /chat/status - Estado del chat
router.get("/status", (req, res) => {
  res.json({
    status: "active",
    features: ["semantic_search", "rag_chat"],
    requirements: {
      groq_api_key: !!process.env.GROQ_API_KEY,
      openai_api_key: !!process.env.OPENAI_API_KEY,
      embeddings_index: true, // Simplificado
    },
    timestamp: new Date().toISOString(),
  })
})

export { router as chatRoute }
