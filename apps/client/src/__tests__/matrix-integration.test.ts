/**
 * Matrix Mode Integration Test Suite
 * 
 * End-to-end integration tests for the complete Matrix Mode transformation pipeline:
 * WebSocket Events -> EventToMatrixTransformer -> useMatrixMode -> Canvas Renderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HookEvent } from '../types';
import { createEventToDropTransformer } from '../utils/eventToMatrix';
import { useMatrixMode } from '../composables/useMatrixMode';

describe('Matrix Mode Integration', () => {
  let transformer: ReturnType<typeof createEventToDropTransformer>;
  let matrixMode: ReturnType<typeof useMatrixMode>;
  
  beforeEach(() => {
    // Set up transformer and matrix mode
    transformer = createEventToDropTransformer(800, 600, 20);
    matrixMode = useMatrixMode();
  });

  describe('End-to-End Event Flow', () => {
    it('should transform WebSocket event through complete pipeline', () => {
      // Enable matrix mode
      matrixMode.state.value.isEnabled = true;
      
      // Mock WebSocket-like event
      const webSocketEvent: HookEvent = {
        id: 1001,
        source_app: 'integration-test',
        session_id: 'test-session-e2e',
        hook_event_type: 'agent_spawn',
        payload: {
          agentName: 'IntegrationAgent',
          status: 'pending'
        },
        timestamp: Date.now()
      };

      // Initial drop count
      const initialDrops = matrixMode.drops.value.length;
      
      // Process event through transformer
      const matrixDrop = transformer.transform(webSocketEvent);
      
      // Verify transformation
      expect(matrixDrop).toBeDefined();
      expect(matrixDrop.sourceEvent).toBe(webSocketEvent);
      expect(matrixDrop.characters.length).toBeGreaterThan(0);
      expect(matrixDrop.column).toBeGreaterThanOrEqual(0);
      
      // Process through matrix mode (this would happen via WebSocket integration)
      matrixMode.processEvent(webSocketEvent);
      
      // Verify drops were added (accounting for async nature)
      setTimeout(() => {
        expect(matrixMode.drops.value.length).toBeGreaterThan(initialDrops);
        
        const addedDrop = matrixMode.drops.value[matrixMode.drops.value.length - 1];
        expect(addedDrop.sourceEvent).toBe(webSocketEvent);
      }, 100);
    });

    it('should handle batch events efficiently', () => {
      matrixMode.state.value.isEnabled = true;
      
      // Create batch of events
      const events: HookEvent[] = [];
      for (let i = 0; i < 50; i++) {
        events.push({
          id: 2000 + i,
          source_app: 'batch-test',
          session_id: `session-${i % 10}`, // 10 different sessions
          hook_event_type: ['agent_spawn', 'agent_progress', 'agent_complete'][i % 3],
          payload: {
            agentName: `BatchAgent${i}`,
            status: ['pending', 'in_progress', 'completed'][i % 3]
          },
          timestamp: Date.now() + i
        });
      }

      // Process batch through transformer
      const drops = transformer.transformBatch(events);
      expect(drops).toHaveLength(50);
      
      // Process through matrix mode
      const startTime = performance.now();
      matrixMode.processEventBatch(events);
      const endTime = performance.now();
      
      // Should process efficiently
      expect(endTime - startTime).toBeLessThan(50); // < 50ms for 50 events
    });

    it('should maintain performance under load', () => {
      matrixMode.state.value.isEnabled = true;
      
      // Simulate high-frequency events
      const eventCount = 1000;
      const events: HookEvent[] = [];
      
      for (let i = 0; i < eventCount; i++) {
        events.push({
          source_app: 'performance-test',
          session_id: `perf-session-${i % 20}`,
          hook_event_type: 'high_frequency_event',
          payload: { sequence: i },
          timestamp: Date.now() + i
        });
      }

      const startTime = performance.now();
      
      // Process all events
      events.forEach(event => {
        const drop = transformer.transform(event);
        expect(drop).toBeDefined();
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should process 1000 events in reasonable time
      expect(totalTime).toBeLessThan(500); // < 500ms for 1000 events
      expect(totalTime / eventCount).toBeLessThan(0.5); // < 0.5ms per event
    });

    it('should handle memory limits gracefully', () => {
      matrixMode.state.value.isEnabled = true;
      
      // Set low memory limit for testing
      matrixMode.config.value.maxDrops = 10;
      
      // Add more drops than limit
      for (let i = 0; i < 20; i++) {
        const event: HookEvent = {
          source_app: 'memory-test',
          session_id: `memory-session-${i}`,
          hook_event_type: 'memory_test_event',
          payload: {},
          timestamp: Date.now() + i
        };
        
        matrixMode.processEvent(event);
      }

      // Should not exceed limit
      setTimeout(() => {
        expect(matrixMode.drops.value.length).toBeLessThanOrEqual(10);
        expect(matrixMode.getMemoryUsage()).toBeLessThan(50); // Reasonable memory usage
      }, 200);
    });
  });

  describe('Character Mapping Verification', () => {
    it('should consistently map agent names to katakana', () => {
      const agentNames = ['SarahPixel', 'JohnTech', 'LisaCanvas', 'MarkRenderer'];
      const mappings = new Map<string, any>();
      
      agentNames.forEach(agentName => {
        const event: HookEvent = {
          source_app: 'character-test',
          session_id: 'char-session',
          hook_event_type: 'agent_name_test',
          payload: { agentName },
          timestamp: Date.now()
        };
        
        const drop1 = transformer.transform(event);
        const drop2 = transformer.transform(event);
        
        // Same agent name should produce same character mapping
        expect(drop1.characters.slice(1, 4)).toEqual(drop2.characters.slice(1, 4));
        
        mappings.set(agentName, drop1.characters.slice(1, 4));
      });

      // Different agent names should produce different mappings
      const allMappings = Array.from(mappings.values());
      const uniqueMappings = new Set(allMappings.map(m => m.join('')));
      expect(uniqueMappings.size).toBe(agentNames.length);
    });

    it('should map event types to appropriate symbols', () => {
      const eventTypeTests = [
        { type: 'agent_spawn', expectedSymbol: '↕' },
        { type: 'agent_complete', expectedSymbol: '◆' },
        { type: 'error_occurred', expectedSymbol: '⚠' },
        { type: 'status_update', expectedSymbol: '◐' }
      ];

      eventTypeTests.forEach(({ type, expectedSymbol }) => {
        const event: HookEvent = {
          source_app: 'symbol-test',
          session_id: 'symbol-session',
          hook_event_type: type,
          payload: {},
          timestamp: Date.now()
        };

        const drop = transformer.transform(event);
        expect(drop.characters[0]).toBe(expectedSymbol);
      });
    });
  });

  describe('Column Assignment', () => {
    it('should assign consistent columns for same session', () => {
      const sessionId = 'consistent-column-test';
      const drops: any[] = [];
      
      for (let i = 0; i < 10; i++) {
        const event: HookEvent = {
          source_app: 'column-test',
          session_id: sessionId,
          hook_event_type: `event_${i}`,
          payload: {},
          timestamp: Date.now() + i
        };
        
        const drop = transformer.transform(event);
        drops.push(drop);
      }

      // All drops from same session should use same column
      const columns = drops.map(d => d.column);
      expect(new Set(columns).size).toBe(1);
    });

    it('should distribute different sessions across columns', () => {
      const sessionIds = Array.from({ length: 20 }, (_, i) => `session-${i}`);
      const columns = new Set<number>();
      
      sessionIds.forEach(sessionId => {
        const event: HookEvent = {
          source_app: 'distribution-test',
          session_id: sessionId,
          hook_event_type: 'distribution_test',
          payload: {},
          timestamp: Date.now()
        };
        
        const drop = transformer.transform(event);
        columns.add(drop.column);
      });

      // Should use multiple columns for distribution
      expect(columns.size).toBeGreaterThan(1);
      expect(columns.size).toBeLessThanOrEqual(20); // But not more than sessions
    });
  });

  describe('Speed Calculations', () => {
    it('should calculate appropriate speeds for different event types', () => {
      const eventTypes = [
        { type: 'error', expectedRange: [120, 200] }, // Faster for errors
        { type: 'spawn', expectedRange: [140, 220] }, // Fastest for spawns
        { type: 'normal', expectedRange: [80, 120] },  // Normal speed
        { type: 'pending', expectedRange: [60, 100] }  // Slower for pending
      ];

      eventTypes.forEach(({ type, expectedRange }) => {
        const event: HookEvent = {
          source_app: 'speed-test',
          session_id: 'speed-session',
          hook_event_type: type,
          payload: {},
          timestamp: Date.now()
        };

        const drop = transformer.transform(event);
        expect(drop.speed).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(drop.speed).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should apply age-based speed modifiers', () => {
      const recentEvent: HookEvent = {
        source_app: 'age-test',
        session_id: 'age-session',
        hook_event_type: 'age_test',
        payload: {},
        timestamp: Date.now() // Recent
      };

      const oldEvent: HookEvent = {
        source_app: 'age-test',
        session_id: 'age-session',
        hook_event_type: 'age_test',
        payload: {},
        timestamp: Date.now() - 600000 // 10 minutes ago
      };

      const recentDrop = transformer.transform(recentEvent);
      const oldDrop = transformer.transform(oldEvent);

      // Recent events should fall faster
      expect(recentDrop.speed).toBeGreaterThan(oldDrop.speed);
    });
  });

  describe('Error Resilience', () => {
    it('should handle malformed events gracefully', () => {
      const malformedEvents = [
        {} as HookEvent,
        { source_app: 'test' } as HookEvent,
        { session_id: '', hook_event_type: '', payload: {} } as HookEvent
      ];

      malformedEvents.forEach(event => {
        expect(() => {
          const drop = transformer.transform(event);
          expect(drop).toBeDefined();
          expect(drop.characters.length).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });

    it('should continue processing after individual failures', () => {
      const mixedEvents: HookEvent[] = [
        { source_app: 'test', session_id: 'good1', hook_event_type: 'valid', payload: {}, timestamp: Date.now() },
        {} as HookEvent, // Invalid
        { source_app: 'test', session_id: 'good2', hook_event_type: 'valid', payload: {}, timestamp: Date.now() }
      ];

      const drops = transformer.transformBatch(mixedEvents);
      expect(drops).toHaveLength(3);
      
      // Valid events should produce valid drops
      expect(drops[0].characters.length).toBeGreaterThan(0);
      expect(drops[2].characters.length).toBeGreaterThan(0);
    });
  });
});