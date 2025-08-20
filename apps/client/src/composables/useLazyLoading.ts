import { ref, computed, watch, nextTick, type Ref } from 'vue'

/**
 * Lazy Loading Composable
 * 
 * Provides efficient lazy loading capabilities for large datasets:
 * - Progressive data loading
 * - Intersection Observer for viewport detection
 * - Memory-efficient pagination
 * - Performance-optimized chunk loading
 */

export interface LazyLoadingConfig {
  // Core configuration
  chunkSize: number
  initialLoad: number
  loadThreshold: number // Pixels from bottom to trigger load
  
  // Performance tuning
  debounceMs: number
  maxCachedChunks: number
  preloadChunks: number
  
  // Memory management
  memoryThreshold: number // MB
  enableMemoryManagement: boolean
}

export interface LazyLoadedData<T> {
  items: T[]
  chunk: number
  isComplete: boolean
  totalAvailable?: number
}

const DEFAULT_CONFIG: LazyLoadingConfig = {
  chunkSize: 50,
  initialLoad: 100,
  loadThreshold: 1000,
  debounceMs: 100,
  maxCachedChunks: 10,
  preloadChunks: 2,
  memoryThreshold: 50, // 50MB
  enableMemoryManagement: true
}

export function useLazyLoading<T>(
  dataLoader: (offset: number, limit: number) => Promise<LazyLoadedData<T>>,
  config: Partial<LazyLoadingConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // State
  const isLoading = ref(false)
  const hasMore = ref(true)
  const error = ref<string | null>(null)
  const currentChunk = ref(0)
  const totalLoaded = ref(0)
  const allItems = ref<T[]>([])
  
  // Memory management
  const chunkCache = new Map<number, T[]>()
  const memoryUsage = ref(0)
  
  // Intersection Observer for viewport detection
  const triggerElement = ref<HTMLElement>()
  let intersectionObserver: IntersectionObserver | null = null
  
  // Debounced loading
  let loadTimeout: NodeJS.Timeout | null = null

  /**
   * Estimate memory usage of cached chunks
   */
  const estimateMemoryUsage = (): number => {
    let usage = 0
    for (const chunk of chunkCache.values()) {
      // Rough estimation: JSON.stringify length * 2 (UTF-16)
      usage += JSON.stringify(chunk).length * 2
    }
    return usage
  }

  /**
   * Manage memory by evicting old chunks if necessary
   */
  const manageMemory = () => {
    if (!finalConfig.enableMemoryManagement) return
    
    const currentUsage = estimateMemoryUsage()
    memoryUsage.value = currentUsage
    
    const thresholdBytes = finalConfig.memoryThreshold * 1024 * 1024
    
    if (currentUsage > thresholdBytes || chunkCache.size > finalConfig.maxCachedChunks) {
      // Remove oldest chunks (keep current and nearby chunks)
      const keepChunks = new Set([
        currentChunk.value,
        Math.max(0, currentChunk.value - 1),
        currentChunk.value + 1
      ])
      
      const chunksToRemove: number[] = []
      for (const chunkNum of chunkCache.keys()) {
        if (!keepChunks.has(chunkNum)) {
          chunksToRemove.push(chunkNum)
        }
      }
      
      // Sort by distance from current chunk and remove farthest
      chunksToRemove
        .sort((a, b) => Math.abs(a - currentChunk.value) - Math.abs(b - currentChunk.value))
        .slice(Math.max(0, chunksToRemove.length - 3)) // Keep at least 3 extra chunks
        .forEach(chunkNum => {
          chunkCache.delete(chunkNum)
        })
      
      console.debug(`Memory management: Evicted ${chunksToRemove.length} chunks, current usage: ${(estimateMemoryUsage() / 1024 / 1024).toFixed(2)}MB`)
    }
  }

  /**
   * Load a specific chunk of data
   */
  const loadChunk = async (chunkNumber: number, silent = false): Promise<void> => {
    // Check if chunk is already cached
    if (chunkCache.has(chunkNumber)) {
      return
    }

    if (!silent) {
      isLoading.value = true
    }
    error.value = null

    try {
      const offset = chunkNumber * finalConfig.chunkSize
      const limit = finalConfig.chunkSize
      
      const startTime = performance.now()
      const result = await dataLoader(offset, limit)
      const loadTime = performance.now() - startTime
      
      if (loadTime > 200) {
        console.warn(`Slow chunk load: Chunk ${chunkNumber} took ${loadTime.toFixed(2)}ms`)
      }

      // Cache the chunk
      chunkCache.set(chunkNumber, result.items)
      
      // Update total available if provided
      if (result.totalAvailable !== undefined) {
        hasMore.value = offset + result.items.length < result.totalAvailable
      } else {
        hasMore.value = result.items.length === finalConfig.chunkSize
      }

      // Manage memory usage
      manageMemory()
      
      console.debug(`Loaded chunk ${chunkNumber}: ${result.items.length} items (${loadTime.toFixed(2)}ms)`)
      
    } catch (loadError) {
      console.error(`Failed to load chunk ${chunkNumber}:`, loadError)
      error.value = loadError instanceof Error ? loadError.message : 'Unknown error'
    } finally {
      if (!silent) {
        isLoading.value = false
      }
    }
  }

  /**
   * Preload nearby chunks for smooth scrolling
   */
  const preloadNearbyChunks = async (centerChunk: number) => {
    const preloadPromises: Promise<void>[] = []
    
    for (let i = 1; i <= finalConfig.preloadChunks; i++) {
      // Preload next chunks
      const nextChunk = centerChunk + i
      if (!chunkCache.has(nextChunk)) {
        preloadPromises.push(loadChunk(nextChunk, true))
      }
      
      // Preload previous chunks
      const prevChunk = centerChunk - i
      if (prevChunk >= 0 && !chunkCache.has(prevChunk)) {
        preloadPromises.push(loadChunk(prevChunk, true))
      }
    }

    // Execute preloads in parallel but don't wait for them
    Promise.all(preloadPromises).catch(error => {
      console.debug('Preload failed (non-critical):', error)
    })
  }

  /**
   * Load more data (for manual triggering)
   */
  const loadMore = async (): Promise<void> => {
    if (isLoading.value || !hasMore.value) return

    // Clear any pending debounced loads
    if (loadTimeout) {
      clearTimeout(loadTimeout)
      loadTimeout = null
    }

    const nextChunk = currentChunk.value + 1
    await loadChunk(nextChunk)
    
    if (!error.value) {
      currentChunk.value = nextChunk
      totalLoaded.value += finalConfig.chunkSize
      
      // Preload nearby chunks
      preloadNearbyChunks(nextChunk)
    }
  }

  /**
   * Debounced load more for scroll events
   */
  const debouncedLoadMore = () => {
    if (loadTimeout) {
      clearTimeout(loadTimeout)
    }
    
    loadTimeout = setTimeout(() => {
      loadMore()
      loadTimeout = null
    }, finalConfig.debounceMs)
  }

  /**
   * Setup intersection observer for automatic loading
   */
  const setupIntersectionObserver = () => {
    if (!triggerElement.value || intersectionObserver) return

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore.value && !isLoading.value) {
          debouncedLoadMore()
        }
      },
      {
        rootMargin: `${finalConfig.loadThreshold}px`,
        threshold: 0
      }
    )

    intersectionObserver.observe(triggerElement.value)
  }

  /**
   * Cleanup intersection observer
   */
  const cleanupIntersectionObserver = () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }
  }

  /**
   * Get currently visible items based on loaded chunks
   */
  const visibleItems = computed(() => {
    const items: T[] = []
    const maxChunk = Math.max(0, currentChunk.value)
    
    // Collect items from all loaded chunks up to current
    for (let i = 0; i <= maxChunk; i++) {
      const chunkItems = chunkCache.get(i)
      if (chunkItems) {
        items.push(...chunkItems)
      }
    }
    
    return items
  })

  /**
   * Initialize with initial data load
   */
  const initialize = async (): Promise<void> => {
    // Calculate how many initial chunks to load
    const initialChunks = Math.ceil(finalConfig.initialLoad / finalConfig.chunkSize)
    
    // Load initial chunks in parallel
    const initialLoads = Array.from({ length: initialChunks }, (_, i) => loadChunk(i, i > 0))
    
    try {
      await Promise.all(initialLoads)
      currentChunk.value = initialChunks - 1
      totalLoaded.value = finalConfig.initialLoad
      
      // Start preloading next chunks
      preloadNearbyChunks(currentChunk.value)
      
    } catch (initError) {
      console.error('Failed to initialize lazy loading:', initError)
      error.value = initError instanceof Error ? initError.message : 'Initialization failed'
    }
  }

  /**
   * Reset to initial state
   */
  const reset = (): void => {
    cleanupIntersectionObserver()
    chunkCache.clear()
    currentChunk.value = 0
    totalLoaded.value = 0
    allItems.value = []
    hasMore.value = true
    error.value = null
    memoryUsage.value = 0
    
    if (loadTimeout) {
      clearTimeout(loadTimeout)
      loadTimeout = null
    }
  }

  /**
   * Jump to a specific chunk (for programmatic navigation)
   */
  const jumpToChunk = async (chunkNumber: number): Promise<void> => {
    if (chunkNumber < 0) return
    
    await loadChunk(chunkNumber)
    if (!error.value) {
      currentChunk.value = chunkNumber
      totalLoaded.value = (chunkNumber + 1) * finalConfig.chunkSize
      preloadNearbyChunks(chunkNumber)
    }
  }

  // Watch trigger element for intersection observer setup
  watch(
    triggerElement,
    (newElement) => {
      cleanupIntersectionObserver()
      if (newElement) {
        nextTick(() => {
          setupIntersectionObserver()
        })
      }
    },
    { immediate: true }
  )

  // Cleanup on unmount
  const cleanup = () => {
    cleanupIntersectionObserver()
    reset()
  }

  return {
    // State
    isLoading: computed(() => isLoading.value),
    hasMore: computed(() => hasMore.value),
    error: computed(() => error.value),
    currentChunk: computed(() => currentChunk.value),
    totalLoaded: computed(() => totalLoaded.value),
    visibleItems,
    memoryUsage: computed(() => memoryUsage.value),
    
    // Template refs
    triggerElement,
    
    // Methods
    loadMore,
    initialize,
    reset,
    jumpToChunk,
    cleanup,
    
    // Advanced methods
    preloadNearbyChunks,
    manageMemory,
    
    // Debug info
    getCacheStats: () => ({
      cachedChunks: chunkCache.size,
      memoryUsageMB: (memoryUsage.value / 1024 / 1024).toFixed(2),
      currentChunk: currentChunk.value
    })
  }
}