/**
 * Test setup for Mora + DeerFlow
 * Configures test environment and utilities
 */

import { jest } from "@jest/globals"

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.LOG_LEVEL = "error"
process.env.OPENAI_API_KEY = "test-key-12345"

// Mock external dependencies
jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  perfLogger: {
    startTimer: jest.fn(),
    endTimer: jest.fn(),
    logMemoryUsage: jest.fn(),
  },
  requestLogger: jest.fn((req, res, next) => next()),
  errorLogger: jest.fn((err, req, res, next) => next(err)),
}))

// Global test timeout
jest.setTimeout(30000)
