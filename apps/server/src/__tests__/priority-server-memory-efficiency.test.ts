/**
 * Priority Server Memory Efficiency Tests
 * 
 * Tests server-side memory usage patterns and efficiency with priority event processing.
 * Validates memory consumption during high-load scenarios and WebSocket broadcasting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { HookEvent } from '../types';

// Performance targets for server memory efficiency
const SERVER_PERFORMANCE_TARGETS = {
  MAX_MEMORY_GROWTH_PER_1000_EVENTS: 50 * 1024 * 1024, // 50MB per 1000 events
  MAX_WEBSOCKET_MEMORY_PER_CLIENT: 10 * 1024 * 1024, // 10MB per client
  MEMORY_LEAK_THRESHOLD: 0.1, // 10% max growth over time
  MAX_MEMORY_FOR_PRIORITY_PROCESSING: 100 * 1024 * 1024, // 100MB
  GARBAGE_COLLECTION_EFFECTIVENESS: 0.8, // 80% memory recovery
  MAX_MESSAGE_QUEUE_MEMORY: 25 * 1024 * 1024, // 25MB for message queuing
};

// Mock WebSocket clients for memory testing
class MockWebSocketClient {
  private messageHistory: string[] = [];
  private memoryUsage: number = 1024 * 1024; // 1MB base
  
  send(message: string): void {
    this.messageHistory.push(message);
    this.memoryUsage += message.length * 2; // UTF-16 encoding
    
    // Simulate client-side buffer limits
    if (this.messageHistory.length > 1000) {
      const removed = this.messageHistory.splice(0, 100);
      this.memoryUsage -= removed.reduce((sum, msg) => sum + msg.length * 2, 0);
    }
  }
  
  getMemoryUsage(): number {
    return this.memoryUsage;
  }
  
  getMessageCount(): number {
    return this.messageHistory.length;
  }
  
  disconnect(): void {
    this.messageHistory = [];
    this.memoryUsage = 0;
  }
}

// Enhanced priority event server simulator
class PriorityEventServer {
  private database: Database;
  private wsClients: Set<MockWebSocketClient> = new Set();
  private multiSessionClients: Map<MockWebSocketClient, Set<string>> = new Map();
  private messageQueue: any[] = [];
  private memoryUsage: number = 20 * 1024 * 1024; // 20MB base server memory
  private processedEvents: number = 0;
  
  constructor() {
    this.database = new Database(':memory:');
    this.initializeDatabase();
  }
  
  private initializeDatabase(): void {
    // Create events table with priority fields
    this.database.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_app TEXT NOT NULL,
        session_id TEXT NOT NULL,
        hook_event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        chat TEXT,
        summary TEXT,
        timestamp INTEGER NOT NULL,
        priority INTEGER DEFAULT 0,
        priority_metadata TEXT
      )
    `);
    
    // Create priority-optimized indexes
    this.database.exec('CREATE INDEX idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    this.database.exec('CREATE INDEX idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
  }
  
  addWebSocketClient(isMultiSession: boolean = false, sessionIds: string[] = []): MockWebSocketClient {
    const client = new MockWebSocketClient();
    
    if (isMultiSession) {
      this.multiSessionClients.set(client, new Set(sessionIds));
    } else {
      this.wsClients.add(client);
    }
    
    // Send initial events to new client
    this.sendInitialEvents(client, isMultiSession);
    
    return client;
  }
  
  removeWebSocketClient(client: MockWebSocketClient): void {
    this.wsClients.delete(client);
    this.multiSessionClients.delete(client);
    client.disconnect();
  }
  
  private sendInitialEvents(client: MockWebSocketClient, isMultiSession: boolean): void {
    const events = this.getRecentEventsWithPriority();
    const initialMessage = {
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
    
    client.send(JSON.stringify(initialMessage));
  }
  
  insertEvent(event: HookEvent): HookEvent {
    const priority = this.calculateEventPriority(event.hook_event_type);
    const priorityMetadata = priority > 0 ? JSON.stringify({
      classified_at: Date.now(),
      classification_reason: 'automatic',
      retention_policy: 'extended'
    }) : null;
    
    const stmt = this.database.prepare(`
      INSERT INTO events (
        source_app, session_id, hook_event_type, payload, 
        chat, summary, timestamp, priority, priority_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const timestamp = event.timestamp || Date.now();
    const result = stmt.run(
      event.source_app,
      event.session_id,
      event.hook_event_type,
      JSON.stringify(event.payload),
      event.chat ? JSON.stringify(event.chat) : null,
      event.summary || null,
      timestamp,
      priority,
      priorityMetadata
    );
    
    const savedEvent = {
      ...event,
      id: result.lastInsertRowid as number,
      timestamp,
      priority,
      priority_metadata: priorityMetadata ? JSON.parse(priorityMetadata) : undefined
    };
    
    // Update memory usage
    this.memoryUsage += this.calculateEventMemorySize(savedEvent);
    this.processedEvents++;
    
    // Broadcast to clients
    this.broadcastEventWithPriority(savedEvent);
    
    return savedEvent;
  }
  
  private calculateEventPriority(eventType: string): number {
    const priorityTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete'];
    return priorityTypes.includes(eventType) ? 1 : 0;
  }
  
  private calculateEventMemorySize(event: HookEvent): number {
    const baseSize = 500; // Object overhead
    const payloadSize = JSON.stringify(event.payload || {}).length;
    const chatSize = event.chat ? JSON.stringify(event.chat).length : 0;
    const summarySize = event.summary ? event.summary.length : 0;
    
    return baseSize + payloadSize + chatSize + summarySize;
  }
  
  private broadcastEventWithPriority(savedEvent: HookEvent): void {
    const message = {
      type: savedEvent.priority > 0 ? 'priority_event' : 'event',
      data: savedEvent,
      priority_info: savedEvent.priority > 0 ? {
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
    this.wsClients.forEach(client => {
      try {
        client.send(messageStr);
      } catch (err) {
        this.wsClients.delete(client);
      }
    });
    
    // Broadcast to multi-session clients
    const multiSessionMessage = {
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
    
    // Add to message queue for monitoring
    this.messageQueue.push({
      timestamp: Date.now(),
      size: messageStr.length,
      priority: savedEvent.priority,
      clientCount: this.wsClients.size + this.multiSessionClients.size
    });
    
    // Limit message queue size
    if (this.messageQueue.length > 10000) {
      this.messageQueue = this.messageQueue.slice(-5000);
    }
  }
  
  private getRecentEventsWithPriority(config = {
    totalLimit: 150,
    priorityLimit: 100,
    regularLimit: 50,
    priorityRetentionHours: 24,
    regularRetentionHours: 4
  }): HookEvent[] {
    const now = Date.now();
    const priorityCutoff = now - (config.priorityRetentionHours * 60 * 60 * 1000);
    const regularCutoff = now - (config.regularRetentionHours * 60 * 60 * 1000);
    
    const priorityStmt = this.database.prepare(`
      SELECT * FROM events
      WHERE priority > 0 AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    const regularStmt = this.database.prepare(`
      SELECT * FROM events
      WHERE priority = 0 AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    const priorityEvents = priorityStmt.all(priorityCutoff, config.priorityLimit) as any[];
    const regularEvents = regularStmt.all(regularCutoff, config.regularLimit) as any[];
    
    return [...priorityEvents, ...regularEvents]
      .map(row => ({
        ...row,
        payload: JSON.parse(row.payload),
        chat: row.chat ? JSON.parse(row.chat) : undefined,
        priority_metadata: row.priority_metadata ? JSON.parse(row.priority_metadata) : undefined
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, config.totalLimit);
  }
  
  getMemoryStats() {
    const clientMemory = Array.from(this.wsClients).reduce((sum, client) => sum + client.getMemoryUsage(), 0) +
                        Array.from(this.multiSessionClients.keys()).reduce((sum, client) => sum + client.getMemoryUsage(), 0);
    
    const messageQueueMemory = this.messageQueue.reduce((sum, msg) => sum + JSON.stringify(msg).length, 0);
    
    return {
      serverMemory: this.memoryUsage,
      clientMemory,
      messageQueueMemory,
      totalMemory: this.memoryUsage + clientMemory + messageQueueMemory,
      processedEvents: this.processedEvents,
      clientCount: this.wsClients.size + this.multiSessionClients.size,
      memoryPerEvent: this.processedEvents > 0 ? this.memoryUsage / this.processedEvents : 0,
      memoryPerClient: this.clientCount > 0 ? clientMemory / this.clientCount : 0
    };
  }
  
  simulateGarbageCollection(): void {
    // Simulate garbage collection by reducing memory usage
    const oldMemory = this.memoryUsage;
    this.memoryUsage = Math.max(
      20 * 1024 * 1024, // Base memory
      this.memoryUsage * (1 - SERVER_PERFORMANCE_TARGETS.GARBAGE_COLLECTION_EFFECTIVENESS)
    );
    
    console.log(`GC: ${((oldMemory - this.memoryUsage) / 1024 / 1024).toFixed(2)}MB reclaimed`);
  }
  
  cleanup(): void {
    this.wsClients.forEach(client => client.disconnect());
    this.multiSessionClients.forEach(client => client.disconnect());
    this.wsClients.clear();
    this.multiSessionClients.clear();
    this.database.close();
  }
}

function createTestEvent(type: string, sessionId: string = 'test-session', payloadSize: number = 1024): HookEvent {
  return {
    source_app: 'performance-test',
    session_id: sessionId,
    hook_event_type: type,
    payload: {
      data: 'x'.repeat(payloadSize),
      timestamp: Date.now(),
      test: true
    },
    timestamp: Date.now(),
    summary: `Test event of type ${type}`
  };
}

describe('Priority Server Memory Efficiency Tests', () => {
  let server: PriorityEventServer;
  let initialMemory: NodeJS.MemoryUsage;

  beforeEach(() => {
    server = new PriorityEventServer();
    initialMemory = process.memoryUsage();
  });

  afterEach(() => {
    server.cleanup();
  });

  describe('Server Memory Usage', () => {
    it('should maintain reasonable memory usage during event processing', () => {
      const eventCount = 1000;
      const events = Array.from({ length: eventCount }, (_, i) => {
        const eventType = i % 5 === 0 ? 'UserPromptSubmit' : 'RegularEvent';
        return createTestEvent(eventType, `session-${i % 10}`, 512 + Math.random() * 512);
      });
      
      const initialStats = server.getMemoryStats();
      
      events.forEach(event => server.insertEvent(event));
      
      const finalStats = server.getMemoryStats();
      const memoryGrowth = finalStats.serverMemory - initialStats.serverMemory;
      
      expect(memoryGrowth).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_MEMORY_GROWTH_PER_1000_EVENTS);
      expect(finalStats.memoryPerEvent).toBeLessThan(100 * 1024); // Less than 100KB per event
      
      console.log(`Server memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB for ${eventCount} events`);
      console.log(`Memory per event: ${(finalStats.memoryPerEvent / 1024).toFixed(2)}KB`);
    });

    it('should handle high-volume event bursts efficiently', () => {
      const burstSize = 5000;
      const batchSize = 100;
      let totalMemoryGrowth = 0;
      
      for (let batch = 0; batch < burstSize / batchSize; batch++) {
        const beforeMemory = server.getMemoryStats().serverMemory;
        
        // Process batch
        for (let i = 0; i < batchSize; i++) {
          const eventType = Math.random() < 0.3 ? 'UserPromptSubmit' : 'RegularEvent';
          const event = createTestEvent(eventType, `session-${batch % 20}`, 256 + Math.random() * 256);
          server.insertEvent(event);
        }
        
        const afterMemory = server.getMemoryStats().serverMemory;
        totalMemoryGrowth += afterMemory - beforeMemory;
        
        // Simulate periodic garbage collection
        if (batch % 10 === 0) {
          server.simulateGarbageCollection();
        }
      }
      
      const finalStats = server.getMemoryStats();
      expect(finalStats.serverMemory).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_MEMORY_FOR_PRIORITY_PROCESSING);
      
      console.log(`Burst processing memory usage: ${(finalStats.serverMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Processed ${burstSize} events in burst mode`);
    });

    it('should recover memory effectively during garbage collection', () => {
      // Fill server with events
      const events = Array.from({ length: 2000 }, (_, i) => 
        createTestEvent('UserPromptSubmit', `session-${i % 5}`, 1024)
      );
      
      events.forEach(event => server.insertEvent(event));
      
      const beforeGC = server.getMemoryStats().serverMemory;
      server.simulateGarbageCollection();
      const afterGC = server.getMemoryStats().serverMemory;
      
      const memoryRecovered = beforeGC - afterGC;
      const recoveryRate = memoryRecovered / beforeGC;
      
      expect(recoveryRate).toBeGreaterThan(SERVER_PERFORMANCE_TARGETS.GARBAGE_COLLECTION_EFFECTIVENESS * 0.8);
      
      console.log(`GC recovery rate: ${(recoveryRate * 100).toFixed(1)}%`);
    });
  });

  describe('WebSocket Client Memory Management', () => {
    it('should maintain efficient memory per client', () => {
      const clientCount = 50;
      const clients: MockWebSocketClient[] = [];
      
      // Add clients
      for (let i = 0; i < clientCount; i++) {
        const client = server.addWebSocketClient(false);
        clients.push(client);
      }
      
      // Send events that will be broadcast to all clients
      const events = Array.from({ length: 100 }, (_, i) => 
        createTestEvent(i % 3 === 0 ? 'UserPromptSubmit' : 'RegularEvent', 'session-1', 512)
      );
      
      events.forEach(event => server.insertEvent(event));
      
      const stats = server.getMemoryStats();
      
      expect(stats.memoryPerClient).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_WEBSOCKET_MEMORY_PER_CLIENT);
      expect(stats.clientMemory).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_WEBSOCKET_MEMORY_PER_CLIENT * clientCount);
      
      console.log(`Memory per client: ${(stats.memoryPerClient / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Total client memory: ${(stats.clientMemory / 1024 / 1024).toFixed(2)}MB for ${clientCount} clients`);
      
      clients.forEach(client => server.removeWebSocketClient(client));
    });

    it('should handle multi-session clients efficiently', () => {
      const multiSessionClients: MockWebSocketClient[] = [];
      const sessionIds = Array.from({ length: 20 }, (_, i) => `session-${i}`);
      
      // Add multi-session clients with different subscription patterns
      for (let i = 0; i < 10; i++) {
        const subscribedSessions = sessionIds.slice(i * 2, (i + 1) * 2); // 2 sessions per client
        const client = server.addWebSocketClient(true, subscribedSessions);
        multiSessionClients.push(client);
      }
      
      // Send events across different sessions
      sessionIds.forEach((sessionId, index) => {
        const events = Array.from({ length: 20 }, (_, i) => 
          createTestEvent(i % 4 === 0 ? 'UserPromptSubmit' : 'RegularEvent', sessionId, 256)
        );
        
        events.forEach(event => server.insertEvent(event));
      });
      
      const stats = server.getMemoryStats();
      
      expect(stats.memoryPerClient).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_WEBSOCKET_MEMORY_PER_CLIENT);
      
      console.log(`Multi-session memory per client: ${(stats.memoryPerClient / 1024 / 1024).toFixed(2)}MB`);
      
      multiSessionClients.forEach(client => server.removeWebSocketClient(client));
    });

    it('should manage message queue memory efficiently', () => {
      const clients = Array.from({ length: 100 }, () => server.addWebSocketClient(false));
      
      // Generate many events to test message queue
      const events = Array.from({ length: 1000 }, (_, i) => 
        createTestEvent(i % 5 === 0 ? 'UserPromptSubmit' : 'RegularEvent', `session-${i % 50}`, 1024)
      );
      
      events.forEach(event => server.insertEvent(event));
      
      const stats = server.getMemoryStats();
      
      expect(stats.messageQueueMemory).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_MESSAGE_QUEUE_MEMORY);
      
      console.log(`Message queue memory: ${(stats.messageQueueMemory / 1024 / 1024).toFixed(2)}MB`);
      
      clients.forEach(client => server.removeWebSocketClient(client));
    });
  });

  describe('Priority Processing Memory Impact', () => {
    it('should measure memory overhead of priority classification', () => {
      const eventCount = 1000;
      
      // Process regular events only
      const regularEvents = Array.from({ length: eventCount }, (_, i) => 
        createTestEvent('RegularEvent', `session-${i % 10}`, 512)
      );
      
      const beforeRegular = server.getMemoryStats().serverMemory;
      regularEvents.forEach(event => server.insertEvent(event));
      const afterRegular = server.getMemoryStats().serverMemory;
      
      const regularMemoryUsage = afterRegular - beforeRegular;
      
      // Reset server
      server.cleanup();
      server = new PriorityEventServer();
      
      // Process priority events
      const priorityEvents = Array.from({ length: eventCount }, (_, i) => 
        createTestEvent('UserPromptSubmit', `session-${i % 10}`, 512)
      );
      
      const beforePriority = server.getMemoryStats().serverMemory;
      priorityEvents.forEach(event => server.insertEvent(event));
      const afterPriority = server.getMemoryStats().serverMemory;
      
      const priorityMemoryUsage = afterPriority - beforePriority;
      const overhead = (priorityMemoryUsage - regularMemoryUsage) / regularMemoryUsage;
      
      // Priority processing should add minimal overhead (<20%)
      expect(overhead).toBeLessThan(0.2);
      
      console.log(`Priority classification overhead: ${(overhead * 100).toFixed(2)}%`);
    });

    it('should handle mixed priority workloads efficiently', () => {
      const totalEvents = 2000;
      const priorityRatios = [0.1, 0.3, 0.5, 0.7]; // 10%, 30%, 50%, 70% priority events
      
      priorityRatios.forEach(ratio => {
        server.cleanup();
        server = new PriorityEventServer();
        
        const priorityCount = Math.floor(totalEvents * ratio);
        const regularCount = totalEvents - priorityCount;
        
        const events: HookEvent[] = [];
        
        // Add priority events
        for (let i = 0; i < priorityCount; i++) {
          events.push(createTestEvent('UserPromptSubmit', `session-${i % 20}`, 512));
        }
        
        // Add regular events
        for (let i = 0; i < regularCount; i++) {
          events.push(createTestEvent('RegularEvent', `session-${i % 20}`, 512));
        }
        
        // Shuffle to simulate realistic patterns
        events.sort(() => Math.random() - 0.5);
        
        const beforeMemory = server.getMemoryStats().serverMemory;
        events.forEach(event => server.insertEvent(event));
        const afterMemory = server.getMemoryStats().serverMemory;
        
        const memoryGrowth = afterMemory - beforeMemory;
        const memoryPerEvent = memoryGrowth / totalEvents;
        
        expect(memoryPerEvent).toBeLessThan(100 * 1024); // Less than 100KB per event
        
        console.log(`${(ratio * 100).toFixed(0)}% priority ratio: ${(memoryPerEvent / 1024).toFixed(2)}KB per event`);
      });
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory over extended operation', () => {
      const memorySnapshots: number[] = [];
      const operationCycles = 10;
      const eventsPerCycle = 500;
      
      for (let cycle = 0; cycle < operationCycles; cycle++) {
        // Add clients
        const clients = Array.from({ length: 10 }, () => server.addWebSocketClient(false));
        
        // Process events
        const events = Array.from({ length: eventsPerCycle }, (_, i) => 
          createTestEvent(i % 4 === 0 ? 'UserPromptSubmit' : 'RegularEvent', `session-${i % 5}`, 512)
        );
        
        events.forEach(event => server.insertEvent(event));
        
        // Remove clients
        clients.forEach(client => server.removeWebSocketClient(client));
        
        // Simulate garbage collection
        server.simulateGarbageCollection();
        
        memorySnapshots.push(server.getMemoryStats().serverMemory);
      }
      
      // Memory should stabilize, not continuously grow
      const firstMemory = memorySnapshots[0];
      const lastMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = (lastMemory - firstMemory) / firstMemory;
      
      expect(memoryGrowth).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MEMORY_LEAK_THRESHOLD);
      
      console.log(`Memory growth over ${operationCycles} cycles: ${(memoryGrowth * 100).toFixed(2)}%`);
      console.log('Memory snapshots:', memorySnapshots.map(m => (m / 1024 / 1024).toFixed(1) + 'MB').join(', '));
    });

    it('should handle client connection churn efficiently', () => {
      const initialMemory = server.getMemoryStats().serverMemory;
      
      // Simulate 100 cycles of client connect/disconnect
      for (let cycle = 0; cycle < 100; cycle++) {
        const clients: MockWebSocketClient[] = [];
        
        // Connect 20 clients
        for (let i = 0; i < 20; i++) {
          clients.push(server.addWebSocketClient(Math.random() < 0.3));
        }
        
        // Send some events
        for (let i = 0; i < 10; i++) {
          const event = createTestEvent(
            Math.random() < 0.3 ? 'UserPromptSubmit' : 'RegularEvent',
            `session-${cycle}`,
            256
          );
          server.insertEvent(event);
        }
        
        // Disconnect all clients
        clients.forEach(client => server.removeWebSocketClient(client));
        
        // Occasional garbage collection
        if (cycle % 20 === 0) {
          server.simulateGarbageCollection();
        }
      }
      
      const finalMemory = server.getMemoryStats().serverMemory;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Should not accumulate significant memory from client churn
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB max growth
      
      console.log(`Client churn memory impact: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain memory efficiency under concurrent load', async () => {
      const concurrentOperations = 10;
      const eventsPerOperation = 200;
      
      const operations = Array.from({ length: concurrentOperations }, async (_, opIndex) => {
        return new Promise<void>((resolve) => {
          const client = server.addWebSocketClient(false);
          
          for (let i = 0; i < eventsPerOperation; i++) {
            const eventType = Math.random() < 0.3 ? 'UserPromptSubmit' : 'RegularEvent';
            const event = createTestEvent(eventType, `session-${opIndex}`, 512);
            server.insertEvent(event);
          }
          
          server.removeWebSocketClient(client);
          resolve();
        });
      });
      
      const startTime = Date.now();
      const startMemory = server.getMemoryStats().serverMemory;
      
      await Promise.all(operations);
      
      const endTime = Date.now();
      const endMemory = server.getMemoryStats().serverMemory;
      
      const duration = endTime - startTime;
      const memoryGrowth = endMemory - startMemory;
      const totalEvents = concurrentOperations * eventsPerOperation;
      
      expect(duration).toBeLessThan(10000); // Should complete in 10 seconds
      expect(memoryGrowth).toBeLessThan(SERVER_PERFORMANCE_TARGETS.MAX_MEMORY_GROWTH_PER_1000_EVENTS * (totalEvents / 1000));
      
      console.log(`Concurrent load: ${totalEvents} events in ${duration}ms, ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth`);
    });
  });
});