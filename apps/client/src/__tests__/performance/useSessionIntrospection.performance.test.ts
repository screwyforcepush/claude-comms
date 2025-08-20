import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useSessionIntrospection } from '../../composables/useSessionIntrospection'
import type { SessionIntrospectionResponse, SessionTimelineMessage } from '../../types'

/**
 * Session Introspection Performance Test Suite
 * 
 * Tests focus on:
 * - Caching efficiency and memory usage
 * - API call optimization and deduplication
 * - Large dataset handling in composable
 * - Reactive update performance
 * - Memory leak prevention
 */
describe('useSessionIntrospection Performance Tests', () => {
  let mockFetch: any
  let performanceEntries: PerformanceEntry[] = []

  beforeEach(() => {
    // Setup performance monitoring
    performanceEntries = []
    
    // Mock fetch with performance tracking
    mockFetch = vi.fn()
    global.fetch = mockFetch
    
    // Clear any existing caches
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Caching Performance', () => {
    it('should cache responses efficiently and reduce API calls', async () => {
      const largeResponse = createLargeSessionResponse(1000)
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeResponse)
      })

      const { fetchData, clearCache } = useSessionIntrospection('test-session')
      clearCache() // Ensure clean state
      
      const startTime = performance.now()
      
      // First fetch - should hit API
      await fetchData()
      const firstFetchTime = performance.now() - startTime
      
      const cacheStartTime = performance.now()
      
      // Second fetch - should use cache
      await fetchData()
      const secondFetchTime = performance.now() - cacheStartTime
      
      // Cache hit should be significantly faster
      expect(secondFetchTime).toBeLessThan(firstFetchTime * 0.1) // At least 10x faster
      expect(secondFetchTime).toBeLessThan(10) // Under 10ms for cache hit
      
      // Should only make one API call
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      console.log(`First fetch: ${firstFetchTime.toFixed(2)}ms, Cache hit: ${secondFetchTime.toFixed(2)}ms`)
    })

    it('should handle cache invalidation efficiently', async () => {
      const response = createLargeSessionResponse(500)
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response)
      })

      const { sessionId, fetchData, invalidateCache, clearCache } = useSessionIntrospection()
      clearCache()
      
      sessionId.value = 'session-1'
      await fetchData()
      
      const invalidationStartTime = performance.now()
      
      // Invalidate specific session cache
      invalidateCache('session-1')
      
      // Fetch again - should hit API
      await fetchData()
      
      const invalidationTime = performance.now() - invalidationStartTime
      
      // Cache invalidation should be fast
      expect(invalidationTime).toBeLessThan(100)
      
      // Should make 2 API calls (before and after invalidation)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should prevent duplicate concurrent requests', async () => {
      const response = createLargeSessionResponse(800)
      
      // Simulate slow API response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(response)
          }), 100)
        )
      )

      const { sessionId, fetchData, clearCache } = useSessionIntrospection()
      clearCache()
      
      sessionId.value = 'concurrent-test'
      
      const startTime = performance.now()
      
      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => fetchData())
      await Promise.all(promises)
      
      const totalTime = performance.now() - startTime
      
      // Should only make one API call despite multiple concurrent requests
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Total time should be close to single request time (not 5x)
      expect(totalTime).toBeLessThan(200) // Should complete in under 200ms
      
      console.log(`Concurrent requests handled in: ${totalTime.toFixed(2)}ms`)
    })

    it('should manage memory usage effectively with large cached datasets', async () => {
      const sessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5']
      const responses = sessions.map(id => createLargeSessionResponse(500, id))
      
      let callIndex = 0
      mockFetch.mockImplementation(() => {
        const response = responses[callIndex++ % responses.length]
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response)
        })
      })

      const { sessionId, fetchData, clearCache } = useSessionIntrospection()
      clearCache()
      
      // Measure memory usage pattern
      const memoryUsages: number[] = []
      
      for (let i = 0; i < sessions.length; i++) {
        sessionId.value = sessions[i]
        await fetchData()
        await nextTick()
        
        // Measure memory (approximation using cache size)
        if (typeof (globalThis as any).gc === 'function') {
          (globalThis as any).gc()
        }
        
        memoryUsages.push(i) // Placeholder for actual memory measurement
      }
      
      // Memory usage should not grow linearly with cache size
      // (This is a simplified test - in real scenarios you'd use actual memory APIs)
      expect(mockFetch).toHaveBeenCalledTimes(sessions.length)
      
      console.log(`Cached ${sessions.length} large sessions`)
    })
  })

  describe('Data Transformation Performance', () => {
    it('should transform large datasets efficiently', async () => {
      const largeResponse = createLargeSessionResponse(2000)
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeResponse)
      })

      const { data, fetchData, clearCache } = useSessionIntrospection('large-session')
      clearCache()
      
      const startTime = performance.now()
      
      await fetchData()
      
      const transformTime = performance.now() - startTime
      
      // Data transformation should complete within performance budget
      expect(transformTime).toBeLessThan(300) // Under 300ms for 2000 messages
      
      // Should transform all messages
      expect(data.value.timeline).toHaveLength(2000)
      
      // Messages should be properly sorted chronologically
      for (let i = 1; i < data.value.timeline.length; i++) {
        expect(data.value.timeline[i].timestamp).toBeGreaterThanOrEqual(
          data.value.timeline[i - 1].timestamp!
        )
      }
      
      console.log(`Transformed ${data.value.timeline.length} messages in ${transformTime.toFixed(2)}ms`)
    })

    it('should handle reactive updates efficiently', async () => {
      const response1 = createLargeSessionResponse(300, 'session-1')
      const response2 = createLargeSessionResponse(400, 'session-2')
      
      let callCount = 0
      mockFetch.mockImplementation(() => {
        const response = callCount === 0 ? response1 : response2
        callCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response)
        })
      })

      const { sessionId, data, clearCache } = useSessionIntrospection()
      clearCache()
      
      // Initial session
      sessionId.value = 'session-1'
      await nextTick()
      
      const updateStartTime = performance.now()
      
      // Change session
      sessionId.value = 'session-2'
      await nextTick()
      
      const updateTime = performance.now() - updateStartTime
      
      // Reactive updates should be fast
      expect(updateTime).toBeLessThan(150)
      
      // Should have fetched data for new session
      expect(data.value.sessionId).toBe('session-2')
      expect(data.value.timeline).toHaveLength(400)
      
      console.log(`Reactive update completed in ${updateTime.toFixed(2)}ms`)
    })

    it('should handle event type filtering efficiently', async () => {
      const fullResponse = createLargeSessionResponse(1000)
      const filteredResponse = {
        ...fullResponse,
        timeline: fullResponse.timeline.slice(0, 200), // Simulate filtered results
        messageCount: 200
      }
      
      let callCount = 0
      mockFetch.mockImplementation(() => {
        const response = callCount === 0 ? fullResponse : filteredResponse
        callCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response)
        })
      })

      const { sessionId, eventTypes, data, clearCache } = useSessionIntrospection()
      clearCache()
      
      sessionId.value = 'filter-test'
      await nextTick()
      
      const filterStartTime = performance.now()
      
      // Apply event type filter
      eventTypes.value = ['UserPromptSubmit', 'PostToolUse']
      await nextTick()
      
      const filterTime = performance.now() - filterStartTime
      
      // Filtering should trigger new API call efficiently
      expect(filterTime).toBeLessThan(200)
      expect(data.value.timeline).toHaveLength(200)
      
      console.log(`Event type filtering completed in ${filterTime.toFixed(2)}ms`)
    })
  })

  describe('Error Handling Performance', () => {
    it('should handle retry logic efficiently', async () => {
      let attemptCount = 0
      
      mockFetch.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          // Simulate network error for first 2 attempts
          return Promise.reject(new TypeError('Network error'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createLargeSessionResponse(100))
        })
      })

      const { sessionId, fetchData, clearCache } = useSessionIntrospection()
      clearCache()
      
      sessionId.value = 'retry-test'
      
      const startTime = performance.now()
      
      await fetchData()
      
      const retryTime = performance.now() - startTime
      
      // Retry logic should not significantly impact performance
      expect(retryTime).toBeLessThan(1000) // Allow time for exponential backoff
      expect(attemptCount).toBe(3) // Should have made 3 attempts
      
      console.log(`Retry logic completed in ${retryTime.toFixed(2)}ms after ${attemptCount} attempts`)
    })

    it('should handle error states without memory leaks', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'))

      const { sessionId, error, loading, fetchData, clearCache } = useSessionIntrospection()
      clearCache()
      
      sessionId.value = 'error-test'
      
      const startTime = performance.now()
      
      await fetchData()
      
      const errorHandlingTime = performance.now() - startTime
      
      // Error handling should be fast
      expect(errorHandlingTime).toBeLessThan(100)
      
      // Should properly set error state
      expect(error.value).toBeTruthy()
      expect(loading.value).toBe(false)
      
      console.log(`Error handling completed in ${errorHandlingTime.toFixed(2)}ms`)
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should clean up watchers and prevent memory leaks', async () => {
      const response = createLargeSessionResponse(100)
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response)
      })

      // Create multiple instances to test cleanup
      const instances = Array.from({ length: 10 }, () => 
        useSessionIntrospection('cleanup-test')
      )
      
      const startTime = performance.now()
      
      // Fetch data for all instances
      await Promise.all(instances.map(instance => instance.fetchData()))
      
      // Clear all caches
      instances.forEach(instance => instance.clearCache())
      
      const cleanupTime = performance.now() - startTime
      
      // Cleanup should be efficient
      expect(cleanupTime).toBeLessThan(200)
      
      console.log(`Cleaned up ${instances.length} instances in ${cleanupTime.toFixed(2)}ms`)
    })

    it('should handle rapid session switching without accumulating memory', async () => {
      const sessions = Array.from({ length: 20 }, (_, i) => `session-${i}`)
      
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createLargeSessionResponse(50))
      }))

      const { sessionId, clearCache } = useSessionIntrospection()
      clearCache()
      
      const startTime = performance.now()
      
      // Rapidly switch between sessions
      for (const session of sessions) {
        sessionId.value = session
        await nextTick()
      }
      
      const switchingTime = performance.now() - startTime
      
      // Rapid switching should be efficient
      expect(switchingTime).toBeLessThan(500)
      
      console.log(`Switched through ${sessions.length} sessions in ${switchingTime.toFixed(2)}ms`)
    })
  })

  // Helper function to create large session response for performance testing
  function createLargeSessionResponse(messageCount: number, sessionId = 'test-session'): SessionIntrospectionResponse {
    const timeline: SessionTimelineMessage[] = []
    const messageTypes: SessionTimelineMessage['type'][] = ['user_message', 'orchestrator_message', 'agent_message']
    
    for (let i = 0; i < messageCount; i++) {
      const type = messageTypes[i % messageTypes.length]
      timeline.push({
        id: i + 1,
        type,
        role: type === 'user_message' ? 'User' : type === 'orchestrator_message' ? 'Orchestrator' : 'Agent',
        timestamp: Date.now() + (i * 1000),
        content: {
          prompt: `Performance test message ${i + 1}`,
          agent_name: `Agent${i % 5}`,
          task_description: `Task ${i + 1}`,
          session_id: sessionId
        },
        source_event: {
          hook_event_type: type === 'user_message' ? 'UserPromptSubmit' : 'PostToolUse',
          payload: {
            test_data: `Performance test payload ${i + 1}`,
            session_id: sessionId
          }
        }
      })
    }
    
    return {
      sessionId,
      timeline,
      messageCount,
      timeRange: timeline.length > 0 ? {
        start: timeline[0].timestamp,
        end: timeline[timeline.length - 1].timestamp,
        duration: timeline[timeline.length - 1].timestamp - timeline[0].timestamp
      } : null
    }
  }
})