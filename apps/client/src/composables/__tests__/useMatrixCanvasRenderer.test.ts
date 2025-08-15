import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useMatrixCanvasRenderer } from '../useMatrixCanvasRenderer'

// Mock Canvas 2D Context
const mockCanvas2DContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 12 })),
  // Properties
  font: '',
  fillStyle: '',
  globalAlpha: 1,
  shadowColor: '',
  shadowBlur: 0,
  canvas: {
    width: 800,
    height: 600
  }
}

// Mock HTMLCanvasElement
const mockCanvas = {
  getContext: vi.fn(() => mockCanvas2DContext),
  width: 800,
  height: 600,
  style: {}
}

// Mock requestAnimationFrame
let rafCallbacks: (() => void)[] = []
const mockRAF = vi.fn((callback: () => void) => {
  rafCallbacks.push(callback)
  return rafCallbacks.length
})

const mockCancelRAF = vi.fn((id: number) => {
  rafCallbacks = rafCallbacks.filter((_, index) => index + 1 !== id)
})

global.requestAnimationFrame = mockRAF
global.cancelAnimationFrame = mockCancelRAF

// Execute all pending RAF callbacks
const flushRAF = () => {
  const callbacks = [...rafCallbacks]
  rafCallbacks = []
  callbacks.forEach(callback => callback())
}

describe('useMatrixCanvasRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rafCallbacks = []
    mockCanvas2DContext.font = ''
    mockCanvas2DContext.fillStyle = ''
    mockCanvas2DContext.globalAlpha = 1
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Canvas Setup & Lifecycle', () => {
    it('initializes canvas with correct dimensions', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
      expect(mockCanvas.width).toBe(800)
      expect(mockCanvas.height).toBe(600)
    })

    it('calculates correct number of columns for viewport width', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getColumnCount } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      const columnCount = getColumnCount()
      
      // 800px width / 20px column width = 40 columns
      expect(columnCount).toBe(40)
    })

    it('handles canvas resize events', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, resize, getColumnCount } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Simulate resize
      mockCanvas.width = 1000
      mockCanvas.height = 800
      resize(1000, 800)
      
      const newColumnCount = getColumnCount()
      expect(newColumnCount).toBe(50) // 1000 / 20 = 50 columns
    })

    it('cleans up resources on destroy', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, destroy, startAnimation } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      destroy()
      
      expect(mockCancelRAF).toHaveBeenCalled()
    })
  })

  describe('Animation Loop', () => {
    it('starts RAF loop when startAnimation is called', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, startAnimation } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      
      expect(mockRAF).toHaveBeenCalled()
    })

    it('stops RAF loop when stopAnimation is called', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, startAnimation, stopAnimation } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      stopAnimation()
      
      expect(mockCancelRAF).toHaveBeenCalled()
    })

    it('maintains target 60fps frame rate', () => {
      vi.useFakeTimers()
      const canvasRef = ref(mockCanvas)
      const { initialize, startAnimation, getPerformanceMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      
      // Simulate 1 second of frames
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(16.67) // ~60fps
        flushRAF()
      }
      
      const metrics = getPerformanceMetrics()
      expect(metrics.avgFrameRate).toBeGreaterThan(55)
      expect(metrics.avgFrameRate).toBeLessThan(65)
      
      vi.useRealTimers()
    })

    it('handles frame dropping gracefully', () => {
      vi.useFakeTimers()
      const canvasRef = ref(mockCanvas)
      const { initialize, startAnimation, getPerformanceMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      
      // Simulate dropped frames (longer intervals)
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(33.33) // ~30fps
        flushRAF()
      }
      
      const metrics = getPerformanceMetrics()
      expect(metrics.droppedFrames).toBeGreaterThan(0)
      expect(metrics.avgFrameRate).toBeLessThan(35)
      
      vi.useRealTimers()
    })
  })

  describe('Character Rendering', () => {
    it('renders characters with Courier New font', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, renderCharacter } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      renderCharacter('ア', 100, 50, 1.0, '#00FF00')
      
      expect(mockCanvas2DContext.font).toContain('Courier New')
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledWith('ア', 100, 50)
    })

    it('applies correct font size and weight', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, renderCharacter } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      renderCharacter('A', 100, 50, 1.0, '#00FF00')
      
      expect(mockCanvas2DContext.font).toContain('14px')
      expect(mockCanvas2DContext.font).toContain('Courier New')
    })

    it('handles different character sets', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, renderCharacter } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Katakana characters
      renderCharacter('ア', 100, 50, 1.0, '#00FF00')
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledWith('ア', 100, 50)
      
      // Alphanumeric characters
      renderCharacter('7', 120, 50, 1.0, '#00FF00')
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledWith('7', 120, 50)
      
      // Symbol characters
      renderCharacter('◆', 140, 50, 1.0, '#00FF00')
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledWith('◆', 140, 50)
    })

    it('applies opacity correctly', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, renderCharacter } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      renderCharacter('A', 100, 50, 0.5, '#00FF00')
      
      expect(mockCanvas2DContext.globalAlpha).toBe(0.5)
    })
  })

  describe('Trail Effects', () => {
    it('creates opacity gradients for character trails', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, render } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const drop = {
        id: 'test-drop',
        column: 0,
        y: 100,
        speed: 100,
        characters: ['ア', 'イ', 'ウ'],
        trail: [
          { char: 'ア', opacity: 1.0, y: 100 },
          { char: 'イ', opacity: 0.7, y: 80 },
          { char: 'ウ', opacity: 0.4, y: 60 }
        ],
        age: 0,
        color: '#00FF00'
      }
      
      addDrop(drop)
      render()
      
      // Should render characters with decreasing opacity
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledTimes(3)
      // globalAlpha is a property, not a method, so we check if it was set
      expect(mockCanvas2DContext.save).toHaveBeenCalled()
      expect(mockCanvas2DContext.restore).toHaveBeenCalled()
    })

    it('maintains trail length between 8-15 characters', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, createDrop } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const drop = createDrop('test', 0, ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ'])
      
      expect(drop.trail.length).toBeGreaterThanOrEqual(8)
      expect(drop.trail.length).toBeLessThanOrEqual(15)
    })

    it('applies smooth opacity transitions', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, createTrail } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const trail = createTrail(['A', 'B', 'C', 'D', 'E'], 100)
      
      // Verify opacity decreases smoothly
      for (let i = 1; i < trail.length; i++) {
        expect(trail[i].opacity).toBeLessThan(trail[i - 1].opacity)
      }
      
      // Head should be fully opaque
      expect(trail[0].opacity).toBe(1.0)
      
      // Tail should be nearly transparent
      expect(trail[trail.length - 1].opacity).toBeLessThan(0.2)
    })

    it('removes old trail segments efficiently', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, getActiveDrops, startAnimation } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const drop = {
        id: 'test-drop',
        column: 0,
        y: 800, // Below screen
        speed: 100,
        characters: ['A'],
        trail: [{ char: 'A', opacity: 1.0, y: 800 }],
        age: 0,
        color: '#00FF00'
      }
      
      addDrop(drop)
      
      // Start animation to trigger drop cleanup
      startAnimation()
      flushRAF() // Process one frame
      
      // Drop should be removed when it goes off screen
      const drops = getActiveDrops()
      expect(drops.length).toBe(0)
    })
  })

  describe('Batch Rendering', () => {
    it('batches multiple character updates in single frame', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, render } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Add multiple drops
      for (let i = 0; i < 10; i++) {
        addDrop({
          id: `drop-${i}`,
          column: i,
          y: i * 20,
          speed: 100,
          characters: ['A'],
          trail: [{ char: 'A', opacity: 1.0, y: i * 20 }],
          age: 0,
          color: '#00FF00'
        })
      }
      
      render()
      
      // Should use fillRect for fade effect instead of clearRect
      expect(mockCanvas2DContext.fillRect).toHaveBeenCalled()
      
      // Should render all characters in one batch
      expect(mockCanvas2DContext.fillText).toHaveBeenCalledTimes(10)
    })

    it('optimizes canvas draw calls', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, render } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Add drops of same color
      for (let i = 0; i < 5; i++) {
        addDrop({
          id: `drop-${i}`,
          column: i,
          y: i * 20,
          speed: 100,
          characters: ['A'],
          trail: [{ char: 'A', opacity: 1.0, y: i * 20 }],
          age: 0,
          color: '#00FF00'
        })
      }
      
      render()
      
      // Should batch operations by color/style
      const fillStyleCalls = mockCanvas2DContext.fillStyle
      expect(fillStyleCalls).toBe('#00FF00')
    })

    it('handles large numbers of drops efficiently', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, render } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Add 1000 drops
      for (let i = 0; i < 1000; i++) {
        addDrop({
          id: `drop-${i}`,
          column: i % 40,
          y: (i % 20) * 20,
          speed: 100,
          characters: ['A'],
          trail: [{ char: 'A', opacity: 1.0, y: (i % 20) * 20 }],
          age: 0,
          color: '#00FF00'
        })
      }
      
      const startTime = performance.now()
      render()
      const endTime = performance.now()
      
      // Render should complete within reasonable time (performance test)
      expect(endTime - startTime).toBeLessThan(100) // More lenient for testing
    })
  })

  describe('Performance Monitoring', () => {
    it('tracks frame rate accurately', () => {
      vi.useFakeTimers()
      const canvasRef = ref(mockCanvas)
      const { initialize, startAnimation, getPerformanceMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      startAnimation()
      
      // Simulate consistent 60fps
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(16.67)
        flushRAF()
      }
      
      const metrics = getPerformanceMetrics()
      expect(metrics.avgFrameRate).toBeCloseTo(60, 1)
      
      vi.useRealTimers()
    })

    it('measures render time per frame', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, render, getPerformanceMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      render()
      
      const metrics = getPerformanceMetrics()
      expect(metrics.avgRenderTime).toBeGreaterThan(0)
      expect(metrics.maxRenderTime).toBeGreaterThanOrEqual(metrics.avgRenderTime)
    })

    it('detects performance degradation', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getPerformanceMetrics, shouldReduceQuality } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Simulate poor performance
      const mockMetrics = {
        avgFrameRate: 25,
        avgRenderTime: 25,
        droppedFrames: 30,
        maxRenderTime: 40
      }
      
      // Mock the metrics
      vi.spyOn({ getPerformanceMetrics }, 'getPerformanceMetrics').mockReturnValue(mockMetrics)
      
      expect(shouldReduceQuality()).toBe(true)
    })

    it('provides memory usage metrics', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getMemoryMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const memoryMetrics = getMemoryMetrics()
      expect(memoryMetrics).toHaveProperty('activeDrops')
      expect(memoryMetrics).toHaveProperty('pooledDrops')
      expect(memoryMetrics).toHaveProperty('memoryUsageMB')
      expect(memoryMetrics.memoryUsageMB).toBeGreaterThan(0)
    })
  })

  describe('Object Pooling', () => {
    it('reuses drop objects to prevent GC pressure', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, addDrop, removeDrop, getDropFromPool } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Create and remove a drop
      const dropId = 'test-drop'
      addDrop({
        id: dropId,
        column: 0,
        y: 100,
        speed: 100,
        characters: ['A'],
        trail: [{ char: 'A', opacity: 1.0, y: 100 }],
        age: 0,
        color: '#00FF00'
      })
      
      removeDrop(dropId)
      
      // Get a new drop from pool
      const newDrop = getDropFromPool()
      
      // Should reuse the same object
      expect(newDrop).toBeDefined()
      expect(newDrop.id).toBe('') // Reset state
    })

    it('initializes pooled objects correctly', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getDropFromPool } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      const drop = getDropFromPool()
      
      expect(drop.id).toBe('')
      expect(drop.column).toBe(0)
      expect(drop.y).toBe(0)
      expect(drop.speed).toBe(0)
      expect(drop.characters).toEqual([])
      expect(drop.trail).toEqual([])
      expect(drop.age).toBe(0)
    })

    it('maintains pool size limits', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getMemoryMetrics } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Pool should not exceed reasonable limits
      const memoryMetrics = getMemoryMetrics()
      expect(memoryMetrics.pooledDrops).toBeLessThanOrEqual(1000)
    })

    it('handles pool exhaustion gracefully', () => {
      const canvasRef = ref(mockCanvas)
      const { initialize, getDropFromPool } = useMatrixCanvasRenderer(canvasRef)
      
      initialize()
      
      // Exhaust the pool
      const drops = []
      for (let i = 0; i < 1500; i++) {
        const drop = getDropFromPool()
        if (drop) {
          drops.push(drop)
        }
      }
      
      // Should still return valid drops even when pool is exhausted
      expect(drops.length).toBeGreaterThan(0)
      
      // Should create new objects when pool is empty
      const newDrop = getDropFromPool()
      expect(newDrop).toBeDefined()
    })
  })

  // Helper functions that should be available
  const getActiveDrops = () => {
    const canvasRef = ref(mockCanvas)
    const { getActiveDrops: fn } = useMatrixCanvasRenderer(canvasRef)
    return fn()
  }
})