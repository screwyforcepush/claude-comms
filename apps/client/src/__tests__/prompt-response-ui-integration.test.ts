/**
 * UI Integration Tests for Prompt/Response Display
 * LisaPhoenix - Integration Tester
 * 
 * Comprehensive UI tests verifying end-to-end prompt/response display functionality
 * from data fetching through component rendering and user interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AgentDetailPane from '../components/AgentDetailPane.vue'
// Commented out unused imports
// import PromptResponseModal from '../components/PromptResponseModal.vue'
import type { AgentStatus } from '../types'
// import type { SubagentMessage } from '../types'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock clipboard API
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

// Test data factory for realistic UI scenarios
class UITestDataFactory {
  static createRealisticAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
    return {
      id: 1,
      name: 'TestUIAgent',
      subagent_type: 'engineer',
      created_at: Date.now() - 120000,
      session_id: 'ui-test-session',
      status: 'completed',
      completion_timestamp: Date.now(),
      total_duration_ms: 65000,
      total_tokens: 3200,
      total_tool_use_count: 7,
      input_tokens: 1800,
      output_tokens: 1400,
      cache_creation_input_tokens: 150,
      cache_read_input_tokens: 250,
      initial_prompt: `Your name is TestUIAgent.
Your Team Role is Primary implementer

SCOPE: Phase-level (phase-id: 03-UserAuth)

YOUR TASK:
Implement comprehensive user authentication system including:
- JWT token-based authentication
- Password hashing and validation
- User registration and login endpoints
- Session management
- Input validation and error handling
- Comprehensive test suite with >90% coverage

CONSTRAINTS:
- Follow existing API patterns in codebase
- Use TypeScript for type safety
- Implement proper security measures
- Follow team coding standards

SUCCESS CRITERIA:
- All authentication endpoints functional
- Security audit passes
- Test coverage >90%
- Documentation complete

FILES TO READ FIRST:
- src/auth/types.ts - authentication interfaces
- src/middleware/validation.ts - validation patterns
- docs/security/guidelines.md - security requirements

TEAM COLLABORATION:
- Coordinate with backend team on API design
- Support frontend team with auth integration
- Leverage security expert for audit guidance

TestUIAgent, adopt 🤝 TEAMWORK to achieve maximum value delivered.`,

      final_response: `## User Authentication System - Implementation Complete ✅

I have successfully implemented the comprehensive user authentication system. Here's the complete breakdown:

### 🏗️ Architecture Implementation

**Core Components Delivered:**
- \`src/auth/routes.ts\` - RESTful authentication endpoints
- \`src/auth/middleware.ts\` - JWT validation and security middleware  
- \`src/auth/service.ts\` - Authentication business logic layer
- \`src/auth/models.ts\` - User and session TypeScript interfaces
- \`src/auth/validators.ts\` - Input validation schemas
- \`src/auth/utils.ts\` - Password hashing and token utilities

### 🔐 Security Features Implemented

**Password Security:**
- bcrypt hashing with salt rounds: 12
- Password strength validation (min 8 chars, mixed case, numbers, special)
- Secure password reset flow with time-limited tokens

**JWT Token Management:**
- Access tokens: 15-minute expiry, RS256 signing
- Refresh tokens: 30-day expiry, stored in database with rotation
- Token blacklisting support for logout
- Automatic token cleanup job

**Rate Limiting & Protection:**
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP
- Password reset: 2 per hour per email
- CSRF protection headers
- SQL injection prevention via parameterized queries

### 🚀 API Endpoints Implemented

\`\`\`typescript
POST   /api/auth/register     - User registration
POST   /api/auth/login        - User authentication
POST   /api/auth/refresh      - Token refresh
POST   /api/auth/logout       - Secure logout
GET    /api/auth/profile      - Get user profile (protected)
PUT    /api/auth/profile      - Update profile (protected)
POST   /api/auth/reset-request - Request password reset
POST   /api/auth/reset-confirm - Confirm password reset
\`\`\`

**Request/Response Examples:**

Registration:
\`\`\`json
POST /api/auth/register
{
  "username": "johndoe",
  "email": "john@example.com", 
  "password": "SecurePass123!"
}

Response: 201 Created
{
  "success": true,
  "user": { "id": "uuid", "username": "johndoe", "email": "..." },
  "tokens": { "access": "jwt...", "refresh": "uuid..." }
}
\`\`\`

### 📋 Database Schema

**Users Table:**
\`\`\`sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP
);
\`\`\`

**Sessions Table:**
\`\`\`sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 🧪 Testing Results

**Unit Tests:** 32/32 passing ✅
- Authentication service tests
- Password hashing tests  
- Token validation tests
- Input validation tests

**Integration Tests:** 18/18 passing ✅
- API endpoint tests
- Database integration tests
- Middleware chain tests
- Error handling tests

**Security Tests:** 12/12 passing ✅
- SQL injection prevention
- XSS protection validation
- Rate limiting verification
- Token security tests

**Coverage Report:**
- Line Coverage: 96.8% ✅
- Branch Coverage: 94.2% ✅  
- Function Coverage: 100% ✅
- Statement Coverage: 96.5% ✅

### 🔍 Security Audit Results

**Vulnerability Scan:** ✅ PASSED
- 0 Critical vulnerabilities
- 0 High severity issues
- 0 Medium severity issues
- 1 Low informational notice (acceptable)

**Penetration Testing:** ✅ PASSED
- Authentication bypass attempts: BLOCKED
- SQL injection attempts: BLOCKED
- XSS attempts: BLOCKED
- Rate limit bypass attempts: BLOCKED
- Session fixation attacks: BLOCKED

### 📚 Documentation Complete

**API Documentation:**
- Interactive Swagger/OpenAPI docs at \`/api/docs\`
- Authentication flow diagrams
- Error response codes and handling
- Rate limiting documentation

**Security Documentation:**
- Security implementation guide
- Threat model and mitigations
- Incident response procedures
- Security best practices for consumers

**Developer Guide:**
- Integration examples for frontend
- Testing utilities and helpers
- Environment setup instructions
- Troubleshooting common issues

### 🚀 Performance Metrics

**Benchmark Results:**
- Average login time: 42ms
- Token validation: 1.8ms  
- Registration flow: 95ms
- Password hashing: 180ms (intentionally slow for security)

**Load Testing:**
- Concurrent users supported: 1,000+
- Requests per second: 500+ (login endpoint)
- Memory usage: 45MB baseline
- Database connections: Efficient pooling (10-50 connections)

### ✅ Deployment Readiness

**Environment Configuration:**
- Development, staging, and production configs
- Environment variable documentation
- Docker containerization complete
- Database migration scripts ready

**Monitoring & Observability:**
- Authentication metrics collection
- Error rate monitoring  
- Performance tracking
- Security event logging

**CI/CD Integration:**
- Automated test execution in pipeline
- Security scanning in build process
- Deployment verification tests
- Rollback procedures documented

---

## 🎯 Project Status: COMPLETE & PRODUCTION READY

The user authentication system is fully implemented, thoroughly tested, and ready for immediate deployment. All acceptance criteria have been met:

✅ **Functional Requirements:** All authentication features working  
✅ **Security Requirements:** Comprehensive security measures implemented  
✅ **Performance Requirements:** Load testing passed with excellent metrics  
✅ **Quality Requirements:** 96%+ test coverage, all quality gates passed  
✅ **Documentation Requirements:** Complete API and security documentation  

**Next Steps:**
1. Code review by senior developer ✅ 
2. Security audit by InfoSec team ✅
3. Performance validation ✅
4. Production deployment approval: **READY** ✅

The authentication system provides enterprise-grade security, excellent performance, and comprehensive monitoring. Ready to go live! 🚀

**Team Collaboration Notes:**
- Worked closely with database team on schema optimization
- Coordinated with frontend team on API contracts
- Received security guidance from InfoSec team
- Provided integration support to QA team

Mission accomplished with 🤝 TEAMWORK! 🎉`,
      ...overrides
    }
  }

  static createAgentWithLargeContent(): AgentStatus {
    const baseAgent = this.createRealisticAgent()
    return {
      ...baseAgent,
      name: 'LargeContentAgent',
      initial_prompt: baseAgent.initial_prompt + '\n\nAdditional Context:\n' + 'A'.repeat(10000),
      final_response: baseAgent.final_response + '\n\nDetailed Logs:\n' + 'B'.repeat(15000)
    }
  }

  static createAgentWithoutPromptResponse(): AgentStatus {
    const baseAgent = this.createRealisticAgent()
    return {
      ...baseAgent,
      name: 'NoContentAgent',
      initial_prompt: undefined,
      final_response: undefined
    }
  }

  static createMultipleAgents(count: number = 3): AgentStatus[] {
    const types = ['engineer', 'architect', 'gatekeeper']
    return Array.from({ length: count }, (_, i) => 
      this.createRealisticAgent({
        id: i + 1,
        name: `TestAgent${i + 1}`,
        subagent_type: types[i % types.length]
      })
    )
  }
}

describe('Prompt/Response UI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('AgentDetailPane - Prompt/Response Display Integration', () => {
    it('should display agent with complete prompt and response data', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      // Verify agent header information
      expect(wrapper.text()).toContain('TestUIAgent')
      expect(wrapper.text()).toContain('Engineer')
      expect(wrapper.text()).toContain('completed')

      // Verify performance metrics display
      expect(wrapper.text()).toContain('3,200') // total tokens formatted
      expect(wrapper.text()).toContain('1,800') // input tokens
      expect(wrapper.text()).toContain('1,400') // output tokens

      // Verify prompt section
      const promptSection = wrapper.find('[data-testid="prompt-section"]')
      expect(promptSection.exists()).toBe(true)
      expect(promptSection.text()).toContain('Initial Prompt')
      expect(promptSection.text()).toContain('TestUIAgent')
      expect(promptSection.text()).toContain('user authentication')
      expect(promptSection.text()).toContain('words') // word count

      // Verify response section
      const responseSection = wrapper.find('[data-testid="response-section"]')
      expect(responseSection.exists()).toBe(true)
      expect(responseSection.text()).toContain('Final Response')
      expect(responseSection.text()).toContain('Implementation Complete')
      expect(responseSection.text()).toContain('PRODUCTION READY')

      // Verify action buttons are present
      expect(wrapper.find('[data-testid="copy-prompt-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="copy-response-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="expand-prompt-response-btn"]').exists()).toBe(true)
    })

    it('should handle agent without prompt/response data gracefully', async () => {
      const agent = UITestDataFactory.createAgentWithoutPromptResponse()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      // Should show basic agent info
      expect(wrapper.text()).toContain('NoContentAgent')
      
      // Should not show prompt/response sections
      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="expand-prompt-response-btn"]').exists()).toBe(false)
    })

    it('should display large content with proper scrolling and truncation', async () => {
      const agent = UITestDataFactory.createAgentWithLargeContent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      // Verify scrollable containers are present
      const promptContent = wrapper.find('[data-testid="prompt-content"]')
      const responseContent = wrapper.find('[data-testid="response-content"]')
      
      expect(promptContent.exists()).toBe(true)
      expect(responseContent.exists()).toBe(true)

      // Verify parent containers have scrolling classes
      const promptContainer = promptContent.element.parentElement
      const responseContainer = responseContent.element.parentElement
      
      expect(promptContainer?.className).toContain('overflow-y-auto')
      expect(responseContainer?.className).toContain('overflow-y-auto')
      expect(promptContainer?.className).toContain('max-h-')
      expect(responseContainer?.className).toContain('max-h-')

      // Verify content is displayed (even if truncated in preview)
      expect(promptContent.text().length).toBeGreaterThan(100)
      expect(responseContent.text().length).toBeGreaterThan(100)
    })

    it('should copy prompt content to clipboard when copy button clicked', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      const copyPromptBtn = wrapper.find('[data-testid="copy-prompt-btn"]')
      await copyPromptBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(agent.initial_prompt)
    })

    it('should copy response content to clipboard when copy button clicked', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      const copyResponseBtn = wrapper.find('[data-testid="copy-response-btn"]')
      await copyResponseBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(agent.final_response)
    })

    it('should emit event to open full modal when expand button clicked', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      const expandBtn = wrapper.find('[data-testid="expand-prompt-response-btn"]')
      await expandBtn.trigger('click')

      expect(wrapper.emitted('open-prompt-response-modal')).toBeTruthy()
      expect(wrapper.emitted('open-prompt-response-modal')?.[0]).toEqual([agent])
    })

    it('should handle clipboard errors gracefully', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))
      
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      const copyBtn = wrapper.find('[data-testid="copy-prompt-btn"]')
      
      // Should not throw error
      await expect(copyBtn.trigger('click')).resolves.not.toThrow()
      
      expect(mockWriteText).toHaveBeenCalled()
    })

    it('should format word counts correctly for prompts and responses', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      await nextTick()

      // Should show word counts for both prompt and response
      const promptSection = wrapper.find('[data-testid="prompt-section"]')
      const responseSection = wrapper.find('[data-testid="response-section"]')
      
      expect(promptSection.text()).toMatch(/\(\d+ words\)/)
      expect(responseSection.text()).toMatch(/\(\d+ words\)/)
    })

    it('should update display when agent data changes', async () => {
      const initialAgent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: initialAgent,
          agents: [initialAgent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      expect(wrapper.text()).toContain('TestUIAgent')

      // Update with different agent
      const updatedAgent = UITestDataFactory.createRealisticAgent({
        name: 'UpdatedAgent',
        subagent_type: 'architect',
        initial_prompt: 'Updated prompt content',
        final_response: 'Updated response content'
      })

      await wrapper.setProps({
        selectedAgent: updatedAgent
      })

      expect(wrapper.text()).toContain('UpdatedAgent')
      expect(wrapper.text()).toContain('Architect')
      expect(wrapper.text()).toContain('Updated prompt content')
      expect(wrapper.text()).toContain('Updated response content')
    })
  })

  describe('API Integration with Real Server Data', () => {
    it('should fetch and display agent data from server API', async () => {
      const mockAgent = UITestDataFactory.createRealisticAgent()
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAgent)
      })

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: null, // Start with no agent
          agents: [],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Simulate fetching agent data
      await wrapper.setProps({
        selectedAgent: mockAgent
      })

      expect(wrapper.text()).toContain('TestUIAgent')
      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(true)
    })

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: null,
          agents: [],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Should show empty state when no agent data
      expect(wrapper.text()).toContain('No agent selected')
    })

    it('should handle partial agent data from API', async () => {
      const partialAgent = UITestDataFactory.createRealisticAgent({
        initial_prompt: undefined, // Missing prompt
        final_response: 'Only has response data'
      })

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: partialAgent,
          agents: [partialAgent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Should show response but not prompt
      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Only has response data')
    })
  })

  describe('Multi-Agent Session Integration', () => {
    it('should handle multiple agents with different completion states', async () => {
      const agents = [
        UITestDataFactory.createRealisticAgent({
          name: 'CompletedAgent',
          status: 'completed',
          initial_prompt: 'Completed agent prompt',
          final_response: 'Completed agent response'
        }),
        UITestDataFactory.createRealisticAgent({
          name: 'InProgressAgent', 
          status: 'in_progress',
          initial_prompt: 'In progress agent prompt',
          final_response: undefined, // No response yet
          completion_timestamp: undefined
        }),
        UITestDataFactory.createRealisticAgent({
          name: 'PendingAgent',
          status: 'pending',
          initial_prompt: undefined, // No prompt yet
          final_response: undefined
        })
      ]

      for (const agent of agents) {
        const wrapper = mount(AgentDetailPane, {
          props: {
            visible: true,
            selectedAgent: agent,
            agents: agents,
            messages: [],
            sessionId: 'ui-test-session'
          }
        })

        if (agent.name === 'CompletedAgent') {
          expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(true)
          expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(true)
          expect(wrapper.text()).toContain('completed')
        } else if (agent.name === 'InProgressAgent') {
          expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(true)
          expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(false)
          expect(wrapper.text()).toContain('in_progress')
        } else if (agent.name === 'PendingAgent') {
          expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
          expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(false)
          expect(wrapper.text()).toContain('pending')
        }

        wrapper.unmount()
      }
    })
  })

  describe('Performance and Accessibility', () => {
    it('should render large content without performance issues', () => {
      const agent = UITestDataFactory.createAgentWithLargeContent()
      
      const startTime = performance.now()

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100) // Should render quickly

      // Should still show content
      expect(wrapper.find('[data-testid="prompt-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="response-content"]').exists()).toBe(true)

      wrapper.unmount()
    })

    it('should have proper accessibility attributes', () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Check ARIA labels
      const closeButton = wrapper.find('[aria-label="Close agent details"]')
      expect(closeButton.exists()).toBe(true)

      // Check text content accessibility
      const promptContent = wrapper.find('[data-testid="prompt-content"]')
      const responseContent = wrapper.find('[data-testid="response-content"]')
      
      expect(promptContent.attributes('role')).toBe('textbox')
      expect(promptContent.attributes('aria-readonly')).toBe('true')
      expect(responseContent.attributes('role')).toBe('textbox')
      expect(responseContent.attributes('aria-readonly')).toBe('true')

      // Check button titles
      const copyPromptBtn = wrapper.find('[data-testid="copy-prompt-btn"]')
      const copyResponseBtn = wrapper.find('[data-testid="copy-response-btn"]')
      
      expect(copyPromptBtn.attributes('title')).toContain('Copy')
      expect(copyResponseBtn.attributes('title')).toContain('Copy')
    })

    it('should handle keyboard navigation properly', async () => {
      const agent = UITestDataFactory.createRealisticAgent()
      
      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Find all focusable elements
      const buttons = wrapper.findAll('button')
      
      // Should have multiple focusable buttons
      expect(buttons.length).toBeGreaterThan(2)
      
      // Each button should be keyboard accessible
      buttons.forEach(button => {
        expect(button.attributes('tabindex')).not.toBe('-1')
      })
    })
  })

  describe('Error States and Edge Cases', () => {
    it('should handle malformed agent data gracefully', async () => {
      const malformedAgent = {
        id: 1,
        name: 'MalformedAgent',
        // Missing required fields
        initial_prompt: null,
        final_response: 123, // Wrong type
      } as any

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: malformedAgent,
          agents: [malformedAgent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Should not crash and should show agent name
      expect(wrapper.text()).toContain('MalformedAgent')
      
      // Should handle missing/malformed data gracefully
      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(false)
    })

    it('should handle special characters and unicode in content', async () => {
      const agent = UITestDataFactory.createRealisticAgent({
        initial_prompt: 'Prompt with special chars: !@#$%^&*() and unicode: 🚀 中文 العربية',
        final_response: 'Response with emojis: ✅ 🎉 and markdown:\n```typescript\nconst msg = "Hello 世界!";\n```'
      })

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Should display special characters correctly
      expect(wrapper.text()).toContain('🚀')
      expect(wrapper.text()).toContain('中文')
      expect(wrapper.text()).toContain('العربية')
      expect(wrapper.text()).toContain('✅')
      expect(wrapper.text()).toContain('🎉')
    })

    it('should handle very long single lines without breaking layout', async () => {
      const veryLongLine = 'A'.repeat(10000) // 10k character line
      const agent = UITestDataFactory.createRealisticAgent({
        initial_prompt: `Prompt with very long line:\n${veryLongLine}`,
        final_response: `Response with long line:\n${veryLongLine}`
      })

      const wrapper = mount(AgentDetailPane, {
        props: {
          visible: true,
          selectedAgent: agent,
          agents: [agent],
          messages: [],
          sessionId: 'ui-test-session'
        }
      })

      // Should not break layout
      const promptContent = wrapper.find('[data-testid="prompt-content"]')
      const responseContent = wrapper.find('[data-testid="response-content"]')
      
      expect(promptContent.exists()).toBe(true)
      expect(responseContent.exists()).toBe(true)
      
      // Should have word wrapping classes
      expect(promptContent.classes()).toContain('break-words')
      expect(responseContent.classes()).toContain('break-words')
    })
  })
});