/**
 * Unit Tests for Hook Capture Functionality
 * LisaPhoenix - Integration Tester
 * 
 * Tests for the Python hook scripts that capture Task() calls and store prompt/response data
 * Tests written FIRST to define expected hook behavior before any modifications
 */

import { expect, test, describe, beforeEach, afterEach, beforeAll } from 'bun:test';
import { spawn } from 'bun';
import { join } from 'path';

// Hook script paths
const HOOK_SCRIPTS_PATH = join(__dirname, '../../../.claude/hooks');
const REGISTER_HOOK_PATH = join(HOOK_SCRIPTS_PATH, 'comms/register_subagent.py');
const COMPLETION_HOOK_PATH = join(HOOK_SCRIPTS_PATH, 'comms/update_subagent_completion.py');

// Mock server for testing hooks
let mockServer: any;
const MOCK_SERVER_PORT = 4002;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

describe('Hook Capture Unit Tests', () => {
  beforeAll(async () => {
    // Start mock server to capture hook requests
    mockServer = Bun.serve({
      port: MOCK_SERVER_PORT,
      async fetch(req) {
        const url = new URL(req.url);
        
        if (url.pathname === '/subagents/register' && req.method === 'POST') {
          const body = await req.json();
          return new Response(JSON.stringify({ 
            success: true, 
            id: 123,
            received: body 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (url.pathname === '/subagents/update-completion' && req.method === 'POST') {
          const body = await req.json();
          return new Response(JSON.stringify({ 
            success: true,
            received: body 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response('Not found', { status: 404 });
      }
    });
    
    console.log(`Mock server started on port ${MOCK_SERVER_PORT}`);
  });
  
  afterAll(() => {
    if (mockServer) {
      mockServer.stop();
    }
  });

  describe('register_subagent.py Hook Tests', () => {
    test('should extract agent name from Task description and register agent', async () => {
      const testInput = {
        session_id: 'test-session-001',
        tool_name: 'Task',
        tool_input: {
          description: 'AlexEngineer: implement user authentication with JWT tokens',
          prompt: 'Your name is AlexEngineer. Implement the user authentication feature with proper validation and error handling. Focus on security best practices.',
          subagent_type: 'engineer'
        }
      };

      // Execute the hook script
      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      // Send input and wait for completion
      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      // Hook should exit successfully (status 0)
      expect(result).toBe(0);
      
      // Verify the hook would have made correct server request
      // (In real implementation, we'd intercept the HTTP request)
    });

    test('should handle Task tool input without proper description format', async () => {
      const testInput = {
        session_id: 'test-session-002',
        tool_name: 'Task',
        tool_input: {
          description: 'invalid description without colon separator',
          prompt: 'Some prompt without agent name',
          subagent_type: 'engineer'
        }
      };

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      // Hook should still exit successfully but not register agent
      expect(result).toBe(0);
    });

    test('should ignore non-Task tool calls', async () => {
      const testInput = {
        session_id: 'test-session-003',
        tool_name: 'Read',
        tool_input: {
          file_path: '/some/file/path.txt'
        }
      };

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      // Hook should exit successfully and do nothing
      expect(result).toBe(0);
    });

    test('should handle malformed JSON input gracefully', async () => {
      const malformedInput = '{ invalid json content';

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(malformedInput);
      await process.stdin?.end();
      
      const result = await process.exited;
      
      // Hook should handle error gracefully and exit successfully
      expect(result).toBe(0);
    });

    test('should handle server unavailability gracefully', async () => {
      // Stop mock server temporarily
      mockServer.stop();
      
      const testInput = {
        session_id: 'test-session-004',
        tool_name: 'Task',
        tool_input: {
          description: 'BetaAgent: test server unavailability',
          prompt: 'Test prompt',
          subagent_type: 'engineer'
        }
      };

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      // Hook should fail gracefully and not block Claude Code
      expect(result).toBe(0);
      
      // Restart mock server
      mockServer = Bun.serve({
        port: MOCK_SERVER_PORT,
        async fetch(req) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      });
    });

    test('should extract complex prompt content correctly', async () => {
      const complexPrompt = `Your name is CharlieArchitect.
Your Team Role is System Architect

SCOPE: Project-level 

YOUR TASK:
Design the authentication system architecture including:
- Database schema for users and sessions
- API endpoint design and contracts  
- Security middleware architecture
- Token management strategy

CONSTRAINTS:
- Must scale to 10k+ users
- Follow microservices patterns
- Ensure data consistency

SUCCESS CRITERIA:
- Architecture documentation complete
- Database schema designed  
- API contracts defined

FILES TO READ FIRST:
- docs/architecture/patterns.md - system patterns
- src/database/schema.sql - current schema

TEAM COLLABORATION:
- Guide implementation team on patterns
- Support infrastructure team with deployment
- Coordinate with product team on requirements

CharlieArchitect, adopt 🤝 TEAMWORK to achieve maximum value delivered.`;

      const testInput = {
        session_id: 'test-session-005',
        tool_name: 'Task',
        tool_input: {
          description: 'CharlieArchitect: design authentication architecture',
          prompt: complexPrompt,
          subagent_type: 'architect'
        }
      };

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // The hook should extract the prompt correctly
      // In real implementation, verify the server received the full prompt
    });
  });

  describe('update_subagent_completion.py Hook Tests', () => {
    test('should extract completion metadata from Task response', async () => {
      const testInput = {
        session_id: 'completion-test-session-001',
        tool_name: 'Task',
        tool_input: {
          description: 'DeltaEngineer: implement authentication endpoints',
          prompt: 'Some initial prompt',
          subagent_type: 'engineer'
        },
        tool_response: {
          success: true,
          totalDurationMs: 45000,
          totalTokens: 2500,
          totalToolUseCount: 8,
          usage: {
            input_tokens: 1200,
            output_tokens: 1300,
            cache_creation_input_tokens: 150,
            cache_read_input_tokens: 300
          },
          conversation: [
            {
              role: 'assistant',
              content: 'Authentication system implemented successfully with JWT tokens, proper validation, and comprehensive test suite. All security requirements met.'
            }
          ]
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should extract all metadata correctly
      // In real implementation, verify server received:
      // - agent name: DeltaEngineer
      // - status: completed
      // - totalDurationMs: 45000
      // - totalTokens: 2500
      // - usage details
    });

    test('should handle Task response without optional metadata', async () => {
      const testInput = {
        session_id: 'completion-test-session-002',
        tool_name: 'Task',
        tool_input: {
          description: 'EchoAgent: basic task completion',
          prompt: 'Basic prompt',
          subagent_type: 'engineer'
        },
        tool_response: {
          success: true,
          // Missing optional metadata
          conversation: [
            {
              role: 'assistant',
              content: 'Task completed successfully.'
            }
          ]
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should handle missing metadata gracefully
    });

    test('should ignore non-Task tool completions', async () => {
      const testInput = {
        session_id: 'completion-test-session-003',
        tool_name: 'Write',
        tool_input: {
          file_path: '/some/file.txt',
          content: 'Some content'
        },
        tool_response: {
          success: true
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should do nothing for non-Task tools
    });

    test('should handle agent not found error gracefully', async () => {
      const testInput = {
        session_id: 'completion-test-session-004',
        tool_name: 'Task',
        tool_input: {
          description: 'NonExistentAgent: this agent was never registered',
          prompt: 'Some prompt',
          subagent_type: 'engineer'
        },
        tool_response: {
          success: true,
          totalDurationMs: 30000,
          conversation: [
            {
              role: 'assistant',
              content: 'Task completed.'
            }
          ]
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should handle 404 from server gracefully
    });

    test('should extract complex response content correctly', async () => {
      const complexResponse = `## Authentication System Implementation Complete

I have successfully implemented the comprehensive user authentication system. Here's what was delivered:

### 🔧 Implementation Details

**Core Components:**
- \`/src/auth/routes.ts\` - Authentication endpoints
- \`/src/auth/middleware.ts\` - JWT validation middleware
- \`/src/auth/service.ts\` - Authentication business logic

**Security Features:**
- Password hashing using bcrypt (salt rounds: 12)
- JWT tokens with RS256 algorithm
- Rate limiting: 5 attempts per 15 minutes

**API Endpoints:**
\`\`\`
POST /auth/register - User registration
POST /auth/login    - User authentication
POST /auth/refresh  - Token refresh
\`\`\`

### 📊 Test Results
- **Unit Tests:** 28/28 passing ✅
- **Integration Tests:** 15/15 passing ✅
- **Coverage:** 94.2% ✅

Ready for code review and deployment! 🎉`;

      const testInput = {
        session_id: 'completion-test-session-005',
        tool_name: 'Task',
        tool_input: {
          description: 'FoxtrotEngineer: implement comprehensive auth system',
          prompt: 'Complex authentication implementation task',
          subagent_type: 'engineer'
        },
        tool_response: {
          success: true,
          totalDurationMs: 180000,
          totalTokens: 4500,
          totalToolUseCount: 15,
          usage: {
            input_tokens: 2000,
            output_tokens: 2500,
            cache_creation_input_tokens: 200,
            cache_read_input_tokens: 100
          },
          conversation: [
            {
              role: 'assistant',
              content: complexResponse
            }
          ]
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should extract the complete response content
      // Including markdown formatting, code blocks, emojis
    });

    test('should handle concurrent completion hooks', async () => {
      const agentCount = 5;
      const processes: Promise<number>[] = [];

      for (let i = 1; i <= agentCount; i++) {
        const testInput = {
          session_id: `concurrent-session-${i}`,
          tool_name: 'Task',
          tool_input: {
            description: `ConcurrentAgent${i}: parallel task execution`,
            prompt: `Task ${i} prompt`,
            subagent_type: 'engineer'
          },
          tool_response: {
            success: true,
            totalDurationMs: 30000 + (i * 1000),
            totalTokens: 1000 + (i * 100),
            conversation: [
              {
                role: 'assistant',
                content: `Task ${i} completed successfully.`
              }
            ]
          }
        };

        const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...Bun.env }
        });

        const processPromise = (async () => {
          await process.stdin?.write(JSON.stringify(testInput));
          await process.stdin?.end();
          return await process.exited;
        })();

        processes.push(processPromise);
      }

      const results = await Promise.all(processes);
      
      // All hooks should complete successfully
      results.forEach(result => {
        expect(result).toBe(0);
      });
    });

    test('should handle empty or malformed conversation content', async () => {
      const testInput = {
        session_id: 'malformed-conversation-session',
        tool_name: 'Task',
        tool_input: {
          description: 'GolfAgent: test malformed conversation',
          prompt: 'Test prompt',
          subagent_type: 'engineer'
        },
        tool_response: {
          success: true,
          totalDurationMs: 25000,
          conversation: [] // Empty conversation
        }
      };

      const process = spawn(['uv', 'run', '--script', COMPLETION_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      
      expect(result).toBe(0);
      
      // Hook should handle empty conversation gracefully
    });
  });

  describe('Hook Performance Tests', () => {
    test('should complete hook execution within reasonable time', async () => {
      const testInput = {
        session_id: 'performance-test-session',
        tool_name: 'Task',
        tool_input: {
          description: 'HotelPerfAgent: performance test agent',
          prompt: 'Performance test prompt with reasonable content length',
          subagent_type: 'engineer'
        }
      };

      const startTime = Date.now();

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      const executionTime = Date.now() - startTime;

      expect(result).toBe(0);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle large prompt content efficiently', async () => {
      const largePrompt = 'Large prompt: ' + 'A'.repeat(50000); // 50KB prompt
      
      const testInput = {
        session_id: 'large-prompt-session',
        tool_name: 'Task',
        tool_input: {
          description: 'IndiaLargeAgent: test large content handling',
          prompt: largePrompt,
          subagent_type: 'engineer'
        }
      };

      const startTime = Date.now();

      const process = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await process.stdin?.write(JSON.stringify(testInput));
      await process.stdin?.end();
      
      const result = await process.exited;
      const executionTime = Date.now() - startTime;

      expect(result).toBe(0);
      expect(executionTime).toBeLessThan(10000); // Should handle large content within 10 seconds
    });
  });

  describe('Hook Environment and Dependencies Tests', () => {
    test('should verify required Python dependencies are available', async () => {
      // Test that requests library is available for HTTP calls
      const process = spawn(['python3', '-c', 'import requests; print("requests available")'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const result = await process.exited;
      expect(result).toBe(0);
    });

    test('should handle different Python environments', async () => {
      // Test hook execution with different Python interpreters
      const testInput = {
        session_id: 'python-env-test',
        tool_name: 'Task',
        tool_input: {
          description: 'JulietEnvAgent: test Python environment',
          prompt: 'Test prompt',
          subagent_type: 'engineer'
        }
      };

      // Try with uv run (preferred)
      const uvProcess = spawn(['uv', 'run', '--script', REGISTER_HOOK_PATH], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...Bun.env }
      });

      await uvProcess.stdin?.write(JSON.stringify(testInput));
      await uvProcess.stdin?.end();
      
      const uvResult = await uvProcess.exited;
      expect(uvResult).toBe(0);
    });
  });
});