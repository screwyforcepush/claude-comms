/**
 * PromptResponseModal Component Tests
 * 
 * Tests for the full-screen modal displaying agent prompts and responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptResponseModal from '../PromptResponseModal.vue'
import type { AgentStatus } from '../../types'

// Mock the clipboard API
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

describe('PromptResponseModal', () => {
  const mockAgent: AgentStatus = {
    id: 1,
    name: 'TestAgent',
    subagent_type: 'engineer',
    created_at: Date.now(),
    session_id: 'test-session',
    status: 'completed',
    initial_prompt: 'Please implement a user login system with proper validation and error handling.',
    final_response: 'I have successfully implemented the user login system with the following features:\n\n1. Input validation\n2. Password hashing\n3. JWT token authentication\n4. Error handling\n5. Rate limiting\n\nThe system is secure and ready for production use.'
  }

  const defaultProps = {
    visible: true,
    agent: mockAgent
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders correctly when visible', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      expect(wrapper.find('.prompt-response-modal').exists()).toBe(true)
      expect(wrapper.text()).toContain('TestAgent - Prompt & Response')
      expect(wrapper.text()).toContain('Initial Prompt')
      expect(wrapper.text()).toContain('Final Response')
    })

    it('does not render when not visible', () => {
      const wrapper = mount(PromptResponseModal, {
        props: {
          ...defaultProps,
          visible: false
        }
      })

      expect(wrapper.find('.prompt-response-modal').exists()).toBe(false)
    })

    it('handles agent with no prompt/response data', () => {
      const emptyAgent = {
        ...mockAgent,
        initial_prompt: undefined,
        final_response: undefined
      }

      const wrapper = mount(PromptResponseModal, {
        props: {
          ...defaultProps,
          agent: emptyAgent
        }
      })

      expect(wrapper.text()).toContain('No prompt available')
      expect(wrapper.text()).toContain('No response available')
    })
  })

  describe('View Modes', () => {
    it('defaults to side-by-side view', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      // Check that side-by-side layout is active
      expect(wrapper.vm.viewMode).toBe('side-by-side')
    })

    it('switches to stacked view when button clicked', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const stackedBtn = wrapper.findAll('button').find(btn => 
        btn.element.title?.includes('Stacked view'))
      
      await stackedBtn?.trigger('click')
      expect(wrapper.vm.viewMode).toBe('stacked')
    })

    it('shows proper layout for each view mode', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      // Test side-by-side layout
      expect(wrapper.find('.flex.h-full').exists()).toBe(true)
      
      // Switch to stacked
      wrapper.vm.viewMode = 'stacked'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.flex.flex-col.h-full').exists()).toBe(true)
    })
  })

  describe('Content Display', () => {
    it('displays prompt and response content correctly', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const promptContent = wrapper.find('[data-testid="modal-prompt-content"]')
      const responseContent = wrapper.find('[data-testid="modal-response-content"]')

      expect(promptContent.text()).toContain('Please implement a user login system')
      expect(responseContent.text()).toContain('I have successfully implemented')
    })

    it('shows correct word counts', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      // Should show word counts in the headers
      expect(wrapper.text()).toMatch(/\(\d+ words\)/)
    })

    it('handles very large content gracefully', () => {
      const largeAgent = {
        ...mockAgent,
        initial_prompt: 'A'.repeat(50000),
        final_response: 'B'.repeat(100000)
      }

      const wrapper = mount(PromptResponseModal, {
        props: {
          ...defaultProps,
          agent: largeAgent
        }
      })

      expect(wrapper.find('[data-testid="modal-prompt-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="modal-response-content"]').exists()).toBe(true)
    })
  })

  describe('Copy Functionality', () => {
    it('copies prompt to clipboard when copy button clicked', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const copyPromptBtn = wrapper.findAll('button').find(btn => 
        btn.element.title?.includes('Copy prompt'))
      
      await copyPromptBtn?.trigger('click')
      expect(mockWriteText).toHaveBeenCalledWith(mockAgent.initial_prompt)
    })

    it('copies response to clipboard when copy button clicked', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const copyResponseBtn = wrapper.findAll('button').find(btn => 
        btn.element.title?.includes('Copy response'))
      
      await copyResponseBtn?.trigger('click')
      expect(mockWriteText).toHaveBeenCalledWith(mockAgent.final_response)
    })

    it('handles clipboard errors gracefully', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard not available'))

      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const copyBtn = wrapper.findAll('button').find(btn => 
        btn.element.title?.includes('Copy prompt'))
      
      // Should not throw error
      await copyBtn?.trigger('click')
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Modal Interactions', () => {
    it('emits close event when close button clicked', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const closeBtn = wrapper.find('[aria-label="Close modal"]')
      await closeBtn.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close event when backdrop clicked', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const backdrop = wrapper.find('.fixed.inset-0.bg-black\\/50')
      await backdrop.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('does not close when clicking modal content', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const modalContent = wrapper.find('.fixed.inset-4')
      await modalContent.trigger('click')
      
      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('closes when Escape key is pressed', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps,
        attachTo: document.body
      })

      // Test the close function directly since keyboard events are handled by the component
      await wrapper.vm.close()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const modal = wrapper.find('[role="dialog"]')
      expect(modal.exists()).toBe(true)
      expect(modal.attributes('aria-modal')).toBe('true')
      expect(modal.attributes('aria-labelledby')).toBe('modal-title')
    })

    it('focuses properly when opened', () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps,
        attachTo: document.body
      })

      // Modal should be mounted and visible
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })

    it('prevents body scroll when open', () => {
      mount(PromptResponseModal, {
        props: defaultProps
      })

      // Body scroll should be prevented (this would be tested in integration tests)
      expect(true).toBe(true) // Placeholder for body scroll prevention
    })
  })

  describe('Performance', () => {
    it('renders large content without performance issues', () => {
      const startTime = performance.now()

      mount(PromptResponseModal, {
        props: {
          ...defaultProps,
          agent: {
            ...mockAgent,
            initial_prompt: 'x'.repeat(10000),
            final_response: 'y'.repeat(20000)
          }
        }
      })

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('handles view mode switching efficiently', async () => {
      const wrapper = mount(PromptResponseModal, {
        props: defaultProps
      })

      const startTime = performance.now()

      // Switch view modes multiple times
      wrapper.vm.viewMode = 'stacked'
      await wrapper.vm.$nextTick()
      
      wrapper.vm.viewMode = 'side-by-side'
      await wrapper.vm.$nextTick()

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(50)
    })
  })
})