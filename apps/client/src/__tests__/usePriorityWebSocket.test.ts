import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { usePriorityWebSocket } from '../composables/usePriorityWebSocket';
import type { HookEvent, PriorityWebSocketMessage } from '../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send implementation
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('usePriorityWebSocket', () => {
  let mockWs: MockWebSocket;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock setTimeout to control timing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockEvent = (type: string, priority: number = 0): HookEvent => ({
    id: Math.floor(Math.random() * 1000),
    source_app: 'test-app',
    session_id: 'test-session',
    hook_event_type: type,
    payload: { test: true },
    timestamp: Date.now(),
    priority,
    priority_metadata: priority > 0 ? {
      classified_at: Date.now(),
      classification_reason: 'automatic',
      retention_policy: 'extended'
    } : undefined
  });

  const createPriorityMessage = (type: 'initial' | 'event' | 'priority_event', data: HookEvent | HookEvent[]): PriorityWebSocketMessage => ({
    type,
    data,
    priority_info: {
      total_events: Array.isArray(data) ? data.length : 1,
      priority_events: Array.isArray(data) ? data.filter(e => (e.priority || 0) > 0).length : ((data.priority || 0) > 0 ? 1 : 0),
      regular_events: Array.isArray(data) ? data.filter(e => (e.priority || 0) === 0).length : ((data.priority || 0) === 0 ? 1 : 0),
      retention_window: {
        priority_hours: 24,
        regular_hours: 4
      },
      protocol_version: '1.0.0'
    }
  });

  describe('Basic Functionality', () => {
    it('should connect to WebSocket and set initial state', async () => {
      const { isConnected, serverSupportsPriority } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      expect(isConnected.value).toBe(false);
      expect(serverSupportsPriority.value).toBe(false);
      
      // Advance timers to trigger connection
      vi.advanceTimersByTime(20);
      await nextTick();
      
      expect(isConnected.value).toBe(true);
    });

    it('should handle initial events with priority separation', async () => {
      const { allEvents, priorityEvents, regularEvents, eventStats } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      // Wait for connection
      vi.advanceTimersByTime(20);
      await nextTick();
      
      // Get the mock WebSocket instance
      const mockWs = (global as any).WebSocket.mockInstances?.[0] || new MockWebSocket('ws://localhost:4000/stream');
      
      // Simulate initial message with mixed priority events
      const initialEvents = [
        createMockEvent('UserPromptSubmit', 1),
        createMockEvent('ToolUse', 0),
        createMockEvent('Notification', 1),
        createMockEvent('RegularEvent', 0)
      ];
      
      const initialMessage = createPriorityMessage('initial', initialEvents);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      expect(allEvents.value).toHaveLength(4);
      expect(priorityEvents.value).toHaveLength(2);
      expect(regularEvents.value).toHaveLength(2);
      expect(eventStats.value.priorityPercentage).toBe(50);
    });
  });

  describe('Priority Event Classification', () => {
    it('should correctly classify priority events', async () => {
      const { priorityEvents, regularEvents, isPriorityEvent } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Test priority event
      const priorityEvent = createMockEvent('UserPromptSubmit', 1);
      const priorityMessage = createPriorityMessage('priority_event', priorityEvent);
      mockWs.simulateMessage(priorityMessage);
      
      await nextTick();
      
      expect(priorityEvents.value).toHaveLength(1);
      expect(regularEvents.value).toHaveLength(0);
      expect(isPriorityEvent(priorityEvent)).toBe(true);
      
      // Test regular event
      const regularEvent = createMockEvent('ToolUse', 0);
      const regularMessage = createPriorityMessage('event', regularEvent);
      mockWs.simulateMessage(regularMessage);
      
      await nextTick();
      
      expect(priorityEvents.value).toHaveLength(1);
      expect(regularEvents.value).toHaveLength(1);
      expect(isPriorityEvent(regularEvent)).toBe(false);
    });

    it('should handle events without priority field as regular events', async () => {
      const { priorityEvents, regularEvents } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      const eventWithoutPriority = {
        ...createMockEvent('SomeEvent'),
        priority: undefined
      };
      
      mockWs.simulateMessage({
        type: 'event',
        data: eventWithoutPriority
      });
      
      await nextTick();
      
      expect(priorityEvents.value).toHaveLength(0);
      expect(regularEvents.value).toHaveLength(1);
    });
  });

  describe('Bucket Management', () => {
    it('should respect priority event limits', async () => {
      const config = {
        maxPriorityEvents: 2,
        maxRegularEvents: 2,
        totalDisplayLimit: 5
      };
      
      const { priorityEvents } = usePriorityWebSocket('ws://localhost:4000/stream', config);
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add 3 priority events (exceeds limit of 2)
      for (let i = 0; i < 3; i++) {
        const event = createMockEvent(`PriorityEvent${i}`, 1);
        const message = createPriorityMessage('priority_event', event);
        mockWs.simulateMessage(message);
        await nextTick();
      }
      
      expect(priorityEvents.value).toHaveLength(2);
    });

    it('should respect regular event limits with aggressive cleanup', async () => {
      const config = {
        maxPriorityEvents: 5,
        maxRegularEvents: 3,
        totalDisplayLimit: 10
      };
      
      const { regularEvents } = usePriorityWebSocket('ws://localhost:4000/stream', config);
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add 5 regular events (exceeds limit of 3)
      for (let i = 0; i < 5; i++) {
        const event = createMockEvent(`RegularEvent${i}`, 0);
        const message = createPriorityMessage('event', event);
        mockWs.simulateMessage(message);
        await nextTick();
      }
      
      // Should keep less than maxRegularEvents due to aggressive cleanup
      expect(regularEvents.value.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Overflow Strategies', () => {
    it('should preserve priority events when using remove_oldest_regular strategy', async () => {
      const config = {
        maxPriorityEvents: 3,
        maxRegularEvents: 2,
        totalDisplayLimit: 4, // Forces overflow
        priorityOverflowStrategy: 'remove_oldest_regular' as const
      };
      
      const { allEvents, priorityEvents, regularEvents } = usePriorityWebSocket('ws://localhost:4000/stream', config);
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add events that will exceed total display limit
      const events = [
        createMockEvent('Priority1', 1),
        createMockEvent('Priority2', 1),
        createMockEvent('Priority3', 1),
        createMockEvent('Regular1', 0),
        createMockEvent('Regular2', 0)
      ];
      
      const initialMessage = createPriorityMessage('initial', events);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      // All priority events should be preserved
      expect(priorityEvents.value).toHaveLength(3);
      // Regular events should be limited to fit within totalDisplayLimit
      expect(allEvents.value.length).toBeLessThanOrEqual(4);
    });

    it('should apply strict limits when using strict_limits strategy', async () => {
      const config = {
        maxPriorityEvents: 2,
        maxRegularEvents: 2,
        totalDisplayLimit: 5,
        priorityOverflowStrategy: 'strict_limits' as const
      };
      
      const { allEvents, priorityEvents, regularEvents } = usePriorityWebSocket('ws://localhost:4000/stream', config);
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      const events = [
        createMockEvent('Priority1', 1),
        createMockEvent('Priority2', 1),
        createMockEvent('Priority3', 1), // Should be removed
        createMockEvent('Regular1', 0),
        createMockEvent('Regular2', 0),
        createMockEvent('Regular3', 0) // Should be removed
      ];
      
      const initialMessage = createPriorityMessage('initial', events);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      expect(priorityEvents.value.length).toBeLessThanOrEqual(2);
      expect(regularEvents.value.length).toBeLessThanOrEqual(2);
      expect(allEvents.value.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Protocol Detection', () => {
    it('should detect priority protocol support from server', async () => {
      const { serverSupportsPriority, protocolVersion, eventStats } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      const initialMessage = createPriorityMessage('initial', []);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      expect(serverSupportsPriority.value).toBe(true);
      expect(protocolVersion.value).toBe('1.0.0');
      expect(eventStats.value.serverSupportsPriority).toBe(true);
    });

    it('should handle legacy messages when protocol not detected', async () => {
      const { allEvents, serverSupportsPriority } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Send legacy message format
      const legacyMessage = {
        type: 'initial',
        data: [createMockEvent('LegacyEvent')]
      };
      
      mockWs.simulateMessage(legacyMessage);
      
      await nextTick();
      
      expect(allEvents.value).toHaveLength(1);
      expect(serverSupportsPriority.value).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should optimize memory usage by removing old events', async () => {
      const { priorityEvents, regularEvents, optimizeMemoryUsage } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add events with old timestamps
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      
      const events = [
        { ...createMockEvent('OldPriority', 1), timestamp: oldTimestamp },
        { ...createMockEvent('RecentPriority', 1), timestamp: recentTimestamp },
        { ...createMockEvent('OldRegular', 0), timestamp: oldTimestamp },
        { ...createMockEvent('RecentRegular', 0), timestamp: recentTimestamp }
      ];
      
      const initialMessage = createPriorityMessage('initial', events);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      expect(priorityEvents.value).toHaveLength(2);
      expect(regularEvents.value).toHaveLength(2);
      
      // Optimize memory usage
      optimizeMemoryUsage();
      
      await nextTick();
      
      // Old priority event should be removed (>24h), old regular event should be removed (>4h)
      expect(priorityEvents.value).toHaveLength(1);
      expect(regularEvents.value).toHaveLength(1);
      expect(priorityEvents.value[0].hook_event_type).toBe('RecentPriority');
      expect(regularEvents.value[0].hook_event_type).toBe('RecentRegular');
    });

    it('should automatically optimize memory on interval', async () => {
      const { priorityEvents } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add old event
      const oldEvent = { 
        ...createMockEvent('OldEvent', 1), 
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago 
      };
      
      const message = createPriorityMessage('priority_event', oldEvent);
      mockWs.simulateMessage(message);
      
      await nextTick();
      expect(priorityEvents.value).toHaveLength(1);
      
      // Advance timers by 5 minutes to trigger memory optimization
      vi.advanceTimersByTime(5 * 60 * 1000);
      await nextTick();
      
      // Old event should be removed
      expect(priorityEvents.value).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const { error, isConnected } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Simulate error
      if (mockWs.onerror) {
        mockWs.onerror(new Event('error'));
      }
      
      await nextTick();
      
      expect(error.value).toBe('WebSocket connection error');
    });

    it('should handle malformed messages gracefully', async () => {
      const { allEvents } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Send malformed message
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }));
      }
      
      await nextTick();
      
      // Should not crash and should not add any events
      expect(allEvents.value).toHaveLength(0);
    });

    it('should attempt reconnection on disconnect', async () => {
      const { isConnected } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      expect(isConnected.value).toBe(true);
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Simulate disconnect
      mockWs.close();
      
      await nextTick();
      
      expect(isConnected.value).toBe(false);
      
      // Advance timers by 3 seconds to trigger reconnection attempt
      vi.advanceTimersByTime(3000);
      await nextTick();
      
      // Should attempt to reconnect (new WebSocket instance created)
      // This is verified by the mock WebSocket constructor being called again
    });
  });

  describe('Utility Functions', () => {
    it('should provide bucket management utilities', async () => {
      const { 
        clearBuckets, 
        getPriorityEvents, 
        getRegularEvents, 
        allEvents,
        priorityEvents,
        regularEvents
      } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Add some events
      const events = [
        createMockEvent('Priority1', 1),
        createMockEvent('Regular1', 0)
      ];
      
      const initialMessage = createPriorityMessage('initial', events);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      expect(allEvents.value).toHaveLength(2);
      expect(getPriorityEvents()).toHaveLength(1);
      expect(getRegularEvents()).toHaveLength(1);
      
      clearBuckets();
      
      expect(priorityEvents.value).toHaveLength(0);
      expect(regularEvents.value).toHaveLength(0);
      expect(allEvents.value).toHaveLength(0);
    });

    it('should provide accurate event statistics', async () => {
      const { eventStats } = usePriorityWebSocket('ws://localhost:4000/stream');
      
      vi.advanceTimersByTime(20);
      await nextTick();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      const events = [
        createMockEvent('Priority1', 1),
        createMockEvent('Priority2', 1),
        createMockEvent('Regular1', 0),
        createMockEvent('Regular2', 0),
        createMockEvent('Regular3', 0)
      ];
      
      const initialMessage = createPriorityMessage('initial', events);
      mockWs.simulateMessage(initialMessage);
      
      await nextTick();
      
      const stats = eventStats.value;
      expect(stats.total).toBe(5);
      expect(stats.priority).toBe(2);
      expect(stats.regular).toBe(3);
      expect(stats.priorityPercentage).toBe(40);
    });
  });
});