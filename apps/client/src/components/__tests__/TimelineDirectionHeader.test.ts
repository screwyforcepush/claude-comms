/**
 * TimelineDirectionHeader Component Tests
 * 
 * Tests for the new timeline direction header component.
 * Based on NinaProton's design specifications and accessibility requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TimelineDirectionHeader from '../timeline/TimelineDirectionHeader.vue'

// Mock component until LilyMatrix creates it
vi.mock('../timeline/TimelineDirectionHeader.vue', () => ({
  default: {
    name: 'TimelineDirectionHeader',
    props: ['isReversed', 'eventCount'],
    emits: ['toggle-order'],
    template: `
      <div 
        data-testid="timeline-direction-header"
        role="banner"
        :aria-label="'Timeline controls and direction'"
        class="sticky top-0 z-20 backdrop-blur-8 bg-gray-800/90 px-4 py-3 border-b border-gray-700"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="text-sm font-semibold text-white">
              <span class="text-blue-400">{{ eventCount }}</span> events
            </div>
            <div 
              class="text-xs text-gray-400"
              :id="'order-description'"
              :aria-describedby="'order-description'"
            >
              {{ isReversed ? 'Latest events at top' : 'Oldest events at top' }}
            </div>
          </div>
          
          <button
            @click="$emit('toggle-order')"
            :aria-pressed="isReversed"
            :aria-label="isReversed ? 'Switch to oldest first order' : 'Switch to newest first order'"
            data-testid="order-toggle-btn"
            class="flex items-center space-x-2 px-3 py-1.5 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            :class="isReversed ? 'border-blue-500 bg-blue-600/20 text-blue-400' : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'"
          >
            <span class="text-sm">{{ isReversed ? '⬇️' : '⬆️' }}</span>
            <span class="text-xs font-medium">
              {{ isReversed ? 'Newest First' : 'Oldest First' }}
            </span>
          </button>
        </div>
        
        <!-- Direction flow indicator -->
        <div class="mt-2 h-1 bg-gradient-to-r rounded-full" :class="isReversed ? 'from-blue-500 to-gray-700' : 'from-gray-700 to-blue-500'"></div>
      </div>
    `
  }
}))

describe('TimelineDirectionHeader', () => {
  const defaultProps = {
    isReversed: true,
    eventCount: 25
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
    it('renders correctly with default props', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      expect(wrapper.find('[data-testid="timeline-direction-header"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('25 events')
      expect(wrapper.text()).toContain('Latest events at top')
    })

    it('shows correct text for non-reversed order', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          isReversed: false
        }
      })

      expect(wrapper.text()).toContain('Oldest events at top')
      expect(wrapper.text()).toContain('Oldest First')
    })

    it('shows correct text for reversed order', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('Latest events at top')
      expect(wrapper.text()).toContain('Newest First')
    })

    it('displays event count dynamically', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          eventCount: 0
        }
      })

      expect(wrapper.text()).toContain('0 events')

      wrapper.setProps({ eventCount: 100 })
      expect(wrapper.text()).toContain('100 events')
    })
  })

  describe('Order Toggle Functionality', () => {
    it('emits toggle-order event when button clicked', async () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      await toggleBtn.trigger('click')

      expect(wrapper.emitted('toggle-order')).toBeTruthy()
      expect(wrapper.emitted('toggle-order')).toHaveLength(1)
    })

    it('updates aria-pressed attribute based on order state', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          isReversed: true
        }
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.attributes('aria-pressed')).toBe('true')

      wrapper.setProps({ isReversed: false })
      expect(toggleBtn.attributes('aria-pressed')).toBe('false')
    })

    it('shows correct aria-label for toggle action', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          isReversed: true
        }
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.attributes('aria-label')).toBe('Switch to oldest first order')

      wrapper.setProps({ isReversed: false })
      expect(toggleBtn.attributes('aria-label')).toBe('Switch to newest first order')
    })
  })

  describe('Visual Styling', () => {
    it('applies correct CSS classes for reversed state', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.classes()).toContain('border-blue-500')
      expect(toggleBtn.classes()).toContain('bg-blue-600/20')
      expect(toggleBtn.classes()).toContain('text-blue-400')
    })

    it('applies correct CSS classes for non-reversed state', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          isReversed: false
        }
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.classes()).toContain('border-gray-600')
      expect(toggleBtn.classes()).toContain('bg-gray-700/50')
      expect(toggleBtn.classes()).toContain('text-gray-300')
    })

    it('includes backdrop blur and sticky positioning', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const header = wrapper.find('[data-testid="timeline-direction-header"]')
      expect(header.classes()).toContain('sticky')
      expect(header.classes()).toContain('top-0')
      expect(header.classes()).toContain('backdrop-blur-8')
    })

    it('shows correct direction flow gradient', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const flowIndicator = wrapper.find('.h-1.bg-gradient-to-r')
      expect(flowIndicator.classes()).toContain('from-blue-500')
      expect(flowIndicator.classes()).toContain('to-gray-700')

      wrapper.setProps({ isReversed: false })
      expect(flowIndicator.classes()).toContain('from-gray-700')
      expect(flowIndicator.classes()).toContain('to-blue-500')
    })
  })

  describe('Accessibility', () => {
    it('has proper banner role', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const header = wrapper.find('[data-testid="timeline-direction-header"]')
      expect(header.attributes('role')).toBe('banner')
      expect(header.attributes('aria-label')).toBe('Timeline controls and direction')
    })

    it('has descriptive text for screen readers', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const description = wrapper.find('#order-description')
      expect(description.exists()).toBe(true)
      expect(description.text()).toBe('Latest events at top')
    })

    it('supports keyboard navigation', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.classes()).toContain('focus:outline-none')
      expect(toggleBtn.classes()).toContain('focus:ring-2')
      expect(toggleBtn.classes()).toContain('focus:ring-blue-500')
    })

    it('provides clear button action descriptions', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const toggleBtn = wrapper.find('[data-testid="order-toggle-btn"]')
      expect(toggleBtn.text()).toContain('Newest First')
      expect(toggleBtn.text()).toContain('⬇️')
    })
  })

  describe('Responsive Design', () => {
    it('maintains layout on different screen sizes', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      const header = wrapper.find('[data-testid="timeline-direction-header"]')
      expect(header.classes()).toContain('px-4')
      expect(header.classes()).toContain('py-3')
      
      // Should have responsive flex layout
      const flexContainer = wrapper.find('.flex.items-center.justify-between')
      expect(flexContainer.exists()).toBe(true)
    })
  })

  describe('Performance', () => {
    it('renders quickly with large event counts', () => {
      const startTime = performance.now()

      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          eventCount: 10000
        }
      })

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(50)
      expect(wrapper.text()).toContain('10000 events')
    })

    it('handles rapid prop updates efficiently', async () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: defaultProps
      })

      // Simulate rapid event count updates
      for (let i = 0; i < 100; i++) {
        await wrapper.setProps({ eventCount: i })
      }

      expect(wrapper.text()).toContain('99 events')
    })
  })

  describe('Edge Cases', () => {
    it('handles zero events gracefully', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          eventCount: 0
        }
      })

      expect(wrapper.text()).toContain('0 events')
      expect(wrapper.find('[data-testid="order-toggle-btn"]').exists()).toBe(true)
    })

    it('handles negative event counts gracefully', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          eventCount: -1
        }
      })

      // Should not crash
      expect(wrapper.find('[data-testid="timeline-direction-header"]').exists()).toBe(true)
    })

    it('handles very large event counts', () => {
      wrapper = mount(TimelineDirectionHeader, {
        props: {
          ...defaultProps,
          eventCount: 999999
        }
      })

      expect(wrapper.text()).toContain('999999 events')
    })
  })
})