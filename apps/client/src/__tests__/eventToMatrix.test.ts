/**
 * Test Suite for Event-to-Matrix Transformation
 * 
 * Comprehensive test coverage for the processEvent function that connects
 * HookEvents from WebSocket to Matrix visualization drops.
 * 
 * Test-First Development: These tests define the expected behavior before implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HookEvent } from '../types';
import type { MatrixDrop } from '../types/matrix-mode';
import { createEventToDropTransformer } from '../utils/eventToMatrix';
import { useMatrixMode } from '../composables/useMatrixMode';

describe('EventToMatrix Transformation', () => {
  let transformer: ReturnType<typeof createEventToDropTransformer>;
  let matrixMode: ReturnType<typeof useMatrixMode>;
  
  beforeEach(() => {
    // Create transformer with test canvas dimensions
    transformer = createEventToDropTransformer(800, 600, 20);
    
    // Create matrix mode instance for integration testing
    matrixMode = useMatrixMode();
  });

  describe('processEvent function', () => {
    it('should transform HookEvent to MatrixDrop with correct structure', () => {
      const mockEvent: HookEvent = {
        id: 123,
        source_app: 'test-app',
        session_id: 'test-session-abc123',
        hook_event_type: 'agent_spawn',
        payload: {
          agentName: 'TestAgent',
          status: 'pending'
        },
        timestamp: 1642781234567
      };

      const drop = transformer.transform(mockEvent);

      // Verify drop structure
      expect(drop).toMatchObject({
        id: expect.stringMatching(/^test-session-abc123-/),
        column: expect.any(Number),
        position: expect.any(Number),
        speed: expect.any(Number),
        characters: expect.arrayContaining([expect.any(String)]),
        brightness: expect.arrayContaining([expect.any(Number)]),
        headColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}/),
        trailColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}/),
        sourceEvent: mockEvent,
        createdAt: expect.any(Number),
        type: expect.stringMatching(/^(spawn|event-data|status-update|error|completion|ambient)$/),
        trailLength: expect.any(Number),
        isActive: true
      });
    });

    it('should map agent names to katakana characters', () => {
      const mockEvent: HookEvent = {
        source_app: 'test-app',
        session_id: 'session-123',
        hook_event_type: 'agent_response',
        payload: { agentName: 'SarahPixel' },
        timestamp: Date.now()
      };

      const drop = transformer.transform(mockEvent);

      // Should contain katakana characters from agent name
      const hasKatakana = drop.characters.some(char => 
        /[\u30A0-\u30FF]/.test(char) // Katakana Unicode range
      );
      expect(hasKatakana).toBe(true);
    });

    it('should assign consistent columns for same session', () => {
      const sessionId = 'consistent-session-123';
      const event1: HookEvent = {
        source_app: 'app1',
        session_id: sessionId,
        hook_event_type: 'start',
        payload: {},
        timestamp: Date.now()
      };
      
      const event2: HookEvent = {
        source_app: 'app1',
        session_id: sessionId,
        hook_event_type: 'progress',
        payload: {},
        timestamp: Date.now() + 1000
      };

      const drop1 = transformer.transform(event1);
      const drop2 = transformer.transform(event2);

      expect(drop1.column).toBe(drop2.column);
    });

    it('should map event types to appropriate symbols', () => {
      const eventTypes = [
        { type: 'agent_spawn', expectedSymbol: '↕' },
        { type: 'agent_complete', expectedSymbol: '◆' },
        { type: 'error_occurred', expectedSymbol: '⚠' },
        { type: 'status_update', expectedSymbol: '◐' }
      ];

      eventTypes.forEach(({ type, expectedSymbol }) => {
        const mockEvent: HookEvent = {
          source_app: 'test',
          session_id: 'test-session',
          hook_event_type: type,
          payload: {},
          timestamp: Date.now()
        };

        const drop = transformer.transform(mockEvent);
        expect(drop.characters).toContain(expectedSymbol);
      });
    });

    it('should calculate speed based on event type and age', () => {
      const recentEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-1',
        hook_event_type: 'error',
        payload: {},
        timestamp: Date.now() // Recent event
      };

      const oldEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-2',
        hook_event_type: 'error',
        payload: {},
        timestamp: Date.now() - 600000 // 10 minutes ago
      };

      const recentDrop = transformer.transform(recentEvent);
      const oldDrop = transformer.transform(oldEvent);

      // Recent events should fall faster
      expect(recentDrop.speed).toBeGreaterThan(oldDrop.speed);
      
      // Error events should be faster than normal
      expect(recentDrop.speed).toBeGreaterThan(80); // Base speed
    });

    it('should include timestamp in character sequence', () => {
      const timestamp = 1642781234567;
      const mockEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-123',
        hook_event_type: 'event',
        payload: {},
        timestamp
      };

      const drop = transformer.transform(mockEvent);
      
      // Should contain last 4 digits of timestamp: 4567
      const timestampChars = ['4', '5', '6', '7'];
      const hasTimestampChars = timestampChars.every(char => 
        drop.characters.includes(char)
      );
      expect(hasTimestampChars).toBe(true);
    });

    it('should set appropriate colors for different event types', () => {
      const errorEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-1',
        hook_event_type: 'error',
        payload: {},
        timestamp: Date.now()
      };

      const completeEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-2',
        hook_event_type: 'complete',
        payload: {},
        timestamp: Date.now()
      };

      const errorDrop = transformer.transform(errorEvent);
      const completeDrop = transformer.transform(completeEvent);

      // Error events should have red-ish colors
      expect(errorDrop.headColor).toMatch(/^#[Ff][0-9A-Fa-f]/);
      
      // Complete events should have different colors
      expect(completeDrop.headColor).not.toBe(errorDrop.headColor);
    });

    it('should generate appropriate trail length', () => {
      const mockEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-123',
        hook_event_type: 'event',
        payload: { agentName: 'TestAgent' },
        timestamp: Date.now()
      };

      const drop = transformer.transform(mockEvent);

      expect(drop.trailLength).toBeGreaterThan(0);
      expect(drop.trailLength).toBeLessThanOrEqual(15); // Default trail length
      expect(drop.characters.length).toBe(drop.trailLength);
      expect(drop.brightness.length).toBe(drop.trailLength);
    });

    it('should handle missing or malformed event data gracefully', () => {
      const malformedEvent: HookEvent = {
        source_app: '',
        session_id: '',
        hook_event_type: '',
        payload: {},
        // Missing timestamp
      };

      expect(() => {
        const drop = transformer.transform(malformedEvent);
        expect(drop).toBeDefined();
        expect(drop.characters.length).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });

  describe('Integration with useMatrixMode', () => {
    it('should add drops to matrix mode state when enabled', () => {
      // Enable matrix mode
      matrixMode.state.value.isEnabled = true;

      const mockEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-123',
        hook_event_type: 'test_event',
        payload: { agentName: 'TestAgent' },
        timestamp: Date.now()
      };

      const initialDropCount = matrixMode.drops.value.length;
      
      // Process event through matrix mode
      matrixMode.processEvent(mockEvent);

      expect(matrixMode.drops.value.length).toBe(initialDropCount + 1);
      
      const addedDrop = matrixMode.drops.value[matrixMode.drops.value.length - 1];
      expect(addedDrop.sourceEvent).toBe(mockEvent);
    });

    it('should not add drops when matrix mode is disabled', () => {
      // Disable matrix mode
      matrixMode.state.value.isEnabled = false;

      const mockEvent: HookEvent = {
        source_app: 'test',
        session_id: 'session-123',
        hook_event_type: 'test_event',
        payload: {},
        timestamp: Date.now()
      };

      const initialDropCount = matrixMode.drops.value.length;
      
      // Process event - should be ignored
      matrixMode.processEvent(mockEvent);

      expect(matrixMode.drops.value.length).toBe(initialDropCount);
    });

    it('should respect maxDrops limit and remove oldest drops', () => {
      matrixMode.state.value.isEnabled = true;
      matrixMode.config.value.maxDrops = 3; // Set low limit for testing

      // Add drops up to limit
      for (let i = 0; i < 5; i++) {
        const event: HookEvent = {
          source_app: 'test',
          session_id: `session-${i}`,
          hook_event_type: 'test_event',
          payload: {},
          timestamp: Date.now() + i
        };
        matrixMode.processEvent(event);
      }

      // Should not exceed maxDrops
      expect(matrixMode.drops.value.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple events efficiently', () => {
      const events: HookEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          source_app: 'batch-test',
          session_id: `session-${i}`,
          hook_event_type: 'batch_event',
          payload: { agentName: `Agent${i}` },
          timestamp: Date.now() + i
        });
      }

      const drops = transformer.transformBatch(events);

      expect(drops).toHaveLength(10);
      drops.forEach((drop, index) => {
        expect(drop.sourceEvent).toBe(events[index]);
        expect(drop.characters.length).toBeGreaterThan(0);
      });
    });

    it('should maintain performance with large batches', () => {
      const startTime = performance.now();
      
      const events: HookEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push({
          source_app: 'perf-test',
          session_id: `session-${i % 100}`, // 100 unique sessions
          hook_event_type: 'performance_test',
          payload: {},
          timestamp: Date.now() + i
        });
      }

      const drops = transformer.transformBatch(events);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(drops).toHaveLength(1000);
      expect(processingTime).toBeLessThan(100); // Should process 1000 events in < 100ms
    });
  });

  describe('Memory Management', () => {
    it('should reuse drop objects through object pooling', () => {
      matrixMode.state.value.isEnabled = true;

      const event: HookEvent = {
        source_app: 'test',
        session_id: 'memory-test',
        hook_event_type: 'test',
        payload: {},
        timestamp: Date.now()
      };

      // Add and remove drops to test pooling
      for (let i = 0; i < 100; i++) {
        matrixMode.processEvent(event);
        if (matrixMode.drops.value.length > 0) {
          const dropId = matrixMode.drops.value[0].id;
          matrixMode.removeDrop(dropId);
        }
      }

      // Pool should have available drops
      expect(matrixMode.dropPool.value.available.length).toBeGreaterThan(0);
    });

    it('should estimate memory usage accurately', () => {
      matrixMode.state.value.isEnabled = true;

      // Add several drops
      for (let i = 0; i < 50; i++) {
        const event: HookEvent = {
          source_app: 'memory-test',
          session_id: `session-${i}`,
          hook_event_type: 'memory_test',
          payload: {},
          timestamp: Date.now() + i
        };
        matrixMode.processEvent(event);
      }

      const memoryUsage = matrixMode.getMemoryUsage();
      
      expect(memoryUsage).toBeGreaterThan(0);
      expect(memoryUsage).toBeLessThan(50); // Should be reasonable for 50 drops
    });
  });

  describe('Error Handling', () => {
    it('should handle transformer errors gracefully', () => {
      const invalidEvent = {} as HookEvent; // Completely invalid event

      expect(() => {
        const drop = transformer.transform(invalidEvent);
        expect(drop).toBeDefined();
      }).not.toThrow();
    });

    it('should continue processing after individual event failures', () => {
      const events: HookEvent[] = [
        { source_app: 'test', session_id: 'good1', hook_event_type: 'valid', payload: {}, timestamp: Date.now() },
        {} as HookEvent, // Invalid event
        { source_app: 'test', session_id: 'good2', hook_event_type: 'valid', payload: {}, timestamp: Date.now() }
      ];

      expect(() => {
        const drops = transformer.transformBatch(events);
        expect(drops).toHaveLength(3); // Should process all events
      }).not.toThrow();
    });
  });
});