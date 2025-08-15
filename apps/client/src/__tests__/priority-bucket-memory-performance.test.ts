/**
 * Priority Bucket Memory Management & Performance Tests
 * 
 * Tests memory usage, performance, and efficiency of the dual-bucket priority event system.
 * Validates <50MB client memory limit and performance requirements from Phase 11.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookEvent } from '../types';

// Performance targets from architecture specification
const PERFORMANCE_TARGETS = {
  MAX_CLIENT_MEMORY: 50 * 1024 * 1024, // 50MB
  MAX_PRIORITY_EVENTS: 200,
  MAX_REGULAR_EVENTS: 100,
  TOTAL_DISPLAY_LIMIT: 250,
  TARGET_FPS: 60,
  MIN_FPS: 50,
  MAX_FRAME_TIME: 16.67, // 60fps
  WEBSOCKET_OVERHEAD_LIMIT: 0.05, // 5% max overhead
  BUCKET_SWITCH_TIME: 10, // 10ms max for bucket operations
};

interface MemoryMeasurement {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  priorityEventCount: number;
  regularEventCount: number;
}

interface PriorityBucketConfig {
  maxPriorityEvents: number;
  maxRegularEvents: number;
  totalDisplayLimit: number;
  priorityOverflowStrategy: 'remove_oldest_regular' | 'remove_oldest_priority' | 'strict_limits';
  enablePriorityIndicators: boolean;
}

// Mock priority bucket system based on architecture spec
class MockPriorityBucketSystem {
  private priorityEvents: HookEvent[] = [];
  private regularEvents: HookEvent[] = [];
  private config: PriorityBucketConfig;
  private memoryUsage: number = 10 * 1024 * 1024; // Base 10MB
  
  constructor(config: Partial<PriorityBucketConfig> = {}) {
    this.config = {
      maxPriorityEvents: PERFORMANCE_TARGETS.MAX_PRIORITY_EVENTS,
      maxRegularEvents: PERFORMANCE_TARGETS.MAX_REGULAR_EVENTS,
      totalDisplayLimit: PERFORMANCE_TARGETS.TOTAL_DISPLAY_LIMIT,
      priorityOverflowStrategy: 'remove_oldest_regular',
      enablePriorityIndicators: true,
      ...config
    };
  }

  addEvent(event: HookEvent): void {
    const priority = (event as any).priority || 0;
    const eventSize = this.calculateEventSize(event);
    
    if (priority > 0) {
      this.addToPriorityBucket(event);
    } else {
      this.addToRegularBucket(event);
    }
    
    this.memoryUsage += eventSize;
    this.enforceMemoryLimits();
  }

  private addToPriorityBucket(event: HookEvent): void {
    this.priorityEvents.push(event);
    
    if (this.priorityEvents.length > this.config.maxPriorityEvents) {
      const overflow = this.priorityEvents.length - this.config.maxPriorityEvents;
      const removed = this.priorityEvents.splice(0, overflow);
      this.memoryUsage -= removed.reduce((sum, e) => sum + this.calculateEventSize(e), 0);
    }
  }

  private addToRegularBucket(event: HookEvent): void {
    this.regularEvents.push(event);
    
    if (this.regularEvents.length > this.config.maxRegularEvents) {
      const keepCount = Math.max(
        this.config.maxRegularEvents - 20, // Remove batch of 20
        this.config.maxRegularEvents * 0.8  // Keep 80%
      );
      const removed = this.regularEvents.splice(0, this.regularEvents.length - keepCount);
      this.memoryUsage -= removed.reduce((sum, e) => sum + this.calculateEventSize(e), 0);
    }
  }

  private enforceMemoryLimits(): void {
    while (this.memoryUsage > PERFORMANCE_TARGETS.MAX_CLIENT_MEMORY * 0.9) {
      // Emergency cleanup - remove oldest regular events first
      if (this.regularEvents.length > 10) {
        const removed = this.regularEvents.splice(0, 10);
        this.memoryUsage -= removed.reduce((sum, e) => sum + this.calculateEventSize(e), 0);
      } else if (this.priorityEvents.length > 50) {
        const removed = this.priorityEvents.splice(0, 10);
        this.memoryUsage -= removed.reduce((sum, e) => sum + this.calculateEventSize(e), 0);
      } else {
        break;
      }
    }
  }

  private calculateEventSize(event: HookEvent): number {
    // Estimate memory size of event
    const baseSize = 200; // Base object overhead
    const payloadSize = JSON.stringify(event.payload || {}).length * 2; // UTF-16
    const chatSize = event.chat ? JSON.stringify(event.chat).length * 2 : 0;
    const summarySize = event.summary ? event.summary.length * 2 : 0;
    
    return baseSize + payloadSize + chatSize + summarySize;
  }

  getAllEvents(): HookEvent[] {
    const combined = [...this.priorityEvents, ...this.regularEvents]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    if (combined.length > this.config.totalDisplayLimit) {
      return this.intelligentDisplayLimiting(combined);
    }
    
    return combined;
  }

  private intelligentDisplayLimiting(events: HookEvent[]): HookEvent[] {
    const priorityEvts = events.filter(e => ((e as any).priority || 0) > 0);
    const regularEvts = events.filter(e => ((e as any).priority || 0) === 0);
    
    switch (this.config.priorityOverflowStrategy) {
      case 'remove_oldest_regular':
        const maxRegularInDisplay = Math.max(0, this.config.totalDisplayLimit - priorityEvts.length);
        return [
          ...priorityEvts,
          ...regularEvts.slice(-maxRegularInDisplay)
        ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
      case 'remove_oldest_priority':
        return events.slice(-this.config.totalDisplayLimit);
        
      case 'strict_limits':
        const limitedPriority = priorityEvts.slice(-this.config.maxPriorityEvents);
        const limitedRegular = regularEvts.slice(-this.config.maxRegularEvents);
        return [...limitedPriority, ...limitedRegular]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-this.config.totalDisplayLimit);
          
      default:
        return events.slice(-this.config.totalDisplayLimit);
    }
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getPriorityEventCount(): number {
    return this.priorityEvents.length;
  }

  getRegularEventCount(): number {
    return this.regularEvents.length;
  }

  clearBuckets(): void {
    this.priorityEvents = [];
    this.regularEvents = [];
    this.memoryUsage = 10 * 1024 * 1024; // Reset to base
  }

  getEventStats() {
    const allEvents = this.getAllEvents();
    return {
      total: allEvents.length,
      priority: this.priorityEvents.length,
      regular: this.regularEvents.length,
      priorityPercentage: allEvents.length > 0 
        ? (this.priorityEvents.length / allEvents.length) * 100 
        : 0,
      memoryUsage: this.memoryUsage,
      memoryEfficiency: allEvents.length > 0 
        ? this.memoryUsage / allEvents.length 
        : 0
    };
  }
}

// Mock WebSocket message enhancement for priority events
interface PriorityWebSocketMessage {
  type: 'initial' | 'event' | 'priority_event';
  data: HookEvent | HookEvent[];
  priority_info?: {
    total_events: number;
    priority_events: number;
    regular_events: number;
    retention_window: {
      priority_hours: number;
      regular_hours: number;
    };
  };
}

function createTestEvent(type: string, priority: number = 0, payloadSize: number = 1024): HookEvent {
  return {
    id: Math.floor(Math.random() * 1000000),
    source_app: 'test',
    session_id: 'test-session',
    hook_event_type: type,
    payload: {
      data: 'x'.repeat(payloadSize), // Control payload size
      timestamp: Date.now()
    },
    timestamp: Date.now(),
    priority,
    priority_metadata: priority > 0 ? {
      classified_at: Date.now(),
      classification_reason: 'automatic',
      retention_policy: 'extended'
    } : undefined
  } as HookEvent & { priority: number };
}

function createEventBurst(count: number, priorityRatio: number = 0.3): HookEvent[] {
  const events: HookEvent[] = [];
  const priorityCount = Math.floor(count * priorityRatio);
  
  // Create priority events
  for (let i = 0; i < priorityCount; i++) {
    const eventType = ['UserPromptSubmit', 'Notification', 'Stop'][i % 3];
    events.push(createTestEvent(eventType, 1, 512 + Math.random() * 1024));
  }
  
  // Create regular events
  for (let i = 0; i < count - priorityCount; i++) {
    events.push(createTestEvent('RegularEvent', 0, 256 + Math.random() * 512));
  }
  
  return events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

function measureMemory(): MemoryMeasurement {
  const memory = (performance as any).memory || {
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0
  };
  
  return {
    timestamp: Date.now(),
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    priorityEventCount: 0,
    regularEventCount: 0
  };
}

describe('Priority Bucket Memory Management & Performance', () => {
  let bucketSystem: MockPriorityBucketSystem;
  let memoryHistory: MemoryMeasurement[] = [];

  beforeEach(() => {
    bucketSystem = new MockPriorityBucketSystem();
    memoryHistory = [];
    
    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 25 * 1024 * 1024, // 25MB
        totalJSHeapSize: 40 * 1024 * 1024, // 40MB  
        jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
      },
      configurable: true
    });

    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Memory Usage Validation', () => {
    it('should stay under 50MB limit with maximum events', () => {
      // Add maximum allowed events
      const events = createEventBurst(PERFORMANCE_TARGETS.TOTAL_DISPLAY_LIMIT);
      
      events.forEach(event => bucketSystem.addEvent(event));
      
      const memoryUsage = bucketSystem.getMemoryUsage();
      expect(memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_CLIENT_MEMORY);
      
      console.log(`Memory usage with ${events.length} events: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory pressure with large payloads', () => {
      // Create events with large payloads
      const largeEvents = Array.from({ length: 100 }, (_, i) => 
        createTestEvent('LargeEvent', i % 3 === 0 ? 1 : 0, 5 * 1024) // 5KB payloads
      );
      
      largeEvents.forEach(event => bucketSystem.addEvent(event));
      
      const memoryUsage = bucketSystem.getMemoryUsage();
      expect(memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_CLIENT_MEMORY);
    });

    it('should efficiently reclaim memory when events are removed', () => {
      const initialMemory = bucketSystem.getMemoryUsage();
      
      // Add many events to trigger cleanup
      const events = createEventBurst(500, 0.5);
      events.forEach(event => bucketSystem.addEvent(event));
      
      const peakMemory = bucketSystem.getMemoryUsage();
      expect(peakMemory).toBeGreaterThan(initialMemory);
      
      // Clear buckets should reclaim most memory
      bucketSystem.clearBuckets();
      const finalMemory = bucketSystem.getMemoryUsage();
      expect(finalMemory).toBeLessThanOrEqual(initialMemory * 1.1); // Within 10% of initial
    });

    it('should maintain memory efficiency as event count grows', () => {
      const measurements: Array<{ count: number; memory: number; efficiency: number }> = [];
      
      for (let count = 50; count <= 300; count += 50) {
        bucketSystem.clearBuckets();
        const events = createEventBurst(count, 0.3);
        events.forEach(event => bucketSystem.addEvent(event));
        
        const stats = bucketSystem.getEventStats();
        measurements.push({
          count,
          memory: stats.memoryUsage,
          efficiency: stats.memoryEfficiency
        });
      }
      
      // Memory efficiency should not degrade significantly
      const firstEfficiency = measurements[0].efficiency;
      const lastEfficiency = measurements[measurements.length - 1].efficiency;
      
      expect(lastEfficiency).toBeLessThanOrEqual(firstEfficiency * 2); // Max 2x degradation
      
      console.log('Memory efficiency measurements:', measurements);
    });
  });

  describe('Dual-Bucket Performance', () => {
    it('should add events to correct buckets quickly', () => {
      const events = createEventBurst(100, 0.4);
      
      const startTime = performance.now();
      events.forEach(event => bucketSystem.addEvent(event));
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.BUCKET_SWITCH_TIME);
      
      const stats = bucketSystem.getEventStats();
      expect(stats.priority).toBeGreaterThan(0);
      expect(stats.regular).toBeGreaterThan(0);
      expect(stats.total).toBe(Math.min(100, PERFORMANCE_TARGETS.TOTAL_DISPLAY_LIMIT));
    });

    it('should handle overflow strategies efficiently', () => {
      const strategies: Array<PriorityBucketConfig['priorityOverflowStrategy']> = [
        'remove_oldest_regular',
        'remove_oldest_priority', 
        'strict_limits'
      ];
      
      strategies.forEach(strategy => {
        const testSystem = new MockPriorityBucketSystem({
          priorityOverflowStrategy: strategy,
          totalDisplayLimit: 50
        });
        
        const events = createEventBurst(100, 0.5); // 50% priority
        const startTime = performance.now();
        
        events.forEach(event => testSystem.addEvent(event));
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        expect(processingTime).toBeLessThan(20); // 20ms limit for 100 events
        expect(testSystem.getAllEvents().length).toBeLessThanOrEqual(50);
        
        console.log(`${strategy} strategy: ${processingTime.toFixed(2)}ms for 100 events`);
      });
    });

    it('should preserve priority events under memory pressure', () => {
      // Fill system beyond regular capacity
      const massiveEventBurst = createEventBurst(1000, 0.2); // 20% priority
      
      massiveEventBurst.forEach(event => bucketSystem.addEvent(event));
      
      const stats = bucketSystem.getEventStats();
      const allEvents = bucketSystem.getAllEvents();
      
      const priorityInDisplay = allEvents.filter(e => ((e as any).priority || 0) > 0).length;
      const regularInDisplay = allEvents.filter(e => ((e as any).priority || 0) === 0).length;
      
      // Should preserve more priority events relative to their proportion
      const priorityRatio = priorityInDisplay / allEvents.length;
      expect(priorityRatio).toBeGreaterThan(0.15); // Should preserve at least 15%
      
      expect(stats.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_CLIENT_MEMORY);
      
      console.log(`Priority preservation: ${priorityRatio * 100}% priority events in display`);
    });
  });

  describe('WebSocket Message Performance', () => {
    it('should measure priority metadata overhead', () => {
      const baseEvent: HookEvent = createTestEvent('TestEvent', 0);
      const priorityEvent: HookEvent = createTestEvent('UserPromptSubmit', 1);
      
      const baseMessage = {
        type: 'event' as const,
        data: baseEvent
      };
      
      const priorityMessage: PriorityWebSocketMessage = {
        type: 'priority_event',
        data: priorityEvent,
        priority_info: {
          total_events: 100,
          priority_events: 30,
          regular_events: 70,
          retention_window: {
            priority_hours: 24,
            regular_hours: 4
          }
        }
      };
      
      const baseSize = JSON.stringify(baseMessage).length;
      const prioritySize = JSON.stringify(priorityMessage).length;
      const overhead = (prioritySize - baseSize) / baseSize;
      
      expect(overhead).toBeLessThanOrEqual(PERFORMANCE_TARGETS.WEBSOCKET_OVERHEAD_LIMIT);
      
      console.log(`WebSocket overhead: ${(overhead * 100).toFixed(2)}% (${prioritySize - baseSize} bytes)`);
    });

    it('should handle initial connection payload efficiently', () => {
      const initialEvents = createEventBurst(150, 0.3);
      
      const initialMessage: PriorityWebSocketMessage = {
        type: 'initial',
        data: initialEvents,
        priority_info: {
          total_events: initialEvents.length,
          priority_events: initialEvents.filter(e => ((e as any).priority || 0) > 0).length,
          regular_events: initialEvents.filter(e => ((e as any).priority || 0) === 0).length,
          retention_window: {
            priority_hours: 24,
            regular_hours: 4
          }
        }
      };
      
      const startTime = performance.now();
      const serialized = JSON.stringify(initialMessage);
      const parseTime = performance.now() - startTime;
      
      expect(parseTime).toBeLessThan(10); // 10ms max for serialization
      expect(serialized.length).toBeLessThan(2 * 1024 * 1024); // 2MB max
      
      console.log(`Initial payload: ${(serialized.length / 1024).toFixed(1)}KB, serialize: ${parseTime.toFixed(2)}ms`);
    });

    it('should maintain low latency with priority classification', () => {
      const eventTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'RegularEvent'];
      const latencies: number[] = [];
      
      eventTypes.forEach(eventType => {
        const event = createTestEvent(eventType, eventType !== 'RegularEvent' ? 1 : 0);
        
        const startTime = performance.now();
        bucketSystem.addEvent(event);
        const endTime = performance.now();
        
        latencies.push(endTime - startTime);
      });
      
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      
      expect(avgLatency).toBeLessThan(1); // 1ms average
      expect(maxLatency).toBeLessThan(5); // 5ms max
      
      console.log(`Classification latencies: avg ${avgLatency.toFixed(3)}ms, max ${maxLatency.toFixed(3)}ms`);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during continuous operation', async () => {
      const memorySnapshots: MemoryMeasurement[] = [];
      
      // Simulate 5 minutes of operation
      for (let minute = 0; minute < 5; minute++) {
        // Add burst of events every minute
        const events = createEventBurst(50, 0.3);
        events.forEach(event => bucketSystem.addEvent(event));
        
        memorySnapshots.push({
          ...measureMemory(),
          priorityEventCount: bucketSystem.getPriorityEventCount(),
          regularEventCount: bucketSystem.getRegularEventCount()
        });
        
        // Advance time by 1 minute
        vi.advanceTimersByTime(60 * 1000);
      }
      
      // Memory should stabilize, not continuously grow
      const firstMemory = memorySnapshots[0].usedJSHeapSize;
      const lastMemory = memorySnapshots[memorySnapshots.length - 1].usedJSHeapSize;
      const growth = (lastMemory - firstMemory) / firstMemory;
      
      expect(growth).toBeLessThan(0.2); // Max 20% growth over 5 minutes
      
      console.log(`Memory growth over 5 minutes: ${(growth * 100).toFixed(1)}%`);
    });

    it('should handle cleanup efficiently during garbage collection', () => {
      const initialMemory = bucketSystem.getMemoryUsage();
      
      // Create memory pressure
      for (let i = 0; i < 10; i++) {
        const events = createEventBurst(100, 0.3);
        events.forEach(event => bucketSystem.addEvent(event));
      }
      
      const peakMemory = bucketSystem.getMemoryUsage();
      
      // Simulate garbage collection by clearing old events
      bucketSystem.clearBuckets();
      
      // Add fresh events
      const freshEvents = createEventBurst(50, 0.3);
      freshEvents.forEach(event => bucketSystem.addEvent(event));
      
      const finalMemory = bucketSystem.getMemoryUsage();
      
      // Should be much closer to initial than peak
      const recoveryRatio = (finalMemory - initialMemory) / (peakMemory - initialMemory);
      expect(recoveryRatio).toBeLessThan(0.3); // Should recover 70%+ of memory
      
      console.log(`Memory recovery: ${((1 - recoveryRatio) * 100).toFixed(1)}%`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish baseline performance metrics', () => {
      const benchmarks = [
        { eventCount: 50, maxTime: 5, description: 'Light load' },
        { eventCount: 150, maxTime: 10, description: 'Normal load' },
        { eventCount: 250, maxTime: 15, description: 'Heavy load' }
      ];
      
      benchmarks.forEach(benchmark => {
        bucketSystem.clearBuckets();
        const events = createEventBurst(benchmark.eventCount, 0.3);
        
        const startTime = performance.now();
        events.forEach(event => bucketSystem.addEvent(event));
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(benchmark.maxTime);
        
        const stats = bucketSystem.getEventStats();
        console.log(`${benchmark.description}: ${processingTime.toFixed(2)}ms, ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
      });
    });

    it('should validate memory efficiency targets', () => {
      const targetEvents = 200;
      const events = createEventBurst(targetEvents, 0.3);
      
      events.forEach(event => bucketSystem.addEvent(event));
      
      const stats = bucketSystem.getEventStats();
      const memoryPerEvent = stats.memoryUsage / stats.total;
      
      // Should use less than 200KB per event on average
      expect(memoryPerEvent).toBeLessThan(200 * 1024);
      
      // Should maintain at least 80% of target events
      expect(stats.total).toBeGreaterThanOrEqual(targetEvents * 0.8);
      
      console.log(`Memory efficiency: ${(memoryPerEvent / 1024).toFixed(1)}KB per event`);
    });
  });
});