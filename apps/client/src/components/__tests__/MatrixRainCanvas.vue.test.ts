import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MatrixRainCanvas from '../MatrixRainCanvas.vue'

// Mock the composable
const mockUseMatrixCanvasRenderer = {
  initialize: vi.fn(),
  destroy: vi.fn(),
  startAnimation: vi.fn(),
  stopAnimation: vi.fn(),
  addDrop: vi.fn(),
  removeDrop: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  getPerformanceMetrics: vi.fn(() => ({
    avgFrameRate: 60,
    avgRenderTime: 12,
    droppedFrames: 0,
    maxRenderTime: 15
  })),
  getMemoryMetrics: vi.fn(() => ({
    activeDrops: 50,
    pooledDrops: 100,
    memoryUsageMB: 25
  })),
  getColumnCount: vi.fn(() => 40),
  shouldReduceQuality: vi.fn(() => false)
}

vi.mock('../composables/useMatrixCanvasRenderer', () => ({
  useMatrixCanvasRenderer: () => mockUseMatrixCanvasRenderer
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe('MatrixRainCanvas.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Component Lifecycle', () => {
    it('renders canvas element with correct attributes', () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
      expect(canvas.attributes('width')).toBe('800')
      expect(canvas.attributes('height')).toBe('600')
    })

    it('initializes canvas renderer on mount', async () => {
      mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await nextTick()

      expect(mockUseMatrixCanvasRenderer.initialize).toHaveBeenCalled()
      expect(mockUseMatrixCanvasRenderer.startAnimation).toHaveBeenCalled()
    })

    it('cleans up resources on unmount', () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      wrapper.unmount()

      expect(mockUseMatrixCanvasRenderer.stopAnimation).toHaveBeenCalled()
      expect(mockUseMatrixCanvasRenderer.destroy).toHaveBeenCalled()
    })

    it('does not start animation when disabled', async () => {
      mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: false
        }
      })

      await nextTick()

      expect(mockUseMatrixCanvasRenderer.initialize).toHaveBeenCalled()
      expect(mockUseMatrixCanvasRenderer.startAnimation).not.toHaveBeenCalled()
    })
  })

  describe('Props & Reactivity', () => {
    it('responds to width/height changes', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await wrapper.setProps({ width: 1000, height: 800 })

      expect(mockUseMatrixCanvasRenderer.resize).toHaveBeenCalledWith(1000, 800)
    })

    it('starts/stops animation when enabled prop changes', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: false
        }
      })

      await wrapper.setProps({ enabled: true })
      expect(mockUseMatrixCanvasRenderer.startAnimation).toHaveBeenCalled()

      await wrapper.setProps({ enabled: false })
      expect(mockUseMatrixCanvasRenderer.stopAnimation).toHaveBeenCalled()
    })

    it('validates props correctly', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Valid props should not warn
      mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      expect(consoleSpy).not.toHaveBeenCalled()

      // Invalid props should warn
      mount(MatrixRainCanvas, {
        props: {
          width: -100, // Invalid negative width
          height: 600,
          enabled: true
        }
      })

      consoleSpy.mockRestore()
    })

    it('responds to configuration changes', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true,
          config: {
            columnWidth: 20,
            dropSpeed: 100,
            trailLength: 10,
            colorScheme: 'classic',
            glowIntensity: 0.8
          }
        }
      })

      const newConfig = {
        columnWidth: 24,
        dropSpeed: 120,
        trailLength: 12,
        colorScheme: 'blue',
        glowIntensity: 1.0
      }

      await wrapper.setProps({ config: newConfig })

      // Should trigger re-initialization with new config
      expect(mockUseMatrixCanvasRenderer.initialize).toHaveBeenCalledTimes(2)
    })
  })

  describe('Event Handling', () => {
    it('handles window resize events', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Simulate window resize
      window.dispatchEvent(new Event('resize'))
      await nextTick()

      // Should call resize with current props
      expect(mockUseMatrixCanvasRenderer.resize).toHaveBeenCalled()
    })

    it('responds to visibility changes', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()

      expect(mockUseMatrixCanvasRenderer.stopAnimation).toHaveBeenCalled()

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()

      expect(mockUseMatrixCanvasRenderer.startAnimation).toHaveBeenCalled()
    })

    it('manages focus/blur states', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Simulate window blur (lost focus)
      window.dispatchEvent(new Event('blur'))
      await nextTick()

      expect(mockUseMatrixCanvasRenderer.stopAnimation).toHaveBeenCalled()

      // Simulate window focus
      window.dispatchEvent(new Event('focus'))
      await nextTick()

      expect(mockUseMatrixCanvasRenderer.startAnimation).toHaveBeenCalled()
    })

    it('handles error conditions gracefully', async () => {
      // Mock an error in initialization
      mockUseMatrixCanvasRenderer.initialize.mockImplementation(() => {
        throw new Error('Canvas initialization failed')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await nextTick()

      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Canvas initialization failed')
      )

      // Component should still render
      expect(wrapper.find('canvas').exists()).toBe(true)

      consoleSpy.mockRestore()
      mockUseMatrixCanvasRenderer.initialize.mockImplementation(() => {})
    })
  })

  describe('Performance Events', () => {
    it('emits performance metrics periodically', async () => {
      vi.useFakeTimers()

      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Fast-forward time to trigger performance emission
      vi.advanceTimersByTime(1000)
      await nextTick()

      expect(wrapper.emitted('performance-update')).toBeTruthy()
      expect(wrapper.emitted('performance-update')[0][0]).toEqual({
        avgFrameRate: 60,
        avgRenderTime: 12,
        droppedFrames: 0,
        maxRenderTime: 15
      })

      vi.useRealTimers()
    })

    it('emits memory metrics when requested', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Call the exposed method
      await wrapper.vm.getMemoryMetrics()

      expect(wrapper.emitted('memory-update')).toBeTruthy()
      expect(wrapper.emitted('memory-update')[0][0]).toEqual({
        activeDrops: 50,
        pooledDrops: 100,
        memoryUsageMB: 25
      })
    })

    it('emits quality reduction warnings', async () => {
      // Mock performance degradation
      mockUseMatrixCanvasRenderer.shouldReduceQuality.mockReturnValue(true)

      vi.useFakeTimers()

      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Fast-forward to trigger quality check
      vi.advanceTimersByTime(1000)
      await nextTick()

      expect(wrapper.emitted('quality-warning')).toBeTruthy()

      vi.useRealTimers()
    })
  })

  describe('Drop Management', () => {
    it('exposes addDrop method', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      const testDrop = {
        id: 'test-drop',
        column: 0,
        y: 100,
        speed: 100,
        characters: ['ア'],
        trail: [{ char: 'ア', opacity: 1.0, y: 100 }],
        age: 0,
        color: '#00FF00'
      }

      await wrapper.vm.addDrop(testDrop)

      expect(mockUseMatrixCanvasRenderer.addDrop).toHaveBeenCalledWith(testDrop)
    })

    it('exposes removeDrop method', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await wrapper.vm.removeDrop('test-drop-id')

      expect(mockUseMatrixCanvasRenderer.removeDrop).toHaveBeenCalledWith('test-drop-id')
    })

    it('exposes clearAllDrops method', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await wrapper.vm.clearAllDrops()

      // Should call removeDrop for all active drops or have a clearAll method
      expect(mockUseMatrixCanvasRenderer.destroy).toHaveBeenCalled()
      expect(mockUseMatrixCanvasRenderer.initialize).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('includes proper ARIA labels', () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('aria-label')).toBe('Matrix rain visualization')
      expect(canvas.attributes('role')).toBe('img')
    })

    it('respects prefers-reduced-motion', async () => {
      // Mock media query for reduced motion
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

      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      await nextTick()

      // Should not start animation when reduced motion is preferred
      expect(mockUseMatrixCanvasRenderer.startAnimation).not.toHaveBeenCalled()
    })

    it('provides screen reader announcements', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Should have live region for announcements
      const liveRegion = wrapper.find('[aria-live="polite"]')
      expect(liveRegion.exists()).toBe(true)
    })
  })

  describe('Development Tools', () => {
    it('provides debug information in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true,
          debug: true
        }
      })

      // Should show debug overlay
      const debugOverlay = wrapper.find('.matrix-debug-overlay')
      expect(debugOverlay.exists()).toBe(true)

      process.env.NODE_ENV = originalNodeEnv
    })

    it('exposes internal state for testing', () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          width: 800,
          height: 600,
          enabled: true
        }
      })

      // Should expose renderer instance for testing
      expect(wrapper.vm.renderer).toBeDefined()
      expect(wrapper.vm.isInitialized).toBe(true)
      expect(wrapper.vm.isAnimating).toBe(true)
    })
  })
})