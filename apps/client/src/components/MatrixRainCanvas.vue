<template>
  <div class="matrix-rain-container" :style="{ width: `${width}px`, height: `${height}px` }">
    <!-- Main Canvas Element -->
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      :aria-label="screenReaderText"
      role="img"
      class="matrix-canvas"
      :class="{
        'matrix-canvas--enabled': enabled,
        'matrix-canvas--reduced-motion': prefersReducedMotion
      }"
    />
    
    <!-- Accessibility Live Region -->
    <div
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
      role="status"
    >
      {{ liveRegionText }}
    </div>
    
    <!-- Debug Overlay (Development Only) -->
    <div
      v-if="debug && isDevelopment"
      class="matrix-debug-overlay"
    >
      <div class="debug-panel">
        <h4>Matrix Renderer Debug</h4>
        <div class="debug-metrics">
          <div>FPS: {{ debugMetrics.avgFrameRate.toFixed(1) }}</div>
          <div>Render: {{ debugMetrics.avgRenderTime.toFixed(2) }}ms</div>
          <div>Drops: {{ debugMetrics.activeDrops }}</div>
          <div>Memory: {{ debugMetrics.memoryUsageMB.toFixed(1) }}MB</div>
          <div>Columns: {{ columnCount }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMatrixCanvasRenderer } from '../composables/useMatrixCanvasRenderer'
import type { MatrixDrop, MatrixConfig } from '../types/matrix'

// Props with validation
interface Props {
  width: number
  height: number
  enabled: boolean
  config?: Partial<MatrixConfig>
  debug?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 800,
  height: 600,
  enabled: true,
  config: () => ({}),
  debug: false
})

// Validate props
if (props.width <= 0 || props.height <= 0) {
  console.warn('MatrixRainCanvas: Invalid dimensions provided')
}

// Events
const emit = defineEmits<{
  'performance-update': [metrics: any]
  'memory-update': [metrics: any]
  'quality-warning': []
  'error': [error: Error]
}>()

// Template refs
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Initialize the canvas renderer
const renderer = useMatrixCanvasRenderer(canvasRef)

// Initialize Matrix mode state management
const matrixMode = useMatrixMode()

// Register this renderer with Matrix mode
matrixMode.setRenderer(renderer)

// Reactive state
const isInitialized = ref(false)
const prefersReducedMotion = ref(false)
const isDevelopment = computed(() => process.env.NODE_ENV === 'development')

// Debug metrics (only in development)
const debugMetrics = ref({
  avgFrameRate: 0,
  avgRenderTime: 0,
  activeDrops: 0,
  memoryUsageMB: 0
})

// Accessibility text
const screenReaderText = computed(() => {
  if (!props.enabled) return 'Matrix rain visualization disabled'
  return 'Matrix rain visualization showing real-time event stream'
})

const liveRegionText = ref('')

// Column count from renderer
const columnCount = computed(() => renderer.getColumnCount())

// Resize observer for responsive canvas
let resizeObserver: ResizeObserver | null = null

// Performance monitoring timer
let performanceTimer: number | null = null

// Check for reduced motion preference
function checkReducedMotion() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mediaQuery.matches
    
    mediaQuery.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches
      handleReducedMotionChange()
    })
  }
}

// Handle reduced motion preference changes
function handleReducedMotionChange() {
  if (prefersReducedMotion.value && renderer.isAnimating.value) {
    renderer.stopAnimation()
    liveRegionText.value = 'Matrix animation paused due to reduced motion preference'
  } else if (!prefersReducedMotion.value && props.enabled && isInitialized.value) {
    renderer.startAnimation()
    liveRegionText.value = 'Matrix animation resumed'
  }
}

// Initialize canvas and start animation
async function initializeCanvas() {
  try {
    await nextTick() // Ensure canvas is in DOM
    
    if (!canvasRef.value) {
      throw new Error('Canvas element not available')
    }
    
    renderer.initialize()
    isInitialized.value = true
    
    // Start animation if enabled and motion is allowed
    if (props.enabled && !prefersReducedMotion.value) {
      renderer.startAnimation()
      liveRegionText.value = 'Matrix visualization started'
    }
    
    // Start performance monitoring
    startPerformanceMonitoring()
    
  } catch (error) {
    console.error('MatrixRainCanvas initialization failed:', error)
    emit('error', error as Error)
  }
}

// Start performance monitoring
function startPerformanceMonitoring() {
  if (performanceTimer) return
  
  performanceTimer = window.setInterval(() => {
    const perfMetrics = renderer.getPerformanceMetrics()
    const memMetrics = renderer.getMemoryMetrics()
    
    // Update Matrix mode performance metrics
    matrixMode.performance.value.fps = perfMetrics.avgFrameRate
    matrixMode.performance.value.frameTime = 1000 / Math.max(perfMetrics.avgFrameRate, 1)
    matrixMode.performance.value.renderTime = perfMetrics.avgRenderTime
    matrixMode.performance.value.dropCount = memMetrics.activeDrops
    matrixMode.performance.value.memoryUsage = memMetrics.memoryUsageMB
    
    // Update debug metrics
    debugMetrics.value = {
      avgFrameRate: perfMetrics.avgFrameRate,
      avgRenderTime: perfMetrics.avgRenderTime,
      activeDrops: memMetrics.activeDrops,
      memoryUsageMB: memMetrics.memoryUsageMB
    }
    
    // Emit performance metrics
    emit('performance-update', perfMetrics)
    emit('memory-update', memMetrics)
    
    // Check for performance issues
    if (renderer.shouldReduceQuality()) {
      emit('quality-warning')
    }
    
    // Update Matrix mode performance tracking
    matrixMode.updatePerformanceMetrics()
  }, 1000) // Every second
}

// Stop performance monitoring
function stopPerformanceMonitoring() {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
}

// Setup resize observer
function setupResizeObserver() {
  if (!window.ResizeObserver) return
  
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      renderer.resize(width, height)
    }
  })
  
  if (canvasRef.value) {
    resizeObserver.observe(canvasRef.value)
  }
}

// Handle window resize
function handleWindowResize() {
  if (isInitialized.value) {
    renderer.resize(props.width, props.height)
  }
}

// Sync drops from Matrix mode state to Canvas renderer
function syncDropsFromState() {
  if (!isInitialized.value) return
  
  // Clear existing canvas drops
  renderer.getActiveDrops().forEach(drop => {
    renderer.removeDrop(drop.id)
  })
  
  // Add drops from Matrix mode state
  matrixMode.drops.value.forEach(stateDrop => {
    // Convert Matrix mode drop to Canvas drop format
    const canvasDrop = renderer.createDrop(
      stateDrop.id,
      stateDrop.column,
      stateDrop.characters.map(char => char.char)
    )
    
    // Update position and properties
    canvasDrop.y = stateDrop.position * 20 // Convert position to pixels
    canvasDrop.speed = stateDrop.speed * 100 // Convert to pixels per second
    canvasDrop.age = (Date.now() - stateDrop.spawnTime) / 1000 // Age in seconds
    
    renderer.addDrop(canvasDrop)
  })
}

// Handle visibility change
function handleVisibilityChange() {
  if (document.hidden) {
    if (renderer.isAnimating.value) {
      renderer.stopAnimation()
    }
  } else {
    if (props.enabled && !prefersReducedMotion.value && isInitialized.value) {
      renderer.startAnimation()
    }
  }
}

// Handle window focus/blur
function handleWindowBlur() {
  if (renderer.isAnimating.value) {
    renderer.stopAnimation()
  }
}

function handleWindowFocus() {
  if (props.enabled && !prefersReducedMotion.value && isInitialized.value) {
    renderer.startAnimation()
  }
}

// Clean up resources
function cleanup() {
  stopPerformanceMonitoring()
  
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('focus', handleWindowFocus)
  
  if (isInitialized.value) {
    renderer.destroy()
    isInitialized.value = false
  }
}

// Exposed methods for parent components
function addDrop(drop: MatrixDrop) {
  if (isInitialized.value) {
    renderer.addDrop(drop)
    // Also add to Matrix mode state if not already there
    const existingDrop = matrixMode.dropPool.value.getActiveDrop(drop.id)
    if (!existingDrop) {
      // Convert Canvas drop to Matrix mode drop format
      const stateDrop = {
        id: drop.id,
        column: drop.column,
        position: drop.y / 20, // Convert pixels to position
        speed: drop.speed / 100, // Convert to speed units
        characters: drop.characters.map((char, index) => ({
          char,
          age: index / drop.characters.length,
          brightness: 1 - (index / drop.characters.length),
          color: drop.color,
          isLeading: index === 0,
          position: index
        })),
        isEventDrop: false,
        spawnTime: Date.now() - (drop.age * 1000),
        lastUpdate: Date.now(),
        brightness: 1,
        trail: true
      }
      matrixMode.addDrop(stateDrop)
    }
  }
}

function removeDrop(dropId: string) {
  if (isInitialized.value) {
    renderer.removeDrop(dropId)
    matrixMode.removeDrop(dropId)
  }
}

function clearAllDrops() {
  if (isInitialized.value) {
    renderer.destroy()
    renderer.initialize()
    matrixMode.clearAllDrops()
  }
}

function getMemoryMetrics() {
  if (isInitialized.value) {
    const metrics = renderer.getMemoryMetrics()
    emit('memory-update', metrics)
    return metrics
  }
  return null
}

// Watch for Matrix mode state changes
watch(() => matrixMode.isEnabled.value, (isEnabled) => {
  if (!isInitialized.value) return
  
  if (isEnabled && !prefersReducedMotion.value) {
    renderer.startAnimation()
    liveRegionText.value = 'Matrix visualization enabled'
  } else {
    renderer.stopAnimation()
    liveRegionText.value = 'Matrix visualization disabled'
  }
})

// Watch for Matrix mode drops changes
watch(() => matrixMode.drops.value, () => {
  syncDropsFromState()
}, { deep: true })

// Watch for prop changes (keep for backwards compatibility)
watch(() => props.enabled, (newEnabled) => {
  // Sync with Matrix mode state
  if (newEnabled !== matrixMode.isEnabled.value) {
    if (newEnabled) {
      matrixMode.enable()
    } else {
      matrixMode.disable()
    }
  }
})

watch(() => [props.width, props.height], ([newWidth, newHeight]) => {
  if (isInitialized.value) {
    renderer.resize(newWidth, newHeight)
  }
})

watch(() => props.config, () => {
  // Reinitialize with new config
  if (isInitialized.value) {
    const wasAnimating = renderer.isAnimating.value
    renderer.destroy()
    renderer.initialize()
    if (wasAnimating && props.enabled && !prefersReducedMotion.value) {
      renderer.startAnimation()
    }
  }
}, { deep: true })

// Lifecycle hooks
onMounted(async () => {
  checkReducedMotion()
  setupResizeObserver()
  
  // Add event listeners
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('focus', handleWindowFocus)
  
  await initializeCanvas()
  
  // Initial sync with Matrix mode state
  syncDropsFromState()
})

onUnmounted(() => {
  cleanup()
})

// Expose methods and state for parent components and testing
defineExpose({
  renderer,
  isInitialized: computed(() => isInitialized.value),
  isAnimating: renderer.isAnimating,
  addDrop,
  removeDrop,
  clearAllDrops,
  getMemoryMetrics
})
</script>

<style scoped>
.matrix-rain-container {
  position: relative;
  overflow: hidden;
  background: #000;
}

.matrix-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}

.matrix-canvas--enabled {
  cursor: none; /* Hide cursor for immersive experience */
}

/* Reduced motion styles */
.matrix-canvas--reduced-motion {
  opacity: 0.7;
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Debug overlay */
.matrix-debug-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  padding: 10px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  backdrop-filter: blur(4px);
  z-index: 10;
}

.debug-panel h4 {
  margin: 0 0 8px 0;
  color: #00ff00;
  font-size: 14px;
  text-align: center;
  border-bottom: 1px solid #00ff00;
  padding-bottom: 4px;
}

.debug-metrics {
  display: grid;
  gap: 2px;
}

/* Performance optimizations */
.matrix-canvas {
  will-change: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .matrix-debug-overlay {
    font-size: 10px;
    padding: 8px;
  }
  
  .debug-panel h4 {
    font-size: 12px;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .matrix-rain-container {
    background: #000;
    border: 1px solid #fff;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .matrix-canvas {
    opacity: 0.5;
  }
  
  .matrix-debug-overlay {
    animation: none;
  }
}

/* Focus management for accessibility */
.matrix-canvas:focus {
  outline: 2px solid #00ff00;
  outline-offset: 2px;
}

/* Print styles */
@media print {
  .matrix-rain-container {
    display: none;
  }
}
</style>