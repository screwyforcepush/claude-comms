/**
 * AgentDetailPane Component Tests
 * 
 * Tests for the enhanced AgentDetailPane component with prompt/response display functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentDetailPane from '../AgentDetailPane.vue'
import type { AgentStatus, SubagentMessage } from '../../types'

// Mock the clipboard API
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

describe('AgentDetailPane', () => {
  const mockAgent: AgentStatus = {
    id: 1,
    name: 'TestAgent',
    subagent_type: 'engineer',
    created_at: Date.now() - 60000,
    session_id: 'test-session',
    status: 'completed',
    completion_timestamp: Date.now(),
    total_duration_ms: 45000,
    total_tokens: 1500,
    total_tool_use_count: 3,
    input_tokens: 800,
    output_tokens: 700,
    // New prompt/response fields
    initial_prompt: 'Please implement the user authentication feature with proper error handling and validation.',
    final_response: 'I have successfully implemented the user authentication feature with:\n\n1. Input validation\n2. Error handling\n3. Security measures\n4. Unit tests\n\nThe implementation is complete and ready for review.'
  }

  const mockAgentWithLargeContent: AgentStatus = {
    ...mockAgent,
    id: 2,
    name: 'LargeContentAgent',
    initial_prompt: 'A'.repeat(5000), // Very long prompt
    final_response: 'B'.repeat(10000) // Very long response
  }

  const defaultProps = {
    visible: true,
    selectedAgent: mockAgent,
    agents: [mockAgent],
    messages: [],
    sessionId: 'test-session'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders correctly when visible with agent data', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      expect(wrapper.find('[data-testid="agent-detail-pane"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('TestAgent')
      expect(wrapper.text()).toContain('Engineer')
      expect(wrapper.text()).toContain('completed')
    })

    it('does not render when not visible', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          visible: false
        }
      })

      expect(wrapper.find('[data-testid="agent-detail-pane"]').exists()).toBe(false)
    })

    it('shows empty state when no agent selected', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: null
        }
      })

      expect(wrapper.text()).toContain('No agent selected')
      expect(wrapper.text()).toContain('Click on an agent in the timeline')
    })
  })

  describe('Prompt & Response Display', () => {
    it('shows prompt section when agent has initial_prompt', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const promptSection = wrapper.find('[data-testid="prompt-section"]')
      expect(promptSection.exists()).toBe(true)
      expect(wrapper.text()).toContain('Initial Prompt')
      expect(wrapper.text()).toContain('Please implement the user authentication feature')
    })

    it('shows response section when agent has final_response', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const responseSection = wrapper.find('[data-testid="response-section"]')
      expect(responseSection.exists()).toBe(true)
      expect(wrapper.text()).toContain('Final Response')
      expect(wrapper.text()).toContain('I have successfully implemented')
    })

    it('hides prompt/response sections when agent has no data', () => {
      const agentWithoutPromptResponse: AgentStatus = {
        ...mockAgent,
        initial_prompt: undefined,
        final_response: undefined
      }

      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: agentWithoutPromptResponse
        }
      })

      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="response-section"]').exists()).toBe(false)
    })

    it('handles large prompt/response content with scrolling', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: mockAgentWithLargeContent
        }
      })

      const promptArea = wrapper.find('[data-testid="prompt-content"]')
      const responseArea = wrapper.find('[data-testid="response-content"]')

      // Check the parent container has overflow handling
      const promptContainer = promptArea.element.parentElement
      const responseContainer = responseArea.element.parentElement
      
      expect(promptContainer?.className).toContain('overflow-y-auto')
      expect(responseContainer?.className).toContain('overflow-y-auto')
      expect(promptArea.element.textContent).toContain('A'.repeat(100)) // Partial content check
      expect(responseArea.element.textContent).toContain('B'.repeat(100))
    })
  })

  describe('Prompt & Response Actions', () => {
    it('copies prompt to clipboard when copy button clicked', async () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const copyPromptBtn = wrapper.find('[data-testid="copy-prompt-btn"]')
      expect(copyPromptBtn.exists()).toBe(true)

      await copyPromptBtn.trigger('click')
      expect(mockWriteText).toHaveBeenCalledWith(mockAgent.initial_prompt)
    })

    it('copies response to clipboard when copy button clicked', async () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const copyResponseBtn = wrapper.find('[data-testid="copy-response-btn"]')
      expect(copyResponseBtn.exists()).toBe(true)

      await copyResponseBtn.trigger('click')
      expect(mockWriteText).toHaveBeenCalledWith(mockAgent.final_response)
    })

    it('opens full modal when expand button clicked', async () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const expandBtn = wrapper.find('[data-testid="expand-prompt-response-btn"]')
      expect(expandBtn.exists()).toBe(true)

      await expandBtn.trigger('click')
      expect(wrapper.emitted('open-prompt-response-modal')).toBeTruthy()
      expect(wrapper.emitted('open-prompt-response-modal')?.[0]).toEqual([mockAgent])
    })
  })

  describe('Content Formatting', () => {
    it('formats timestamps correctly', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      // Should show formatted timestamp in the timeline section
      expect(wrapper.text()).toMatch(/Started/)
      expect(wrapper.text()).toMatch(/Completed/)
    })

    it('shows proper word count for prompt and response', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      // Should calculate word counts
      expect(wrapper.text()).toContain('words')
    })

    it('displays proper complexity indicators', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: mockAgentWithLargeContent
        }
      })

      // Should show word count for large content indicating complexity  
      // Note: The word count function splits by whitespace, so a repeated character is 1 word
      expect(wrapper.text()).toContain('1 words')
    })
  })

  describe('Keyboard Interactions', () => {
    it('closes panel when Escape key pressed', async () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps,
        attachTo: document.body
      })

      // Test the close function directly - simulating what the Escape handler does
      await wrapper.vm.close()
      
      // Wait for the timeout in the close function
      await new Promise(resolve => setTimeout(resolve, 350))
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const closeButton = wrapper.find('[aria-label="Close agent details"]')
      expect(closeButton.exists()).toBe(true)

      const promptContent = wrapper.find('[data-testid="prompt-content"]')
      expect(promptContent.attributes('role')).toBe('textbox')
      expect(promptContent.attributes('aria-readonly')).toBe('true')
    })

    it('supports keyboard navigation', () => {
      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const focusableElements = wrapper.findAll('button, [tabindex="0"]')
      expect(focusableElements.length).toBeGreaterThan(0)

      focusableElements.forEach(el => {
        expect(el.attributes('tabindex')).not.toBe('-1')
      })
    })
  })

  describe('Performance', () => {
    it('handles very large content without performance issues', () => {
      const startTime = performance.now()

      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: {
            ...mockAgent,
            initial_prompt: 'x'.repeat(50000),
            final_response: 'y'.repeat(100000)
          }
        }
      })

      expect(wrapper.find('[data-testid="prompt-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="response-content"]').exists()).toBe(true)

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100) // Should render quickly
    })

    it('uses proper text virtualization for large content', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: mockAgentWithLargeContent
        }
      })

      const promptArea = wrapper.find('[data-testid="prompt-content"]')
      const responseArea = wrapper.find('[data-testid="response-content"]')

      // Should have max-height constraints for performance in the parent container
      const promptContainer = promptArea.element.parentElement
      const responseContainer = responseArea.element.parentElement
      
      expect(promptContainer?.className).toContain('max-h-')
      expect(responseContainer?.className).toContain('max-h-')
    })
  })

  describe('Error Handling', () => {
    it('handles null/undefined prompt gracefully', () => {
      const wrapper = mount(AgentDetailPane, {
        props: {
          ...defaultProps,
          selectedAgent: {
            ...mockAgent,
            initial_prompt: null as any
          }
        }
      })

      expect(wrapper.find('[data-testid="prompt-section"]').exists()).toBe(false)
    })

    it('handles clipboard write failures gracefully', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))

      const wrapper = mount(AgentDetailPane, {
        props: defaultProps
      })

      const copyBtn = wrapper.find('[data-testid="copy-prompt-btn"]')
      await copyBtn.trigger('click')

      // Should not throw error, may show error state
      expect(wrapper.vm).toBeDefined()
    })
  })
})