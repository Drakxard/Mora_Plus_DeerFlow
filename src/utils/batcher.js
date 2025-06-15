import config from "../config/index.js"

const performanceConfig = config.getPerformanceConfig()

/**
 * Intelligent batching system for LLM requests with centralized configuration
 */
class LLMBatcher {
  constructor() {
    this.queues = {
      chat: [],
      quiz: [],
      agent: [],
    }

    this.batchSizes = {
      chat: performanceConfig.batchSizeChat,
      quiz: performanceConfig.batchSizeQuiz,
      agent: performanceConfig.batchSizeAgent,
    }

    this.batchTimeout = performanceConfig.batchTimeout
    this.concurrencyLimit = performanceConfig.concurrencyLimit
    this.activeRequests = 0

    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      averageBatchSize: 0,
      averageWaitTime: 0,
      timeouts: 0,
      errors: 0,
    }

    // Start batch processing
    this.startBatchProcessing()
  }
}
