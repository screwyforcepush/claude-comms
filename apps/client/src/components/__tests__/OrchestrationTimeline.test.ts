/**
 * OrchestrationTimeline Component Tests
 * 
 * Comprehensive test suite for the message history display component.
 * Tests chronological message display, visual distinctions, and performance.
 * Following TDD principles - these tests define the expected behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import OrchestrationTimeline from '../OrchestrationTimeline.vue'

// Mock the virtual scrolling dependencies
vi.mock('vue-virtual-scroll-list', () => ({
  default: {
    name: 'VirtualList',
    props: ['size', 'remain', 'items', 'item', 'itemHeight'],
    template: '<div data-testid="virtual-list"><slot v-for="item in items" :key="item.id" :item="item" /></div>'
  }
}))

describe('OrchestrationTimeline', () => {
  const mockMessages = [
    {
      id: 1,
      type: 'user_prompt',
      timestamp: 1000,
      content: 'Please implement the user authentication system',
      metadata: {
        session_id: 'session-1',
        user_id: 'user-123'
      }
    },
    {
      id: 2,
      type: 'orchestrator_task',
      timestamp: 2000,
      content: 'Creating task for engineer: Implement authentication backend',
      metadata: {
        session_id: 'session-1',
        agent_name: 'AuthEngineer',
        task_id: 'task-1'
      }
    },
    {
      id: 3,
      type: 'agent_response',
      timestamp: 3000,
      content: 'Authentication system implemented successfully with JWT tokens',
      metadata: {
        session_id: 'session-1',
        agent_name: 'AuthEngineer',
        task_id: 'task-1',
        status: 'completed'
      }
    },
    {
      id: 4,
      type: 'orchestrator_task',
      timestamp: 4000,
      content: 'Creating task for engineer: Add user registration form',
      metadata: {
        session_id: 'session-1',
        agent_name: 'FrontendEngineer',
        task_id: 'task-2'
      }
    }
  ]

  const defaultProps = {
    messages: mockMessages,
    sessionId: 'session-1'
  }

  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Rendering', () => {
    it('renders correctly with message history', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      expect(wrapper.find('.orchestration-timeline').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="message-item"]')).toHaveLength(4)
    })

    it('displays empty state when no messages', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: []
        }
      })

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('No orchestration events to display')
      expect(wrapper.text()).toContain('Events will appear here as they occur')
    })

    it('renders header with session information', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const header = wrapper.find('[data-testid="timeline-header"]')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('Session Events')
      expect(header.text()).toContain('session-1')
    })
  })

  describe('Chronological Message Display', () => {
    it('displays messages in chronological order (oldest first at top)', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      expect(messageItems).toHaveLength(4)

      // Messages should be ordered oldest to newest (chronological)
      expect(messageItems[0].attributes('data-message-id')).toBe('1') // timestamp: 1000
      expect(messageItems[1].attributes('data-message-id')).toBe('2') // timestamp: 2000
      expect(messageItems[2].attributes('data-message-id')).toBe('3') // timestamp: 3000
      expect(messageItems[3].attributes('data-message-id')).toBe('4') // timestamp: 4000
    })

    it('maintains chronological order when new messages are added', async () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const newMessage = {
        id: 5,
        type: 'agent_response',
        timestamp: 5000,
        content: 'Registration form completed',
        metadata: {
          session_id: 'session-1',
          agent_name: 'FrontendEngineer',
          task_id: 'task-2',
          status: 'completed'
        }
      }

      await wrapper.setProps({
        messages: [...mockMessages, newMessage]
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      expect(messageItems).toHaveLength(5)

      // New message should be at the bottom (chronological order)
      expect(messageItems[4].attributes('data-message-id')).toBe('5')
    })

    it('handles messages with same timestamp gracefully', () => {
      const messagesWithSameTimestamp = [
        {
          id: 1,
          type: 'user_prompt',
          timestamp: 1000,
          content: 'First message',
          metadata: { session_id: 'session-1' }
        },
        {
          id: 2,
          type: 'orchestrator_task',
          timestamp: 1000, // Same timestamp
          content: 'Second message',
          metadata: { session_id: 'session-1' }
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: messagesWithSameTimestamp
        }
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      expect(messageItems).toHaveLength(2)
      // Should not crash and should display both messages
    })

    it('handles messages without timestamps', () => {
      const messagesWithoutTimestamps = [
        {
          id: 1,
          type: 'user_prompt',
          content: 'Message without timestamp',
          metadata: { session_id: 'session-1' }
        },
        {
          id: 2,
          type: 'orchestrator_task',
          timestamp: 2000,
          content: 'Message with timestamp',
          metadata: { session_id: 'session-1' }
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: messagesWithoutTimestamps
        }
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      expect(messageItems).toHaveLength(2)
      // Should gracefully handle missing timestamps
    })
  })

  describe('Visual Message Type Distinctions', () => {
    it('applies correct styling for user prompts', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const userPromptMessage = wrapper.find('[data-message-type="user_prompt"]')
      expect(userPromptMessage.exists()).toBe(true)
      expect(userPromptMessage.classes()).toContain('user-prompt-message')
      expect(userPromptMessage.find('.message-icon').text()).toContain('👤')
      expect(userPromptMessage.find('.message-label').text()).toBe('User Prompt')
    })

    it('applies correct styling for orchestrator tasks', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const orchestratorMessages = wrapper.findAll('[data-message-type="orchestrator_task"]')
      expect(orchestratorMessages).toHaveLength(2)

      orchestratorMessages.forEach((message: any) => {
        expect(message.classes()).toContain('orchestrator-task-message')
        expect(message.find('.message-icon').text()).toContain('⚙️')
        expect(message.find('.message-label').text()).toBe('Orchestrator Task')
      })
    })

    it('applies correct styling for agent responses', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const agentResponseMessage = wrapper.find('[data-message-type="agent_response"]')
      expect(agentResponseMessage.exists()).toBe(true)
      expect(agentResponseMessage.classes()).toContain('agent-response-message')
      expect(agentResponseMessage.find('.message-icon').text()).toContain('🤖')
      expect(agentResponseMessage.find('.message-label').text()).toBe('Agent Response')
    })

    it('displays agent names for task and response messages', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const taskMessage = wrapper.find('[data-message-id="2"]')
      expect(taskMessage.find('.agent-name').text()).toBe('AuthEngineer')

      const responseMessage = wrapper.find('[data-message-id="3"]')
      expect(responseMessage.find('.agent-name').text()).toBe('AuthEngineer')
    })

    it('shows task status for agent responses', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const responseMessage = wrapper.find('[data-message-id="3"]')
      const statusBadge = responseMessage.find('.status-badge')
      expect(statusBadge.exists()).toBe(true)
      expect(statusBadge.text()).toBe('completed')
      expect(statusBadge.classes()).toContain('status-completed')
    })

    it('handles unknown message types gracefully', () => {
      const messagesWithUnknownType = [
        {
          id: 1,
          type: 'unknown_type',
          timestamp: 1000,
          content: 'Unknown message type',
          metadata: { session_id: 'session-1' }
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: messagesWithUnknownType
        }
      })

      const unknownMessage = wrapper.find('[data-message-type="unknown_type"]')
      expect(unknownMessage.exists()).toBe(true)
      expect(unknownMessage.classes()).toContain('unknown-message')
      expect(unknownMessage.find('.message-icon').text()).toContain('❓')
    })
  })

  describe('Message Content and Metadata', () => {
    it('displays message content correctly', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const userPromptMessage = wrapper.find('[data-message-id="1"]')
      const messageContent = userPromptMessage.find('.message-content')
      expect(messageContent.text()).toContain('Please implement the user authentication system')
    })

    it('displays timestamps in readable format', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      messageItems.forEach((item: any) => {
        const timestamp = item.find('.message-timestamp')
        expect(timestamp.exists()).toBe(true)
        // Should display time in readable format
        expect(timestamp.text()).toMatch(/\d{1,2}:\d{2}/)
      })
    })

    it('shows expanded details when message is clicked', async () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const messageItem = wrapper.find('[data-message-id="2"]')
      await messageItem.find('.message-header').trigger('click')

      const expandedDetails = messageItem.find('.message-details')
      expect(expandedDetails.exists()).toBe(true)
      expect(expandedDetails.find('.metadata-section').exists()).toBe(true)
    })

    it('displays task IDs for orchestrator and agent messages', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const taskMessage = wrapper.find('[data-message-id="2"]')
      const responseMessage = wrapper.find('[data-message-id="3"]')

      expect(taskMessage.find('.task-id').text()).toBe('task-1')
      expect(responseMessage.find('.task-id').text()).toBe('task-1')
    })
  })

  describe('Performance with Large Message Lists', () => {
    it('renders large message lists efficiently with virtual scrolling', () => {
      const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        type: i % 3 === 0 ? 'user_prompt' : i % 3 === 1 ? 'orchestrator_task' : 'agent_response',
        timestamp: i * 1000,
        content: `Message content ${i + 1}`,
        metadata: {
          session_id: 'session-1',
          agent_name: `Agent${i % 10}`
        }
      }))

      const startTime = performance.now()

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: largeMessageList
        }
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render efficiently (less than 200ms for 1000 items)
      expect(renderTime).toBeLessThan(200)

      // Virtual scrolling should be enabled
      expect(wrapper.find('[data-testid="virtual-list"]').exists()).toBe(true)
    })

    it('enables virtual scrolling for more than 100 messages', () => {
      const manyMessages = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        type: 'orchestrator_task',
        timestamp: i * 1000,
        content: `Message ${i + 1}`,
        metadata: { session_id: 'session-1' }
      }))

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: manyMessages
        }
      })

      expect(wrapper.find('[data-testid="virtual-list"]').exists()).toBe(true)
      expect(wrapper.vm.useVirtualScrolling).toBe(true)
    })

    it('uses regular scrolling for small message lists', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps // Only 4 messages
      })

      expect(wrapper.vm.useVirtualScrolling).toBe(false)
      expect(wrapper.find('.regular-scroll-container').exists()).toBe(true)
    })
  })

  describe('Scrolling Behavior', () => {
    it('auto-scrolls to bottom when new messages arrive', async () => {
      const mockScrollTo = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        value: mockScrollTo,
        configurable: true
      })

      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const newMessage = {
        id: 5,
        type: 'user_prompt',
        timestamp: 5000,
        content: 'New message',
        metadata: { session_id: 'session-1' }
      }

      await wrapper.setProps({
        messages: [...mockMessages, newMessage]
      })

      await nextTick()

      // Should auto-scroll to bottom for new messages
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth'
      })
    })

    it('maintains scroll position when not at bottom', async () => {
      const mockScrollTop = 100
      const mockScrollHeight = 1000
      const mockClientHeight = 500

      Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
        get: () => mockScrollTop,
        set: vi.fn(),
        configurable: true
      })

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        get: () => mockScrollHeight,
        configurable: true
      })

      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        get: () => mockClientHeight,
        configurable: true
      })

      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      // Add new message while not at bottom
      const newMessage = {
        id: 5,
        type: 'agent_response',
        timestamp: 5000,
        content: 'New response',
        metadata: { session_id: 'session-1' }
      }

      await wrapper.setProps({
        messages: [...mockMessages, newMessage]
      })

      // Should maintain scroll position when user is not at bottom
      expect(wrapper.vm.shouldAutoScroll).toBe(false)
    })
  })

  describe('Message Filtering and Session Handling', () => {
    it('filters messages by session ID', () => {
      const mixedSessionMessages = [
        ...mockMessages,
        {
          id: 5,
          type: 'user_prompt',
          timestamp: 5000,
          content: 'Different session message',
          metadata: { session_id: 'session-2' }
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          messages: mixedSessionMessages,
          sessionId: 'session-1'
        }
      })

      const messageItems = wrapper.findAll('[data-testid="message-item"]')
      expect(messageItems).toHaveLength(4) // Only session-1 messages

      messageItems.forEach((item: any) => {
        const messageId = item.attributes('data-message-id')
        const message = mixedSessionMessages.find(m => m.id.toString() === messageId)
        expect(message?.metadata.session_id).toBe('session-1')
      })
    })

    it('updates display when session ID changes', async () => {
      const mixedSessionMessages = [
        ...mockMessages,
        {
          id: 5,
          type: 'user_prompt',
          timestamp: 5000,
          content: 'Session 2 message',
          metadata: { session_id: 'session-2' }
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          messages: mixedSessionMessages,
          sessionId: 'session-1'
        }
      })

      expect(wrapper.findAll('[data-testid="message-item"]')).toHaveLength(4)

      // Change to session-2
      await wrapper.setProps({ sessionId: 'session-2' })

      expect(wrapper.findAll('[data-testid="message-item"]')).toHaveLength(1)
      expect(wrapper.find('[data-message-id="5"]').exists()).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed message data gracefully', () => {
      const malformedMessages = [
        {
          id: 1,
          // Missing type
          timestamp: 1000,
          content: 'Malformed message',
          metadata: { session_id: 'session-1' }
        },
        {
          id: 2,
          type: 'user_prompt',
          // Missing content
          timestamp: 2000,
          metadata: { session_id: 'session-1' }
        }
      ]

      expect(() => {
        wrapper = mount(OrchestrationTimeline, {
          props: {
            ...defaultProps,
            messages: malformedMessages
          }
        })
      }).not.toThrow()

      expect(wrapper.findAll('[data-testid="message-item"]')).toHaveLength(2)
    })

    it('handles empty or undefined session ID', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: {
          messages: mockMessages,
          sessionId: undefined
        }
      })

      // Should display all messages when no session filter
      expect(wrapper.findAll('[data-testid="message-item"]')).toHaveLength(4)
    })

    it('handles messages with missing metadata', () => {
      const messagesWithoutMetadata = [
        {
          id: 1,
          type: 'user_prompt',
          timestamp: 1000,
          content: 'Message without metadata'
        }
      ]

      wrapper = mount(OrchestrationTimeline, {
        props: {
          ...defaultProps,
          messages: messagesWithoutMetadata
        }
      })

      const messageItem = wrapper.find('[data-testid="message-item"]')
      expect(messageItem.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const timeline = wrapper.find('.orchestration-timeline')
      expect(timeline.attributes('role')).toBe('log')
      expect(timeline.attributes('aria-live')).toBe('polite')
      expect(timeline.attributes('aria-label')).toContain('Orchestration timeline')
    })

    it('supports keyboard navigation', async () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const firstMessage = wrapper.find('[data-message-id="1"]')
      expect(firstMessage.attributes('tabindex')).toBe('0')
      expect(firstMessage.attributes('role')).toBe('article')

      // Test keyboard interaction
      await firstMessage.trigger('keydown.enter')
      expect(firstMessage.find('.message-details').exists()).toBe(true)
    })

    it('provides screen reader announcements for new messages', async () => {
      wrapper = mount(OrchestrationTimeline, {
        props: defaultProps
      })

      const newMessage = {
        id: 5,
        type: 'agent_response',
        timestamp: 5000,
        content: 'New completion',
        metadata: { session_id: 'session-1' }
      }

      await wrapper.setProps({
        messages: [...mockMessages, newMessage]
      })

      const announcement = wrapper.find('[aria-live="assertive"]')
      expect(announcement.exists()).toBe(true)
      expect(announcement.text()).toContain('New agent response received')
    })
  })
})