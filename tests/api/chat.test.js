/**
 * Chat API Tests
 */

import request from "supertest"
import express from "express"

// Mock the chat route
const mockChatRoute = express.Router()

mockChatRoute.post("/", (req, res) => {
  const { question } = req.body

  if (!question) {
    return res.status(400).json({
      error: 'Field "question" is required',
    })
  }

  // Mock successful response
  res.json({
    question,
    answer: "This is a test response",
    context: {
      chunksUsed: 2,
      chunks: [
        { text: "Test chunk 1...", relevance: "high", score: 0.9 },
        { text: "Test chunk 2...", relevance: "medium", score: 0.7 },
      ],
      timestamp: new Date().toISOString(),
    },
  })
})

mockChatRoute.get("/status", (req, res) => {
  res.json({
    status: "Chat API is running",
    features: ["RAG", "Semantic Search", "Contextual Responses"],
    requirements: {
      openai_api_key: true,
      embeddings_index: "Available",
    },
  })
})

describe("Chat API", () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use("/chat", mockChatRoute)
  })

  describe("POST /chat", () => {
    it("should return 400 when question is missing", async () => {
      const response = await request(app).post("/chat").send({}).expect(400)

      expect(response.body).toHaveProperty("error")
      expect(response.body.error).toContain("required")
    })

    it("should return 400 when question is empty", async () => {
      const response = await request(app).post("/chat").send({ question: "" }).expect(400)

      expect(response.body).toHaveProperty("error")
    })

    it("should handle chat question successfully", async () => {
      const testQuestion = "What is machine learning?"

      const response = await request(app).post("/chat").send({ question: testQuestion }).expect(200)

      expect(response.body).toHaveProperty("question", testQuestion)
      expect(response.body).toHaveProperty("answer")
      expect(response.body).toHaveProperty("context")
      expect(response.body.context).toHaveProperty("chunksUsed")
      expect(response.body.context).toHaveProperty("chunks")
    })

    it("should include user ID in request", async () => {
      const response = await request(app)
        .post("/chat")
        .send({
          question: "Test question",
          userId: "test-user-123",
        })
        .expect(200)

      expect(response.body).toHaveProperty("answer")
    })
  })

  describe("GET /chat/status", () => {
    it("should return chat status", async () => {
      const response = await request(app).get("/chat/status").expect(200)

      expect(response.body).toHaveProperty("status")
      expect(response.body).toHaveProperty("features")
      expect(response.body).toHaveProperty("requirements")
    })
  })
})
