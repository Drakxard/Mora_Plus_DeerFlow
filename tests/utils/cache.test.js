/**
 * Cache System Tests
 */

import { OptimizedCache } from "../../src/utils/cache.js"

describe("OptimizedCache", () => {
  let cache

  beforeEach(() => {
    cache = new OptimizedCache({
      name: "test-cache",
      max: 5,
      ttl: 1000, // 1 second for testing
    })
  })

  afterEach(() => {
    cache.clear()
  })

  describe("Basic Operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")
    })

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("non-existent")).toBeUndefined()
    })

    it("should check if key exists", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)
      expect(cache.has("key2")).toBe(false)
    })

    it("should delete keys", () => {
      cache.set("key1", "value1")
      expect(cache.delete("key1")).toBe(true)
      expect(cache.get("key1")).toBeUndefined()
      expect(cache.delete("non-existent")).toBe(false)
    })

    it("should clear all keys", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      cache.clear()
      expect(cache.get("key1")).toBeUndefined()
      expect(cache.get("key2")).toBeUndefined()
    })
  })

  describe("Batch Operations", () => {
    it("should get multiple values", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      cache.set("key3", "value3")

      const result = cache.getMany(["key1", "key2", "key4"])

      expect(result.results).toEqual({
        key1: "value1",
        key2: "value2",
      })
      expect(result.misses).toEqual(["key4"])
    })

    it("should set multiple values", () => {
      const entries = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      }

      cache.setMany(entries)

      expect(cache.get("key1")).toBe("value1")
      expect(cache.get("key2")).toBe("value2")
      expect(cache.get("key3")).toBe("value3")
    })
  })

  describe("Statistics", () => {
    it("should track cache statistics", () => {
      // Generate some hits and misses
      cache.set("key1", "value1")
      cache.get("key1") // hit
      cache.get("key2") // miss
      cache.get("key1") // hit
      cache.delete("key1")

      const stats = cache.getStats()

      expect(stats.name).toBe("test-cache")
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.sets).toBe(1)
      expect(stats.deletes).toBe(1)
      expect(stats.hitRate).toBe("66.67%")
    })
  })

  describe("Cache-aside Pattern", () => {
    it("should get or set with async function", async () => {
      const asyncFn = jest.fn().mockResolvedValue("computed-value")

      // First call should execute function
      const result1 = await cache.getOrSet("key1", asyncFn)
      expect(result1).toBe("computed-value")
      expect(asyncFn).toHaveBeenCalledTimes(1)

      // Second call should return cached value
      const result2 = await cache.getOrSet("key1", asyncFn)
      expect(result2).toBe("computed-value")
      expect(asyncFn).toHaveBeenCalledTimes(1) // Not called again
    })

    it("should handle async function errors", async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error("Test error"))

      await expect(cache.getOrSet("key1", asyncFn)).rejects.toThrow("Test error")
      expect(cache.get("key1")).toBeUndefined() // Should not cache errors
    })
  })

  describe("TTL (Time To Live)", () => {
    it("should expire items after TTL", (done) => {
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")

      // Wait for TTL to expire
      setTimeout(() => {
        expect(cache.get("key1")).toBeUndefined()
        done()
      }, 1100) // TTL is 1000ms
    })
  })

  describe("LRU Eviction", () => {
    it("should evict least recently used items when max size exceeded", () => {
      // Fill cache to max capacity (5 items)
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`)
      }

      // Access key1 to make it recently used
      cache.get("key1")

      // Add one more item, should evict key2 (least recently used)
      cache.set("key6", "value6")

      expect(cache.get("key1")).toBe("value1") // Should still exist
      expect(cache.get("key2")).toBeUndefined() // Should be evicted
      expect(cache.get("key6")).toBe("value6") // Should exist
    })
  })
})
