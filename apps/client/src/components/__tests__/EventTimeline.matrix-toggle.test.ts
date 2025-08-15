/**
 * EventTimeline Matrix Mode Toggle Tests
 * 
 * Comprehensive test suite for Matrix mode toggle integration in EventTimeline component.
 * Tests toggle functionality, conditional rendering, accessibility, and state management.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventTimeline from '../EventTimeline.vue'
import type { HookEvent } from '../../types'

// Mock MatrixRainCanvas component
const MockMatrixRainCanvas = {
  name: 'MatrixRainCanvas',
  props: ['width', 'height', 'enabled', 'config'],
  template: `
    <div 
      data-testid="matrix-rain-canvas" 
      :class="{ 'matrix-enabled': enabled }"
      :style="{ width: width + 'px', height: height + 'px' }"
    >
      Matrix Canvas {{ enabled ? 'Enabled' : 'Disabled' }}
    </div>
  `,
  emits: ['performance-update', 'memory-update', 'quality-warning', 'error'],
  methods: {
    addDrop: vi.fn(),
    removeDrop: vi.fn(),
    clearAllDrops: vi.fn(),
    getMemoryMetrics: vi.fn()
  }
}

// Mock useMatrixMode composable
const mockMatrixMode = {
  isEnabled: { value: false },
  isTransitioning: { value: false },
  toggle: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  processEvent: vi.fn(),
  processEventBatch: vi.fn(),
  state: { 
    value: { 
      isEnabled: false, 
      isTransitioning: false 
    } 
  },
  config: { 
    value: { 
      columnWidth: 20,
      dropSpeed: 60,
      trailLength: 12 
    } 
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('../../composables/useMatrixMode', () => ({
  useMatrixMode: () => mockMatrixMode
}))

// Mock other composables
vi.mock('../../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: vi.fn(() => 'bg-blue-500'),
    getColorForSession: vi.fn(() => 'text-blue-500'),
    getGradientForApp: vi.fn(() => 'bg-green-500'),
    getColorForApp: vi.fn(() => 'text-green-500'),
    getHexColorForApp: vi.fn(() => '#10B981')
  })
}))

vi.mock('../../composables/useTimelineOrdering', () => ({
  useTimelineOrdering: () => ({
    orderMode: { value: 'newest-first' },
    applyOrderingContext: vi.fn((events) => events),
    generateTimeRange: vi.fn(() => 'Recent activity'),
    setOrderMode: vi.fn(),
    scrollDirection: { value: 'down' }
  })
}))

// Mock timeline component utils
vi.mock('../timeline/index', () => ({
  timelineComponentUtils: {
    shouldEnableAnimations: vi.fn(() => true)
  }
}))

// Mock TimelineDirectionHeader
vi.mock('../timeline/TimelineDirectionHeader.vue', () => ({
  default: {
    name: 'TimelineDirectionHeader',
    props: ['currentOrder', 'eventCount', 'timeRange'],
    template: '<div data-testid="timeline-direction-header">Timeline Header</div>',
    emits: ['order-changed']
  }
}))

// Mock EnhancedEventRow
vi.mock('../timeline/EnhancedEventRow.vue', () => ({
  default: {
    name: 'EnhancedEventRow',
    props: ['enhancedEvent', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor', 'currentOrder', 'totalEvents', 'useGpuAcceleration'],
    template: '<div data-testid="enhanced-event-row" :data-event-id="enhancedEvent.id">{{ enhancedEvent.hook_event_type }}</div>'
  }
}))

describe('EventTimeline Matrix Mode Toggle', () => {
  const mockEvents: HookEvent[] = [
    {
      id: 1,
      source_app: 'client',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: { tool_name: 'Bash' },
      timestamp: 1000
    },
    {
      id: 2,
      source_app: 'server',
      session_id: 'session-1',
      hook_event_type: 'PostToolUse',
      payload: { tool_name: 'Read' },
      timestamp: 2000
    }
  ]

  const defaultProps = {
    events: mockEvents,
    filters: {
      sourceApp: '',
      sessionId: '',
      eventType: ''
    },
    stickToBottom: true
  }

  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock state
    mockMatrixMode.isEnabled.value = false
    mockMatrixMode.isTransitioning.value = false
    mockMatrixMode.state.value.isEnabled = false
    mockMatrixMode.state.value.isTransitioning = false
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Matrix Toggle Button', () => {
    it('renders Matrix mode toggle button in header', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      expect(toggleButton.exists()).toBe(true)
      expect(toggleButton.attributes('aria-label')).toBe('Toggle Matrix mode visualization')
    })

    it('displays correct toggle button state when Matrix mode is disabled', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      expect(toggleButton.classes()).toContain('matrix-toggle--disabled')
      expect(toggleButton.attributes('aria-pressed')).toBe('false')
      expect(toggleButton.text()).toContain('🔳')
    })

    it('displays correct toggle button state when Matrix mode is enabled', async () => {
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      expect(toggleButton.classes()).toContain('matrix-toggle--enabled')
      expect(toggleButton.attributes('aria-pressed')).toBe('true')
      expect(toggleButton.text()).toContain('🟢')
    })

    it('shows transitioning state during mode switch', async () => {
      mockMatrixMode.isTransitioning.mockReturnValue(true)
      mockMatrixMode.state.value.isTransitioning = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      expect(toggleButton.classes()).toContain('matrix-toggle--transitioning')
      expect(toggleButton.attributes('disabled')).toBeDefined()
      expect(toggleButton.text()).toContain('⚡')
    })
  })

  describe('Toggle Functionality', () => {
    it('calls Matrix mode toggle when button is clicked', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      await toggleButton.trigger('click')

      expect(mockMatrixMode.toggle).toHaveBeenCalledTimes(1)
    })

    it('calls Matrix mode toggle when Enter key is pressed', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      await toggleButton.trigger('keydown.enter')

      expect(mockMatrixMode.toggle).toHaveBeenCalledTimes(1)
    })

    it('calls Matrix mode toggle when Space key is pressed', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      await toggleButton.trigger('keydown.space')

      expect(mockMatrixMode.toggle).toHaveBeenCalledTimes(1)
    })

    it('does not toggle when button is disabled during transition', async () => {
      mockMatrixMode.isTransitioning.mockReturnValue(true)
      mockMatrixMode.state.value.isTransitioning = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      await toggleButton.trigger('click')

      expect(mockMatrixMode.toggle).not.toHaveBeenCalled()
    })
  })

  describe('Conditional Rendering', () => {
    it('shows normal timeline view when Matrix mode is disabled', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const normalTimeline = wrapper.find('[data-testid="normal-timeline-view"]')
      const matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')

      expect(normalTimeline.exists()).toBe(true)
      expect(matrixCanvas.exists()).toBe(false)
    })

    it('shows Matrix canvas when Matrix mode is enabled', async () => {
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const normalTimeline = wrapper.find('[data-testid="normal-timeline-view"]')
      const matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')

      expect(normalTimeline.exists()).toBe(false)
      expect(matrixCanvas.exists()).toBe(true)
      expect(matrixCanvas.props('enabled')).toBe(true)
    })

    it('passes correct props to MatrixRainCanvas', async () => {
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')
      
      expect(matrixCanvas.props('enabled')).toBe(true)
      expect(matrixCanvas.props('width')).toBeDefined()
      expect(matrixCanvas.props('height')).toBeDefined()
      expect(matrixCanvas.props('config')).toEqual(mockMatrixMode.config.value)
    })

    it('processes events through Matrix mode when enabled', async () => {
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      // Add new events
      const newEvents = [...mockEvents, {
        id: 3,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'Notification',
        payload: { message: 'Test' },
        timestamp: 3000
      }]

      await wrapper.setProps({ events: newEvents })

      expect(mockMatrixMode.processEvent).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('includes proper ARIA attributes for toggle button', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      
      expect(toggleButton.attributes('role')).toBe('button')
      expect(toggleButton.attributes('tabindex')).toBe('0')
      expect(toggleButton.attributes('aria-label')).toBe('Toggle Matrix mode visualization')
      expect(toggleButton.attributes('aria-pressed')).toBe('false')
    })

    it('announces mode changes to screen readers', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const liveRegion = wrapper.find('[data-testid="matrix-mode-announcer"]')
      expect(liveRegion.exists()).toBe(true)
      expect(liveRegion.attributes('aria-live')).toBe('polite')
      expect(liveRegion.attributes('aria-atomic')).toBe('true')
    })

    it('updates screen reader announcement when mode changes', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const liveRegion = wrapper.find('[data-testid="matrix-mode-announcer"]')
      expect(liveRegion.text()).toBe('Matrix mode disabled')

      // Simulate enabling Matrix mode
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true
      await wrapper.vm.$nextTick()

      expect(liveRegion.text()).toBe('Matrix mode enabled')
    })

    it('provides keyboard navigation support', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      
      // Focus should be manageable
      toggleButton.element.focus()
      expect(document.activeElement).toBe(toggleButton.element)

      // Should respond to keyboard events
      await toggleButton.trigger('keydown.enter')
      expect(mockMatrixMode.toggle).toHaveBeenCalled()
    })
  })

  describe('Performance Considerations', () => {
    it('does not render Matrix canvas when mode is disabled', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')
      expect(matrixCanvas.exists()).toBe(false)
    })

    it('properly cleans up Matrix canvas when switching modes', async () => {
      // Start with Matrix mode enabled
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      let matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')
      expect(matrixCanvas.exists()).toBe(true)

      // Switch to disabled
      mockMatrixMode.isEnabled.mockReturnValue(false)
      mockMatrixMode.state.value.isEnabled = false
      await wrapper.vm.$forceUpdate()
      await nextTick()

      matrixCanvas = wrapper.find('[data-testid="matrix-rain-canvas"]')
      expect(matrixCanvas.exists()).toBe(false)
    })

    it('batches event processing for Matrix mode', async () => {
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      // Add multiple events at once
      const manyNewEvents = Array.from({ length: 10 }, (_, i) => ({
        id: i + 10,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'Notification',
        payload: { message: `Test ${i}` },
        timestamp: 3000 + i
      }))

      await wrapper.setProps({ events: [...mockEvents, ...manyNewEvents] })

      // Should use batch processing for better performance
      expect(mockMatrixMode.processEventBatch).toHaveBeenCalled()
    })
  })

  describe('Visual Transitions', () => {
    it('applies transition classes during mode switch', async () => {
      mockMatrixMode.isTransitioning.mockReturnValue(true)
      mockMatrixMode.state.value.isTransitioning = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const container = wrapper.find('.flex-1')
      expect(container.classes()).toContain('matrix-mode-transitioning')
    })

    it('removes transition classes after mode switch completes', async () => {
      // Start with transitioning
      mockMatrixMode.isTransitioning.mockReturnValue(true)
      mockMatrixMode.state.value.isTransitioning = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      let container = wrapper.find('.flex-1')
      expect(container.classes()).toContain('matrix-mode-transitioning')

      // Complete transition
      mockMatrixMode.isTransitioning.mockReturnValue(false)
      mockMatrixMode.state.value.isTransitioning = false
      await wrapper.vm.$forceUpdate()
      await nextTick()

      container = wrapper.find('.flex-1')
      expect(container.classes()).not.toContain('matrix-mode-transitioning')
    })
  })

  describe('Error Handling', () => {
    it('handles Matrix mode initialization errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockMatrixMode.enable.mockRejectedValue(new Error('Matrix initialization failed'))

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      const toggleButton = wrapper.find('[data-testid="matrix-toggle-button"]')
      await toggleButton.trigger('click')

      // Component should still be functional
      expect(wrapper.find('[data-testid="normal-timeline-view"]').exists()).toBe(true)

      consoleSpy.mockRestore()
    })

    it('recovers from Matrix mode errors and falls back to normal view', async () => {
      // Start with Matrix mode enabled
      mockMatrixMode.isEnabled.mockReturnValue(true)
      mockMatrixMode.state.value.isEnabled = true

      wrapper = mount(EventTimeline, {
        props: defaultProps,
        global: {
          components: {
            MatrixRainCanvas: MockMatrixRainCanvas
          }
        }
      })

      // Simulate Matrix canvas error
      const matrixCanvas = wrapper.findComponent(MockMatrixRainCanvas)
      await matrixCanvas.vm.$emit('error', new Error('Canvas rendering failed'))

      // Should fall back to normal view
      await nextTick()
      expect(mockMatrixMode.disable).toHaveBeenCalled()
    })
  })
})