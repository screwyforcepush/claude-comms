/**
 * WebSocket Subscription Management Tests
 * TestTiger - Real-time data subscription and management testing
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ref, nextTick } from 'vue';
import type { 
  SessionTimelineData,
  MultiSessionUpdate
} from '../types/multi-session';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
      this.dispatchEvent('open', new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock sending - could be used to simulate server responses
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', { code: 1000, reason: 'Normal closure' });
      if (this.onclose) this.onclose(closeEvent);
      this.dispatchEvent('close', closeEvent);
    }, 10);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  dispatchEvent(type: string, event: any) {
    // Call the specific handler if it exists
    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (type === 'open' && this.onopen) {
      this.onopen(event);
    } else if (type === 'close' && this.onclose) {
      this.onclose(event);
    } else if (type === 'error' && this.onerror) {
      this.onerror(event);
    }
    
    // Call addEventListener listeners
    if (this.listeners[type]) {
      this.listeners[type].forEach(listener => listener(event));
    }
  }

  // Helper method to simulate server messages
  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      const event = new MessageEvent('message', { data: JSON.stringify(data) });
      if (this.onmessage) this.onmessage(event);
      this.dispatchEvent('message', event);
    }
  }

  // Helper method to simulate connection error
  simulateError() {
    const event = new Event('error');
    if (this.onerror) this.onerror(event);
    this.dispatchEvent('error', event);
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

describe('WebSocket Subscription Management', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (mockWs) {
      mockWs.close();
    }
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const wsUrl = 'ws://localhost:4000/stream';
      mockWs = new MockWebSocket(wsUrl);

      let isConnected = false;
      let connectionError: string | null = null;

      mockWs.onopen = () => {
        isConnected = true;
      };

      mockWs.onerror = () => {
        connectionError = 'Connection failed';
      };

      // Wait for connection to open
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
      expect(isConnected).toBe(true);
      expect(connectionError).toBeNull();
    });

    it('should handle connection failures gracefully', async () => {
      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      let connectionError: string | null = null;
      let reconnectAttempts = 0;

      mockWs.onerror = () => {
        connectionError = 'Connection failed';
      };

      const attemptReconnect = () => {
        reconnectAttempts++;
        // Simulate reconnection logic
        if (reconnectAttempts < 3) {
          setTimeout(attemptReconnect, 100);
        }
      };

      // Simulate connection error
      mockWs.simulateError();
      attemptReconnect();

      await new Promise(resolve => setTimeout(resolve, 350));

      expect(connectionError).toBe('Connection failed');
      expect(reconnectAttempts).toBe(3);
    });

    it('should handle WebSocket close events', async () => {
      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      let closeReason: string | null = null;
      let wasCleanClose = false;

      mockWs.onclose = (event) => {
        closeReason = event.reason;
        wasCleanClose = event.code === 1000;
      };

      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for open
      mockWs.close();
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for close

      expect(closeReason).toBe('Normal closure');
      expect(wasCleanClose).toBe(true);
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe('Real-time Session Updates', () => {
    beforeEach(async () => {
      mockWs = new MockWebSocket('ws://localhost:4000/stream');
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
    });

    it('should receive and process session registration events', async () => {
      const receivedEvents: any[] = [];

      mockWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        receivedEvents.push(data);
      };

      // Simulate server sending subagent registration event
      const registrationEvent = {
        type: 'subagent_registered',
        data: {
          id: 123,
          session_id: 'test-session-001',
          name: 'NewAgent',
          subagent_type: 'engineer'
        }
      };

      mockWs.simulateMessage(registrationEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('subagent_registered');
      expect(receivedEvents[0].data.name).toBe('NewAgent');
      expect(receivedEvents[0].data.session_id).toBe('test-session-001');
    });

    it('should receive and process agent completion events', async () => {
      const completionEvents: any[] = [];

      mockWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_status_update') {
          completionEvents.push(data);
        }
      };

      // Simulate agent completion event
      const completionEvent = {
        type: 'agent_status_update',
        data: {
          session_id: 'test-session-001',
          name: 'CompletedAgent',
          status: 'completed',
          completed_at: Date.now(),
          completion_metadata: {
            total_duration_ms: 45000,
            total_tokens: 2500
          }
        }
      };

      mockWs.simulateMessage(completionEvent);

      expect(completionEvents).toHaveLength(1);
      expect(completionEvents[0].data.status).toBe('completed');
      expect(completionEvents[0].data.completion_metadata.total_tokens).toBe(2500);
    });

    it('should receive and process inter-agent message events', async () => {
      const messageEvents: any[] = [];

      mockWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'subagent_message') {
          messageEvents.push(data);
        }
      };

      // Simulate inter-agent message event
      const messageEvent = {
        type: 'subagent_message',
        data: {
          sender: 'SenderAgent',
          message: {
            type: 'status_update',
            content: 'Task completed',
            metadata: { duration: 30000 }
          }
        }
      };

      mockWs.simulateMessage(messageEvent);

      expect(messageEvents).toHaveLength(1);
      expect(messageEvents[0].data.sender).toBe('SenderAgent');
      expect(messageEvents[0].data.message.content).toBe('Task completed');
    });

    it('should handle initial data load on connection', async () => {
      let initialData: any = null;

      mockWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'initial') {
          initialData = data;
        }
      };

      // Simulate server sending initial data on connection
      const initialEvents = [
        {
          id: 1,
          session_id: 'existing-session-1',
          hook_event_type: 'agent_registration',
          timestamp: Date.now() - 3600000
        },
        {
          id: 2,
          session_id: 'existing-session-2', 
          hook_event_type: 'agent_completion',
          timestamp: Date.now() - 1800000
        }
      ];

      mockWs.simulateMessage({
        type: 'initial',
        data: initialEvents
      });

      expect(initialData).not.toBeNull();
      expect(initialData.data).toHaveLength(2);
      expect(initialData.data[0].session_id).toBe('existing-session-1');
    });
  });

  describe('Subscription State Management', () => {
    it('should manage subscription state correctly', async () => {
      const subscriptionState = {
        isConnected: ref(false),
        isReconnecting: ref(false),
        lastError: ref<string | null>(null),
        reconnectAttempts: ref(0)
      };

      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      mockWs.onopen = () => {
        subscriptionState.isConnected.value = true;
        subscriptionState.isReconnecting.value = false;
        subscriptionState.reconnectAttempts.value = 0;
      };

      mockWs.onclose = () => {
        subscriptionState.isConnected.value = false;
        subscriptionState.isReconnecting.value = true;
      };

      mockWs.onerror = () => {
        subscriptionState.lastError.value = 'Connection error';
        subscriptionState.reconnectAttempts.value++;
      };

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(subscriptionState.isConnected.value).toBe(true);
      expect(subscriptionState.isReconnecting.value).toBe(false);

      // Simulate error and reconnection
      mockWs.simulateError();
      expect(subscriptionState.lastError.value).toBe('Connection error');
      expect(subscriptionState.reconnectAttempts.value).toBe(1);

      // Simulate close
      mockWs.close();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(subscriptionState.isConnected.value).toBe(false);
      expect(subscriptionState.isReconnecting.value).toBe(true);
    });

    it('should handle multiple subscription filters', () => {
      const subscriptionFilters = {
        sessionIds: ref<string[]>([]),
        eventTypes: ref<string[]>(['subagent_registered', 'agent_status_update']),
        includeMessages: ref(true)
      };

      const shouldProcessEvent = (event: any) => {
        // Filter by session ID if specified
        if (subscriptionFilters.sessionIds.value.length > 0) {
          const sessionId = event.data?.session_id;
          if (sessionId && !subscriptionFilters.sessionIds.value.includes(sessionId)) {
            return false;
          }
        }

        // Filter by event type
        if (!subscriptionFilters.eventTypes.value.includes(event.type)) {
          return false;
        }

        // Filter messages if disabled
        if (!subscriptionFilters.includeMessages.value && event.type === 'subagent_message') {
          return false;
        }

        return true;
      };

      const testEvents = [
        { type: 'subagent_registered', data: { session_id: 'session-1' } },
        { type: 'subagent_message', data: { sender: 'Agent1' } },
        { type: 'agent_status_update', data: { session_id: 'session-2' } },
        { type: 'unknown_event', data: { test: true } }
      ];

      // Test with no session filter - should allow registered and status events, exclude message
      subscriptionFilters.includeMessages.value = false;
      const filteredEvents = testEvents.filter(shouldProcessEvent);
      
      expect(filteredEvents).toHaveLength(2);
      expect(filteredEvents[0].type).toBe('subagent_registered');
      expect(filteredEvents[1].type).toBe('agent_status_update');

      // Test with session filter
      subscriptionFilters.sessionIds.value = ['session-1'];
      subscriptionFilters.includeMessages.value = true;
      const sessionFilteredEvents = testEvents.filter(shouldProcessEvent);
      
      expect(sessionFilteredEvents).toHaveLength(1);
      expect(sessionFilteredEvents[0].data.session_id).toBe('session-1');
    });
  });

  describe('Auto-reconnection Logic', () => {
    it('should implement exponential backoff for reconnection', async () => {
      const reconnectionAttempts: number[] = [];
      const maxAttempts = 5;
      const baseDelay = 100;

      const attemptReconnection = async (attempt: number): Promise<boolean> => {
        reconnectionAttempts.push(attempt);
        
        if (attempt >= maxAttempts) {
          return false; // Give up after max attempts
        }

        // Simulate connection attempt failure
        if (attempt < 3) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptReconnection(attempt + 1);
        }

        // Succeed on 4th attempt
        return true;
      };

      const success = await attemptReconnection(0);
      
      expect(success).toBe(true);
      expect(reconnectionAttempts).toEqual([0, 1, 2, 3]);
    });

    it('should reset reconnection attempts on successful connection', () => {
      const connectionManager = {
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        isConnected: false,

        onConnectionOpen() {
          this.isConnected = true;
          this.reconnectAttempts = 0; // Reset on success
        },

        onConnectionClose() {
          this.isConnected = false;
          this.scheduleReconnect();
        },

        scheduleReconnect() {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Would schedule actual reconnection attempt
          }
        }
      };

      // Simulate multiple failed connections
      connectionManager.onConnectionClose();
      connectionManager.onConnectionClose();
      connectionManager.onConnectionClose();
      
      expect(connectionManager.reconnectAttempts).toBe(3);

      // Simulate successful connection
      connectionManager.onConnectionOpen();
      
      expect(connectionManager.isConnected).toBe(true);
      expect(connectionManager.reconnectAttempts).toBe(0);
    });

    it('should stop reconnection after max attempts', () => {
      const connectionManager = {
        reconnectAttempts: 0,
        maxReconnectAttempts: 3,
        shouldReconnect: true,

        attemptReconnect() {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.shouldReconnect = false;
            return false;
          }
          this.reconnectAttempts++;
          return true;
        }
      };

      // Simulate failed reconnection attempts
      expect(connectionManager.attemptReconnect()).toBe(true); // Attempt 1
      expect(connectionManager.attemptReconnect()).toBe(true); // Attempt 2  
      expect(connectionManager.attemptReconnect()).toBe(true); // Attempt 3
      expect(connectionManager.attemptReconnect()).toBe(false); // Max reached

      expect(connectionManager.shouldReconnect).toBe(false);
      expect(connectionManager.reconnectAttempts).toBe(3);
    });
  });

  describe('Message Queuing and Buffering', () => {
    it('should buffer messages during disconnection', async () => {
      const messageBuffer: any[] = [];
      let isConnected = false;

      const sendMessage = (message: any) => {
        if (isConnected) {
          // Send immediately
          return mockWs.send(JSON.stringify(message));
        } else {
          // Buffer for later
          messageBuffer.push(message);
        }
      };

      const flushBuffer = () => {
        if (isConnected && messageBuffer.length > 0) {
          messageBuffer.forEach(message => {
            mockWs.send(JSON.stringify(message));
          });
          messageBuffer.length = 0;
        }
      };

      // Try to send messages while disconnected
      sendMessage({ type: 'test', data: 'message 1' });
      sendMessage({ type: 'test', data: 'message 2' });
      
      expect(messageBuffer).toHaveLength(2);

      // Connect and flush buffer
      mockWs = new MockWebSocket('ws://localhost:4000/stream');
      mockWs.onopen = () => {
        isConnected = true;
        flushBuffer();
      };

      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(messageBuffer).toHaveLength(0);
      expect(isConnected).toBe(true);
    });

    it('should handle message ordering correctly', async () => {
      const receivedMessages: any[] = [];
      const messageSequence = ref(0);

      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      mockWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        receivedMessages.push(data);
      };

      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection

      // Simulate ordered messages from server
      const messages = [
        { type: 'event', sequence: 1, data: 'first' },
        { type: 'event', sequence: 2, data: 'second' },
        { type: 'event', sequence: 3, data: 'third' }
      ];

      messages.forEach(msg => mockWs.simulateMessage(msg));

      expect(receivedMessages).toHaveLength(3);
      expect(receivedMessages[0].sequence).toBe(1);
      expect(receivedMessages[1].sequence).toBe(2);
      expect(receivedMessages[2].sequence).toBe(3);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const processedEvents: any[] = [];
      const eventProcessingTimes: number[] = [];

      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      mockWs.onmessage = (event) => {
        const startTime = performance.now();
        const data = JSON.parse(event.data);
        processedEvents.push(data);
        eventProcessingTimes.push(performance.now() - startTime);
      };

      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection

      // Simulate rapid-fire events
      const eventCount = 100;
      for (let i = 0; i < eventCount; i++) {
        mockWs.simulateMessage({
          type: 'rapid_event',
          sequence: i,
          timestamp: Date.now()
        });
      }

      expect(processedEvents).toHaveLength(eventCount);
      
      // Check processing times are reasonable (< 1ms per event)
      const avgProcessingTime = eventProcessingTimes.reduce((sum, time) => sum + time, 0) / eventProcessingTimes.length;
      expect(avgProcessingTime).toBeLessThan(1);
    });

    it('should implement event deduplication', () => {
      const processedEventIds = new Set<string>();
      const uniqueEvents: any[] = [];

      const processEvent = (event: any) => {
        const eventId = `${event.type}-${event.data?.id}-${event.timestamp}`;
        
        if (processedEventIds.has(eventId)) {
          return; // Skip duplicate
        }
        
        processedEventIds.add(eventId);
        uniqueEvents.push(event);
      };

      // Test with duplicate events
      const events = [
        { type: 'test', data: { id: 1 }, timestamp: 1000 },
        { type: 'test', data: { id: 2 }, timestamp: 2000 },
        { type: 'test', data: { id: 1 }, timestamp: 1000 }, // Duplicate
        { type: 'test', data: { id: 3 }, timestamp: 3000 }
      ];

      events.forEach(processEvent);

      expect(uniqueEvents).toHaveLength(3);
      expect(uniqueEvents.map(e => e.data.id)).toEqual([1, 2, 3]);
    });

    it('should manage memory usage for long-running sessions', () => {
      const eventHistory: any[] = [];
      const maxHistorySize = 1000;

      const addEvent = (event: any) => {
        eventHistory.push(event);
        
        // Trim history to prevent memory leaks
        if (eventHistory.length > maxHistorySize) {
          eventHistory.splice(0, eventHistory.length - maxHistorySize);
        }
      };

      // Add events beyond max size
      for (let i = 0; i < 1500; i++) {
        addEvent({ id: i, timestamp: Date.now() });
      }

      expect(eventHistory).toHaveLength(maxHistorySize);
      expect(eventHistory[0].id).toBe(500); // Should have trimmed first 500
      expect(eventHistory[eventHistory.length - 1].id).toBe(1499);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed JSON messages gracefully', async () => {
      let errorCount = 0;
      const validEvents: any[] = [];

      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      mockWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          validEvents.push(data);
        } catch (error) {
          errorCount++;
          console.error('Invalid JSON received:', event.data);
        }
      };

      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate server sending invalid JSON
      mockWs.dispatchEvent('message', new MessageEvent('message', { 
        data: '{"invalid": json}' 
      }));

      // Simulate valid JSON
      mockWs.simulateMessage({ type: 'valid', data: 'test' });

      expect(errorCount).toBe(1);
      expect(validEvents).toHaveLength(1);
      expect(validEvents[0].type).toBe('valid');
    });

    it('should handle WebSocket protocol errors', async () => {
      let protocolErrorHandled = false;

      mockWs = new MockWebSocket('ws://localhost:4000/stream');

      mockWs.onerror = (event) => {
        protocolErrorHandled = true;
        console.error('WebSocket protocol error:', event);
      };

      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate protocol error
      mockWs.simulateError();

      expect(protocolErrorHandled).toBe(true);
    });
  });
});