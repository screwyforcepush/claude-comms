import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { 
  initDatabase, 
  setDatabase, 
  getDatabase,
  insertEvent,
  getRecentEventsWithPriority,
  getSessionEventsWithPriority,
  getSessionIntrospectionEvents,
  validatePriorityPerformance,
  collectPriorityMetrics
} from '../../db'
import type { HookEvent } from '../../types'

/**
 * Database Performance Test Suite
 * 
 * Tests focus on:
 * - Query performance under load (< 200ms target)
 * - Index effectiveness
 * - Priority event bucket performance
 * - Memory usage optimization
 * - Concurrent query handling
 */
describe('Database Performance Tests', () => {
  let testDb: Database
  let testEvents: HookEvent[]

  beforeEach(() => {
    // Use in-memory database for performance testing
    testDb = new Database(':memory:')
    setDatabase(testDb)
    initDatabase()
    
    // Generate large dataset for performance testing
    testEvents = generateLargeEventDataset(5000)
    
    // Insert test data
    testEvents.forEach(event => {
      insertEvent(event)
    })
  })

  afterEach(() => {
    testDb.close()
  })

  describe('Query Performance Benchmarks', () => {
    it('should retrieve recent events within 200ms target', () => {
      const iterations = 10
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        
        const events = getRecentEventsWithPriority({
          totalLimit: 150,
          priorityLimit: 100,
          regularLimit: 50,
          priorityRetentionHours: 24,
          regularRetentionHours: 4
        })
        
        const queryTime = performance.now() - startTime
        times.push(queryTime)
        
        expect(events).toBeDefined()
        expect(events.length).toBeGreaterThan(0)
        expect(events.length).toBeLessThanOrEqual(150)
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
      const maxTime = Math.max(...times)
      
      console.log(`Recent events query - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
      
      // Performance targets
      expect(avgTime).toBeLessThan(100) // Average under 100ms
      expect(maxTime).toBeLessThan(200) // Maximum under 200ms
    })

    it('should handle session-specific queries efficiently', () => {
      const sessionIds = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5']
      const times: number[] = []

      sessionIds.forEach(sessionId => {
        const startTime = performance.now()
        
        const events = getSessionEventsWithPriority(sessionId, undefined, {
          totalLimit: 100,
          priorityLimit: 70,
          regularLimit: 30,
          priorityRetentionHours: 24,
          regularRetentionHours: 4
        })
        
        const queryTime = performance.now() - startTime
        times.push(queryTime)
        
        expect(events).toBeDefined()
        // Should filter to session-specific events only
        events.forEach(event => {
          expect(event.session_id).toBe(sessionId)
        })
      })

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
      const maxTime = Math.max(...times)
      
      console.log(`Session query - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
      
      // Performance targets for session queries
      expect(avgTime).toBeLessThan(80)
      expect(maxTime).toBeLessThan(150)
    })

    it('should handle introspection queries within performance budget', () => {
      const sessionIds = ['session-1', 'session-2', 'session-3']
      const times: number[] = []

      sessionIds.forEach(sessionId => {
        const startTime = performance.now()
        
        const events = getSessionIntrospectionEvents(sessionId)
        
        const queryTime = performance.now() - startTime
        times.push(queryTime)
        
        expect(events).toBeDefined()
        // Should only contain introspection-relevant events
        events.forEach(event => {
          expect(['UserPromptSubmit', 'PostToolUse']).toContain(event.hook_event_type)
          if (event.hook_event_type === 'PostToolUse') {
            expect(event.payload?.tool_name).toBe('Task')
          }
        })
      })

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
      const maxTime = Math.max(...times)
      
      console.log(`Introspection query - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
      
      // Performance targets for introspection queries
      expect(avgTime).toBeLessThan(60)
      expect(maxTime).toBeLessThan(120)
    })

    it('should perform bulk inserts efficiently', () => {
      const bulkEvents = generateLargeEventDataset(1000)
      
      const startTime = performance.now()
      
      bulkEvents.forEach(event => {
        insertEvent(event)
      })
      
      const insertTime = performance.now() - startTime
      const avgPerInsert = insertTime / bulkEvents.length
      
      console.log(`Bulk insert - Total: ${insertTime.toFixed(2)}ms, Avg per insert: ${avgPerInsert.toFixed(2)}ms`)
      
      // Performance targets for bulk inserts
      expect(insertTime).toBeLessThan(2000) // 2 seconds for 1000 inserts
      expect(avgPerInsert).toBeLessThan(2) // Under 2ms per insert
    })
  })

  describe('Index Effectiveness', () => {
    it('should use proper indexes for priority queries', () => {
      // Query with EXPLAIN QUERY PLAN to verify index usage
      const db = getDatabase()
      
      const plans = [
        db.prepare('EXPLAIN QUERY PLAN SELECT * FROM events WHERE priority > 0 ORDER BY timestamp DESC LIMIT 100').all(),
        db.prepare('EXPLAIN QUERY PLAN SELECT * FROM events WHERE session_id = ? AND priority > 0 ORDER BY timestamp DESC').all(),
        db.prepare('EXPLAIN QUERY PLAN SELECT * FROM events WHERE hook_event_type = ? AND priority > 0').all()
      ]
      
      plans.forEach((plan, index) => {
        const planString = JSON.stringify(plan)
        console.log(`Query plan ${index + 1}:`, planString)
        
        // Should use indexes, not full table scans
        expect(planString.toLowerCase()).not.toContain('scan table')
        expect(planString.toLowerCase()).toContain('using index')
      })
    })

    it('should leverage composite indexes for complex queries', () => {
      const db = getDatabase()
      
      // Test composite index usage for session + priority + timestamp
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN 
        SELECT * FROM events 
        WHERE session_id = ? AND priority > ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).all('session-1', 0, 50)
      
      const planString = JSON.stringify(plan)
      console.log('Composite index plan:', planString)
      
      // Should use the composite index for session + priority + timestamp
      expect(planString.toLowerCase()).toContain('using index')
    })

    it('should have optimal query execution for priority bucketing', () => {
      const performanceResult = validatePriorityPerformance()
      
      expect(performanceResult.performant).toBe(true)
      expect(performanceResult.issues).toHaveLength(0)
      
      // Verify metrics are within acceptable ranges
      expect(performanceResult.metrics.queryTime).toBeLessThan(200)
      expect(performanceResult.metrics.sessionQueryTime).toBeLessThan(150)
      
      console.log('Priority performance metrics:', performanceResult.metrics)
    })
  })

  describe('Memory Usage Optimization', () => {
    it('should limit memory usage with large result sets', () => {
      // Test with different limit configurations
      const configs = [
        { totalLimit: 50, priorityLimit: 35, regularLimit: 15 },
        { totalLimit: 100, priorityLimit: 70, regularLimit: 30 },
        { totalLimit: 200, priorityLimit: 140, regularLimit: 60 },
        { totalLimit: 500, priorityLimit: 350, regularLimit: 150 }
      ]
      
      configs.forEach(config => {
        const startTime = performance.now()
        
        const events = getRecentEventsWithPriority(config)
        
        const queryTime = performance.now() - startTime
        
        // Results should respect the limits
        expect(events.length).toBeLessThanOrEqual(config.totalLimit)
        
        // Query time should scale reasonably with result size
        const timePerEvent = queryTime / events.length
        expect(timePerEvent).toBeLessThan(1) // Under 1ms per event
        
        console.log(`Config ${JSON.stringify(config)} - Events: ${events.length}, Time: ${queryTime.toFixed(2)}ms`)
      })
    })

    it('should handle priority vs regular event balance efficiently', () => {
      const metrics = collectPriorityMetrics()
      
      // Verify priority classification is working
      expect(metrics.totalEvents).toBeGreaterThan(0)
      expect(metrics.priorityEvents).toBeGreaterThan(0)
      expect(metrics.regularEvents).toBeGreaterThan(0)
      
      // Priority percentage should be reasonable (not all events are priority)
      expect(metrics.priorityPercentage).toBeGreaterThan(5)
      expect(metrics.priorityPercentage).toBeLessThan(95)
      
      // Classification accuracy should be high
      expect(metrics.classificationAccuracy.accuracy).toBeGreaterThan(80)
      
      console.log('Priority metrics:', {
        total: metrics.totalEvents,
        priority: metrics.priorityEvents,
        regular: metrics.regularEvents,
        priorityPercentage: metrics.priorityPercentage.toFixed(2) + '%',
        accuracy: metrics.classificationAccuracy.accuracy.toFixed(2) + '%'
      })
    })
  })

  describe('Concurrent Query Performance', () => {
    it('should handle multiple concurrent queries efficiently', async () => {
      const concurrentQueries = 20
      const promises: Promise<any>[] = []
      
      const startTime = performance.now()
      
      // Create concurrent queries of different types
      for (let i = 0; i < concurrentQueries; i++) {
        const queryType = i % 4
        
        switch (queryType) {
          case 0:
            promises.push(Promise.resolve(getRecentEventsWithPriority()))
            break
          case 1:
            promises.push(Promise.resolve(getSessionEventsWithPriority(`session-${i % 5}`)))
            break
          case 2:
            promises.push(Promise.resolve(getSessionIntrospectionEvents(`session-${i % 5}`)))
            break
          case 3:
            promises.push(Promise.resolve(collectPriorityMetrics()))
            break
        }
      }
      
      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      
      console.log(`Concurrent queries - Total: ${totalTime.toFixed(2)}ms for ${concurrentQueries} queries`)
      
      // All queries should complete successfully
      expect(results).toHaveLength(concurrentQueries)
      results.forEach(result => {
        expect(result).toBeDefined()
      })
      
      // Concurrent performance should be reasonable
      expect(totalTime).toBeLessThan(1000) // Under 1 second for 20 concurrent queries
      
      const avgTimePerQuery = totalTime / concurrentQueries
      expect(avgTimePerQuery).toBeLessThan(200) // Average under 200ms per query
    })

    it('should maintain performance under mixed read/write load', () => {
      const numReads = 50
      const numWrites = 20
      
      const startTime = performance.now()
      
      // Simulate mixed workload
      for (let i = 0; i < Math.max(numReads, numWrites); i++) {
        if (i < numWrites) {
          // Insert new events
          const event = createTestEvent(`concurrent-session-${i % 5}`, 'MixedLoad')
          insertEvent(event)
        }
        
        if (i < numReads) {
          // Query events
          getRecentEventsWithPriority({ totalLimit: 100 })
        }
      }
      
      const mixedLoadTime = performance.now() - startTime
      
      console.log(`Mixed load - ${numReads} reads + ${numWrites} writes: ${mixedLoadTime.toFixed(2)}ms`)
      
      // Mixed workload should complete within reasonable time
      expect(mixedLoadTime).toBeLessThan(2000)
      
      const avgTimePerOp = mixedLoadTime / (numReads + numWrites)
      expect(avgTimePerOp).toBeLessThan(30) // Under 30ms per operation
    })
  })

  describe('Query Optimization Validation', () => {
    it('should optimize timestamp-based queries effectively', () => {
      const now = Date.now()
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      
      // Query recent events within time window
      const startTime = performance.now()
      
      const db = getDatabase()
      const recentEvents = db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE timestamp >= ?
      `).get(oneDayAgo) as any
      
      const queryTime = performance.now() - startTime
      
      console.log(`Timestamp query - Count: ${recentEvents.count}, Time: ${queryTime.toFixed(2)}ms`)
      
      // Timestamp queries should be very fast due to index
      expect(queryTime).toBeLessThan(50)
      expect(recentEvents.count).toBeGreaterThan(0)
    })

    it('should handle event type filtering efficiently', () => {
      const eventTypes = ['UserPromptSubmit', 'PostToolUse', 'SubagentStart', 'SubagentComplete']
      
      eventTypes.forEach(eventType => {
        const startTime = performance.now()
        
        const db = getDatabase()
        const typeEvents = db.prepare(`
          SELECT COUNT(*) as count 
          FROM events 
          WHERE hook_event_type = ?
        `).get(eventType) as any
        
        const queryTime = performance.now() - startTime
        
        console.log(`Event type '${eventType}' - Count: ${typeEvents.count}, Time: ${queryTime.toFixed(2)}ms`)
        
        // Event type queries should use index effectively
        expect(queryTime).toBeLessThan(30)
      })
    })

    it('should optimize priority-based sorting and filtering', () => {
      const db = getDatabase()
      
      // Test priority-based query with sorting
      const startTime = performance.now()
      
      const priorityEvents = db.prepare(`
        SELECT id, priority, timestamp, hook_event_type
        FROM events 
        WHERE priority > 0
        ORDER BY priority DESC, timestamp DESC
        LIMIT 100
      `).all()
      
      const queryTime = performance.now() - startTime
      
      console.log(`Priority query - Count: ${priorityEvents.length}, Time: ${queryTime.toFixed(2)}ms`)
      
      // Priority queries should leverage composite indexes
      expect(queryTime).toBeLessThan(100)
      expect(priorityEvents.length).toBeGreaterThan(0)
      
      // Results should be properly sorted
      for (let i = 1; i < priorityEvents.length; i++) {
        const prev = priorityEvents[i - 1] as any
        const curr = priorityEvents[i] as any
        
        // Higher priority first, then newer timestamp
        if (prev.priority === curr.priority) {
          expect(prev.timestamp).toBeGreaterThanOrEqual(curr.timestamp)
        } else {
          expect(prev.priority).toBeGreaterThanOrEqual(curr.priority)
        }
      }
    })
  })

  // Helper functions for test data generation
  function generateLargeEventDataset(count: number): HookEvent[] {
    const events: HookEvent[] = []
    const eventTypes = ['UserPromptSubmit', 'PostToolUse', 'SubagentStart', 'SubagentComplete', 'Notification', 'Stop']
    const sessionIds = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5']
    
    for (let i = 0; i < count; i++) {
      const eventType = eventTypes[i % eventTypes.length]
      const sessionId = sessionIds[i % sessionIds.length]
      
      events.push(createTestEvent(sessionId, eventType, i))
    }
    
    return events
  }

  function createTestEvent(sessionId: string, eventType: string, index?: number): HookEvent {
    const now = Date.now()
    const timestamp = now - (Math.random() * 7 * 24 * 60 * 60 * 1000) // Random within last week
    
    let payload: Record<string, any> = {
      test_index: index || 0,
      timestamp: timestamp
    }

    // Create realistic payloads based on event type
    switch (eventType) {
      case 'UserPromptSubmit':
        payload = {
          ...payload,
          prompt: `Test user prompt ${index || 0} for performance testing`,
          user_id: `user-${(index || 0) % 10}`
        }
        break
      case 'PostToolUse':
        payload = {
          ...payload,
          tool_name: 'Task',
          description: `Agent${(index || 0) % 5}: Performance test task ${index || 0}`,
          subagent_type: 'engineer'
        }
        break
      case 'SubagentStart':
        payload = {
          ...payload,
          agent_name: `Agent${(index || 0) % 10}`,
          task_description: `Performance test task ${index || 0}`
        }
        break
      case 'SubagentComplete':
        payload = {
          ...payload,
          agent_name: `Agent${(index || 0) % 10}`,
          status: (index || 0) % 2 === 0 ? 'completed' : 'failed'
        }
        break
    }

    return {
      source_app: 'claude-code',
      session_id: sessionId,
      hook_event_type: eventType,
      payload,
      timestamp
    }
  }
})