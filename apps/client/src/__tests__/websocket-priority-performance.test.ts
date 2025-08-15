/**
 * WebSocket Priority Performance Tests
 * 
 * Tests WebSocket message size impact from priority metadata and messaging performance.
 * Validates network efficiency and latency requirements for priority event system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookEvent } from '../types';

// Performance targets for WebSocket messaging
const WEBSOCKET_PERFORMANCE_TARGETS = {
  MAX_MESSAGE_OVERHEAD: 0.05, // 5% max overhead from priority metadata
  MAX_INITIAL_PAYLOAD_SIZE: 2 * 1024 * 1024, // 2MB for initial connection
  MAX_MESSAGE_LATENCY: 10, // 10ms max processing latency
  MAX_SERIALIZATION_TIME: 5, // 5ms max JSON serialization time
  TARGET_MESSAGES_PER_SECOND: 1000, // Throughput target
  MAX_RECONNECTION_TIME: 3000, // 3 seconds max reconnection
  MAX_MESSAGE_QUEUE_SIZE: 10000, // Max queued messages
};

// Enhanced WebSocket message types from architecture spec
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
    retention_hint?: string;
    classification?: string;
    bucket?: string;
  };
  sessionId?: string; // For multi-session clients
}

// Mock WebSocket implementation for testing
class MockWebSocket extends EventTarget {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  private messageQueue: string[] = [];
  private latencySimulation: number = 0;
  private connected: boolean = false;
  
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  
  constructor(url: string, latency: number = 0) {
    super();
    this.url = url;
    this.latencySimulation = latency;
    
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.connected = true;
      this.dispatchEvent(new Event('open'));
    }, latency);
  }
  
  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Simulate network latency
    setTimeout(() => {
      this.messageQueue.push(data);
    }, this.latencySimulation);
  }
  
  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.connected = false;
    this.dispatchEvent(new Event('close'));
  }
  
  // Test helper methods
  simulateMessage(message: string): void {
    if (this.connected) {
      const event = new MessageEvent('message', { data: message });
      this.dispatchEvent(event);
    }
  }
  
  getQueuedMessages(): string[] {
    return [...this.messageQueue];
  }
  
  clearQueue(): void {
    this.messageQueue = [];
  }
  
  simulateConnectionError(): void {
    this.readyState = WebSocket.CLOSED;
    this.connected = false;
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new Event('close'));
  }
}

// Priority WebSocket client implementation
class PriorityWebSocketClient {
  private ws: MockWebSocket | null = null;
  private url: string;
  private reconnectTimeout: number | null = null;
  private messageHistory: PriorityWebSocketMessage[] = [];
  private performanceMetrics: {
    messageCount: number;
    totalLatency: number;
    averageMessageSize: number;
    priorityMessageCount: number;
    overheadBytes: number;
  } = {
    messageCount: 0,
    totalLatency: 0,
    averageMessageSize: 0,
    priorityMessageCount: 0,
    overheadBytes: 0
  };
  
  constructor(url: string) {
    this.url = url;
  }
  
  connect(latency: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new MockWebSocket(this.url, latency);
      
      this.ws.addEventListener('open', () => {
        console.log('Priority WebSocket connected');
        resolve();
      });
      
      this.ws.addEventListener('message', (event) => {
        this.handleMessage(event as MessageEvent);
      });
      
      this.ws.addEventListener('error', () => {
        reject(new Error('WebSocket connection failed'));
      });
      
      this.ws.addEventListener('close', () => {
        this.attemptReconnect();
      });
      
      // Timeout for connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, WEBSOCKET_PERFORMANCE_TARGETS.MAX_RECONNECTION_TIME);
    });
  }
  
  private handleMessage(event: MessageEvent): void {
    const startTime = performance.now();
    
    try {
      const message: PriorityWebSocketMessage = JSON.parse(event.data);
      this.messageHistory.push(message);
      
      // Update performance metrics
      const messageSize = event.data.length;
      this.performanceMetrics.messageCount++;
      this.performanceMetrics.totalLatency += performance.now() - startTime;
      this.performanceMetrics.averageMessageSize = 
        (this.performanceMetrics.averageMessageSize * (this.performanceMetrics.messageCount - 1) + messageSize) / 
        this.performanceMetrics.messageCount;
      
      if (message.type === 'priority_event' || message.priority_info) {
        this.performanceMetrics.priorityMessageCount++;
        
        // Calculate overhead from priority metadata
        const baseMessage = { type: message.type, data: message.data };
        const baseSize = JSON.stringify(baseMessage).length;
        const prioritySize = event.data.length;
        this.performanceMetrics.overheadBytes += prioritySize - baseSize;
      }
      
    } catch (error) {
      console.error('Failed to parse priority WebSocket message:', error);
    }
  }
  
  private attemptReconnect(): void {
    console.log('Priority WebSocket disconnected, attempting to reconnect...');
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect().catch(console.error);
    }, 3000);
  }
  
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  simulateReceiveMessage(message: PriorityWebSocketMessage): void {
    if (this.ws) {
      this.ws.simulateMessage(JSON.stringify(message));
    }
  }
  
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageLatency: this.performanceMetrics.messageCount > 0 
        ? this.performanceMetrics.totalLatency / this.performanceMetrics.messageCount 
        : 0,
      overheadPercentage: this.performanceMetrics.messageCount > 0
        ? (this.performanceMetrics.overheadBytes / (this.performanceMetrics.averageMessageSize * this.performanceMetrics.messageCount)) * 100
        : 0
    };
  }
  
  getMessageHistory(): PriorityWebSocketMessage[] {
    return [...this.messageHistory];
  }
  
  clearHistory(): void {
    this.messageHistory = [];
    this.performanceMetrics = {
      messageCount: 0,
      totalLatency: 0,
      averageMessageSize: 0,
      priorityMessageCount: 0,
      overheadBytes: 0
    };
  }
}

function createTestEvent(type: string, priority: number = 0, payloadSize: number = 512): HookEvent {
  return {
    id: Math.floor(Math.random() * 1000000),
    source_app: 'test',
    session_id: 'test-session',
    hook_event_type: type,
    payload: {
      data: 'x'.repeat(payloadSize),
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

function createPriorityMessage(
  event: HookEvent, 
  includeFullPriorityInfo: boolean = true
): PriorityWebSocketMessage {
  const isPriority = (event as any).priority > 0;
  
  const message: PriorityWebSocketMessage = {
    type: isPriority ? 'priority_event' : 'event',
    data: event
  };
  
  if (isPriority && includeFullPriorityInfo) {
    message.priority_info = {
      total_events: 100,
      priority_events: 30,
      regular_events: 70,
      retention_window: {
        priority_hours: 24,
        regular_hours: 4
      },
      retention_hint: 'extended',
      classification: 'automatic',
      bucket: 'priority'
    };
  }
  
  return message;
}

function createInitialMessage(events: HookEvent[]): PriorityWebSocketMessage {
  const priorityEvents = events.filter(e => ((e as any).priority || 0) > 0);
  const regularEvents = events.filter(e => ((e as any).priority || 0) === 0);
  
  return {
    type: 'initial',
    data: events,
    priority_info: {
      total_events: events.length,
      priority_events: priorityEvents.length,
      regular_events: regularEvents.length,
      retention_window: {
        priority_hours: 24,
        regular_hours: 4
      }
    }
  };
}

function measureSerializationPerformance(message: PriorityWebSocketMessage): {
  serializedSize: number;
  serializationTime: number;
  serializedData: string;
} {
  const startTime = performance.now();
  const serializedData = JSON.stringify(message);
  const endTime = performance.now();
  
  return {
    serializedSize: serializedData.length,
    serializationTime: endTime - startTime,
    serializedData
  };
}

describe('WebSocket Priority Performance Tests', () => {
  let client: PriorityWebSocketClient;
  
  beforeEach(async () => {
    client = new PriorityWebSocketClient('ws://localhost:8080');
    
    // Mock global WebSocket
    (global as any).WebSocket = MockWebSocket;
    
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
  });

  describe('Message Overhead Analysis', () => {
    it('should measure priority metadata overhead', () => {
      const baseEvent = createTestEvent('RegularEvent', 0, 1024);
      const priorityEvent = createTestEvent('UserPromptSubmit', 1, 1024);
      
      const baseMessage = createPriorityMessage(baseEvent, false);
      const priorityMessage = createPriorityMessage(priorityEvent, true);
      
      const basePerf = measureSerializationPerformance(baseMessage);
      const priorityPerf = measureSerializationPerformance(priorityMessage);
      
      const overhead = (priorityPerf.serializedSize - basePerf.serializedSize) / basePerf.serializedSize;
      
      expect(overhead).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_OVERHEAD);
      expect(priorityPerf.serializationTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_SERIALIZATION_TIME);
      
      console.log(`Priority metadata overhead: ${(overhead * 100).toFixed(2)}%`);
      console.log(`Base message: ${basePerf.serializedSize} bytes, Priority message: ${priorityPerf.serializedSize} bytes`);
    });

    it('should validate different priority metadata configurations', () => {
      const event = createTestEvent('UserPromptSubmit', 1, 512);
      const configurations = [
        { name: 'Minimal', includeFullInfo: false },
        { name: 'Standard', includeFullInfo: true },
        { name: 'Extended', includeFullInfo: true, addSessionId: true }
      ];
      
      configurations.forEach(config => {
        const message = createPriorityMessage(event, config.includeFullInfo);
        
        if (config.addSessionId) {
          message.sessionId = 'multi-session-id';
        }
        
        const perf = measureSerializationPerformance(message);
        const baseSize = JSON.stringify({ type: 'event', data: event }).length;
        const overhead = (perf.serializedSize - baseSize) / baseSize;
        
        expect(overhead).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_OVERHEAD * 2); // Allow 2x for extended
        
        console.log(`${config.name} config: ${perf.serializedSize} bytes, ${(overhead * 100).toFixed(2)}% overhead`);
      });
    });

    it('should test initial connection payload size', () => {
      const eventCounts = [50, 100, 150, 200];
      
      eventCounts.forEach(count => {
        const events = Array.from({ length: count }, (_, i) => 
          createTestEvent(i % 4 === 0 ? 'UserPromptSubmit' : 'RegularEvent', i % 4 === 0 ? 1 : 0, 512)
        );
        
        const initialMessage = createInitialMessage(events);
        const perf = measureSerializationPerformance(initialMessage);
        
        if (count <= 150) {
          expect(perf.serializedSize).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_INITIAL_PAYLOAD_SIZE);
        }
        
        expect(perf.serializationTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_SERIALIZATION_TIME * 2);
        
        console.log(`Initial payload (${count} events): ${(perf.serializedSize / 1024).toFixed(1)}KB, ${perf.serializationTime.toFixed(2)}ms`);
      });
    });
  });

  describe('Message Processing Performance', () => {
    it('should handle high-frequency messages efficiently', async () => {
      await client.connect(0);
      
      const messageCount = 1000;
      const events = Array.from({ length: messageCount }, (_, i) => 
        createTestEvent(i % 5 === 0 ? 'UserPromptSubmit' : 'RegularEvent', i % 5 === 0 ? 1 : 0, 256)
      );
      
      const startTime = performance.now();
      
      events.forEach(event => {
        const message = createPriorityMessage(event, true);
        client.simulateReceiveMessage(message);
      });
      
      // Fast forward timers to process all messages
      vi.runAllTimers();
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const messagesPerSecond = messageCount / (processingTime / 1000);
      
      expect(messagesPerSecond).toBeGreaterThan(WEBSOCKET_PERFORMANCE_TARGETS.TARGET_MESSAGES_PER_SECOND);
      
      const metrics = client.getPerformanceMetrics();
      expect(metrics.averageLatency).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_LATENCY);
      
      console.log(`Processed ${messageCount} messages at ${Math.round(messagesPerSecond)} msg/sec`);
      console.log(`Average latency: ${metrics.averageLatency.toFixed(3)}ms`);
    });

    it('should maintain performance with varying payload sizes', async () => {
      await client.connect(0);
      
      const payloadSizes = [256, 512, 1024, 2048, 4096]; // Different payload sizes
      const messagesPerSize = 100;
      
      payloadSizes.forEach(payloadSize => {
        client.clearHistory();
        
        const events = Array.from({ length: messagesPerSize }, (_, i) => 
          createTestEvent(i % 3 === 0 ? 'UserPromptSubmit' : 'RegularEvent', i % 3 === 0 ? 1 : 0, payloadSize)
        );
        
        const startTime = performance.now();
        
        events.forEach(event => {
          const message = createPriorityMessage(event, true);
          client.simulateReceiveMessage(message);
        });
        
        vi.runAllTimers();
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        const metrics = client.getPerformanceMetrics();
        
        expect(metrics.averageLatency).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_LATENCY * 2);
        
        console.log(`Payload ${payloadSize}B: ${(processingTime / messagesPerSize).toFixed(3)}ms per message`);
      });
    });

    it('should handle burst scenarios efficiently', async () => {
      await client.connect(0);
      
      const burstSizes = [10, 50, 100, 200];
      
      burstSizes.forEach(burstSize => {
        client.clearHistory();
        
        // Create burst of events
        const events = Array.from({ length: burstSize }, (_, i) => 
          createTestEvent('UserPromptSubmit', 1, 512 + Math.random() * 512)
        );
        
        const startTime = performance.now();
        
        // Send all messages at once (burst)
        events.forEach(event => {
          const message = createPriorityMessage(event, true);
          client.simulateReceiveMessage(message);
        });
        
        vi.runAllTimers();
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const metrics = client.getPerformanceMetrics();
        
        expect(metrics.averageLatency).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_LATENCY);
        expect(totalTime).toBeLessThan(burstSize); // Should be sub-linear with burst size
        
        console.log(`Burst ${burstSize}: ${totalTime.toFixed(2)}ms total, ${metrics.averageLatency.toFixed(3)}ms avg latency`);
      });
    });
  });

  describe('Connection Performance', () => {
    it('should establish connections within acceptable time', async () => {
      const latencies = [0, 50, 100, 200]; // Simulate different network conditions
      
      for (const latency of latencies) {
        const testClient = new PriorityWebSocketClient('ws://localhost:8080');
        
        const startTime = performance.now();
        await testClient.connect(latency);
        const connectionTime = performance.now() - startTime;
        
        expect(connectionTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_RECONNECTION_TIME);
        
        testClient.disconnect();
        
        console.log(`Connection with ${latency}ms latency: ${connectionTime.toFixed(2)}ms`);
      }
    });

    it('should handle reconnection scenarios efficiently', async () => {
      await client.connect(0);
      
      // Simulate connection drops and reconnections
      for (let i = 0; i < 5; i++) {
        const mockWs = (client as any).ws as MockWebSocket;
        
        // Simulate connection error
        mockWs.simulateConnectionError();
        
        // Fast forward reconnection timeout
        vi.advanceTimersByTime(3000);
        
        // Should attempt to reconnect
        const reconnectStartTime = performance.now();
        await client.connect(10); // 10ms latency
        const reconnectTime = performance.now() - reconnectStartTime;
        
        expect(reconnectTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_RECONNECTION_TIME);
        
        console.log(`Reconnection ${i + 1}: ${reconnectTime.toFixed(2)}ms`);
      }
    });

    it('should maintain performance with multiple concurrent connections', async () => {
      const clientCount = 50;
      const clients: PriorityWebSocketClient[] = [];
      
      // Create multiple clients
      const connectionPromises = Array.from({ length: clientCount }, async (_, i) => {
        const testClient = new PriorityWebSocketClient(`ws://localhost:8080/client-${i}`);
        clients.push(testClient);
        return testClient.connect(Math.random() * 50); // Random latency up to 50ms
      });
      
      const startTime = performance.now();
      await Promise.all(connectionPromises);
      const totalConnectionTime = performance.now() - startTime;
      
      expect(totalConnectionTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_RECONNECTION_TIME * 2);
      
      // Test broadcasting to all clients
      const testEvent = createTestEvent('UserPromptSubmit', 1, 512);
      const message = createPriorityMessage(testEvent, true);
      
      const broadcastStart = performance.now();
      clients.forEach(client => client.simulateReceiveMessage(message));
      vi.runAllTimers();
      const broadcastTime = performance.now() - broadcastStart;
      
      expect(broadcastTime).toBeLessThan(100); // 100ms for 50 clients
      
      // Cleanup
      clients.forEach(client => client.disconnect());
      
      console.log(`${clientCount} concurrent connections: ${totalConnectionTime.toFixed(2)}ms`);
      console.log(`Broadcast to ${clientCount} clients: ${broadcastTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should manage message history memory efficiently', async () => {
      await client.connect(0);
      
      const messageCount = 5000;
      const events = Array.from({ length: messageCount }, (_, i) => 
        createTestEvent(i % 4 === 0 ? 'UserPromptSubmit' : 'RegularEvent', i % 4 === 0 ? 1 : 0, 512)
      );
      
      // Send messages gradually and measure memory growth
      let maxHistorySize = 0;
      const memoryCheckPoints = [1000, 2000, 3000, 4000, 5000];
      
      for (let i = 0; i < events.length; i++) {
        const message = createPriorityMessage(events[i], true);
        client.simulateReceiveMessage(message);
        
        if (memoryCheckPoints.includes(i + 1)) {
          const history = client.getMessageHistory();
          maxHistorySize = Math.max(maxHistorySize, history.length);
          
          // History should not grow unbounded
          expect(history.length).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_QUEUE_SIZE);
          
          console.log(`Messages processed: ${i + 1}, History size: ${history.length}`);
        }
      }
      
      vi.runAllTimers();
      
      const finalMetrics = client.getPerformanceMetrics();
      expect(finalMetrics.overheadPercentage).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_OVERHEAD * 100);
      
      console.log(`Maximum history size: ${maxHistorySize} messages`);
      console.log(`Final overhead: ${finalMetrics.overheadPercentage.toFixed(2)}%`);
    });

    it('should handle large individual messages efficiently', async () => {
      await client.connect(0);
      
      const largeSizes = [10 * 1024, 50 * 1024, 100 * 1024]; // 10KB, 50KB, 100KB
      
      largeSizes.forEach(size => {
        const largeEvent = createTestEvent('UserPromptSubmit', 1, size);
        largeEvent.chat = Array.from({ length: 100 }, (_, i) => ({
          role: 'user',
          content: 'x'.repeat(100) // Add large chat content
        }));
        
        const message = createPriorityMessage(largeEvent, true);
        const perf = measureSerializationPerformance(message);
        
        expect(perf.serializationTime).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_SERIALIZATION_TIME * 5); // Allow 5x for large messages
        
        client.simulateReceiveMessage(message);
        vi.runAllTimers();
        
        const metrics = client.getPerformanceMetrics();
        expect(metrics.averageLatency).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_LATENCY * 3); // Allow 3x for large messages
        
        console.log(`Large message (${(size / 1024).toFixed(1)}KB): ${perf.serializationTime.toFixed(2)}ms serialization`);
        
        client.clearHistory(); // Reset for next test
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed priority metadata gracefully', async () => {
      await client.connect(0);
      
      const malformedMessages = [
        '{"type":"priority_event","data":null}', // Null data
        '{"type":"priority_event","data":{},"priority_info":null}', // Null priority_info
        '{"type":"priority_event","data":{"invalid":"data"},"priority_info":{"invalid":"info"}}', // Invalid structure
        '{"type":"priority_event"}', // Missing data
        'invalid json{' // Invalid JSON
      ];
      
      malformedMessages.forEach((messageStr, index) => {
        const mockWs = (client as any).ws as MockWebSocket;
        
        // Should not throw errors
        expect(() => {
          mockWs.simulateMessage(messageStr);
          vi.runAllTimers();
        }).not.toThrow();
        
        console.log(`Malformed message ${index + 1}: handled gracefully`);
      });
      
      // Client should still be functional
      const validEvent = createTestEvent('UserPromptSubmit', 1, 512);
      const validMessage = createPriorityMessage(validEvent, true);
      
      expect(() => {
        client.simulateReceiveMessage(validMessage);
        vi.runAllTimers();
      }).not.toThrow();
      
      const metrics = client.getPerformanceMetrics();
      expect(metrics.messageCount).toBeGreaterThan(0);
    });

    it('should maintain performance under network instability', async () => {
      await client.connect(0);
      
      // Simulate unstable network with intermittent issues
      for (let cycle = 0; cycle < 10; cycle++) {
        // Send normal messages
        for (let i = 0; i < 50; i++) {
          const event = createTestEvent('UserPromptSubmit', 1, 512);
          const message = createPriorityMessage(event, true);
          client.simulateReceiveMessage(message);
        }
        
        // Simulate occasional connection issues
        if (cycle % 3 === 0) {
          const mockWs = (client as any).ws as MockWebSocket;
          mockWs.simulateConnectionError();
          
          // Reconnect
          vi.advanceTimersByTime(3000);
          await client.connect(20); // 20ms latency
        }
        
        vi.runAllTimers();
      }
      
      const metrics = client.getPerformanceMetrics();
      
      // Should maintain reasonable performance despite instability
      expect(metrics.averageLatency).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_LATENCY * 2);
      expect(metrics.overheadPercentage).toBeLessThan(WEBSOCKET_PERFORMANCE_TARGETS.MAX_MESSAGE_OVERHEAD * 100);
      
      console.log(`Network instability test - Average latency: ${metrics.averageLatency.toFixed(3)}ms`);
      console.log(`Messages processed: ${metrics.messageCount}, Overhead: ${metrics.overheadPercentage.toFixed(2)}%`);
    });
  });
});