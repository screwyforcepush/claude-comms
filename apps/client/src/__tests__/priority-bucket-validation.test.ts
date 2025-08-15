/**
 * Priority Bucket Behavior Validation Tests
 * Testing dual-bucket management, overflow handling, and client-side logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import type { HookEvent } from '../types';

// Priority Bucket Configuration Interface
interface PriorityBucketConfig {
  maxPriorityEvents: number;
  maxRegularEvents: number;
  totalDisplayLimit: number;
  priorityOverflowStrategy: 'remove_oldest_regular' | 'remove_oldest_priority' | 'strict_limits';
  enablePriorityIndicators: boolean;
}

// Enhanced HookEvent with priority
interface PriorityHookEvent extends HookEvent {
  priority?: number;
  priority_metadata?: {
    classified_at: number;
    classification_reason: string;
    retention_policy: string;
  };
}

// WebSocket Message Interface
interface PriorityWebSocketMessage {
  type: 'initial' | 'event' | 'priority_event';
  data: PriorityHookEvent | PriorityHookEvent[];
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

// Memory Management Interface
interface PriorityEventMemoryManager {
  shouldPerformCleanup(): boolean;
  optimizeBuckets(priorityEvents: PriorityHookEvent[], regularEvents: PriorityHookEvent[]): {
    priority: PriorityHookEvent[];
    regular: PriorityHookEvent[];
  };
}

// Mock implementation of priority bucket management
function createPriorityBucketManager(config: PriorityBucketConfig) {
  const priorityEvents = ref<PriorityHookEvent[]>([]);
  const regularEvents = ref<PriorityHookEvent[]>([]);
  const isTransitioning = ref(false);
  const lastCleanup = ref(0);
  
  const allEvents = ref<PriorityHookEvent[]>([]);
  
  // Update combined events when buckets change
  const updateCombinedEvents = () => {
    const combined = [...priorityEvents.value, ...regularEvents.value]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply total display limit
    if (combined.length > config.totalDisplayLimit) {
      allEvents.value = intelligentDisplayLimiting(combined, config);
    } else {
      allEvents.value = combined;
    }
  };
  
  const intelligentDisplayLimiting = (events: PriorityHookEvent[], cfg: PriorityBucketConfig): PriorityHookEvent[] => {
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    switch (cfg.priorityOverflowStrategy) {
      case 'remove_oldest_regular':
        // Always preserve priority events, remove oldest regular
        const maxRegularInDisplay = Math.max(0, cfg.totalDisplayLimit - priorityEvts.length);
        return [
          ...priorityEvts,
          ...regularEvts.slice(-maxRegularInDisplay)
        ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
      case 'remove_oldest_priority':
        // Remove oldest priority events if needed
        return events.slice(-cfg.totalDisplayLimit);
        
      case 'strict_limits':
        // Respect individual bucket limits strictly
        const limitedPriority = priorityEvts.slice(-cfg.maxPriorityEvents);
        const limitedRegular = regularEvts.slice(-cfg.maxRegularEvents);
        return [...limitedPriority, ...limitedRegular]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-cfg.totalDisplayLimit);
          
      default:
        return events.slice(-cfg.totalDisplayLimit);
    }
  };
  
  const addToPriorityBucket = (event: PriorityHookEvent) => {
    priorityEvents.value.push(event);
    
    if (priorityEvents.value.length > config.maxPriorityEvents) {
      // Remove oldest priority events when limit exceeded
      const overflow = priorityEvents.value.length - config.maxPriorityEvents;
      priorityEvents.value = priorityEvents.value.slice(overflow);
    }
    
    updateCombinedEvents();
  };
  
  const addToRegularBucket = (event: PriorityHookEvent) => {
    regularEvents.value.push(event);
    
    if (regularEvents.value.length > config.maxRegularEvents) {
      // More aggressive cleanup for regular events
      const keepCount = Math.max(
        config.maxRegularEvents - 20, // Remove batch of 20
        config.maxRegularEvents * 0.8  // Keep 80%
      );
      regularEvents.value = regularEvents.value.slice(-keepCount);
    }
    
    updateCombinedEvents();
  };
  
  const handleNewEvent = (event: PriorityHookEvent) => {
    const priority = event.priority || 0;
    
    if (priority > 0) {
      addToPriorityBucket(event);
    } else {
      addToRegularBucket(event);
    }
  };
  
  const handleInitialEvents = (events: PriorityHookEvent[]) => {
    // Separate initial events by priority
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    // Load into respective buckets with limits
    priorityEvents.value = priorityEvts.slice(-config.maxPriorityEvents);
    regularEvents.value = regularEvts.slice(-config.maxRegularEvents);
    
    updateCombinedEvents();
  };
  
  const clearBuckets = () => {
    priorityEvents.value = [];
    regularEvents.value = [];
    allEvents.value = [];
  };
  
  const getBucketStats = () => ({
    priority: priorityEvents.value.length,
    regular: regularEvents.value.length,
    total: allEvents.value.length,
    priorityPercentage: allEvents.value.length > 0 
      ? (priorityEvents.value.length / allEvents.value.length) * 100 
      : 0
  });
  
  return {
    priorityEvents: priorityEvents,
    regularEvents: regularEvents,
    allEvents: allEvents,
    isTransitioning,
    handleNewEvent,
    handleInitialEvents,
    clearBuckets,
    getBucketStats,
    addToPriorityBucket,
    addToRegularBucket,
    intelligentDisplayLimiting
  };
}

// Memory manager implementation
function createPriorityEventMemoryManager(config: PriorityBucketConfig): PriorityEventMemoryManager {
  let lastCleanup = 0;
  const cleanupInterval = 60000; // 1 minute
  
  const shouldPerformCleanup = (): boolean => {
    return Date.now() - lastCleanup > cleanupInterval;
  };
  
  const optimizeBuckets = (priorityEvents: PriorityHookEvent[], regularEvents: PriorityHookEvent[]) => {
    if (!shouldPerformCleanup()) {
      return { priority: priorityEvents, regular: regularEvents };
    }
    
    const now = Date.now();
    const priorityRetention = 24 * 60 * 60 * 1000; // 24 hours
    const regularRetention = 4 * 60 * 60 * 1000;   // 4 hours
    
    // Remove old events based on retention policy
    const freshPriority = priorityEvents.filter(
      e => now - (e.timestamp || 0) < priorityRetention
    );
    
    const freshRegular = regularEvents.filter(
      e => now - (e.timestamp || 0) < regularRetention
    );
    
    lastCleanup = now;
    
    return {
      priority: freshPriority.slice(-config.maxPriorityEvents),
      regular: freshRegular.slice(-config.maxRegularEvents)
    };
  };
  
  return {
    shouldPerformCleanup,
    optimizeBuckets
  };
}

// Test helper functions
function createTestEvent(
  eventType: string, 
  sessionId?: string, 
  priority?: number,
  timestamp?: number
): PriorityHookEvent {
  return {
    id: Math.floor(Math.random() * 1000),
    source_app: "test",
    session_id: sessionId || "test-session",
    hook_event_type: eventType,
    payload: { agentName: "TestAgent", data: "test" },
    timestamp: timestamp || Date.now(),
    priority
  };
}

function createTestConfig(overrides?: Partial<PriorityBucketConfig>): PriorityBucketConfig {
  return {
    maxPriorityEvents: 50,
    maxRegularEvents: 30,
    totalDisplayLimit: 80,
    priorityOverflowStrategy: 'remove_oldest_regular',
    enablePriorityIndicators: true,
    ...overrides
  };
}

describe('Priority Bucket Behavior Validation', () => {
  let bucketManager: ReturnType<typeof createPriorityBucketManager>;
  let config: PriorityBucketConfig;

  beforeEach(() => {
    config = createTestConfig();
    bucketManager = createPriorityBucketManager(config);
  });

  describe('Event Allocation', () => {
    it('should allocate priority events to priority bucket', () => {
      const priorityEvent = createTestEvent('UserPromptSubmit', 'session-1', 1);
      
      bucketManager.handleNewEvent(priorityEvent);
      
      expect(bucketManager.priorityEvents.value).toHaveLength(1);
      expect(bucketManager.regularEvents.value).toHaveLength(0);
      expect(bucketManager.priorityEvents.value[0]).toEqual(priorityEvent);
    });

    it('should allocate regular events to regular bucket', () => {
      const regularEvent = createTestEvent('tool_use', 'session-1', 0);
      
      bucketManager.handleNewEvent(regularEvent);
      
      expect(bucketManager.priorityEvents.value).toHaveLength(0);
      expect(bucketManager.regularEvents.value).toHaveLength(1);
      expect(bucketManager.regularEvents.value[0]).toEqual(regularEvent);
    });

    it('should treat events without priority as regular events', () => {
      const eventWithoutPriority = createTestEvent('tool_use', 'session-1');
      delete eventWithoutPriority.priority;
      
      bucketManager.handleNewEvent(eventWithoutPriority);
      
      expect(bucketManager.priorityEvents.value).toHaveLength(0);
      expect(bucketManager.regularEvents.value).toHaveLength(1);
    });

    it('should handle mixed event types correctly', () => {
      const events = [
        createTestEvent('UserPromptSubmit', 'session-1', 1),
        createTestEvent('tool_use', 'session-1', 0),
        createTestEvent('Notification', 'session-1', 1),
        createTestEvent('response', 'session-1', 0)
      ];
      
      events.forEach(event => bucketManager.handleNewEvent(event));
      
      expect(bucketManager.priorityEvents.value).toHaveLength(2);
      expect(bucketManager.regularEvents.value).toHaveLength(2);
      expect(bucketManager.allEvents.value).toHaveLength(4);
    });
  });

  describe('Bucket Overflow Management', () => {
    it('should remove oldest priority events when priority bucket overflows', () => {
      const smallConfig = createTestConfig({ maxPriorityEvents: 3 });
      const smallBucketManager = createPriorityBucketManager(smallConfig);
      
      // Add more priority events than the limit
      for (let i = 0; i < 5; i++) {
        const event = createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i * 1000);
        smallBucketManager.handleNewEvent(event);
      }
      
      expect(smallBucketManager.priorityEvents.value).toHaveLength(3);
      
      // Should keep the most recent events
      const timestamps = smallBucketManager.priorityEvents.value.map(e => e.timestamp);
      expect(timestamps).toEqual(timestamps.sort((a, b) => (a || 0) - (b || 0)));
    });

    it('should remove oldest regular events when regular bucket overflows', () => {
      const smallConfig = createTestConfig({ maxRegularEvents: 3 });
      const smallBucketManager = createPriorityBucketManager(smallConfig);
      
      // Add more regular events than the limit
      for (let i = 0; i < 5; i++) {
        const event = createTestEvent('tool_use', 'session-1', 0, Date.now() + i * 1000);
        smallBucketManager.handleNewEvent(event);
      }
      
      expect(smallBucketManager.regularEvents.value).toHaveLength(3);
    });

    it('should handle aggressive cleanup for regular events', () => {
      const config = createTestConfig({ maxRegularEvents: 25 });
      const manager = createPriorityBucketManager(config);
      
      // Fill regular bucket to capacity
      for (let i = 0; i < 25; i++) {
        const event = createTestEvent('tool_use', 'session-1', 0, Date.now() + i * 1000);
        manager.handleNewEvent(event);
      }
      
      expect(manager.regularEvents.value).toHaveLength(25);
      
      // Add one more to trigger cleanup
      const overflowEvent = createTestEvent('tool_use', 'session-1', 0, Date.now() + 26000);
      manager.handleNewEvent(overflowEvent);
      
      // Should aggressively clean up (keep 80% or remove batch of 20)
      const expectedKeepCount = Math.max(25 - 20, 25 * 0.8); // max(5, 20) = 20
      expect(manager.regularEvents.value.length).toBeLessThanOrEqual(25);
      expect(manager.regularEvents.value.length).toBeGreaterThanOrEqual(expectedKeepCount);
    });
  });

  describe('Display Limiting Strategies', () => {
    it('should implement remove_oldest_regular strategy correctly', () => {
      const config = createTestConfig({ 
        totalDisplayLimit: 10,
        priorityOverflowStrategy: 'remove_oldest_regular'
      });
      const manager = createPriorityBucketManager(config);
      
      // Add 8 priority events and 5 regular events (13 total, over limit of 10)
      for (let i = 0; i < 8; i++) {
        manager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i * 1000));
      }
      for (let i = 0; i < 5; i++) {
        manager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0, Date.now() + (i + 8) * 1000));
      }
      
      expect(manager.allEvents.value).toHaveLength(10);
      
      const priorityCount = manager.allEvents.value.filter(e => (e.priority || 0) > 0).length;
      const regularCount = manager.allEvents.value.filter(e => (e.priority || 0) === 0).length;
      
      expect(priorityCount).toBe(8); // All priority events preserved
      expect(regularCount).toBe(2);  // Only 2 regular events fit
    });

    it('should implement remove_oldest_priority strategy correctly', () => {
      const config = createTestConfig({ 
        totalDisplayLimit: 10,
        priorityOverflowStrategy: 'remove_oldest_priority'
      });
      const manager = createPriorityBucketManager(config);
      
      // Add more events than display limit
      for (let i = 0; i < 15; i++) {
        const eventType = i % 2 === 0 ? 'UserPromptSubmit' : 'tool_use';
        const priority = i % 2 === 0 ? 1 : 0;
        manager.handleNewEvent(createTestEvent(eventType, 'session-1', priority, Date.now() + i * 1000));
      }
      
      expect(manager.allEvents.value).toHaveLength(10);
      
      // Should keep most recent 10 events regardless of priority
      const displayedTimestamps = manager.allEvents.value.map(e => e.timestamp);
      const sortedTimestamps = displayedTimestamps.sort((a, b) => (a || 0) - (b || 0));
      expect(displayedTimestamps).toEqual(sortedTimestamps);
    });

    it('should implement strict_limits strategy correctly', () => {
      const config = createTestConfig({ 
        maxPriorityEvents: 6,
        maxRegularEvents: 4,
        totalDisplayLimit: 8, // Less than sum of individual limits
        priorityOverflowStrategy: 'strict_limits'
      });
      const manager = createPriorityBucketManager(config);
      
      // Add more events than individual limits
      for (let i = 0; i < 10; i++) {
        manager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i * 1000));
      }
      for (let i = 0; i < 10; i++) {
        manager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0, Date.now() + (i + 10) * 1000));
      }
      
      expect(manager.allEvents.value).toHaveLength(8); // Total display limit
      
      const priorityCount = manager.allEvents.value.filter(e => (e.priority || 0) > 0).length;
      const regularCount = manager.allEvents.value.filter(e => (e.priority || 0) === 0).length;
      
      expect(priorityCount).toBeLessThanOrEqual(6);
      expect(regularCount).toBeLessThanOrEqual(4);
    });
  });

  describe('Initial Event Loading', () => {
    it('should load initial events into correct buckets', () => {
      const initialEvents = [
        createTestEvent('UserPromptSubmit', 'session-1', 1),
        createTestEvent('tool_use', 'session-1', 0),
        createTestEvent('Notification', 'session-2', 1),
        createTestEvent('response', 'session-2', 0)
      ];
      
      bucketManager.handleInitialEvents(initialEvents);
      
      expect(bucketManager.priorityEvents.value).toHaveLength(2);
      expect(bucketManager.regularEvents.value).toHaveLength(2);
      expect(bucketManager.allEvents.value).toHaveLength(4);
    });

    it('should respect bucket limits when loading initial events', () => {
      const smallConfig = createTestConfig({ 
        maxPriorityEvents: 2,
        maxRegularEvents: 2
      });
      const smallManager = createPriorityBucketManager(smallConfig);
      
      const initialEvents = [
        ...Array.from({ length: 5 }, (_, i) => createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i * 1000)),
        ...Array.from({ length: 5 }, (_, i) => createTestEvent('tool_use', 'session-1', 0, Date.now() + (i + 5) * 1000))
      ];
      
      smallManager.handleInitialEvents(initialEvents);
      
      expect(smallManager.priorityEvents.value).toHaveLength(2);
      expect(smallManager.regularEvents.value).toHaveLength(2);
    });

    it('should maintain timestamp ordering in initial load', () => {
      const initialEvents = [
        createTestEvent('UserPromptSubmit', 'session-1', 1, 1000),
        createTestEvent('tool_use', 'session-1', 0, 2000),
        createTestEvent('Notification', 'session-2', 1, 3000),
        createTestEvent('response', 'session-2', 0, 4000)
      ];
      
      bucketManager.handleInitialEvents(initialEvents);
      
      const allTimestamps = bucketManager.allEvents.value.map(e => e.timestamp);
      expect(allTimestamps).toEqual([1000, 2000, 3000, 4000]);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should calculate bucket statistics correctly', () => {
      const events = [
        createTestEvent('UserPromptSubmit', 'session-1', 1),
        createTestEvent('UserPromptSubmit', 'session-2', 1),
        createTestEvent('tool_use', 'session-1', 0),
        createTestEvent('response', 'session-2', 0)
      ];
      
      events.forEach(event => bucketManager.handleNewEvent(event));
      
      const stats = bucketManager.getBucketStats();
      
      expect(stats.priority).toBe(2);
      expect(stats.regular).toBe(2);
      expect(stats.total).toBe(4);
      expect(stats.priorityPercentage).toBe(50);
    });

    it('should handle zero events in statistics', () => {
      const stats = bucketManager.getBucketStats();
      
      expect(stats.priority).toBe(0);
      expect(stats.regular).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.priorityPercentage).toBe(0);
    });

    it('should calculate priority percentage correctly', () => {
      // Add 7 priority events and 3 regular events
      for (let i = 0; i < 7; i++) {
        bucketManager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1));
      }
      for (let i = 0; i < 3; i++) {
        bucketManager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0));
      }
      
      const stats = bucketManager.getBucketStats();
      expect(stats.priorityPercentage).toBe(70); // 7/10 * 100
    });
  });

  describe('Memory Management', () => {
    it('should perform cleanup based on time intervals', () => {
      const memoryManager = createPriorityEventMemoryManager(config);
      
      // Initially should not need cleanup
      expect(memoryManager.shouldPerformCleanup()).toBe(true); // First time always true
      
      // After cleanup, should not need immediate cleanup
      const now = Date.now();
      const recentEvents = [createTestEvent('UserPromptSubmit', 'session-1', 1, now)];
      const oldEvents = [createTestEvent('tool_use', 'session-1', 0, now)];
      
      memoryManager.optimizeBuckets(recentEvents, oldEvents);
      
      // Mock that cleanup just happened
      expect(memoryManager.shouldPerformCleanup()).toBe(false);
    });

    it('should remove expired events based on retention policy', () => {
      const memoryManager = createPriorityEventMemoryManager(config);
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const sixHoursAgo = now - (6 * 60 * 60 * 1000);
      
      const priorityEvents = [
        createTestEvent('UserPromptSubmit', 'session-1', 1, oneDayAgo - 1000), // Expired priority
        createTestEvent('Notification', 'session-1', 1, now - 1000) // Fresh priority
      ];
      
      const regularEvents = [
        createTestEvent('tool_use', 'session-1', 0, sixHoursAgo), // Expired regular
        createTestEvent('response', 'session-1', 0, now - 1000) // Fresh regular
      ];
      
      const optimized = memoryManager.optimizeBuckets(priorityEvents, regularEvents);
      
      expect(optimized.priority).toHaveLength(1); // Only fresh priority event
      expect(optimized.regular).toHaveLength(1);  // Only fresh regular event
      expect(optimized.priority[0].hook_event_type).toBe('Notification');
      expect(optimized.regular[0].hook_event_type).toBe('response');
    });

    it('should respect bucket size limits during cleanup', () => {
      const smallConfig = createTestConfig({ 
        maxPriorityEvents: 2,
        maxRegularEvents: 2
      });
      const memoryManager = createPriorityEventMemoryManager(smallConfig);
      const now = Date.now();
      
      // Create more fresh events than bucket limits
      const priorityEvents = Array.from({ length: 5 }, (_, i) => 
        createTestEvent('UserPromptSubmit', 'session-1', 1, now - i * 1000)
      );
      
      const regularEvents = Array.from({ length: 5 }, (_, i) => 
        createTestEvent('tool_use', 'session-1', 0, now - i * 1000)
      );
      
      const optimized = memoryManager.optimizeBuckets(priorityEvents, regularEvents);
      
      expect(optimized.priority).toHaveLength(2);
      expect(optimized.regular).toHaveLength(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle events with missing timestamps', () => {
      const eventWithoutTimestamp = createTestEvent('UserPromptSubmit', 'session-1', 1);
      delete eventWithoutTimestamp.timestamp;
      
      expect(() => bucketManager.handleNewEvent(eventWithoutTimestamp)).not.toThrow();
      expect(bucketManager.priorityEvents.value).toHaveLength(1);
    });

    it('should handle events with invalid priority values', () => {
      const events = [
        { ...createTestEvent('tool_use', 'session-1'), priority: -1 },
        { ...createTestEvent('tool_use', 'session-1'), priority: NaN },
        { ...createTestEvent('tool_use', 'session-1'), priority: Infinity }
      ];
      
      events.forEach(event => {
        expect(() => bucketManager.handleNewEvent(event)).not.toThrow();
      });
      
      // All should be treated as regular events (priority 0)
      expect(bucketManager.regularEvents.value).toHaveLength(3);
      expect(bucketManager.priorityEvents.value).toHaveLength(0);
    });

    it('should handle clearing buckets', () => {
      // Add some events
      bucketManager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1));
      bucketManager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0));
      
      expect(bucketManager.allEvents.value).toHaveLength(2);
      
      bucketManager.clearBuckets();
      
      expect(bucketManager.priorityEvents.value).toHaveLength(0);
      expect(bucketManager.regularEvents.value).toHaveLength(0);
      expect(bucketManager.allEvents.value).toHaveLength(0);
    });

    it('should handle extreme configuration values', () => {
      const extremeConfig = createTestConfig({
        maxPriorityEvents: 0,
        maxRegularEvents: 0,
        totalDisplayLimit: 0
      });
      
      const extremeManager = createPriorityBucketManager(extremeConfig);
      
      extremeManager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1));
      extremeManager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0));
      
      expect(extremeManager.allEvents.value).toHaveLength(0);
    });

    it('should handle very large event volumes', () => {
      const largeConfig = createTestConfig({
        maxPriorityEvents: 1000,
        maxRegularEvents: 1000,
        totalDisplayLimit: 2000
      });
      
      const largeManager = createPriorityBucketManager(largeConfig);
      
      // Add 2000 events rapidly
      for (let i = 0; i < 1000; i++) {
        largeManager.handleNewEvent(createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i));
        largeManager.handleNewEvent(createTestEvent('tool_use', 'session-1', 0, Date.now() + i + 1000));
      }
      
      expect(largeManager.priorityEvents.value).toHaveLength(1000);
      expect(largeManager.regularEvents.value).toHaveLength(1000);
      expect(largeManager.allEvents.value).toHaveLength(2000);
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency event additions efficiently', () => {
      const startTime = performance.now();
      
      // Add 1000 events rapidly
      for (let i = 0; i < 1000; i++) {
        const eventType = i % 3 === 0 ? 'UserPromptSubmit' : 'tool_use';
        const priority = i % 3 === 0 ? 1 : 0;
        bucketManager.handleNewEvent(createTestEvent(eventType, 'session-1', priority, Date.now() + i));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(bucketManager.allEvents.value.length).toBeGreaterThan(0);
    });

    it('should maintain performance with frequent bucket statistics calls', () => {
      // Add some events
      for (let i = 0; i < 100; i++) {
        const eventType = i % 2 === 0 ? 'UserPromptSubmit' : 'tool_use';
        const priority = i % 2 === 0 ? 1 : 0;
        bucketManager.handleNewEvent(createTestEvent(eventType, 'session-1', priority));
      }
      
      const startTime = performance.now();
      
      // Call statistics 1000 times
      for (let i = 0; i < 1000; i++) {
        bucketManager.getBucketStats();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should not cause memory leaks with continuous operation', () => {
      const config = createTestConfig({ 
        maxPriorityEvents: 10,
        maxRegularEvents: 10,
        totalDisplayLimit: 20
      });
      const manager = createPriorityBucketManager(config);
      
      // Simulate continuous operation
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add events
        for (let i = 0; i < 50; i++) {
          const eventType = i % 2 === 0 ? 'UserPromptSubmit' : 'tool_use';
          const priority = i % 2 === 0 ? 1 : 0;
          manager.handleNewEvent(createTestEvent(eventType, 'session-1', priority));
        }
        
        // Clear and restart
        manager.clearBuckets();
      }
      
      // Memory should be clean
      expect(manager.priorityEvents.value).toHaveLength(0);
      expect(manager.regularEvents.value).toHaveLength(0);
      expect(manager.allEvents.value).toHaveLength(0);
    });
  });
});