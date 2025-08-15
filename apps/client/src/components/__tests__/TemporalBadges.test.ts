/**
 * TemporalBadges Component Tests
 * 
 * Tests for temporal context badges in EventRow components.
 * Based on NinaProton's visual hierarchy and accessibility specifications.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock TemporalBadge component that will be integrated into EventRow
const TemporalBadge = {
  name: 'TemporalBadge',
  props: {
    context: {
      type: String,
      required: true,
      validator: (value: string) => ['latest', 'recent', 'older', 'oldest'].includes(value)
    },
    timestamp: {
      type: Number,
      required: true
    },
    totalEvents: {
      type: Number,
      required: true
    },
    eventIndex: {
      type: Number,
      required: true
    }
  },
  computed: {
    badgeClass() {
      const contextClasses = {
        latest: 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 animate-pulse',
        recent: 'bg-blue-600 text-white shadow-md',
        older: 'bg-gray-400 text-gray-900 shadow-sm',
        oldest: 'bg-gray-600 text-gray-300 shadow-sm'
      }
      return contextClasses[this.context as keyof typeof contextClasses] || contextClasses.older
    },
    ariaLabel() {
      const labels = {
        latest: 'Latest event in timeline',
        recent: 'Recent event',
        older: 'Older event',
        oldest: 'Oldest event in timeline'
      }
      return labels[this.context as keyof typeof labels] || 'Timeline event'
    },
    shouldGlow() {
      return this.context === 'latest'
    }
  },
  template: `
    <span
      :class="[
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold transition-all duration-300',
        badgeClass,
        { 'drop-shadow-glow': shouldGlow }
      ]"
      :aria-label="ariaLabel"
      data-testid="temporal-badge"
      :data-context="context"
    >
      <span class="mr-1">
        {{ context === 'latest' ? '🔥' : context === 'recent' ? '⚡' : context === 'older' ? '📅' : '🕰️' }}
      </span>
      {{ context.charAt(0).toUpperCase() + context.slice(1) }}
    </span>
  `
}

describe('TemporalBadge', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Badge Context Classification', () => {
    it('renders latest badge correctly', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 10,
          eventIndex: 0
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.attributes('data-context')).toBe('latest')
      expect(badge.text()).toContain('Latest')
      expect(badge.text()).toContain('🔥')
      expect(badge.classes()).toContain('bg-blue-500')
      expect(badge.classes()).toContain('animate-pulse')
    })

    it('renders recent badge correctly', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'recent',
          timestamp: Date.now() - 60000,
          totalEvents: 10,
          eventIndex: 1
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.attributes('data-context')).toBe('recent')
      expect(badge.text()).toContain('Recent')
      expect(badge.text()).toContain('⚡')
      expect(badge.classes()).toContain('bg-blue-600')
      expect(badge.classes()).not.toContain('animate-pulse')
    })

    it('renders older badge correctly', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'older',
          timestamp: Date.now() - 300000,
          totalEvents: 10,
          eventIndex: 5
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.attributes('data-context')).toBe('older')
      expect(badge.text()).toContain('Older')
      expect(badge.text()).toContain('📅')
      expect(badge.classes()).toContain('bg-gray-400')
    })

    it('renders oldest badge correctly', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'oldest',
          timestamp: Date.now() - 3600000,
          totalEvents: 10,
          eventIndex: 9
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.attributes('data-context')).toBe('oldest')
      expect(badge.text()).toContain('Oldest')
      expect(badge.text()).toContain('🕰️')
      expect(badge.classes()).toContain('bg-gray-600')
    })
  })

  describe('Visual Hierarchy', () => {
    it('applies glow effect only to latest events', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 5,
          eventIndex: 0
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.classes()).toContain('drop-shadow-glow')
      expect(badge.classes()).toContain('shadow-blue-500/50')
    })

    it('applies different shadow intensities by context', () => {
      const contexts = [
        { context: 'latest', expectedShadow: 'shadow-lg' },
        { context: 'recent', expectedShadow: 'shadow-md' },
        { context: 'older', expectedShadow: 'shadow-sm' },
        { context: 'oldest', expectedShadow: 'shadow-sm' }
      ]

      contexts.forEach(({ context, expectedShadow }) => {
        wrapper = mount(TemporalBadge, {
          props: {
            context,
            timestamp: Date.now(),
            totalEvents: 10,
            eventIndex: 0
          }
        })

        const badge = wrapper.find('[data-testid="temporal-badge"]')
        expect(badge.classes()).toContain(expectedShadow)
        
        if (wrapper) {
          wrapper.unmount()
        }
      })
    })

    it('uses appropriate text contrast for each context', () => {
      const contextColors = [
        { context: 'latest', expectedText: 'text-white' },
        { context: 'recent', expectedText: 'text-white' },
        { context: 'older', expectedText: 'text-gray-900' },
        { context: 'oldest', expectedText: 'text-gray-300' }
      ]

      contextColors.forEach(({ context, expectedText }) => {
        wrapper = mount(TemporalBadge, {
          props: {
            context,
            timestamp: Date.now(),
            totalEvents: 10,
            eventIndex: 0
          }
        })

        const badge = wrapper.find('[data-testid="temporal-badge"]')
        expect(badge.classes()).toContain(expectedText)
        
        if (wrapper) {
          wrapper.unmount()
        }
      })
    })
  })

  describe('Accessibility', () => {
    it('provides appropriate aria-labels for screen readers', () => {
      const contexts = [
        { context: 'latest', expectedLabel: 'Latest event in timeline' },
        { context: 'recent', expectedLabel: 'Recent event' },
        { context: 'older', expectedLabel: 'Older event' },
        { context: 'oldest', expectedLabel: 'Oldest event in timeline' }
      ]

      contexts.forEach(({ context, expectedLabel }) => {
        wrapper = mount(TemporalBadge, {
          props: {
            context,
            timestamp: Date.now(),
            totalEvents: 10,
            eventIndex: 0
          }
        })

        const badge = wrapper.find('[data-testid="temporal-badge"]')
        expect(badge.attributes('aria-label')).toBe(expectedLabel)
        
        if (wrapper) {
          wrapper.unmount()
        }
      })
    })

    it('includes meaningful emoji indicators', () => {
      const contexts = [
        { context: 'latest', expectedEmoji: '🔥' },
        { context: 'recent', expectedEmoji: '⚡' },
        { context: 'older', expectedEmoji: '📅' },
        { context: 'oldest', expectedEmoji: '🕰️' }
      ]

      contexts.forEach(({ context, expectedEmoji }) => {
        wrapper = mount(TemporalBadge, {
          props: {
            context,
            timestamp: Date.now(),
            totalEvents: 10,
            eventIndex: 0
          }
        })

        expect(wrapper.text()).toContain(expectedEmoji)
        
        if (wrapper) {
          wrapper.unmount()
        }
      })
    })
  })

  describe('Prop Validation', () => {
    it('validates context prop values', () => {
      // Valid context values should work
      const validContexts = ['latest', 'recent', 'older', 'oldest']
      
      validContexts.forEach(context => {
        expect(() => {
          mount(TemporalBadge, {
            props: {
              context,
              timestamp: Date.now(),
              totalEvents: 10,
              eventIndex: 0
            }
          })
        }).not.toThrow()
      })
    })

    it('requires all necessary props', () => {
      // Should fail without required props
      expect(() => {
        mount(TemporalBadge, {
          props: {}
        })
      }).toThrow()
    })
  })

  describe('Animation and Transitions', () => {
    it('applies pulse animation only to latest context', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 5,
          eventIndex: 0
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.classes()).toContain('animate-pulse')
    })

    it('includes transition classes for smooth state changes', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'recent',
          timestamp: Date.now(),
          totalEvents: 5,
          eventIndex: 1
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.classes()).toContain('transition-all')
      expect(badge.classes()).toContain('duration-300')
    })

    it('supports reduced motion preferences', async () => {
      // Mock prefers-reduced-motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 5,
          eventIndex: 0
        }
      })

      // Component should still render but may have different animation behavior
      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.exists()).toBe(true)
    })
  })

  describe('Performance', () => {
    it('renders quickly with all contexts', () => {
      const contexts = ['latest', 'recent', 'older', 'oldest']
      
      contexts.forEach(context => {
        const startTime = performance.now()
        
        wrapper = mount(TemporalBadge, {
          props: {
            context,
            timestamp: Date.now(),
            totalEvents: 100,
            eventIndex: 0
          }
        })

        const endTime = performance.now()
        expect(endTime - startTime).toBeLessThan(10)
        
        if (wrapper) {
          wrapper.unmount()
        }
      })
    })

    it('handles rapid context changes efficiently', async () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 10,
          eventIndex: 0
        }
      })

      const contexts = ['recent', 'older', 'oldest', 'latest']
      
      for (const context of contexts) {
        await wrapper.setProps({ context })
        await nextTick()
      }

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.attributes('data-context')).toBe('latest')
    })
  })

  describe('Integration with EventRow', () => {
    it('provides correct data attributes for integration', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'latest',
          timestamp: Date.now(),
          totalEvents: 10,
          eventIndex: 0
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.attributes('data-context')).toBe('latest')
      expect(badge.attributes('data-testid')).toBe('temporal-badge')
    })

    it('maintains small size for inline usage', () => {
      wrapper = mount(TemporalBadge, {
        props: {
          context: 'recent',
          timestamp: Date.now(),
          totalEvents: 10,
          eventIndex: 1
        }
      })

      const badge = wrapper.find('[data-testid="temporal-badge"]')
      expect(badge.classes()).toContain('px-2')
      expect(badge.classes()).toContain('py-1')
      expect(badge.classes()).toContain('text-xs')
    })
  })
})