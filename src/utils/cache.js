import config from "../config/index.js"

const cacheConfig = config.getCacheConfig()

/**
 * LRU Cache implementation with centralized configuration
 */
class LRUCache {
  constructor(maxSize = cacheConfig.maxSize) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.ttlMap = new Map()

    // Default TTL values from config
    this.defaultTTLs = {
      embeddings: cacheConfig.ttlEmbeddings,
      search: cacheConfig.ttlSearch,
      chat: cacheConfig.ttlChat,
      bkt: cacheConfig.ttlBkt,
    }

    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryPressureCleans: 0,
    }

    // Start cleanup interval
    this.startCleanupInterval()
    this.startMemoryMonitoring()
  }

  get(key) {
    // Check if key exists and is not expired
    if (this.cache.has(key)) {
      const ttl = this.ttlMap.get(key)
      if (ttl && Date.now() > ttl) {
        // Expired
        this.cache.delete(key)
        this.ttlMap.delete(key)
        this.metrics.misses++
        return undefined
      }

      // Move to end (most recently used)
      const value = this.cache.get(key)
      this.cache.delete(key)
      this.cache.set(key, value)
      this.metrics.hits++
      return value
    }

    this.metrics.misses++
    return undefined
  }

  set(key, value, ttlType = "chat") {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
      this.ttlMap.delete(firstKey)
      this.metrics.evictions++
    }

    // Set TTL
    const ttl = this.defaultTTLs[ttlType] || this.defaultTTLs.chat
    this.ttlMap.set(key, Date.now() + ttl)

    // Add/update value
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.cache.set(key, value)
    this.metrics.sets++
  }

  delete(key) {
    const deleted = this.cache.delete(key)
    this.ttlMap.delete(key)
    if (deleted) {
      this.metrics.deletes++
    }
    return deleted
  }

  clear() {
    this.cache.clear()
    this.ttlMap.clear()
  }

  size() {
    return this.cache.size
  }

  getMetrics() {
    return {
      ...this.metrics,
      size: this.cache.size,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
    }
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now()
      for (const [key, ttl] of this.ttlMap.entries()) {
        if (now > ttl) {
          this.cache.delete(key)
          this.ttlMap.delete(key)
        }
      }
    }, 60000) // Clean every minute
  }

  startMemoryMonitoring() {
    setInterval(() => {
      if (process.memoryUsage().heapUsed > 500 * 1024 * 1024) {
        // 500MB
        const keysToDelete = Math.floor(this.cache.size * 0.1) // Remove 10%
        let deleted = 0
        for (const key of this.cache.keys()) {
          if (deleted >= keysToDelete) break
          this.cache.delete(key)
          this.ttlMap.delete(key)
          deleted++
        }
        this.metrics.memoryPressureCleans++
      }
    }, 30000) // Check every 30 seconds
  }
}

// Create optimized cache instance
export const OptimizedCache = new LRUCache()

// Export the class as well for testing
export { LRUCache }

export default OptimizedCache
