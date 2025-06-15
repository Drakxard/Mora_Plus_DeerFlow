/**
 * Search API Tests
 */

import request from "supertest"
import express from "express"
import { searchRoute } from "../../src/api/search.js"

// Mock dependencies
jest.mock("../../src/api/search.js", () => ({
  searchRoute: {
    handle: jest.fn(),
  },
}))

describe("Search API", () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use("/search", searchRoute)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /search", () => {
    it("should return 400 when query parameter is missing", async () => {
      const response = await request(app).get("/search").expect(400)

      expect(response.body).toHaveProperty("error")
      expect(response.body.error).toContain('Query parameter "q" is required')
    })

    it("should return 400 when query is empty", async () => {
      const response = await request(app).get("/search?q=").expect(400)

      expect(response.body).toHaveProperty("error")
    })

    it("should handle search query successfully", async () => {
      // Mock successful search
      searchRoute.handle.mockImplementation((req, res) => {
        res.json({
          query: "test query",
          results: [
            {
              text: "Test result",
              score: 0.95,
              relevance: "high",
            },
          ],
          metadata: {
            totalChunks: 1,
            searchTime: new Date().toISOString(),
          },
        })
      })

      const response = await request(app).get("/search?q=test%20query").expect(200)

      expect(response.body).toHaveProperty("query", "test query")
      expect(response.body).toHaveProperty("results")
      expect(response.body.results).toHaveLength(1)
      expect(response.body.results[0]).toHaveProperty("score")
    })

    it("should handle search errors gracefully", async () => {
      // Mock search error
      searchRoute.handle.mockImplementation((req, res) => {
        res.status(500).json({
          error: "Internal server error",
          message: "Index file not found",
        })
      })

      const response = await request(app).get("/search?q=test").expect(500)

      expect(response.body).toHaveProperty("error")
    })
  })
})
