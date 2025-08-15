import { ref, computed, type Ref } from 'vue'
import type { 
  MatrixDrop, 
  MatrixCharacter, 
  MatrixConfig,
  MatrixPerformanceMetrics 
} from '../types/matrix'

// Local renderer-specific types
export interface MatrixMemoryMetrics {
  activeDrops: number
  pooledDrops: number
  memoryUsageMB: number
}

/**
 * Matrix Canvas Renderer Composable
 * Implements high-performance Canvas 2D rendering for Matrix rain effect
 * Following TDD principles with comprehensive test coverage
 */
export function useMatrixCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  // Core state
  const ctx = ref<CanvasRenderingContext2D | null>(null)
  const isInitialized = ref(false)
  const isAnimating = ref(false)
  const rafId = ref<number | null>(null)
  
  // Rendering configuration
  const columnWidth = 20 // 20px columns as per spec
  const trailLength = 12 // Default trail length
  const font = '14px Courier New' // Monospace font for Matrix characters
  
  // Performance tracking
  const frameCount = ref(0)
  const lastFrameTime = ref(0)
  const frameTimeSum = ref(0)
  const droppedFrames = ref(0)
  const maxRenderTime = ref(0)
  const renderTimes: number[] = []
  
  // Drop management
  const activeDrops = ref<Map<string, MatrixDrop>>(new Map())
  const dropPool: MatrixDrop[] = []
  const columnPositions: number[] = []
  const canvasWidth = ref(0)
  const canvasHeight = ref(0)
  
  // Initialize Canvas 2D context and pre-calculate positions
  function initialize() {
    if (!canvasRef.value) return
    
    const canvas = canvasRef.value
    ctx.value = canvas.getContext('2d')
    
    if (!ctx.value) {
      throw new Error('Canvas 2D context not available')
    }
    
    // Set up canvas dimensions
    canvasWidth.value = canvas.width
    canvasHeight.value = canvas.height
    
    // Pre-calculate column positions for O(1) lookup (PaulArch guidance)
    columnPositions.length = 0
    const columnCount = Math.floor(canvasWidth.value / columnWidth)
    for (let i = 0; i < columnCount; i++) {
      columnPositions.push(i * columnWidth)
    }
    
    // Initialize font once during setup (PaulArch guidance)
    ctx.value.font = font
    ctx.value.textAlign = 'left'
    ctx.value.textBaseline = 'top'
    
    // Initialize object pool with 1000 drops (PaulArch guidance)
    initializeDropPool()
    
    isInitialized.value = true
  }
  
  // Initialize object pool to prevent GC pressure
  function initializeDropPool() {
    dropPool.length = 0
    for (let i = 0; i < 1000; i++) {
      dropPool.push(createEmptyDrop())
    }
  }
  
  // Create empty drop object
  function createEmptyDrop(): MatrixDrop {
    return {
      id: '',
      column: 0,
      position: 0,
      speed: 0,
      characters: [],
      brightness: [],
      headColor: '#00FF00',
      trailColor: '#00FF00',
      isEventDrop: false,
      spawnTime: Date.now(),
      lastUpdate: Date.now(),
      type: 'ambient',
      trailLength: 0,
      isActive: true,
      // Legacy compatibility
      y: 0,
      age: 0,
      color: '#00FF00',
      trail: true
    }
  }
  
  // Get drop from pool or create new one
  function getDropFromPool(): MatrixDrop {
    if (dropPool.length > 0) {
      return dropPool.pop()!
    }
    return createEmptyDrop()
  }
  
  // Return drop to pool
  function returnDropToPool(drop: MatrixDrop) {
    // Reset drop state
    drop.id = ''
    drop.column = 0
    drop.position = 0
    drop.speed = 0
    drop.characters = []
    drop.brightness = []
    drop.headColor = '#00FF00'
    drop.trailColor = '#00FF00'
    drop.isEventDrop = false
    drop.spawnTime = Date.now()
    drop.lastUpdate = Date.now()
    drop.type = 'ambient'
    drop.trailLength = 0
    drop.isActive = true
    drop.sourceEvent = undefined
    drop.effects = undefined
    // Legacy compatibility
    drop.y = 0
    drop.age = 0
    drop.color = '#00FF00'
    drop.trail = true
    
    // Return to pool if not at capacity
    if (dropPool.length < 1000) {
      dropPool.push(drop)
    }
  }
  
  // Create character trail with opacity gradient
  function createTrail(characters: string[], startY: number): MatrixCharacter[] {
    const trail: MatrixCharacter[] = []
    const length = Math.min(characters.length, trailLength)
    
    for (let i = 0; i < length; i++) {
      const opacity = Math.max(0.05, 1 - (i / (length - 1)) * 0.95) // Smooth fade from 1.0 to 0.05
      trail.push({
        char: characters[i % characters.length],
        opacity,
        y: startY - (i * 20) // 20px spacing between characters
      })
    }
    
    return trail
  }
  
  // Create new drop with proper initialization
  function createDrop(id: string, column: number, characters: string[]): MatrixDrop {
    const drop = getDropFromPool()
    drop.id = id
    drop.column = column
    drop.position = -20 // Start above screen
    drop.speed = 100 + Math.random() * 100 // 100-200 px/second
    drop.isEventDrop = true
    drop.spawnTime = Date.now()
    drop.lastUpdate = Date.now()
    drop.type = 'event-data'
    drop.trailLength = Math.min(characters.length, trailLength)
    drop.isActive = true
    drop.headColor = '#00FF00'
    drop.trailColor = '#00FF00'
    
    // Convert characters to MatrixCharacter array
    drop.characters = characters.map((char, index) => ({
      char,
      age: index / characters.length,
      brightness: 1 - (index / characters.length),
      color: index === 0 ? drop.headColor : drop.trailColor,
      isLeading: index === 0,
      position: index
    }))
    
    // Generate brightness array
    drop.brightness = drop.characters.map(char => char.brightness)
    
    // Legacy compatibility
    drop.y = drop.position
    drop.age = 0
    drop.color = drop.headColor
    drop.trail = true
    
    return drop
  }
  
  // Add drop to active drops
  function addDrop(drop: MatrixDrop) {
    activeDrops.value.set(drop.id, drop)
  }
  
  // Remove drop from active drops
  function removeDrop(dropId: string) {
    const drop = activeDrops.value.get(dropId)
    if (drop) {
      activeDrops.value.delete(dropId)
      returnDropToPool(drop)
    }
  }
  
  // Get current column count
  function getColumnCount(): number {
    return columnPositions.length
  }
  
  // Resize canvas and recalculate positions
  function resize(width: number, height: number) {
    if (!canvasRef.value || !ctx.value) return
    
    canvasWidth.value = width
    canvasHeight.value = height
    canvasRef.value.width = width
    canvasRef.value.height = height
    
    // Recalculate column positions
    columnPositions.length = 0
    const columnCount = Math.floor(width / columnWidth)
    for (let i = 0; i < columnCount; i++) {
      columnPositions.push(i * columnWidth)
    }
    
    // Reset font after canvas resize
    ctx.value.font = font
    ctx.value.textAlign = 'left'
    ctx.value.textBaseline = 'top'
  }
  
  // Render single character with opacity
  function renderCharacter(char: string, x: number, y: number, opacity: number, color: string) {
    if (!ctx.value) return
    
    ctx.value.save()
    ctx.value.globalAlpha = opacity
    ctx.value.fillStyle = color
    ctx.value.fillText(char, x, y)
    ctx.value.restore()
  }
  
  // Update all drops positions and trails
  function updateDrops(deltaTime: number) {
    const dropsToRemove: string[] = []
    
    activeDrops.value.forEach((drop) => {
      // Update drop age and position
      const now = Date.now()
      drop.age = now - drop.spawnTime
      drop.lastUpdate = now
      drop.position += (drop.speed * deltaTime) / 1000 // Convert to pixels per millisecond
      
      // Update legacy compatibility field
      drop.y = drop.position
      
      // Update character positions and aging
      drop.characters.forEach((char, index) => {
        char.age += deltaTime / 1000 // age in seconds
        // Characters further in trail get progressively older appearance
        const trailPosition = index / Math.max(drop.characters.length - 1, 1)
        char.brightness = Math.max(0.1, 1 - trailPosition * 0.9)
        drop.brightness[index] = char.brightness
      })
      
      // Remove drops that are completely off screen
      const dropBottom = drop.position + (drop.trailLength * 20) // 20px spacing
      if (dropBottom > canvasHeight.value + 100) {
        drop.isActive = false
        dropsToRemove.push(drop.id)
      }
    })
    
    // Clean up off-screen drops
    dropsToRemove.forEach(dropId => removeDrop(dropId))
  }
  
  // Batch render all drops with optimized draw calls
  function renderDrops() {
    if (!ctx.value) return
    
    // Group draws by opacity for batch rendering (PaulArch guidance)
    const opacityGroups = new Map<number, Array<{ char: string, x: number, y: number, color: string }>>()
    
    activeDrops.value.forEach((drop) => {
      if (drop.column >= columnPositions.length) return
      
      const x = columnPositions[drop.column]
      
      drop.characters.forEach((char, index) => {
        const charY = drop.position - (index * 20) // 20px spacing between characters
        
        // Only render if character is visible on screen
        if (charY >= -20 && charY <= canvasHeight.value + 20) {
          const opacity = Math.round(char.brightness * 100) / 100 // Round for grouping
          
          if (!opacityGroups.has(opacity)) {
            opacityGroups.set(opacity, [])
          }
          
          opacityGroups.get(opacity)!.push({
            char: char.char,
            x,
            y: charY,
            color: char.color
          })
        }
      })
    })
    
    // Render each opacity group in batch
    opacityGroups.forEach((characters, opacity) => {
      if (characters.length === 0) return
      
      ctx.value!.save()
      ctx.value!.globalAlpha = opacity
      
      // Group by color within opacity group
      const colorGroups = new Map<string, Array<{ char: string, x: number, y: number }>>()
      
      characters.forEach((char) => {
        if (!colorGroups.has(char.color)) {
          colorGroups.set(char.color, [])
        }
        colorGroups.get(char.color)!.push(char)
      })
      
      // Render each color group
      colorGroups.forEach((chars, color) => {
        ctx.value!.fillStyle = color
        chars.forEach((char) => {
          ctx.value!.fillText(char.char, char.x, char.y)
        })
      })
      
      ctx.value!.restore()
    })
  }
  
  // Main render function with performance tracking
  function render() {
    if (!ctx.value || !isInitialized.value) return
    
    const renderStartTime = performance.now()
    
    // Use semi-transparent fade instead of full clear (PaulArch guidance)
    ctx.value.save()
    ctx.value.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.value.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
    ctx.value.restore()
    
    // Render all drops in batches
    renderDrops()
    
    // Track render performance
    const renderEndTime = performance.now()
    const renderTime = renderEndTime - renderStartTime
    renderTimes.push(renderTime)
    
    // Keep only last 60 render times for averaging
    if (renderTimes.length > 60) {
      renderTimes.shift()
    }
    
    maxRenderTime.value = Math.max(maxRenderTime.value, renderTime)
  }
  
  // Animation loop with performance monitoring
  function animationLoop() {
    if (!isAnimating.value) return
    
    const currentTime = performance.now()
    
    if (lastFrameTime.value > 0) {
      const deltaTime = currentTime - lastFrameTime.value
      
      // Track frame rate
      frameCount.value++
      frameTimeSum.value += deltaTime
      
      // Detect dropped frames (> 20ms)
      if (deltaTime > 20) {
        droppedFrames.value++
      }
      
      // Update drop positions
      updateDrops(deltaTime)
      
      // Render frame
      render()
    }
    
    lastFrameTime.value = currentTime
    rafId.value = requestAnimationFrame(animationLoop)
  }
  
  // Start animation loop
  function startAnimation() {
    if (isAnimating.value || !isInitialized.value) return
    
    isAnimating.value = true
    lastFrameTime.value = 0
    frameCount.value = 0
    frameTimeSum.value = 0
    droppedFrames.value = 0
    
    rafId.value = requestAnimationFrame(animationLoop)
  }
  
  // Stop animation loop
  function stopAnimation() {
    isAnimating.value = false
    
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }
  
  // Clean up resources
  function destroy() {
    stopAnimation()
    
    // Return all active drops to pool
    activeDrops.value.forEach((drop) => {
      returnDropToPool(drop)
    })
    activeDrops.value.clear()
    
    isInitialized.value = false
    ctx.value = null
  }
  
  // Get performance metrics
  function getPerformanceMetrics(): MatrixPerformanceMetrics {
    const avgFrameTime = frameTimeSum.value / Math.max(frameCount.value, 1)
    const avgFrameRate = frameTimeSum.value > 0 ? 1000 / avgFrameTime : 0
    const avgRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
      : 0
    
    return {
      avgFrameRate: Math.round(avgFrameRate * 10) / 10,
      avgRenderTime: Math.round(avgRenderTime * 100) / 100,
      droppedFrames: droppedFrames.value,
      maxRenderTime: Math.round(maxRenderTime.value * 100) / 100
    }
  }
  
  // Get memory metrics
  function getMemoryMetrics(): MatrixMemoryMetrics {
    const activeDropCount = activeDrops.value.size
    const pooledDropCount = dropPool.length
    
    // Rough estimate: each drop ~1KB, plus canvas and other overhead
    const memoryUsageMB = ((activeDropCount + pooledDropCount) * 1024 + 10 * 1024 * 1024) / (1024 * 1024)
    
    return {
      activeDrops: activeDropCount,
      pooledDrops: pooledDropCount,
      memoryUsageMB: Math.round(memoryUsageMB * 10) / 10
    }
  }
  
  // Check if quality should be reduced
  function shouldReduceQuality(): boolean {
    const metrics = getPerformanceMetrics()
    return metrics.avgFrameRate < 30 || metrics.avgRenderTime > 20 || metrics.droppedFrames > 30
  }
  
  // Get all active drops (for testing)
  function getActiveDrops(): MatrixDrop[] {
    return Array.from(activeDrops.value.values())
  }
  
  // Computed properties
  const columnCount = computed(() => columnPositions.length)
  
  return {
    // Core functions
    initialize,
    destroy,
    startAnimation,
    stopAnimation,
    resize,
    
    // Drop management
    addDrop,
    removeDrop,
    createDrop,
    getDropFromPool,
    createTrail,
    
    // Rendering
    render,
    renderCharacter,
    
    // Metrics
    getPerformanceMetrics,
    getMemoryMetrics,
    shouldReduceQuality,
    
    // State
    isInitialized: computed(() => isInitialized.value),
    isAnimating: computed(() => isAnimating.value),
    columnCount,
    getColumnCount,
    getActiveDrops
  }
}