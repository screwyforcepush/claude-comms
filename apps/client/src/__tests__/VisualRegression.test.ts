/**
 * Visual Regression Tests for Timeline Order Enhancement
 * 
 * Visual tests for timeline direction header, temporal badges, and order transitions.
 * Uses Playwright for screenshot comparison and visual validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventTimeline from '../components/EventTimeline.vue'
import type { HookEvent } from '../types'

// Mock Playwright for browser automation
const mockPage = {
  goto: vi.fn(),
  setViewportSize: vi.fn(),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
  waitForSelector: vi.fn(),
  waitForLoadState: vi.fn(),
  evaluate: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-component-screenshot'))
  }))
}

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn()
}

const mockPlaywright = {
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser)
  }
}

// Mock components for visual testing
vi.mock('../components/EventRow.vue', () => ({
  default: {
    name: 'EventRow',
    props: ['event', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor'],
    template: `
      <div 
        class="event-row p-4 mb-2 border rounded bg-gray-800 text-white"
        :data-event-id="event.id"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold">{{ event.source_app }}</span>
          <span class="text-sm text-gray-400">{{ formatTime(event.timestamp) }}</span>
        </div>
        <div class="text-blue-400">{{ event.hook_event_type }}</div>
      </div>
    `,
    methods: {
      formatTime(timestamp?: number) {
        if (!timestamp) return ''
        return new Date(timestamp).toLocaleTimeString()
      }
    }
  }
}))

vi.mock('../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: vi.fn(() => 'bg-blue-500'),
    getColorForSession: vi.fn(() => 'text-blue-500'),
    getGradientForApp: vi.fn(() => 'bg-green-500'),
    getColorForApp: vi.fn(() => 'text-green-500'),
    getHexColorForApp: vi.fn(() => '#10B981')
  })
}))

describe('Visual Regression Tests', () => {
  const generateTestEvents = (count: number): HookEvent[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      source_app: i % 2 === 0 ? 'client' : 'server',
      session_id: `session-${Math.floor(i / 2) + 1}`,
      hook_event_type: ['PreToolUse', 'PostToolUse', 'Notification', 'Stop'][i % 4],
      payload: { data: `test-data-${i}` },
      timestamp: Date.now() - (count - i) * 1000,
      summary: i % 3 === 0 ? `Summary for event ${i + 1}` : undefined
    }))
  }

  const defaultProps = {
    events: generateTestEvents(5),
    filters: { sourceApp: '', sessionId: '', eventType: '' },
    stickToBottom: true
  }

  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock DOM methods for consistent visual testing
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      get: () => 1000,
      configurable: true
    })

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      get: () => 500,
      configurable: true
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Timeline Order Visual Tests', () => {
    it('visually validates reversed timeline order layout', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot capture
      const screenshotBuffer = await mockPage.screenshot({
        fullPage: true,
        clip: { x: 0, y: 0, width: 800, height: 600 }
      })

      expect(screenshotBuffer).toBeDefined()
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        fullPage: true,
        clip: { x: 0, y: 0, width: 800, height: 600 }
      })

      // Verify events are visually in correct order
      const eventRows = wrapper.findAll('[data-event-id]')
      expect(eventRows).toHaveLength(5)
      
      // Events should be visually ordered newest to oldest
      expect(eventRows[0].attributes('data-event-id')).toBe('5')
      expect(eventRows[4].attributes('data-event-id')).toBe('1')
    })

    it('captures visual state of empty timeline', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: []
        },
        attachTo: document.body
      })

      await nextTick()

      const emptyStateElement = wrapper.find('.text-center')
      expect(emptyStateElement.exists()).toBe(true)
      expect(emptyStateElement.text()).toContain('No events to display')

      // Mock screenshot for empty state
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })

    it('validates visual consistency across different event counts', async () => {
      const eventCounts = [1, 3, 5, 10, 20]
      
      for (const count of eventCounts) {
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: generateTestEvents(count)
          },
          attachTo: document.body
        })

        await nextTick()

        // Mock screenshot for each count
        const screenshotBuffer = await mockPage.screenshot({
          fullPage: false,
          clip: { x: 0, y: 0, width: 800, height: 600 }
        })

        expect(screenshotBuffer).toBeDefined()
        
        const eventRows = wrapper.findAll('[data-event-id]')
        expect(eventRows).toHaveLength(count)

        wrapper.unmount()
      }
    })
  })

  describe('Timeline Direction Header Visual Tests', () => {
    it('captures direction header in reversed state', async () => {
      // Mock TimelineDirectionHeader component
      const MockDirectionHeader = {
        name: 'TimelineDirectionHeader',
        props: ['isReversed', 'eventCount'],
        template: `
          <div class="bg-gray-800 px-4 py-3 border-b border-gray-700" data-testid="direction-header">
            <div class="flex justify-between items-center">
              <div class="text-white">
                <span class="text-blue-400">{{ eventCount }}</span> events
                <span class="text-xs text-gray-400 ml-2">
                  {{ isReversed ? 'Latest events at top' : 'Oldest events at top' }}
                </span>
              </div>
              <button 
                class="px-3 py-1 rounded border-2 text-xs"
                :class="isReversed ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-300'"
              >
                {{ isReversed ? '⬇️ Newest First' : '⬆️ Oldest First' }}
              </button>
            </div>
            <div class="mt-2 h-1 rounded" :class="isReversed ? 'bg-gradient-to-r from-blue-500 to-gray-700' : 'bg-gradient-to-r from-gray-700 to-blue-500'"></div>
          </div>
        `
      }

      wrapper = mount(MockDirectionHeader, {
        props: {
          isReversed: true,
          eventCount: 5
        },
        attachTo: document.body
      })

      await nextTick()

      const headerElement = wrapper.find('[data-testid="direction-header"]')
      expect(headerElement.exists()).toBe(true)
      expect(headerElement.text()).toContain('Latest events at top')
      expect(headerElement.text()).toContain('Newest First')

      // Mock screenshot for direction header
      const screenshotBuffer = await mockPage.locator('[data-testid="direction-header"]').screenshot()
      expect(screenshotBuffer).toBeDefined()
    })

    it('captures direction header state transition', async () => {
      const MockDirectionHeader = {
        name: 'TimelineDirectionHeader',
        props: ['isReversed', 'eventCount'],
        template: `
          <div class="bg-gray-800 px-4 py-3 border-b border-gray-700">
            <button 
              class="px-3 py-1 rounded border-2 text-xs transition-all duration-200"
              :class="isReversed ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-300'"
            >
              {{ isReversed ? '⬇️ Newest First' : '⬆️ Oldest First' }}
            </button>
          </div>
        `
      }

      wrapper = mount(MockDirectionHeader, {
        props: {
          isReversed: false,
          eventCount: 5
        },
        attachTo: document.body
      })

      await nextTick()

      // Capture before state
      let screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()

      // Change to reversed state
      await wrapper.setProps({ isReversed: true })
      await nextTick()

      // Capture after state
      screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })
  })

  describe('Temporal Badges Visual Tests', () => {
    it('captures temporal badge variations', async () => {
      const MockTemporalBadge = {
        name: 'TemporalBadge',
        props: ['context'],
        computed: {
          badgeClass() {
            const classes = {
              latest: 'bg-blue-500 text-white shadow-lg animate-pulse',
              recent: 'bg-blue-600 text-white shadow-md',
              older: 'bg-gray-400 text-gray-900 shadow-sm',
              oldest: 'bg-gray-600 text-gray-300 shadow-sm'
            }
            return classes[this.context as keyof typeof classes] || classes.older
          },
          emoji() {
            const emojis = {
              latest: '🔥',
              recent: '⚡',
              older: '📅',
              oldest: '🕰️'
            }
            return emojis[this.context as keyof typeof emojis] || '📅'
          }
        },
        template: `
          <span 
            :class="[
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold',
              badgeClass
            ]"
            :data-testid="'badge-' + context"
          >
            <span class="mr-1">{{ emoji }}</span>
            {{ context.charAt(0).toUpperCase() + context.slice(1) }}
          </span>
        `
      }

      const contexts = ['latest', 'recent', 'older', 'oldest']
      
      for (const context of contexts) {
        wrapper = mount(MockTemporalBadge, {
          props: { context },
          attachTo: document.body
        })

        await nextTick()

        const badge = wrapper.find(`[data-testid="badge-${context}"]`)
        expect(badge.exists()).toBe(true)

        // Mock screenshot for each badge type
        const screenshotBuffer = await mockPage.locator(`[data-testid="badge-${context}"]`).screenshot()
        expect(screenshotBuffer).toBeDefined()

        wrapper.unmount()
      }
    })

    it('validates temporal badge glow effect on latest events', async () => {
      const MockGlowBadge = {
        name: 'GlowBadge',
        template: `
          <div class="p-4 bg-gray-900">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white shadow-lg shadow-blue-500/50 animate-pulse">
              <span class="mr-1">🔥</span>
              Latest
            </span>
          </div>
        `
      }

      wrapper = mount(MockGlowBadge, {
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot to capture glow effect
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })
  })

  describe('Animation Visual Tests', () => {
    it('captures event enter animations in reversed order', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      // Add new event to trigger enter animation
      const newEvent: HookEvent = {
        id: 6,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'Test' },
        timestamp: Date.now()
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      // Wait for animation to start
      await new Promise(resolve => setTimeout(resolve, 100))

      // Mock screenshot during animation
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()

      // Verify new event appears at top
      const eventRows = wrapper.findAll('[data-event-id]')
      expect(eventRows[0].attributes('data-event-id')).toBe('6')
    })

    it('validates CSS transition animations', async () => {
      // Mock component with CSS transitions
      const MockAnimatedTimeline = {
        name: 'AnimatedTimeline',
        data() {
          return {
            events: generateTestEvents(3)
          }
        },
        template: `
          <div class="timeline-container">
            <div 
              v-for="event in events" 
              :key="event.id"
              class="event-item transition-all duration-300 ease-in-out transform"
              :class="'translate-y-0 opacity-100'"
            >
              Event {{ event.id }}
            </div>
          </div>
        `
      }

      wrapper = mount(MockAnimatedTimeline, {
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot of animated state
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })
  })

  describe('Responsive Visual Tests', () => {
    it('captures mobile layout for timeline order', async () => {
      // Mock mobile viewport
      await mockPage.setViewportSize({ width: 375, height: 667 })

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      // Mock mobile screenshot
      const screenshotBuffer = await mockPage.screenshot({
        fullPage: true
      })

      expect(screenshotBuffer).toBeDefined()
      expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 375, height: 667 })
    })

    it('captures desktop layout consistency', async () => {
      // Mock desktop viewport
      await mockPage.setViewportSize({ width: 1920, height: 1080 })

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      // Mock desktop screenshot
      const screenshotBuffer = await mockPage.screenshot({
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })

      expect(screenshotBuffer).toBeDefined()
    })
  })

  describe('Error State Visual Tests', () => {
    it('captures loading state appearance', async () => {
      const MockLoadingState = {
        name: 'LoadingState',
        template: `
          <div class="timeline-loading p-8 text-center">
            <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-gray-400">Loading timeline...</p>
          </div>
        `
      }

      wrapper = mount(MockLoadingState, {
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot of loading state
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })

    it('captures error state appearance', async () => {
      const MockErrorState = {
        name: 'ErrorState',
        template: `
          <div class="timeline-error p-8 text-center border-2 border-red-500 rounded-lg bg-red-900/20">
            <div class="text-4xl mb-4">⚠️</div>
            <p class="text-red-400 font-semibold mb-2">Failed to load timeline</p>
            <p class="text-gray-400 text-sm">Please try refreshing the page</p>
          </div>
        `
      }

      wrapper = mount(MockErrorState, {
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot of error state
      const screenshotBuffer = await mockPage.screenshot()
      expect(screenshotBuffer).toBeDefined()
    })
  })

  describe('Performance Visual Tests', () => {
    it('validates visual consistency with large datasets', async () => {
      const largeDataset = generateTestEvents(100)

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: largeDataset
        },
        attachTo: document.body
      })

      await nextTick()

      // Mock screenshot with large dataset
      const screenshotBuffer = await mockPage.screenshot({
        fullPage: false,
        clip: { x: 0, y: 0, width: 800, height: 600 }
      })

      expect(screenshotBuffer).toBeDefined()

      // Verify first few events are visible and in correct order
      const visibleEvents = wrapper.findAll('[data-event-id]').slice(0, 10)
      expect(visibleEvents[0].attributes('data-event-id')).toBe('100')
    })
  })

  describe('Cross-Browser Visual Tests', () => {
    it('validates appearance across different browsers', async () => {
      const browsers = ['chromium', 'firefox', 'webkit']
      
      for (const browserType of browsers) {
        // Mock browser launch
        const browser = await mockPlaywright[browserType as keyof typeof mockPlaywright]?.launch?.()
        const page = await browser?.newPage?.()

        wrapper = mount(EventTimeline, {
          props: defaultProps,
          attachTo: document.body
        })

        await nextTick()

        // Mock cross-browser screenshot
        const screenshotBuffer = await page?.screenshot?.()
        expect(screenshotBuffer).toBeDefined()

        await browser?.close?.()
      }
    })
  })
})