/**
 * End-to-End Integration Tests for Prompt/Response Capture Flow
 * LisaPhoenix - Integration Tester
 * 
 * Comprehensive E2E tests verifying complete prompt/response data flow:
 * Hook Capture → Server Storage → Database → API Retrieval → UI Display
 */

import { expect, test, describe, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { setupTestDatabase, teardownTestDatabase } from './test-setup';
import { spawn } from 'bun';
import { join } from 'path';
import type { 
  UpdateAgentDataRequest,
  AgentPromptResponseData,
  HookEvent
} from '../src/types';

// Test configuration
const TEST_SERVER_PORT = 4001;
const TEST_BASE_URL = `http://localhost:${TEST_SERVER_PORT}`;
const HOOK_SCRIPTS_PATH = join(__dirname, '../../../.claude/hooks');

// Test server instance
let testServer: any;

// Test data factory for realistic scenarios
class TestDataFactory {
  static createRealisticAgentPrompt(agentName: string, taskType: string): string {
    const prompts = {
      engineer: `Your name is ${agentName}. 

SCOPE: Phase-level (phase-id: 03-UserAuth)

YOUR TASK:
Implement comprehensive user authentication system with JWT tokens, including:
- User registration and login endpoints
- Password hashing with bcrypt
- JWT token generation and validation
- Rate limiting and security middleware
- Input validation and error handling
- Comprehensive test suite with >90% coverage

CONSTRAINTS:
- Follow existing API patterns in the codebase
- Use TypeScript for type safety
- Implement proper error handling
- Follow security best practices

SUCCESS CRITERIA:
- All authentication endpoints working
- Security vulnerabilities addressed
- Tests passing with high coverage
- Documentation updated

FILES TO READ FIRST:
- src/auth/types.ts - auth interfaces
- src/middleware/validation.ts - validation patterns

TEAM COLLABORATION:
- Coordinate with backend team on API contracts
- Support frontend team with auth flow integration
- Leverage security expert guidance on best practices

${agentName}, adopt 🤝 TEAMWORK to achieve maximum value delivered.`,
      
      gatekeeper: `Your name is ${agentName}.
Your Team Role is Quality Assurance Reviewer

SCOPE: Project-level

YOUR TASK:
Review the user authentication implementation for:
- Code quality and maintainability
- Security vulnerabilities and best practices
- Test coverage and edge cases
- API design consistency
- Error handling patterns

CONSTRAINTS:
- Must verify all security requirements met
- Ensure test coverage >90%
- Validate proper error responses
- Check rate limiting implementation

SUCCESS CRITERIA:
- Security audit completed
- Code quality gates passed
- All tests passing
- Documentation reviewed and approved

TEAM COLLABORATION:
- Provide feedback to implementation team
- Support deployment team with security requirements
- Coordinate with architect on design decisions

${agentName}, adopt 🤝 TEAMWORK to achieve maximum value delivered.`,
      
      architect: `Your name is ${agentName}.
Your Team Role is System Architect

SCOPE: Project-level 

YOUR TASK:
Design the authentication system architecture including:
- Database schema for users and sessions
- API endpoint design and contracts
- Security middleware architecture
- Token management strategy
- Integration patterns with existing system

CONSTRAINTS:
- Must scale to 10k+ users
- Follow microservices patterns
- Ensure data consistency
- Consider future OAuth integration

SUCCESS CRITERIA:
- Architecture documentation complete
- Database schema designed
- API contracts defined
- Security model documented

TEAM COLLABORATION:
- Guide implementation team on patterns
- Support infrastructure team with deployment
- Coordinate with product team on requirements

${agentName}, adopt 🤝 TEAMWORK to achieve maximum value delivered.`
    };

    return prompts[taskType as keyof typeof prompts] || prompts.engineer;
  }

  static createRealisticAgentResponse(agentName: string, taskType: string): string {
    const responses = {
      engineer: `## Authentication System Implementation Complete

I have successfully implemented the comprehensive user authentication system. Here's what was delivered:

### 🔧 Implementation Details

**Core Components:**
- \`/src/auth/routes.ts\` - Authentication endpoints (register, login, refresh)
- \`/src/auth/middleware.ts\` - JWT validation middleware  
- \`/src/auth/service.ts\` - Authentication business logic
- \`/src/auth/models.ts\` - User and session data models
- \`/src/auth/validation.ts\` - Input validation schemas

**Security Features:**
- Password hashing using bcrypt (salt rounds: 12)
- JWT tokens with RS256 algorithm
- Rate limiting: 5 attempts per 15 minutes
- Input sanitization and validation
- CSRF protection headers
- Secure session management

**API Endpoints:**
\`\`\`
POST /auth/register - User registration
POST /auth/login    - User authentication  
POST /auth/refresh  - Token refresh
POST /auth/logout   - Session termination
GET  /auth/profile  - User profile (protected)
\`\`\`

### 📊 Test Results
- **Unit Tests:** 28/28 passing ✅
- **Integration Tests:** 15/15 passing ✅
- **Security Tests:** 8/8 passing ✅
- **Coverage:** 94.2% ✅

### 🔒 Security Audit Results
- ✅ Password strength validation
- ✅ SQL injection protection  
- ✅ XSS prevention
- ✅ Rate limiting active
- ✅ Secure token storage
- ✅ HTTPS enforcement

### 📚 Documentation Updated
- API documentation in \`docs/api/auth.md\`
- Security guide in \`docs/security/auth.md\`
- Integration examples in \`docs/examples/auth-flow.md\`

### 🚀 Deployment Ready
The authentication system is fully implemented, tested, and ready for production deployment. All security requirements met and documentation complete.

**Performance Metrics:**
- Login endpoint: ~45ms average response time
- JWT validation: ~2ms average
- Database queries optimized with proper indexing

Ready for code review and deployment! 🎉`,

      gatekeeper: `## Quality Assurance Review - Authentication System

I have completed a comprehensive review of the authentication implementation. Here's my assessment:

### ✅ Code Quality Assessment

**Architecture Review:**
- Clean separation of concerns ✅
- Proper error handling patterns ✅  
- Consistent API design ✅
- TypeScript types properly defined ✅
- Dependency injection implemented ✅

**Code Standards:**
- ESLint rules compliance: 100% ✅
- Prettier formatting: Consistent ✅
- Function complexity: All under 10 ✅
- Code duplication: <3% ✅

### 🔒 Security Audit

**Critical Security Checks:**
- ✅ SQL injection prevention verified
- ✅ XSS protection implemented
- ✅ Password hashing secure (bcrypt, 12 rounds)
- ✅ JWT tokens properly signed (RS256)
- ✅ Rate limiting configured (5/15min)
- ✅ Input validation comprehensive
- ✅ Error messages don't leak info
- ✅ HTTPS enforcement

**Vulnerability Scan Results:**
- 0 Critical vulnerabilities
- 0 High severity issues  
- 0 Medium severity issues
- 2 Low informational notices (acceptable)

### 📋 Test Coverage Analysis

**Coverage Metrics:**
- Line Coverage: 94.2% ✅
- Branch Coverage: 91.8% ✅ 
- Function Coverage: 100% ✅
- Statement Coverage: 94.1% ✅

**Test Quality:**
- All edge cases covered ✅
- Error scenarios tested ✅
- Performance tests included ✅
- Security tests comprehensive ✅

### 🚫 Issues Identified

**Minor Improvements Needed:**
1. Add retry logic for database connection failures
2. Improve error logging for token refresh failures
3. Add metrics collection for authentication events

**Recommendations:**
- Consider implementing OAuth 2.0 for future enhancement
- Add automated security scanning to CI/CD pipeline
- Monitor authentication metrics in production

### ✅ APPROVAL STATUS

**Final Verdict: APPROVED FOR PRODUCTION ✅**

The authentication system meets all quality gates:
- Security requirements: PASSED ✅
- Performance requirements: PASSED ✅  
- Code quality standards: PASSED ✅
- Test coverage requirements: PASSED ✅
- Documentation standards: PASSED ✅

Ready for deployment with confidence! 🚀`,

      architect: `## Authentication System Architecture Design

I have designed a comprehensive and scalable authentication architecture for the system. Here's the complete architectural blueprint:

### 🏗️ System Architecture Overview

**High-Level Design:**
\`\`\`
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Client    │───▶│  API Gateway │───▶│   Auth      │
│ Application │    │   (Rate      │    │  Service    │
└─────────────┘    │  Limiting)   │    └─────────────┘
                   └──────────────┘           │
                                             ▼
                   ┌──────────────┐    ┌─────────────┐
                   │   Session    │    │  User       │
                   │   Store      │    │ Database    │
                   │  (Redis)     │    │ (PostgreSQL)│
                   └──────────────┘    └─────────────┘
\`\`\`

### 🗄️ Database Schema Design

**Users Table:**
\`\`\`sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
\`\`\`

**Sessions Table:**
\`\`\`sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
\`\`\`

### 🔒 Security Architecture

**Token Strategy:**
- Access Token: JWT, 15-minute expiry, stateless
- Refresh Token: UUID, 30-day expiry, stored in database
- Token Rotation: New refresh token on each use
- Blacklist Support: Revoked tokens tracked

**Encryption Standards:**
- Password Hashing: bcrypt, cost factor 12
- JWT Signing: RS256 with 2048-bit keys
- Session IDs: Cryptographically secure random
- Database Encryption: AES-256 at rest

**Rate Limiting Strategy:**
\`\`\`
Login Attempts:     5 per 15 minutes per IP
Registration:       3 per hour per IP  
Password Reset:     2 per hour per email
Token Refresh:      10 per minute per user
Profile Updates:    20 per hour per user
\`\`\`

### 🚀 Scalability Design

**Horizontal Scaling:**
- Stateless authentication service
- Redis cluster for session storage
- Database read replicas
- CDN for static assets

**Performance Optimizations:**
- Connection pooling (10-50 connections)
- Query optimization with proper indexing
- Caching layer (Redis) for frequent lookups
- Lazy loading of user permissions

**Capacity Planning:**
- Target: 10,000+ concurrent users
- Login throughput: 1,000 requests/second
- Database connections: Auto-scaling 10-100
- Memory usage: ~2GB per service instance

### 🔄 Integration Patterns

**API Design:**
\`\`\`typescript
// Authentication Contract
interface AuthService {
  register(data: RegisterRequest): Promise<AuthResponse>
  login(credentials: LoginRequest): Promise<AuthResponse>
  refresh(token: string): Promise<TokenResponse>
  logout(sessionId: string): Promise<void>
  validateToken(token: string): Promise<UserContext>
}
\`\`\`

**Event-Driven Architecture:**
- User registration events
- Authentication success/failure events
- Password change events  
- Account lockout events
- Session expiry events

### 🔮 Future Extensibility

**OAuth 2.0 Preparation:**
- Abstract authentication interface
- Provider strategy pattern
- User account linking
- Social login integration points

**Multi-Factor Authentication:**
- TOTP support framework
- SMS/Email verification
- Backup code generation
- Device trust management

### 📊 Monitoring & Observability

**Key Metrics:**
- Authentication success/failure rates
- Token validation performance
- Session duration analytics
- Security event tracking
- System resource utilization

**Alerting Thresholds:**
- Login failure rate >20%
- Response time >500ms
- Database connection failures
- Suspicious login patterns
- Rate limit violations

### ✅ Implementation Roadmap

**Phase 1: Core Authentication (Complete)**
- Basic login/logout functionality
- JWT token implementation
- Password security

**Phase 2: Enhanced Security**
- Rate limiting implementation
- Session management
- Audit logging

**Phase 3: Scalability**
- Redis integration
- Database optimization
- Load balancing

**Phase 4: Advanced Features**  
- MFA implementation
- OAuth integration
- Advanced monitoring

The authentication architecture is designed for security, scalability, and maintainability. Ready to guide the implementation team! 🏗️`
    };

    return responses[taskType as keyof typeof responses] || responses.engineer;
  }

  static createTaskToolInput(agentName: string, taskType: string) {
    return {
      description: `${agentName}: ${taskType === 'engineer' ? 'implement user authentication' : taskType === 'gatekeeper' ? 'review authentication system' : 'design auth architecture'}`,
      prompt: this.createRealisticAgentPrompt(agentName, taskType),
      subagent_type: taskType
    };
  }

  static createTaskToolResponse(agentName: string, taskType: string) {
    return {
      success: true,
      totalDurationMs: Math.floor(Math.random() * 180000) + 30000, // 30s - 3min
      totalTokens: Math.floor(Math.random() * 5000) + 1000, // 1k - 6k tokens
      totalToolUseCount: Math.floor(Math.random() * 15) + 1, // 1-15 tools
      usage: {
        input_tokens: Math.floor(Math.random() * 3000) + 500,
        output_tokens: Math.floor(Math.random() * 2000) + 500,
        cache_creation_input_tokens: Math.floor(Math.random() * 100),
        cache_read_input_tokens: Math.floor(Math.random() * 500)
      },
      conversation: [
        {
          role: 'assistant',
          content: this.createRealisticAgentResponse(agentName, taskType)
        }
      ]
    };
  }
}

describe('E2E Prompt/Response Capture Integration Tests', () => {
  beforeAll(async () => {
    // Start test server instance
    console.log('Starting test server for E2E integration tests...');
    
    // Note: In real implementation, we'd start a separate test server
    // For now, we'll use the main server and clean up test data
  });

  afterAll(async () => {
    if (testServer) {
      testServer.kill();
    }
  });

  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  describe('Hook Capture Simulation Tests', () => {
    test('should simulate Task() hook capture and registration', async () => {
      const sessionId = `e2e-test-session-${Date.now()}`;
      const agentName = 'AlexEngineer';
      
      // Simulate the hook script execution with realistic Task() data
      const toolInput = TestDataFactory.createTaskToolInput(agentName, 'engineer');
      
      // Simulate register_subagent.py hook execution
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Task',
        tool_input: toolInput
      };

      // Test hook would normally be called by Claude Code
      // For testing, we directly call the registration endpoint
      const registerResponse = await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: toolInput.subagent_type
        })
      });

      expect(registerResponse.status).toBe(200);
      
      // Store the initial prompt (simulating hook behavior)
      const promptResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: toolInput.prompt
        })
      });

      expect(promptResponse.status).toBe(200);

      // Verify the agent was registered with prompt
      const agentsResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      const agents = await agentsResponse.json();
      
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe(agentName);
      expect(agents[0].initial_prompt).toBe(toolInput.prompt);
      expect(agents[0].subagent_type).toBe('engineer');
    });

    test('should simulate Task() completion hook capture', async () => {
      const sessionId = `e2e-completion-session-${Date.now()}`;
      const agentName = 'BetaGatekeeper';
      
      // First register the agent
      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'gatekeeper'
        })
      });

      // Simulate the completion response from Task()
      const toolResponse = TestDataFactory.createTaskToolResponse(agentName, 'gatekeeper');
      
      // Simulate update_subagent_completion.py hook execution
      const completionResponse = await fetch('http://localhost:4000/subagents/update-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          status: 'completed',
          completed_at: Date.now(),
          total_duration_ms: toolResponse.totalDurationMs,
          total_tokens: toolResponse.totalTokens,
          total_tool_use_count: toolResponse.totalToolUseCount,
          input_tokens: toolResponse.usage.input_tokens,
          output_tokens: toolResponse.usage.output_tokens,
          cache_creation_input_tokens: toolResponse.usage.cache_creation_input_tokens,
          cache_read_input_tokens: toolResponse.usage.cache_read_input_tokens
        })
      });

      expect(completionResponse.status).toBe(200);

      // Store the final response (simulating response capture)
      const finalResponse = toolResponse.conversation[0].content;
      const responseUpdateResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_response: finalResponse
        })
      });

      expect(responseUpdateResponse.status).toBe(200);

      // Verify all data was captured
      const fullAgentResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}/full`);
      const agentData = await fullAgentResponse.json();
      
      expect(agentData.name).toBe(agentName);
      expect(agentData.status).toBe('completed');
      expect(agentData.total_duration_ms).toBe(toolResponse.totalDurationMs);
      expect(agentData.total_tokens).toBe(toolResponse.totalTokens);
      expect(agentData.final_response).toBe(finalResponse);
    });

    test('should handle multiple concurrent agent Task() calls', async () => {
      const sessionId = `e2e-concurrent-session-${Date.now()}`;
      const agents = [
        { name: 'CharlieArch', type: 'architect' },
        { name: 'DeltaEng', type: 'engineer' },
        { name: 'EchoGate', type: 'gatekeeper' }
      ];

      // Simulate concurrent Task() calls (registration phase)
      const registrationPromises = agents.map(agent => 
        fetch('http://localhost:4000/subagents/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: agent.name,
            subagent_type: agent.type
          })
        })
      );

      const registrationResponses = await Promise.all(registrationPromises);
      registrationResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Simulate concurrent prompt storage
      const promptPromises = agents.map(agent => {
        const toolInput = TestDataFactory.createTaskToolInput(agent.name, agent.type);
        return fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_prompt: toolInput.prompt
          })
        });
      });

      const promptResponses = await Promise.all(promptPromises);
      promptResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Simulate concurrent completion and response storage
      const completionPromises = agents.map(agent => {
        const toolResponse = TestDataFactory.createTaskToolResponse(agent.name, agent.type);
        const finalResponse = toolResponse.conversation[0].content;
        
        // Update completion status and store response
        return Promise.all([
          fetch('http://localhost:4000/subagents/update-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              name: agent.name,
              status: 'completed',
              completed_at: Date.now(),
              total_duration_ms: toolResponse.totalDurationMs,
              total_tokens: toolResponse.totalTokens
            })
          }),
          fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              final_response: finalResponse
            })
          })
        ]);
      });

      const allCompletionResponses = await Promise.all(completionPromises);
      allCompletionResponses.forEach(responses => {
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
      });

      // Verify all agents have complete data
      const agentsResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      const agentsData = await agentsResponse.json();
      
      expect(agentsData).toHaveLength(3);
      
      agentsData.forEach((agent: any) => {
        expect(agent.status).toBe('completed');
        expect(agent.initial_prompt).toBeTruthy();
        expect(agent.final_response).toBeTruthy();
        expect(agent.total_tokens).toBeGreaterThan(0);
      });
    });
  });

  describe('Server API Integration Tests', () => {
    test('should handle large prompt/response content efficiently', async () => {
      const sessionId = `e2e-large-content-session-${Date.now()}`;
      const agentName = 'FoxtrotLargeContent';
      
      // Create large but realistic content
      const largePrompt = TestDataFactory.createRealisticAgentPrompt(agentName, 'engineer') + 
        '\n\nAdditional Context:\n' + 'A'.repeat(500000); // ~500KB additional
      const largeResponse = TestDataFactory.createRealisticAgentResponse(agentName, 'engineer') + 
        '\n\nDetailed Implementation:\n' + 'B'.repeat(750000); // ~750KB additional

      // Register agent
      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      const startTime = Date.now();

      // Store large content
      const updateResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: largePrompt,
          final_response: largeResponse
        })
      });

      const storageTime = Date.now() - startTime;

      expect(updateResponse.status).toBe(200);
      expect(storageTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify retrieval performance
      const retrievalStartTime = Date.now();
      const fullAgentResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}/full`);
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(fullAgentResponse.status).toBe(200);
      expect(retrievalTime).toBeLessThan(2000); // Should retrieve within 2 seconds

      const agentData = await fullAgentResponse.json();
      expect(agentData.initial_prompt).toBe(largePrompt);
      expect(agentData.final_response).toBe(largeResponse);
      expect(agentData.prompt_length).toBe(largePrompt.length);
      expect(agentData.response_length).toBe(largeResponse.length);
    });

    test('should maintain data integrity under high load', async () => {
      const sessionId = `e2e-high-load-session-${Date.now()}`;
      const agentCount = 20;
      
      // Create many agents concurrently
      const agents = Array.from({ length: agentCount }, (_, i) => ({
        name: `LoadTestAgent${i + 1}`,
        type: ['engineer', 'gatekeeper', 'architect'][i % 3]
      }));

      // Register all agents
      const registrations = agents.map(agent =>
        fetch('http://localhost:4000/subagents/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: agent.name,
            subagent_type: agent.type
          })
        })
      );

      await Promise.all(registrations);

      // Perform rapid updates
      const updates = agents.map(agent => {
        const toolInput = TestDataFactory.createTaskToolInput(agent.name, agent.type);
        const toolResponse = TestDataFactory.createTaskToolResponse(agent.name, agent.type);
        
        return fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_prompt: toolInput.prompt,
            final_response: toolResponse.conversation[0].content
          })
        });
      });

      const updateResponses = await Promise.all(updates);
      updateResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify data integrity
      const agentsResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      const agentsData = await agentsResponse.json();
      
      expect(agentsData).toHaveLength(agentCount);
      
      // Verify each agent has correct data
      agentsData.forEach((agent: any) => {
        expect(agent.initial_prompt).toBeTruthy();
        expect(agent.final_response).toBeTruthy();
        expect(agent.name.startsWith('LoadTestAgent')).toBe(true);
      });
    });
  });

  describe('Real-world Scenario Simulations', () => {
    test('should simulate complete multi-agent collaboration session', async () => {
      const sessionId = `e2e-collaboration-session-${Date.now()}`;
      
      // Simulate a realistic multi-agent session workflow
      const workflow = [
        { name: 'GolfArchitect', type: 'architect', order: 1 },
        { name: 'HotelEngineer1', type: 'engineer', order: 2 },
        { name: 'IndiaEngineer2', type: 'engineer', order: 2 },
        { name: 'JulietGatekeeper', type: 'gatekeeper', order: 3 }
      ];

      // Phase 1: Architecture planning
      const architect = workflow.find(a => a.type === 'architect')!;
      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: architect.name,
          subagent_type: architect.type
        })
      });

      const archToolInput = TestDataFactory.createTaskToolInput(architect.name, architect.type);
      await fetch(`http://localhost:4000/subagents/${sessionId}/${architect.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: archToolInput.prompt
        })
      });

      // Simulate architect completion
      const archToolResponse = TestDataFactory.createTaskToolResponse(architect.name, architect.type);
      await Promise.all([
        fetch('http://localhost:4000/subagents/update-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: architect.name,
            status: 'completed',
            total_duration_ms: archToolResponse.totalDurationMs
          })
        }),
        fetch(`http://localhost:4000/subagents/${sessionId}/${architect.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            final_response: archToolResponse.conversation[0].content
          })
        })
      ]);

      // Phase 2: Parallel engineering work
      const engineers = workflow.filter(a => a.type === 'engineer');
      const engineerRegistrations = engineers.map(eng =>
        fetch('http://localhost:4000/subagents/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: eng.name,
            subagent_type: eng.type
          })
        })
      );

      await Promise.all(engineerRegistrations);

      // Engineers start with architecture context
      const engineerWork = engineers.map(async (eng) => {
        const toolInput = TestDataFactory.createTaskToolInput(eng.name, eng.type);
        await fetch(`http://localhost:4000/subagents/${sessionId}/${eng.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_prompt: toolInput.prompt
          })
        });

        // Simulate work completion
        const toolResponse = TestDataFactory.createTaskToolResponse(eng.name, eng.type);
        await Promise.all([
          fetch('http://localhost:4000/subagents/update-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              name: eng.name,
              status: 'completed',
              total_duration_ms: toolResponse.totalDurationMs,
              total_tokens: toolResponse.totalTokens
            })
          }),
          fetch(`http://localhost:4000/subagents/${sessionId}/${eng.name}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              final_response: toolResponse.conversation[0].content
            })
          })
        ]);
      });

      await Promise.all(engineerWork);

      // Phase 3: Quality gate review
      const gatekeeper = workflow.find(a => a.type === 'gatekeeper')!;
      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: gatekeeper.name,
          subagent_type: gatekeeper.type
        })
      });

      const gateToolInput = TestDataFactory.createTaskToolInput(gatekeeper.name, gatekeeper.type);
      const gateToolResponse = TestDataFactory.createTaskToolResponse(gatekeeper.name, gatekeeper.type);

      await Promise.all([
        fetch(`http://localhost:4000/subagents/${sessionId}/${gatekeeper.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_prompt: gateToolInput.prompt
          })
        }),
        // Simulate immediate completion for gatekeeper review
        setTimeout(async () => {
          await Promise.all([
            fetch('http://localhost:4000/subagents/update-completion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionId,
                name: gatekeeper.name,
                status: 'completed',
                total_duration_ms: gateToolResponse.totalDurationMs
              })
            }),
            fetch(`http://localhost:4000/subagents/${sessionId}/${gatekeeper.name}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                final_response: gateToolResponse.conversation[0].content
              })
            })
          ]);
        }, 100)
      ]);

      // Wait for all work to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify complete session
      const sessionResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      const sessionAgents = await sessionResponse.json();
      
      expect(sessionAgents).toHaveLength(4);
      
      // Verify architect completed first
      const archAgent = sessionAgents.find((a: any) => a.name === architect.name);
      expect(archAgent.status).toBe('completed');
      expect(archAgent.initial_prompt).toContain('System Architect');
      expect(archAgent.final_response).toContain('Architecture');

      // Verify engineers completed
      const engAgents = sessionAgents.filter((a: any) => a.subagent_type === 'engineer');
      expect(engAgents).toHaveLength(2);
      engAgents.forEach((agent: any) => {
        expect(agent.status).toBe('completed');
        expect(agent.initial_prompt).toContain('authentication');
        expect(agent.final_response).toContain('✅');
      });

      // Verify gatekeeper review
      const gateAgent = sessionAgents.find((a: any) => a.name === gatekeeper.name);
      expect(gateAgent.status).toBe('completed');
      expect(gateAgent.initial_prompt).toContain('Quality Assurance');
      expect(gateAgent.final_response).toContain('APPROVED');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle hook failures gracefully', async () => {
      const sessionId = `e2e-error-session-${Date.now()}`;
      const agentName = 'KiloErrorAgent';
      
      // Test hook failure by trying to update non-existent agent
      const updateResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: 'Some prompt'
        })
      });

      expect(updateResponse.status).toBe(404);
      
      const errorData = await updateResponse.json();
      expect(errorData.error).toBe('Agent not found');
    });

    test('should handle malformed tool data', async () => {
      const sessionId = `e2e-malformed-session-${Date.now()}`;
      const agentName = 'LimaMalformedAgent';

      // Register agent first
      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      // Try to send malformed JSON
      const malformedResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json content {'
      });

      expect(malformedResponse.status).toBe(400);
      
      const errorData = await malformedResponse.json();
      expect(errorData.error).toBe('Invalid JSON payload');
    });

    test('should validate content size limits', async () => {
      const sessionId = `e2e-size-limit-session-${Date.now()}`;
      const agentName = 'MikeSizeLimitAgent';

      await fetch('http://localhost:4000/subagents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: agentName,
          subagent_type: 'engineer'
        })
      });

      // Try to store content larger than 1MB limit
      const oversizedContent = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte
      
      const oversizedResponse = await fetch(`http://localhost:4000/subagents/${sessionId}/${agentName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_prompt: oversizedContent
        })
      });

      expect(oversizedResponse.status).toBe(400);
      
      const errorData = await oversizedResponse.json();
      expect(errorData.error).toBe('Validation failed');
      expect(errorData.validation_errors[0].code).toBe('TEXT_TOO_LONG');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance targets for typical workload', async () => {
      const sessionId = `e2e-performance-session-${Date.now()}`;
      const agentCount = 10;
      
      const agents = Array.from({ length: agentCount }, (_, i) => ({
        name: `PerfAgent${i + 1}`,
        type: 'engineer'
      }));

      // Benchmark: Registration phase
      const regStartTime = Date.now();
      const registrations = agents.map(agent =>
        fetch('http://localhost:4000/subagents/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            name: agent.name,
            subagent_type: agent.type
          })
        })
      );

      await Promise.all(registrations);
      const regTime = Date.now() - regStartTime;

      // Benchmark: Prompt storage phase
      const promptStartTime = Date.now();
      const prompts = agents.map(agent => {
        const toolInput = TestDataFactory.createTaskToolInput(agent.name, agent.type);
        return fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_prompt: toolInput.prompt
          })
        });
      });

      await Promise.all(prompts);
      const promptTime = Date.now() - promptStartTime;

      // Benchmark: Response storage phase
      const responseStartTime = Date.now();
      const responses = agents.map(agent => {
        const toolResponse = TestDataFactory.createTaskToolResponse(agent.name, agent.type);
        return fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            final_response: toolResponse.conversation[0].content
          })
        });
      });

      await Promise.all(responses);
      const responseTime = Date.now() - responseStartTime;

      // Benchmark: Retrieval phase
      const retrievalStartTime = Date.now();
      const retrievals = agents.map(agent =>
        fetch(`http://localhost:4000/subagents/${sessionId}/${agent.name}/full`)
      );

      await Promise.all(retrievals);
      const retrievalTime = Date.now() - retrievalStartTime;

      // Assert performance targets
      expect(regTime).toBeLessThan(2000); // Registration: <2s for 10 agents
      expect(promptTime).toBeLessThan(3000); // Prompt storage: <3s for 10 agents
      expect(responseTime).toBeLessThan(3000); // Response storage: <3s for 10 agents
      expect(retrievalTime).toBeLessThan(1000); // Retrieval: <1s for 10 agents

      console.log(`Performance Benchmarks:
        Registration: ${regTime}ms (target: <2000ms)
        Prompt Storage: ${promptTime}ms (target: <3000ms)
        Response Storage: ${responseTime}ms (target: <3000ms)
        Retrieval: ${retrievalTime}ms (target: <1000ms)`);
    });
  });
});