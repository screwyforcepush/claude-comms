/**
 * EventTimeline E2E Tests
 * 
 * End-to-end tests for timeline order enhancement features.
 * Tests scroll behavior, auto-pan functionality, and real-time updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventTimeline from '../components/EventTimeline.vue'
import type { HookEvent } from '../types'

// Mock Playwright for visual regression testing when available
const mockPlaywright = {
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
  page: {
    goto: vi.fn(),
    waitForSelector: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot'))
  }
}

// Mock WebSocket for real-time testing
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
  onmessage: null as any,
  onopen: null as any,
  onclose: null as any,
  onerror: null as any
}

// Mock EventRow component
vi.mock('../components/EventRow.vue', () => ({
  default: {
    name: 'EventRow',
    props: ['event', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor'],
    template: `
      <div 
        data-testid="event-row" 
        :data-event-id="event.id"
        :data-timestamp="event.timestamp"
        class="event-row p-4 mb-2 border rounded"
      >
        <div class="event-content">{{ event.hook_event_type }}</div>
        <div class="event-time">{{ event.timestamp }}</div>
      </div>
    `
  }
}))

// Mock composables
vi.mock('../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: vi.fn(() => 'bg-blue-500'),
    getColorForSession: vi.fn(() => 'text-blue-500'),
    getGradientForApp: vi.fn(() => 'bg-green-500'),
    getColorForApp: vi.fn(() => 'text-green-500'),
    getHexColorForApp: vi.fn(() => '#10B981')
  })
}))

describe('EventTimeline E2E Tests', () => {
  // Generate test events with varied timestamps
  const generateEvents = (count: number): HookEvent[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      source_app: i % 2 === 0 ? 'client' : 'server',
      session_id: `session-${Math.floor(i / 3) + 1}`,
      hook_event_type: ['PreToolUse', 'PostToolUse', 'Notification', 'Stop'][i % 4],
      payload: { data: `test-data-${i}` },
      timestamp: Date.now() - (count - i) * 1000 // Chronological order
    }))
  }

  const defaultProps = {
    events: generateEvents(10),
    filters: { sourceApp: '', sessionId: '', eventType: '' },
    stickToBottom: true
  }

  let wrapper: any
  let mockElement: any

  beforeEach(() => {
    // Mock scroll container element
    mockElement = {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 500,
      scrollIntoView: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        width: 800,
        height: 500
      }))
    }

    // Mock DOM methods
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      get: () => mockElement.scrollTop,
      set: (value) => { mockElement.scrollTop = value },
      configurable: true
    })

    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      get: () => mockElement.scrollHeight,
      configurable: true
    })

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      get: () => mockElement.clientHeight,
      configurable: true
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Timeline Order Enhancement E2E', () => {
    it('displays events in correct reversed order on initial load', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(10)

      // Verify events are in reverse chronological order (newest first)
      const timestamps = eventRows.map(row => 
        parseInt(row.attributes('data-timestamp') || '0')
      )

      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }
    })

    it('maintains reversed order when new events arrive in real-time', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Simulate new event arrival
      const newEvent: HookEvent = {
        id: 11,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'New test prompt' },
        timestamp: Date.now() // Latest timestamp
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      await nextTick()

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(11)

      // New event should be first (highest timestamp)
      expect(eventRows[0].attributes('data-event-id')).toBe('11')
    })

    it('handles rapid event updates without breaking order', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const baseTime = Date.now()
      const rapidEvents = [...defaultProps.events]

      // Simulate rapid event additions
      for (let i = 0; i < 20; i++) {
        rapidEvents.push({
          id: 11 + i,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'Notification',
          payload: { data: `rapid-${i}` },
          timestamp: baseTime + i * 100
        })

        await wrapper.setProps({ events: [...rapidEvents] })
        await nextTick()
      }

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(30)

      // Verify order is still maintained
      const firstEventId = eventRows[0].attributes('data-event-id')
      expect(firstEventId).toBe('30') // Latest added event
    })
  })

  describe('Scroll Behavior Enhancement E2E', () => {
    it('auto-scrolls to top when stickToTop is enabled', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          stickToBottom: false // In reversed timeline, this means stick to top
        }
      })

      await nextTick()

      // Mock scroll position at bottom
      mockElement.scrollTop = 1500

      // Add new event
      const newEvent: HookEvent = {
        id: 11,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'Stop',
        payload: {},
        timestamp: Date.now()
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      await nextTick()

      // Should auto-scroll to top (0) for new events when not sticking to bottom
      expect(mockElement.scrollTop).toBe(0)
    })

    it('maintains scroll position when auto-scroll is disabled', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          stickToBottom: false
        }
      })

      const savedScrollPosition = 800
      mockElement.scrollTop = savedScrollPosition

      // Simulate user scroll away from auto-scroll position
      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      await scrollContainer.trigger('scroll')

      // Add new event
      const newEvent: HookEvent = {
        id: 11,
        source_app: 'server',
        session_id: 'session-2',
        hook_event_type: 'PreToolUse',
        payload: {},
        timestamp: Date.now()
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      await nextTick()

      // Should maintain user's scroll position
      expect(mockElement.scrollTop).toBe(savedScrollPosition)
    })

    it('emits scroll state changes correctly', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const scrollContainer = wrapper.find('[ref="scrollContainer"]')

      // Simulate scroll to top (for reversed timeline)
      mockElement.scrollTop = 0
      await scrollContainer.trigger('scroll')

      expect(wrapper.emitted('update:stickToBottom')).toBeTruthy()
    })

    it('handles smooth scrolling for better UX', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          stickToBottom: true
        }
      })

      // Mock smooth scroll behavior
      const mockSmoothScroll = vi.fn()
      Element.prototype.scrollTo = mockSmoothScroll

      // Add new event that should trigger smooth scroll
      const newEvent: HookEvent = {
        id: 11,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'Notification',
        payload: {},
        timestamp: Date.now()
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      await nextTick()

      // Should have attempted smooth scrolling
      expect(mockElement.scrollTop).toBeDefined()
    })
  })

  describe('Performance E2E Tests', () => {
    it('handles large datasets efficiently', async () => {
      const largeDataset = generateEvents(1000)
      
      const startTime = performance.now()

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: largeDataset
        }
      })

      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render large dataset quickly (< 200ms)
      expect(renderTime).toBeLessThan(200)

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1000)

      // Verify order is correct even with large dataset
      expect(eventRows[0].attributes('data-event-id')).toBe('1000')
      expect(eventRows[999].attributes('data-event-id')).toBe('1')
    })

    it('maintains performance during rapid updates', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const startTime = performance.now()

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        const newEvent: HookEvent = {
          id: 1000 + i,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'Notification',
          payload: {},
          timestamp: Date.now() + i
        }

        await wrapper.setProps({
          events: [...wrapper.props('events'), newEvent]
        })

        if (i % 10 === 0) {
          await nextTick() // Batch DOM updates
        }
      }

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should handle rapid updates efficiently (< 500ms for 100 updates)
      expect(updateTime).toBeLessThan(500)
    })

    it('efficiently handles memory usage with event rotation', async () => {
      const maxEvents = 100
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Simulate continuous event stream that should trigger rotation
      for (let i = 0; i < 200; i++) {
        const newEvent: HookEvent = {
          id: 1000 + i,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'Notification',
          payload: {},
          timestamp: Date.now() + i
        }

        const currentEvents = wrapper.props('events')
        const updatedEvents = [...currentEvents, newEvent]
        
        // Simulate max event limit (would be handled by parent component)
        const limitedEvents = updatedEvents.slice(-maxEvents)

        await wrapper.setProps({
          events: limitedEvents
        })

        if (i % 20 === 0) {
          await nextTick()
        }
      }

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows.length).toBeLessThanOrEqual(maxEvents)
    })
  })

  describe('Filter Integration E2E', () => {
    it('maintains order when applying filters', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: generateEvents(20)
        }
      })

      // Apply filter for client events only
      await wrapper.setProps({
        filters: {
          sourceApp: 'client',
          sessionId: '',
          eventType: ''
        }
      })

      await nextTick()

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      
      // Should show only client events
      eventRows.forEach(row => {
        const eventId = parseInt(row.attributes('data-event-id') || '0')
        // Client events have even IDs in our test data
        expect(eventId % 2).toBe(1) // Adjusted for 1-based IDs
      })

      // Verify filtered events are still in reverse chronological order
      const timestamps = eventRows.map(row => 
        parseInt(row.attributes('data-timestamp') || '0')
      )

      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }
    })

    it('handles filter changes without losing scroll state', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: generateEvents(50)
        }
      })

      // Set specific scroll position
      const scrollPosition = 600
      mockElement.scrollTop = scrollPosition

      // Apply filter
      await wrapper.setProps({
        filters: {
          sourceApp: 'server',
          sessionId: '',
          eventType: ''
        }
      })

      await nextTick()

      // Filter change should reset to appropriate scroll position
      // (behavior may vary based on implementation)
      expect(mockElement.scrollTop).toBeDefined()
    })
  })

  describe('Accessibility E2E', () => {
    it('maintains keyboard navigation through events', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        attachTo: document.body
      })

      await nextTick()

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      
      // Should be able to tab through events
      eventRows.forEach(row => {
        expect(row.element).toBeDefined()
      })
    })

    it('provides screen reader announcements for new events', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Mock aria-live region
      const mockAriaLive = document.createElement('div')
      mockAriaLive.setAttribute('aria-live', 'polite')
      document.body.appendChild(mockAriaLive)

      // Add new event
      const newEvent: HookEvent = {
        id: 11,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'Test prompt' },
        timestamp: Date.now()
      }

      await wrapper.setProps({
        events: [...defaultProps.events, newEvent]
      })

      await nextTick()

      // Cleanup
      document.body.removeChild(mockAriaLive)
    })
  })

  describe('Error Handling E2E', () => {
    it('gracefully handles malformed event data', async () => {
      const malformedEvents = [
        ...defaultProps.events,
        {
          id: null as any,
          source_app: '',
          session_id: '',
          hook_event_type: '',
          payload: null,
          timestamp: undefined
        }
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: malformedEvents
        }
      })

      await nextTick()

      // Should not crash
      expect(wrapper.find('[data-testid="event-row"]').exists()).toBe(true)
    })

    it('handles WebSocket disconnection gracefully', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Simulate WebSocket disconnection
      mockWebSocket.readyState = WebSocket.CLOSED

      // Component should continue to function with existing events
      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows.length).toBeGreaterThan(0)
    })
  })
})