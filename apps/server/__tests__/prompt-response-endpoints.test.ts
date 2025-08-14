/**
 * HTTP Endpoint Tests for Agent Prompt/Response API  
 * JuanNebula - Backend API Engineer
 * 
 * Tests for the new HTTP endpoints that handle agent prompts and responses
 */

import { expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, teardownTestDatabase } from './test-setup';
import type { 
  UpdateAgentDataRequest,
  ValidationError
} from '../src/types';

// Test server setup
let testServer: any;
let testPort: number;
let baseUrl: string;

describe('Agent Prompt/Response HTTP API Endpoints', () => {
  beforeAll(async () => {
    // Start test server on different port from main server
    testPort = 4002; // Different from main server (4000) and other tests (4001)
    baseUrl = `http://localhost:${testPort}`;
    
    // Note: Using existing server for integration testing
    // In a real scenario, we'd start a separate test server instance
  });

  afterAll(async () => {
    // Cleanup test server if needed
    if (testServer) {
      testServer.stop();
    }
  });

  beforeEach(() => {
    setupTestDatabase();
    baseUrl = 'http://localhost:4000'; // Use main server for integration tests
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  describe('PATCH /subagents/{sessionId}/{name}', () => {
    test('should store agent prompt successfully', async () => {
      const sessionId = 'prompt-test-session';
      const agentName = 'PromptTestAgent';
      const prompt = 'Your name is PromptTestAgent. Build a user authentication system with JWT tokens, input validation, and comprehensive error handling. Focus on security best practices and maintainable code structure.';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: prompt
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toContain('initial_prompt');
      expect(data.message).toContain('PromptTestAgent');
    });

    test('should store agent response successfully', async () => {
      const sessionId = 'response-test-session';
      const agentName = 'ResponseTestAgent';
      const response_text = 'Authentication system implemented successfully. Created JWT-based auth with:\n\n- User registration/login endpoints\n- Token validation middleware\n- Password hashing with bcrypt\n- Input validation with Joi\n- Error handling middleware\n- Rate limiting protection\n\nAll tests passing: 25/25 ✅\nSecurity audit completed ✅\nDocumentation updated ✅';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        final_response: response_text
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toContain('final_response');
    });

    test('should store both prompt and response in single request', async () => {
      const sessionId = 'full-update-session';
      const agentName = 'FullUpdateAgent';
      const prompt = 'Create a todo application with CRUD operations';
      const response_text = 'Todo application completed with full CRUD functionality';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: prompt,
        final_response: response_text
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toContain('initial_prompt');
      expect(data.updated_fields).toContain('final_response');
      expect(data.updated_fields).toHaveLength(2);
    });

    test('should validate text size limits (1MB max)', async () => {
      const sessionId = 'size-limit-session';
      const agentName = 'SizeLimitAgent';
      const oversizedPrompt = 'A'.repeat(1024 * 1024 + 1); // 1MB + 1 byte
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: oversizedPrompt
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.validation_errors).toHaveLength(1);
      expect(data.validation_errors[0].field).toBe('initial_prompt');
      expect(data.validation_errors[0].code).toBe('TEXT_TOO_LONG');
    });

    test('should handle multiple validation errors', async () => {
      const sessionId = 'multi-error-session';
      const agentName = 'MultiErrorAgent';
      const oversizedPrompt = 'P'.repeat(1024 * 1024 + 1);
      const oversizedResponse = 'R'.repeat(1024 * 1024 + 1);
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: oversizedPrompt,
        final_response: oversizedResponse
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.validation_errors).toHaveLength(2);
      
      const promptError = data.validation_errors.find((e: ValidationError) => e.field === 'initial_prompt');
      const responseError = data.validation_errors.find((e: ValidationError) => e.field === 'final_response');
      
      expect(promptError).toBeDefined();
      expect(responseError).toBeDefined();
    });

    test('should return 404 for nonexistent agent', async () => {
      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: 'Some prompt for nonexistent agent'
      };

      const response = await fetch(`${baseUrl}/subagents/fake-session/FakeAgent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Agent not found');
    });

    test('should handle invalid path format', async () => {
      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: 'Some prompt'
      };

      const response = await fetch(`${baseUrl}/subagents/invalid-path`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Invalid path format');
    });

    test('should handle invalid JSON payload', async () => {
      const sessionId = 'json-error-session';
      const agentName = 'JsonErrorAgent';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json content'
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid JSON payload');
    });

    test('should handle empty update request', async () => {
      const sessionId = 'empty-update-session';
      const agentName = 'EmptyUpdateAgent';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        // No fields to update
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toHaveLength(0);
    });

    test('should handle special characters and unicode', async () => {
      const sessionId = 'unicode-update-session';
      const agentName = 'UnicodeAgent';
      const unicodePrompt = 'Task with unicode: 🚀 中文 العربية and special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const unicodeResponse = 'Response with newlines:\n\nCode snippet:\n```typescript\nconst msg = "Hello, 世界!";\n```\n\nSuccess! ✅';
      
      // Register agent first
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const updateRequest: UpdateAgentDataRequest = {
        initial_prompt: unicodePrompt,
        final_response: unicodeResponse
      };

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toHaveLength(2);
    });
  });

  describe('GET /subagents/{sessionId}/{name}/full', () => {
    test('should return complete agent data with prompt/response', async () => {
      const sessionId = 'full-get-session';
      const agentName = 'FullGetAgent';
      const prompt = 'Build a REST API with authentication';
      const response_text = 'REST API completed with JWT authentication, CRUD endpoints, and comprehensive tests';
      
      // Register agent
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });
      
      // Store prompt and response
      await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: prompt,
          final_response: response_text
        })
      });

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}/full`);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.name).toBe(agentName);
      expect(data.session_id).toBe(sessionId);
      expect(data.initial_prompt).toBe(prompt);
      expect(data.final_response).toBe(response_text);
      expect(data.prompt_length).toBe(prompt.length);
      expect(data.response_length).toBe(response_text.length);
      expect(data.has_prompt).toBe(true);
      expect(data.has_response).toBe(true);
      
      // Should have standard agent fields too
      expect(data.id).toBeGreaterThan(0);
      expect(data.subagent_type).toBe('engineer');
      expect(data.created_at).toBeGreaterThan(0);
    });

    test('should return agent data without prompt/response', async () => {
      const sessionId = 'empty-full-session';
      const agentName = 'EmptyFullAgent';
      
      // Register agent without storing prompt/response
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'tester'
        })
      });

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}/full`);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.name).toBe(agentName);
      expect(data.initial_prompt).toBeNull();
      expect(data.final_response).toBeNull();
      expect(data.prompt_length).toBe(0);
      expect(data.response_length).toBe(0);
      expect(data.has_prompt).toBe(false);
      expect(data.has_response).toBe(false);
    });

    test('should return 404 for nonexistent agent', async () => {
      const response = await fetch(`${baseUrl}/subagents/fake-session/FakeAgent/full`);

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Agent not found');
    });

    test('should handle invalid path format', async () => {
      const response = await fetch(`${baseUrl}/subagents/invalid/path/structure/not-full`);

      expect(response.status).toBe(404); // Falls through to default handler
    });

    test('should include cache headers', async () => {
      const sessionId = 'cache-test-session';
      const agentName = 'CacheTestAgent';
      
      // Register agent
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}/full`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    });
  });

  describe('Integration with existing GET /subagents/{sessionId}', () => {
    test('should include prompt/response fields in session agent list', async () => {
      const sessionId = 'integration-list-session';
      const agent1Name = 'IntegrationAgent1';
      const agent2Name = 'IntegrationAgent2';
      
      const prompt1 = 'Task 1: Build frontend components';
      const response1 = 'Frontend components completed successfully';
      const prompt2 = 'Task 2: Write backend API';
      const response2 = 'Backend API implemented with full CRUD operations';
      
      // Register agents
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agent1Name,
          subagent_type: 'engineer'
        })
      });
      
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agent2Name,
          subagent_type: 'engineer'
        })
      });
      
      // Store prompts and responses
      await fetch(`${baseUrl}/subagents/${sessionId}/${agent1Name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: prompt1,
          final_response: response1
        })
      });
      
      await fetch(`${baseUrl}/subagents/${sessionId}/${agent2Name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: prompt2,
          final_response: response2
        })
      });

      const response = await fetch(`${baseUrl}/subagents/${sessionId}`);

      expect(response.status).toBe(200);
      
      const agents = await response.json();
      expect(agents).toHaveLength(2);
      
      const agent1 = agents.find((a: any) => a.name === agent1Name);
      const agent2 = agents.find((a: any) => a.name === agent2Name);
      
      expect(agent1?.initial_prompt).toBe(prompt1);
      expect(agent1?.final_response).toBe(response1);
      expect(agent2?.initial_prompt).toBe(prompt2);
      expect(agent2?.final_response).toBe(response2);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent PATCH requests', async () => {
      const sessionId = 'concurrent-patch-session';
      const agentCount = 5;
      const promises: Promise<Response>[] = [];
      
      // Register agents first
      for (let i = 1; i <= agentCount; i++) {
        await fetch(`${baseUrl}/subagents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: `ConcurrentAgent${i}`,
            subagent_type: 'engineer'
          })
        });
      }
      
      // Concurrent PATCH requests
      for (let i = 1; i <= agentCount; i++) {
        promises.push(
          fetch(`${baseUrl}/subagents/${sessionId}/ConcurrentAgent${i}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              initial_prompt: `Prompt for agent ${i}`,
              final_response: `Response from agent ${i}`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Verify all data was stored
      const listResponse = await fetch(`${baseUrl}/subagents/${sessionId}`);
      const agents = await listResponse.json();
      
      expect(agents).toHaveLength(agentCount);
      agents.forEach((agent: any, index: number) => {
        const agentNum = agentCount - index; // Due to DESC ordering
        expect(agent.initial_prompt).toBe(`Prompt for agent ${agentNum}`);
        expect(agent.final_response).toBe(`Response from agent ${agentNum}`);
      });
    });

    test('should handle large but valid payloads efficiently', async () => {
      const sessionId = 'large-payload-session';
      const agentName = 'LargePayloadAgent';
      const largePrompt = 'Large prompt: ' + 'A'.repeat(500000); // 500KB
      const largeResponse = 'Large response: ' + 'B'.repeat(500000); // 500KB
      
      // Register agent
      await fetch(`${baseUrl}/subagents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });
      
      const startTime = Date.now();
      
      const response = await fetch(`${baseUrl}/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: largePrompt,
          final_response: largeResponse
        })
      });
      
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toHaveLength(2);
    });
  });
});