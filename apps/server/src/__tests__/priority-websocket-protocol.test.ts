/**
 * Priority WebSocket Protocol Tests
 * Testing backward compatibility, priority metadata, and message handling
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import type { HookEvent } from "../types";

// Enhanced WebSocket Message Interfaces
interface WebSocketMessage {
  type: string;
  data: any;
}

interface PriorityWebSocketMessage extends WebSocketMessage {
  type: 'initial' | 'event' | 'priority_event';
  data: HookEvent | HookEvent[];
  priority_info?: {
    total_events?: number;
    priority_events?: number;
    regular_events?: number;
    retention_window?: {
      priority_hours: number;
      regular_hours: number;
    };
    retention_hint?: string;
    classification?: string;
    bucket?: string;
  };
}

interface MultiSessionWebSocketMessage extends PriorityWebSocketMessage {
  sessionId: string;
}

// Mock WebSocket Client for testing
class MockWebSocketClient {
  public messages: string[] = [];
  public isConnected: boolean = false;
  public lastMessage: string = '';
  public onMessageCallbacks: ((message: string) => void)[] = [];
  
  send(message: string): void {
    this.messages.push(message);
    this.lastMessage = message;
  }
  
  close(): void {
    this.isConnected = false;
  }
  
  addEventListener(event: string, callback: (e: any) => void): void {
    if (event === 'message') {
      this.onMessageCallbacks.push((message: string) => {
        callback({ data: message });
      });
    }
  }
  
  simulateMessage(message: string): void {
    this.onMessageCallbacks.forEach(callback => callback(message));
  }
}

// Mock WebSocket Server
class MockWebSocketServer {
  private clients = new Set<MockWebSocketClient>();
  private multiSessionClients = new Map<MockWebSocketClient, Set<string>>();
  
  addClient(client: MockWebSocketClient, isMultiSession: boolean = false): void {
    this.clients.add(client);
    client.isConnected = true;
    
    if (isMultiSession) {
      this.multiSessionClients.set(client, new Set());
    }
  }
  
  removeClient(client: MockWebSocketClient): void {
    this.clients.delete(client);
    this.multiSessionClients.delete(client);
    client.isConnected = false;
  }
  
  subscribeToSession(client: MockWebSocketClient, sessionId: string): void {
    const sessions = this.multiSessionClients.get(client);
    if (sessions) {
      sessions.add(sessionId);
    }
  }
  
  broadcastEventWithPriority(savedEvent: HookEvent & { priority?: number }): void {
    const message: PriorityWebSocketMessage = {
      type: savedEvent.priority && savedEvent.priority > 0 ? 'priority_event' : 'event',
      data: savedEvent,
      priority_info: savedEvent.priority && savedEvent.priority > 0 ? {
        retention_hint: 'extended',
        classification: 'automatic',
        bucket: 'priority'
      } : {
        retention_hint: 'standard', 
        classification: 'automatic',
        bucket: 'regular'
      }
    };
    
    const messageStr = JSON.stringify(message);
    
    // Broadcast to single-session clients
    this.clients.forEach(client => {
      if (!this.multiSessionClients.has(client)) {
        try {
          client.send(messageStr);
        } catch (err) {
          this.clients.delete(client);
        }
      }
    });
    
    // Broadcast to multi-session clients
    const multiSessionMessage: MultiSessionWebSocketMessage = {
      ...message,
      sessionId: savedEvent.session_id
    };
    
    this.multiSessionClients.forEach((subscribedSessions, client) => {
      if (subscribedSessions.has(savedEvent.session_id)) {
        try {
          client.send(JSON.stringify(multiSessionMessage));
        } catch (err) {
          this.multiSessionClients.delete(client);
        }
      }
    });
  }
  
  sendInitialEvents(client: MockWebSocketClient, events: HookEvent[]): void {
    const message: PriorityWebSocketMessage = {
      type: 'initial',
      data: events,
      priority_info: {
        total_events: events.length,
        priority_events: events.filter(e => (e as any).priority > 0).length,
        regular_events: events.filter(e => (e as any).priority === 0).length,
        retention_window: {
          priority_hours: 24,
          regular_hours: 4
        }
      }
    };
    
    client.send(JSON.stringify(message));
  }
  
  getConnectedClients(): MockWebSocketClient[] {
    return Array.from(this.clients);
  }
  
  getMultiSessionClients(): Map<MockWebSocketClient, Set<string>> {
    return this.multiSessionClients;
  }
}

// Test helper functions
function createTestEvent(
  eventType: string, 
  sessionId?: string, 
  priority?: number,
  timestamp?: number
): HookEvent & { priority?: number } {
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

function createLegacyWebSocketMessage(event: HookEvent): WebSocketMessage {
  return {
    type: 'event',
    data: event
  };
}

describe('Priority WebSocket Protocol', () => {
  let mockServer: MockWebSocketServer;
  let mockClient: MockWebSocketClient;

  beforeEach(() => {
    mockServer = new MockWebSocketServer();
    mockClient = new MockWebSocketClient();
  });

  afterEach(() => {
    mockServer.removeClient(mockClient);
  });

  describe('Message Format Enhancement', () => {
    test('should broadcast priority events with enhanced metadata', () => {
      mockServer.addClient(mockClient);
      
      const priorityEvent = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(priorityEvent);
      
      expect(mockClient.messages).toHaveLength(1);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.type).toBe('priority_event');
      expect(message.data).toEqual(priorityEvent);
      expect(message.priority_info).toBeDefined();
      expect(message.priority_info?.retention_hint).toBe('extended');
      expect(message.priority_info?.classification).toBe('automatic');
      expect(message.priority_info?.bucket).toBe('priority');
    });

    test('should broadcast regular events with standard metadata', () => {
      mockServer.addClient(mockClient);
      
      const regularEvent = createTestEvent('tool_use', 'session-1', 0);
      mockServer.broadcastEventWithPriority(regularEvent);
      
      expect(mockClient.messages).toHaveLength(1);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.type).toBe('event');
      expect(message.data).toEqual(regularEvent);
      expect(message.priority_info).toBeDefined();
      expect(message.priority_info?.retention_hint).toBe('standard');
      expect(message.priority_info?.classification).toBe('automatic');
      expect(message.priority_info?.bucket).toBe('regular');
    });

    test('should handle events without priority field as regular events', () => {
      mockServer.addClient(mockClient);
      
      const eventWithoutPriority = createTestEvent('tool_use', 'session-1');
      delete (eventWithoutPriority as any).priority;
      
      mockServer.broadcastEventWithPriority(eventWithoutPriority);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.type).toBe('event');
      expect(message.priority_info?.bucket).toBe('regular');
    });

    test('should include session information in multi-session messages', () => {
      mockServer.addClient(mockClient, true);
      mockServer.subscribeToSession(mockClient, 'session-1');
      
      const priorityEvent = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(priorityEvent);
      
      expect(mockClient.messages).toHaveLength(1);
      
      const message: MultiSessionWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.sessionId).toBe('session-1');
      expect(message.type).toBe('priority_event');
    });
  });

  describe('Initial Connection Enhancement', () => {
    test('should send priority-aware initial events', () => {
      const events = [
        createTestEvent('UserPromptSubmit', 'session-1', 1),
        createTestEvent('tool_use', 'session-1', 0),
        createTestEvent('Notification', 'session-2', 1),
        createTestEvent('response', 'session-2', 0)
      ];
      
      mockServer.addClient(mockClient);
      mockServer.sendInitialEvents(mockClient, events);
      
      expect(mockClient.messages).toHaveLength(1);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.type).toBe('initial');
      expect(Array.isArray(message.data)).toBe(true);
      expect(message.data).toHaveLength(4);
      
      expect(message.priority_info).toBeDefined();
      expect(message.priority_info?.total_events).toBe(4);
      expect(message.priority_info?.priority_events).toBe(2);
      expect(message.priority_info?.regular_events).toBe(2);
      expect(message.priority_info?.retention_window).toBeDefined();
      expect(message.priority_info?.retention_window?.priority_hours).toBe(24);
      expect(message.priority_info?.retention_window?.regular_hours).toBe(4);
    });

    test('should handle empty initial event list', () => {
      mockServer.addClient(mockClient);
      mockServer.sendInitialEvents(mockClient, []);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.type).toBe('initial');
      expect(message.data).toHaveLength(0);
      expect(message.priority_info?.total_events).toBe(0);
      expect(message.priority_info?.priority_events).toBe(0);
      expect(message.priority_info?.regular_events).toBe(0);
    });

    test('should calculate statistics correctly for initial events', () => {
      const events = [
        ...Array.from({ length: 7 }, (_, i) => createTestEvent('UserPromptSubmit', `session-${i}`, 1)),
        ...Array.from({ length: 3 }, (_, i) => createTestEvent('tool_use', `session-${i}`, 0))
      ];
      
      mockServer.addClient(mockClient);
      mockServer.sendInitialEvents(mockClient, events);
      
      const message: PriorityWebSocketMessage = JSON.parse(mockClient.lastMessage);
      expect(message.priority_info?.total_events).toBe(10);
      expect(message.priority_info?.priority_events).toBe(7);
      expect(message.priority_info?.regular_events).toBe(3);
    });
  });

  describe('Backward Compatibility', () => {
    test('should not break legacy clients receiving priority events', () => {
      mockServer.addClient(mockClient);
      
      const priorityEvent = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(priorityEvent);
      
      const message = JSON.parse(mockClient.lastMessage);
      
      // Legacy clients should still be able to access basic event data
      expect(message.data.id).toBe(priorityEvent.id);
      expect(message.data.source_app).toBe(priorityEvent.source_app);
      expect(message.data.session_id).toBe(priorityEvent.session_id);
      expect(message.data.hook_event_type).toBe(priorityEvent.hook_event_type);
      expect(message.data.payload).toEqual(priorityEvent.payload);
      
      // Additional priority fields should not interfere
      expect(message.priority_info).toBeDefined();
    });

    test('should handle legacy message format gracefully', () => {
      mockServer.addClient(mockClient);
      
      const legacyEvent = createTestEvent('tool_use', 'session-1');
      const legacyMessage = createLegacyWebSocketMessage(legacyEvent);
      
      // Simulate receiving legacy format
      mockClient.simulateMessage(JSON.stringify(legacyMessage));
      
      // Should not throw errors when processed
      expect(() => {
        const parsed = JSON.parse(JSON.stringify(legacyMessage));
        expect(parsed.type).toBe('event');
        expect(parsed.data).toEqual(legacyEvent);
      }).not.toThrow();
    });

    test('should maintain compatibility with existing client parsers', () => {
      mockServer.addClient(mockClient);
      
      const regularEvent = createTestEvent('response', 'session-1', 0);
      mockServer.broadcastEventWithPriority(regularEvent);
      
      const message = JSON.parse(mockClient.lastMessage);
      
      // Essential fields should be in expected format
      expect(typeof message.type).toBe('string');
      expect(typeof message.data).toBe('object');
      expect(message.data !== null).toBe(true);
      
      // Should be parseable by legacy event handler
      const extractEventData = (msg: any) => {
        return msg.data;
      };
      
      const extractedEvent = extractEventData(message);
      expect(extractedEvent.hook_event_type).toBe('response');
      expect(extractedEvent.session_id).toBe('session-1');
    });
  });

  describe('Multi-Session Client Support', () => {
    test('should route priority events to subscribed sessions only', () => {
      const client1 = new MockWebSocketClient();
      const client2 = new MockWebSocketClient();
      
      mockServer.addClient(client1, true);
      mockServer.addClient(client2, true);
      
      mockServer.subscribeToSession(client1, 'session-1');
      mockServer.subscribeToSession(client2, 'session-2');
      
      const event1 = createTestEvent('UserPromptSubmit', 'session-1', 1);
      const event2 = createTestEvent('Notification', 'session-2', 1);
      
      mockServer.broadcastEventWithPriority(event1);
      mockServer.broadcastEventWithPriority(event2);
      
      // Client1 should only receive session-1 events
      expect(client1.messages).toHaveLength(1);
      const client1Message: MultiSessionWebSocketMessage = JSON.parse(client1.lastMessage);
      expect(client1Message.sessionId).toBe('session-1');
      
      // Client2 should only receive session-2 events
      expect(client2.messages).toHaveLength(1);
      const client2Message: MultiSessionWebSocketMessage = JSON.parse(client2.lastMessage);
      expect(client2Message.sessionId).toBe('session-2');
    });

    test('should handle session subscription changes', () => {
      mockServer.addClient(mockClient, true);
      mockServer.subscribeToSession(mockClient, 'session-1');
      
      const event1 = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(event1);
      
      expect(mockClient.messages).toHaveLength(1);
      
      // Subscribe to additional session
      mockServer.subscribeToSession(mockClient, 'session-2');
      
      const event2 = createTestEvent('Notification', 'session-2', 1);
      mockServer.broadcastEventWithPriority(event2);
      
      expect(mockClient.messages).toHaveLength(2);
      
      const sessions = mockServer.getMultiSessionClients().get(mockClient);
      expect(sessions?.has('session-1')).toBe(true);
      expect(sessions?.has('session-2')).toBe(true);
    });

    test('should not send events to unsubscribed sessions', () => {
      mockServer.addClient(mockClient, true);
      mockServer.subscribeToSession(mockClient, 'session-1');
      
      const event = createTestEvent('UserPromptSubmit', 'session-unsubscribed', 1);
      mockServer.broadcastEventWithPriority(event);
      
      expect(mockClient.messages).toHaveLength(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle client disconnection gracefully', () => {
      mockServer.addClient(mockClient);
      
      // Simulate client error by making send throw
      const originalSend = mockClient.send;
      mockClient.send = () => {
        throw new Error('Connection lost');
      };
      
      const event = createTestEvent('UserPromptSubmit', 'session-1', 1);
      
      // Should not throw when client fails
      expect(() => mockServer.broadcastEventWithPriority(event)).not.toThrow();
      
      // Client should be removed from active clients
      const connectedClients = mockServer.getConnectedClients();
      expect(connectedClients.includes(mockClient)).toBe(false);
    });

    test('should handle malformed priority metadata', () => {
      mockServer.addClient(mockClient);
      
      const eventWithMalformedPriority = createTestEvent('UserPromptSubmit', 'session-1', NaN);
      
      expect(() => mockServer.broadcastEventWithPriority(eventWithMalformedPriority)).not.toThrow();
      
      const message = JSON.parse(mockClient.lastMessage);
      expect(message.priority_info).toBeDefined();
      expect(message.priority_info.bucket).toBe('regular'); // Should fallback to regular
    });

    test('should handle very large event payloads', () => {
      mockServer.addClient(mockClient);
      
      const largeEvent = createTestEvent('UserPromptSubmit', 'session-1', 1);
      largeEvent.payload = { 
        data: 'A'.repeat(50000), // 50KB payload
        metadata: 'B'.repeat(50000)
      };
      
      expect(() => mockServer.broadcastEventWithPriority(largeEvent)).not.toThrow();
      
      const message = JSON.parse(mockClient.lastMessage);
      expect(message.data.payload.data).toBe(largeEvent.payload.data);
    });

    test('should handle rapid event broadcasting', () => {
      mockServer.addClient(mockClient);
      
      const events = Array.from({ length: 100 }, (_, i) => 
        createTestEvent('UserPromptSubmit', 'session-1', 1, Date.now() + i)
      );
      
      expect(() => {
        events.forEach(event => mockServer.broadcastEventWithPriority(event));
      }).not.toThrow();
      
      expect(mockClient.messages).toHaveLength(100);
    });
  });

  describe('Performance and Scalability', () => {
    test('should broadcast to multiple clients efficiently', () => {
      const clients = Array.from({ length: 50 }, () => new MockWebSocketClient());
      clients.forEach(client => mockServer.addClient(client));
      
      const event = createTestEvent('UserPromptSubmit', 'session-1', 1);
      
      const startTime = Date.now();
      mockServer.broadcastEventWithPriority(event);
      const broadcastTime = Date.now() - startTime;
      
      expect(broadcastTime).toBeLessThan(50); // Should complete quickly
      
      clients.forEach(client => {
        expect(client.messages).toHaveLength(1);
        const message = JSON.parse(client.lastMessage);
        expect(message.type).toBe('priority_event');
      });
    });

    test('should handle mixed single-session and multi-session clients', () => {
      const singleSessionClients = Array.from({ length: 10 }, () => new MockWebSocketClient());
      const multiSessionClients = Array.from({ length: 10 }, () => new MockWebSocketClient());
      
      singleSessionClients.forEach(client => mockServer.addClient(client, false));
      multiSessionClients.forEach(client => {
        mockServer.addClient(client, true);
        mockServer.subscribeToSession(client, 'session-1');
      });
      
      const event = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(event);
      
      // All single-session clients should receive the event
      singleSessionClients.forEach(client => {
        expect(client.messages).toHaveLength(1);
        const message = JSON.parse(client.lastMessage);
        expect(message.sessionId).toBeUndefined(); // No session ID for single-session
      });
      
      // All subscribed multi-session clients should receive the event
      multiSessionClients.forEach(client => {
        expect(client.messages).toHaveLength(1);
        const message = JSON.parse(client.lastMessage);
        expect(message.sessionId).toBe('session-1');
      });
    });

    test('should not impact performance with many inactive multi-session clients', () => {
      const activeClients = Array.from({ length: 5 }, () => new MockWebSocketClient());
      const inactiveClients = Array.from({ length: 45 }, () => new MockWebSocketClient());
      
      activeClients.forEach(client => {
        mockServer.addClient(client, true);
        mockServer.subscribeToSession(client, 'session-1');
      });
      
      inactiveClients.forEach(client => {
        mockServer.addClient(client, true);
        mockServer.subscribeToSession(client, 'session-inactive');
      });
      
      const event = createTestEvent('UserPromptSubmit', 'session-1', 1);
      
      const startTime = Date.now();
      mockServer.broadcastEventWithPriority(event);
      const broadcastTime = Date.now() - startTime;
      
      expect(broadcastTime).toBeLessThan(50);
      
      // Only active clients should receive messages
      activeClients.forEach(client => {
        expect(client.messages).toHaveLength(1);
      });
      
      inactiveClients.forEach(client => {
        expect(client.messages).toHaveLength(0);
      });
    });
  });

  describe('Message Size and Compression', () => {
    test('should handle message size efficiently', () => {
      mockServer.addClient(mockClient);
      
      const event = createTestEvent('UserPromptSubmit', 'session-1', 1);
      mockServer.broadcastEventWithPriority(event);
      
      const messageSize = mockClient.lastMessage.length;
      
      // Priority metadata should add minimal overhead
      const legacyMessage = createLegacyWebSocketMessage(event);
      const legacySize = JSON.stringify(legacyMessage).length;
      
      const overhead = messageSize - legacySize;
      expect(overhead).toBeLessThan(200); // Reasonable metadata overhead
    });

    test('should maintain message structure consistency', () => {
      mockServer.addClient(mockClient);
      
      const events = [
        createTestEvent('UserPromptSubmit', 'session-1', 1),
        createTestEvent('tool_use', 'session-1', 0),
        createTestEvent('Notification', 'session-2', 1)
      ];
      
      events.forEach(event => mockServer.broadcastEventWithPriority(event));
      
      const messages = mockClient.messages.map(msg => JSON.parse(msg));
      
      // All messages should have consistent structure
      messages.forEach(message => {
        expect(message).toHaveProperty('type');
        expect(message).toHaveProperty('data');
        expect(message).toHaveProperty('priority_info');
        expect(message.priority_info).toHaveProperty('retention_hint');
        expect(message.priority_info).toHaveProperty('classification');
        expect(message.priority_info).toHaveProperty('bucket');
      });
    });
  });
});