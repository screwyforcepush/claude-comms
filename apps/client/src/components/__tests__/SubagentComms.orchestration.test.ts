/**
 * SubagentComms Orchestration Integration Tests
 * 
 * Comprehensive test suite for orchestration pane integration in SubagentComms.
 * Tests new tab functionality, component integration, and data flow.
 * Written FIRST using TDD approach before implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import SubagentComms from '../SubagentComms.vue'
import type { Session, AgentStatus, SubagentMessage } from '../../types'

// Mock child components that don't exist yet
vi.mock('../SessionSelector.vue', () => ({
  default: {
    name: 'SessionSelector',
    props: ['selectedSessionId', 'sessions'],
    emits: ['session-changed', 'refresh-sessions'],
    template: `
      <div data-testid="session-selector">
        <select 
          :value="selectedSessionId" 
          @change="$emit('session-changed', $event.target.value)"
          data-testid="session-select"
        >
          <option value="">Select a session...</option>
          <option 
            v-for="session in sessions" 
            :key="session.session_id" 
            :value="session.session_id"
            data-testid="session-option"
          >
            {{ session.session_id }}
          </option>
        </select>
        <button 
          @click="$emit('refresh-sessions')"
          data-testid="refresh-button"
        >
          Refresh
        </button>
      </div>
    `
  }
}))

vi.mock('../OrchestrationTimeline.vue', () => ({
  default: {
    name: 'OrchestrationTimeline',
    props: ['sessionId', 'messages', 'height'],
    emits: ['message-selected'],
    template: `
      <div data-testid="orchestration-timeline">
        <div v-if="!sessionId" data-testid="no-session-message">
          Select a session to view orchestration timeline
        </div>
        <div v-else data-testid="timeline-content">
          <div 
            v-for="message in messages" 
            :key="message.id"
            @click="$emit('message-selected', message)"
            data-testid="timeline-message"
          >
            {{ message.content }}
          </div>
        </div>
      </div>
    `
  }
}))

// Mock existing components
vi.mock('../InteractiveAgentTimeline.vue', () => ({
  default: {
    name: 'InteractiveAgentTimeline',
    template: '<div data-testid="interactive-agent-timeline">Timeline</div>'
  }
}))

vi.mock('../AgentDetailPane.vue', () => ({
  default: {
    name: 'AgentDetailPane',
    template: '<div data-testid="agent-detail-pane">Agent Details</div>'
  }
}))

vi.mock('../MessageDetailPane.vue', () => ({
  default: {
    name: 'MessageDetailPane',
    template: '<div data-testid="message-detail-pane">Message Details</div>'
  }
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SubagentComms Orchestration Integration', () => {
  const mockSessions: Session[] = [
    {
      session_id: 'session-123',
      created_at: '2025-08-20T10:00:00Z',
      agent_count: 3
    },
    {
      session_id: 'session-456',
      created_at: '2025-08-20T11:00:00Z',
      agent_count: 2
    }
  ]

  const mockAgents: AgentStatus[] = [
    {
      id: 1,
      name: 'TestAgent1',
      subagent_type: 'engineer',
      created_at: Date.now(),
      session_id: 'session-123',
      status: 'completed'
    },
    {
      id: 2,
      name: 'TestAgent2',
      subagent_type: 'architect',
      created_at: Date.now(),
      session_id: 'session-123',
      status: 'in_progress'
    }
  ]

  const mockMessages: SubagentMessage[] = [
    {
      id: 'msg1',
      sender: 'TestAgent1',
      message: 'Task completed successfully',
      created_at: Date.now(),
      notified: []
    },
    {
      id: 'msg2',
      sender: 'TestAgent2',
      message: 'Architecture review in progress',
      created_at: Date.now(),
      notified: []
    }
  ]

  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessions)
        })
      } else if (url.includes('/subagents/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAgents)
        })
      } else if (url.includes('/subagents/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages)
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.resetAllMocks()
  })

  describe('Orchestration Tab Rendering', () => {
    it('displays three tabs including new Orchestration tab', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Should have three tabs: Timeline, List, and Orchestration
      const tabButtons = wrapper.findAll('button')
      const viewTabs = tabButtons.filter(btn => 
        btn.text().includes('Timeline View') || 
        btn.text().includes('List View') || 
        btn.text().includes('Orchestration View')
      )
      
      expect(viewTabs).toHaveLength(3)
      
      // Check for Orchestration tab specifically
      const orchestrationTab = tabButtons.find(btn => 
        btn.text().includes('Orchestration View')
      )
      expect(orchestrationTab).toBeTruthy()
      expect(orchestrationTab?.text()).toContain('📊 Orchestration View')
    })

    it('Orchestration tab is inactive by default', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      expect(orchestrationTab.classes()).not.toContain('bg-gray-800')
      expect(orchestrationTab.classes()).not.toContain('text-blue-400')
    })

    it('can switch to Orchestration tab', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Should show active tab styling
      expect(orchestrationTab.classes()).toContain('bg-gray-800')
      expect(orchestrationTab.classes()).toContain('text-blue-400')
    })
  })

  describe('Orchestration View Content', () => {
    it('shows session selector when no session selected', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Should show session selector
      const sessionSelector = wrapper.find('[data-testid="session-selector"]')
      expect(sessionSelector.exists()).toBe(true)
      
      // Should show message to select session
      const noSessionMessage = wrapper.find('[data-testid="no-session-message"]')
      expect(noSessionMessage.exists()).toBe(true)
      expect(noSessionMessage.text()).toContain('Select a session to view orchestration timeline')
    })

    it('integrates SessionSelector component correctly', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      const sessionSelector = wrapper.find('[data-testid="session-selector"]')
      expect(sessionSelector.exists()).toBe(true)

      // Should have refresh button
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      expect(refreshButton.exists()).toBe(true)
    })

    it('integrates OrchestrationTimeline component correctly', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Select a session
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      // OrchestrationTimeline should be rendered
      const orchestrationTimeline = wrapper.find('[data-testid="orchestration-timeline"]')
      expect(orchestrationTimeline.exists()).toBe(true)
    })
  })

  describe('Session Management Integration', () => {
    it('loads sessions on component mount', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Should have called sessions API
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/sessions')
    })

    it('handles session selection in orchestration view', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Select a session
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')
      await sessionSelect.trigger('change')

      // Should load session data
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/session-123')
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/messages')
    })

    it('preserves session selection when switching between tabs', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Select a session in the default view
      const sessionSelect = wrapper.find('select')
      await sessionSelect.setValue('session-123')

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Session should still be selected in orchestration view
      const orchestrationSessionSelector = wrapper.find('[data-testid="session-select"]')
      expect(orchestrationSessionSelector.element.value).toBe('session-123')
    })

    it('updates all views when session changes in orchestration view', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Change session in orchestration view
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-456')
      await sessionSelect.trigger('change')

      // Switch back to timeline view
      const timelineTab = wrapper.find('button:contains("Timeline View")')
      await timelineTab.trigger('click')

      // Main session selector should reflect the change
      const mainSessionSelect = wrapper.find('select')
      expect(mainSessionSelect.element.value).toBe('session-456')
    })
  })

  describe('Data Flow Integration', () => {
    it('passes correct props to OrchestrationTimeline', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab and select session
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      await nextTick()

      const orchestrationTimeline = wrapper.findComponent({ name: 'OrchestrationTimeline' })
      expect(orchestrationTimeline.exists()).toBe(true)
      expect(orchestrationTimeline.props('sessionId')).toBe('session-123')
      expect(orchestrationTimeline.props('messages')).toEqual(expect.any(Array))
      expect(orchestrationTimeline.props('height')).toBe(600)
    })

    it('handles message selection from OrchestrationTimeline', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab and select session
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      await nextTick()

      // Simulate message selection
      const orchestrationTimeline = wrapper.findComponent({ name: 'OrchestrationTimeline' })
      await orchestrationTimeline.trigger('message-selected', mockMessages[0])

      // Should handle message selection (could open detail pane, etc.)
      // This will be implemented based on UX requirements
    })

    it('fetches orchestration data using correct API endpoint', async () => {
      // Mock the new introspection API endpoint
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/sessions/introspect/session-123/timeline')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              sessionId: 'session-123',
              timeline: [
                {
                  id: 'msg1',
                  type: 'orchestrator_task',
                  role: 'orchestrator',
                  timestamp: Date.now(),
                  content: 'Task assignment created',
                  source_event: 'PostToolUse'
                }
              ],
              messageCount: 1,
              timeRange: { start: Date.now() - 3600000, end: Date.now() }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      })

      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab and select session
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      await nextTick()

      // Should call the introspection API endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/sessions/introspect/session-123/timeline'
      )
    })
  })

  describe('State Management', () => {
    it('maintains separate state for orchestration view', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Should have orchestration-specific state
      expect(wrapper.vm.activeView).toBe('timeline') // default view
      
      // Switch to orchestration
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      expect(wrapper.vm.activeView).toBe('orchestration')
    })

    it('preserves orchestration state when switching tabs', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Set up orchestration view with session selected
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      // Switch to timeline tab
      const timelineTab = wrapper.find('button:contains("Timeline View")')
      await timelineTab.trigger('click')

      // Switch back to orchestration
      await orchestrationTab.trigger('click')

      // Session should still be selected
      const sessionSelector = wrapper.find('[data-testid="session-select"]')
      expect(sessionSelector.element.value).toBe('session-123')
    })
  })

  describe('Error Handling', () => {
    it('handles API failures gracefully in orchestration view', async () => {
      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('API Error'))

      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Should not crash, should show empty state or error message
      expect(wrapper.exists()).toBe(true)
    })

    it('handles empty session data in orchestration view', async () => {
      // Mock empty response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Should handle empty state gracefully
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('WebSocket Integration', () => {
    it('updates orchestration view on real-time events', async () => {
      const mockWsConnection = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }

      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: mockWsConnection
        }
      })

      await nextTick()

      // Should set up WebSocket listener
      expect(mockWsConnection.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      
      // Switch to orchestration view
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')

      // Simulate WebSocket message
      const messageHandler = mockWsConnection.addEventListener.mock.calls[0][1]
      const mockEvent = {
        data: JSON.stringify({
          type: 'subagent_message',
          data: {
            session_id: 'session-123',
            sender: 'NewAgent',
            message: 'New orchestration event'
          }
        })
      }

      messageHandler(mockEvent)
      await nextTick()

      // Should update orchestration data
      // Exact implementation depends on how real-time updates are handled
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for orchestration tab', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      expect(orchestrationTab.attributes('title')).toContain('Switch to orchestration view')
    })

    it('has proper keyboard navigation for orchestration view', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      
      // Should be focusable
      expect(orchestrationTab.attributes('tabindex')).not.toBe('-1')
      
      // Should respond to keyboard events
      await orchestrationTab.trigger('keydown.enter')
      
      // Should switch to orchestration view
      expect(wrapper.vm.activeView).toBe('orchestration')
    })
  })

  describe('Performance', () => {
    it('does not load orchestration data until tab is selected', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Should not have called introspection API yet
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/introspect/')
      )

      // Switch to orchestration tab
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      await nextTick()

      // Now should call introspection API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/introspect/')
      )
    })

    it('caches orchestration data between tab switches', async () => {
      wrapper = mount(SubagentComms, {
        props: {
          wsConnection: null
        }
      })

      await nextTick()

      // Load orchestration data
      const orchestrationTab = wrapper.find('[data-testid="orchestration-tab"]')
      await orchestrationTab.trigger('click')
      
      const sessionSelect = wrapper.find('[data-testid="session-select"]')
      await sessionSelect.setValue('session-123')

      await nextTick()
      
      const initialCallCount = mockFetch.mock.calls.length

      // Switch away and back
      const timelineTab = wrapper.find('button:contains("Timeline View")')
      await timelineTab.trigger('click')
      await orchestrationTab.trigger('click')

      // Should not make additional API calls (data cached)
      expect(mockFetch.mock.calls.length).toBe(initialCallCount)
    })
  })
})