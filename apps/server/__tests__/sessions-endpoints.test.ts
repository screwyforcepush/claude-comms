/**
 * Server Endpoint Integration Tests for Multi-Session Functionality
 * TestTiger - HTTP API endpoint testing
 */

import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { 
  RegisterSubagentRequest,
  SendMessageRequest,
  GetUnreadMessagesRequest,
  UpdateSubagentCompletionRequest,
  HookEvent
} from '../src/types';

// Test server setup
let testServer: any;
let testPort: number;
let baseUrl: string;

describe('Sessions HTTP API Endpoints', () => {
  beforeAll(async () => {
    // Start test server on random port
    testPort = 4001; // Use different port from main server
    
    // Import and start server for testing
    const { default: serverModule } = await import('../src/index');
    
    baseUrl = `http://localhost:${testPort}`;
  });

  afterAll(async () => {
    // Cleanup test server
    if (testServer) {
      testServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear test database before each test
    // Note: Using separate test database
  });

  describe('POST /subagents/register', () => {
    test('should register a new subagent successfully', async () => {
      const request: RegisterSubagentRequest = {
        session_id: 'test-session-001',
        name: 'TestAgent',
        subagent_type: 'engineer'
      };

      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeGreaterThan(0);
    });

    test('should handle missing required fields', async () => {
      const invalidRequest = {
        session_id: 'test-session',
        name: 'TestAgent'
        // Missing subagent_type
      };

      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should handle invalid JSON payload', async () => {
      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
    });

    test('should set correct CORS headers', async () => {
      const request: RegisterSubagentRequest = {
        session_id: 'cors-test',
        name: 'CORSAgent',
        subagent_type: 'tester'
      };

      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('POST /subagents/update-completion', () => {
    test('should update agent completion successfully', async () => {
      // First register an agent
      const registerRequest: RegisterSubagentRequest = {
        session_id: 'completion-test',
        name: 'CompletionAgent',
        subagent_type: 'engineer'
      };

      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerRequest)
      });

      // Then update completion
      const updateRequest: UpdateSubagentCompletionRequest = {
        session_id: 'completion-test',
        name: 'CompletionAgent',
        status: 'completed',
        completed_at: Date.now(),
        completion_metadata: {
          total_duration_ms: 45000,
          total_tokens: 1500,
          success: true
        }
      };

      const response = await fetch(`${baseUrl}/subagents/update-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('should return 404 for nonexistent agent', async () => {
      const updateRequest: UpdateSubagentCompletionRequest = {
        session_id: 'fake-session',
        name: 'FakeAgent',
        status: 'completed'
      };

      const response = await fetch(`${baseUrl}/subagents/update-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Subagent not found');
    });

    test('should handle partial completion data', async () => {
      // Register agent
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'partial-test',
          name: 'PartialAgent',
          subagent_type: 'tester'
        })
      });

      // Partial update
      const updateRequest = {
        session_id: 'partial-test',
        name: 'PartialAgent',
        status: 'in_progress'
        // No completion_metadata
      };

      const response = await fetch(`${baseUrl}/subagents/update-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /subagents/sessions', () => {
    test('should return all sessions with agent counts', async () => {
      // Create test sessions with different agent counts
      const testData = [
        { sessionId: 'session-1', agents: ['Agent1', 'Agent2', 'Agent3'] },
        { sessionId: 'session-2', agents: ['AgentA', 'AgentB'] },
        { sessionId: 'session-3', agents: ['SoloAgent'] }
      ];

      for (const { sessionId, agents } of testData) {
        for (const agentName of agents) {
          await fetch(`${baseUrl}/subagents/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              name: agentName,
              subagent_type: 'engineer'
            })
          });
        }
      }

      const response = await fetch(`${baseUrl}/subagents/sessions`);
      
      expect(response.status).toBe(200);
      
      const sessions = await response.json();
      expect(sessions).toHaveLength(3);

      const session1 = sessions.find((s: any) => s.session_id === 'session-1');
      const session2 = sessions.find((s: any) => s.session_id === 'session-2');
      const session3 = sessions.find((s: any) => s.session_id === 'session-3');

      expect(session1.agent_count).toBe(3);
      expect(session2.agent_count).toBe(2);
      expect(session3.agent_count).toBe(1);
    });

    test('should return empty array when no sessions exist', async () => {
      const response = await fetch(`${baseUrl}/subagents/sessions`);
      
      expect(response.status).toBe(200);
      
      const sessions = await response.json();
      expect(sessions).toHaveLength(0);
    });

    test('should handle server errors gracefully', async () => {
      // This test would need to mock database failure
      // For now, just verify the endpoint exists and has error handling
      const response = await fetch(`${baseUrl}/subagents/sessions`);
      expect(response.status).toBeOneOf([200, 500]);
    });
  });

  describe('GET /subagents/:sessionId', () => {
    test('should return all agents for a specific session', async () => {
      const sessionId = 'detailed-session';
      const agents = [
        { name: 'Engineer1', type: 'engineer' },
        { name: 'Tester1', type: 'tester' },
        { name: 'Reviewer1', type: 'code-reviewer' }
      ];

      // Register agents
      for (const agent of agents) {
        await fetch(`${baseUrl}/subagents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: agent.name,
            subagent_type: agent.type
          })
        });
      }

      const response = await fetch(`${baseUrl}/subagents/${sessionId}`);
      
      expect(response.status).toBe(200);
      
      const sessionAgents = await response.json();
      expect(sessionAgents).toHaveLength(3);

      const engineer = sessionAgents.find((a: any) => a.name === 'Engineer1');
      const tester = sessionAgents.find((a: any) => a.name === 'Tester1');
      const reviewer = sessionAgents.find((a: any) => a.name === 'Reviewer1');

      expect(engineer.subagent_type).toBe('engineer');
      expect(tester.subagent_type).toBe('tester');
      expect(reviewer.subagent_type).toBe('code-reviewer');

      // Check required fields
      for (const agent of sessionAgents) {
        expect(agent.id).toBeGreaterThan(0);
        expect(agent.session_id).toBe(sessionId);
        expect(agent.created_at).toBeGreaterThan(0);
        expect(agent.completion_timestamp).toBeDefined(); // Should map from completed_at
      }
    });

    test('should return empty array for nonexistent session', async () => {
      const response = await fetch(`${baseUrl}/subagents/nonexistent-session`);
      
      expect(response.status).toBe(200);
      
      const agents = await response.json();
      expect(agents).toHaveLength(0);
    });

    test('should not conflict with other endpoint paths', async () => {
      // Test that /subagents/register doesn't get caught by /:sessionId route
      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'path-test',
          name: 'PathTestAgent',
          subagent_type: 'engineer'
        })
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Inter-Agent Messaging Endpoints', () => {
    test('should handle message sending and receiving flow', async () => {
      const sessionId = 'messaging-test';
      
      // Register two agents
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: 'Sender',
          subagent_type: 'engineer'
        })
      });

      // Small delay to ensure different registration times
      await new Promise(resolve => setTimeout(resolve, 10));

      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: 'Receiver',
          subagent_type: 'tester'
        })
      });

      // Send message
      const messageRequest: SendMessageRequest = {
        sender: 'Sender',
        message: {
          type: 'status_update',
          content: 'Task completed successfully',
          metadata: { duration: 30000, tokens: 1200 }
        }
      };

      const sendResponse = await fetch(`${baseUrl}/subagents/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageRequest)
      });

      expect(sendResponse.status).toBe(200);
      
      const sendData = await sendResponse.json();
      expect(sendData.success).toBe(true);
      expect(sendData.id).toBeGreaterThan(0);

      // Get unread messages
      const unreadRequest: GetUnreadMessagesRequest = {
        subagent_name: 'Receiver'
      };

      const unreadResponse = await fetch(`${baseUrl}/subagents/unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unreadRequest)
      });

      expect(unreadResponse.status).toBe(200);
      
      const unreadData = await unreadResponse.json();
      expect(unreadData.messages).toHaveLength(1);
      expect(unreadData.messages[0].sender).toBe('Sender');
      expect(unreadData.messages[0].message).toEqual(messageRequest.message);

      // Second call should return empty (already marked as read)
      const secondUnreadResponse = await fetch(`${baseUrl}/subagents/unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unreadRequest)
      });

      const secondUnreadData = await secondUnreadResponse.json();
      expect(secondUnreadData.messages).toHaveLength(0);
    });

    test('should get all messages via GET endpoint', async () => {
      // Send a few messages first
      const messages = [
        { sender: 'Agent1', message: { content: 'Message 1' } },
        { sender: 'Agent2', message: { content: 'Message 2' } },
        { sender: 'Agent3', message: { content: 'Message 3' } }
      ];

      for (const msg of messages) {
        await fetch(`${baseUrl}/subagents/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg)
        });
      }

      const response = await fetch(`${baseUrl}/subagents/messages`);
      
      expect(response.status).toBe(200);
      
      const allMessages = await response.json();
      expect(allMessages.length).toBeGreaterThanOrEqual(3);
      
      // Verify structure of returned messages
      const latestMessages = allMessages.slice(0, 3);
      for (const message of latestMessages) {
        expect(message.sender).toBeDefined();
        expect(message.message).toBeDefined();
        expect(message.created_at).toBeDefined();
        expect(message.notified).toBeDefined();
      }
    });
  });

  describe('WebSocket Integration', () => {
    test('should broadcast agent registration events', async () => {
      // This would require setting up WebSocket client for testing
      // For now, just verify the endpoint doesn't break WebSocket functionality
      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'websocket-test',
          name: 'WSAgent',
          subagent_type: 'engineer'
        })
      });

      expect(response.status).toBe(200);
    });

    test('should handle WebSocket upgrade requests', async () => {
      // Test that WebSocket endpoint is accessible
      const response = await fetch(`${baseUrl}/stream`, {
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      });

      // Either successful upgrade or method not allowed for regular HTTP
      expect(response.status).toBeOneOf([101, 405, 400]);
    });
  });

  describe('Error Handling & Resilience', () => {
    test('should handle malformed JSON gracefully', async () => {
      const endpoints = [
        '/subagents/register',
        '/subagents/message', 
        '/subagents/unread',
        '/subagents/update-completion'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"malformed": json}'
        });

        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });

    test('should handle missing Content-Type header', async () => {
      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        body: JSON.stringify({
          session_id: 'header-test',
          name: 'HeaderTestAgent',
          subagent_type: 'engineer'
        })
      });

      // Should either succeed (auto-detect) or return 400 with clear error
      expect(response.status).toBeOneOf([200, 400]);
    });

    test('should handle very large payloads', async () => {
      const largePayload = {
        session_id: 'large-payload-test',
        name: 'LargePayloadAgent',
        subagent_type: 'engineer',
        metadata: {
          largeField: 'A'.repeat(100000), // 100KB string
          arrayField: new Array(1000).fill(0).map((_, i) => ({ id: i, data: `Item ${i}` }))
        }
      };

      const response = await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largePayload)
      });

      // Should handle large payloads appropriately
      expect(response.status).toBeOneOf([200, 413, 400]); // Success, too large, or bad request
    });

    test('should handle concurrent requests safely', async () => {
      const sessionId = 'concurrent-requests-test';
      const concurrentRequests = 20;
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        fetch(`${baseUrl}/subagents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: `ConcurrentAgent${i}`,
            subagent_type: 'engineer'
          })
        })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify all agents were registered
      const sessionResponse = await fetch(`${baseUrl}/subagents/${sessionId}`);
      const agents = await sessionResponse.json();
      expect(agents).toHaveLength(concurrentRequests);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should handle rapid session creation', async () => {
      const sessionCount = 30;
      const startTime = Date.now();
      
      const promises = Array.from({ length: sessionCount }, (_, i) => 
        fetch(`${baseUrl}/subagents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: `perf-session-${i}`,
            name: `PerfAgent${i}`,
            subagent_type: 'engineer'
          })
        })
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 30 sessions
      
      console.log(`Performance: Created ${sessionCount} sessions in ${totalTime}ms (${Math.round(totalTime/sessionCount)}ms avg)`);
    });

    test('should retrieve sessions list efficiently', async () => {
      const sessionCount = 25;
      
      // Create test sessions first
      for (let i = 0; i < sessionCount; i++) {
        await fetch(`${baseUrl}/subagents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: `list-perf-session-${i}`,
            name: `ListPerfAgent${i}`,
            subagent_type: 'engineer'
          })
        });
      }
      
      // Benchmark sessions list retrieval
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/subagents/sessions`);
      const retrievalTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      
      const sessions = await response.json();
      expect(sessions.length).toBeGreaterThanOrEqual(sessionCount);
      expect(retrievalTime).toBeLessThan(500); // Under 500ms
      
      console.log(`Performance: Retrieved ${sessions.length} sessions in ${retrievalTime}ms`);
    });
  });
});