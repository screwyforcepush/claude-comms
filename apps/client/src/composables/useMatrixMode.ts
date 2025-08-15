/**
 * Matrix Mode State Management
 * 
 * Primary composable for managing Matrix mode state, configuration, and lifecycle.
 * Provides reactive state management for Canvas renderer integration and WebSocket event processing.
 * 
 * Key Features:
 * - Reactive mode toggle with smooth transitions
 * - Configuration management for visual parameters
 * - Drop pool with memory management (50MB limit)
 * - Performance monitoring and adaptive quality
 * - LocalStorage persistence for user preferences
 * - Integration with Canvas/WebGL renderers
 */

import { ref, reactive, computed, watch, nextTick, onUnmounted } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { HookEvent } from '../types';
import type {
  MatrixModeState,
  MatrixConfig,
  MatrixDrop,
  MatrixCharacter,
  DropPool,
  MatrixPerformanceMetrics,
  MatrixCanvasRenderer,
  MatrixWebGLRenderer,
  UseMatrixModeReturn,
  MatrixPreset,
  MatrixTransition,
  MatrixError,
  MatrixColorScheme,
  MatrixCharacterSet,
  MatrixPersistentState
} from '../types/matrix';

// ============================================================================
// Default Configuration Constants
// ============================================================================

const DEFAULT_CONFIG: MatrixConfig = {
  // Visual Configuration
  columnWidth: 20,
  dropSpeed: 60,
  trailLength: 12,
  colorScheme: {
    type: 'classic',
    primary: '#00ff00',
    highlight: '#ffffff',
    background: '#000000',
    fade: ['#00ff00', '#00cc00', '#009900', '#006600', '#003300'],
    glow: '#00ff0066',
    special: {
      spawn: '#ffff00',
      complete: '#00ffff',
      error: '#ff0000',
      message: '#ff00ff'
    }
  },
  characterSet: {
    katakana: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト', 'ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
    symbols: ['⚡', '⚠', '✓', '✗', '⚙', '◆', '●', '▲', '▼', '■'],
    numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''),
    custom: []
  },
  glowIntensity: 0.7,
  
  // Performance Configuration
  maxDrops: 1000,
  targetFPS: 60,
  adaptiveQuality: true,
  webglThreshold: 5000,
  
  // Animation Configuration
  spawnRate: 0.3,
  fadeSpeed: 0.05,
  variability: 0.2,
  gravity: 1.0
};

const STORAGE_KEY = 'matrix-mode-state';
const STORAGE_VERSION = '1.0.0';

// ============================================================================
// Character Set Definitions
// ============================================================================

const MATRIX_CHARACTERS = {
  katakana: [
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ',
    'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン'
  ],
  symbols: ['⚡', '⚠', '✓', '✗', '⚙', '◆', '●', '▲', '▼', '■', '♦', '★', '⬢', '⚪', '⚫'],
  numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for drops
 */
function generateDropId(): string {
  return `drop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate memory usage estimate for Matrix state
 */
function estimateMemoryUsage(dropCount: number, charactersPerDrop: number): number {
  if (dropCount === 0) return 0;
  
  // Rough estimate: each drop ~1KB, each character ~200 bytes
  const dropSize = 1024; // bytes
  const charSize = 200; // bytes
  const totalBytes = (dropCount * dropSize + dropCount * charactersPerDrop * charSize);
  const memoryMB = totalBytes / (1024 * 1024); // Convert to MB
  
  // Add baseline overhead for Matrix mode state (~2MB)
  return Math.max(memoryMB + 2, 0.1); // Minimum 0.1 MB to show it's working
}

/**
 * Create an empty drop pool
 */
function createDropPool(maxSize: number): DropPool {
  const pool: DropPool = {
    available: [],
    active: new Map(),
    maxSize,
    
    createDrop(): MatrixDrop {
      return {
        id: generateDropId(),
        column: 0,
        position: 0,
        speed: 1,
        characters: [],
        isEventDrop: false,
        spawnTime: Date.now(),
        lastUpdate: Date.now(),
        brightness: 1,
        trail: true
      };
    },
    
    releaseDrop(drop: MatrixDrop): void {
      // Reset drop state
      drop.position = 0;
      drop.speed = 1;
      drop.characters = [];
      drop.sourceEvent = undefined;
      drop.isEventDrop = false;
      drop.brightness = 1;
      
      // Add to available pool if under limit
      if (this.available.length < this.maxSize) {
        this.available.push(drop);
      }
      
      // Remove from active
      this.active.delete(drop.id);
    },
    
    getActiveDrop(id: string): MatrixDrop | undefined {
      return this.active.get(id);
    },
    
    cleanup(): void {
      this.active.clear();
      this.available = [];
    }
  };
  
  return pool;
}

/**
 * Load persistent state from localStorage
 */
function loadPersistentState(): MatrixPersistentState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as MatrixPersistentState;
      if (state.version === STORAGE_VERSION) {
        return state;
      }
    }
  } catch (error) {
    console.warn('Failed to load Matrix mode state from localStorage:', error);
  }
  return null;
}

/**
 * Save persistent state to localStorage
 */
function savePersistentState(state: MatrixPersistentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save Matrix mode state to localStorage:', error);
  }
}

// ============================================================================
// Main Composable
// ============================================================================

/**
 * Matrix Mode State Management Composable
 * 
 * Provides complete state management for Matrix mode including:
 * - Mode toggle and transitions
 * - Configuration management
 * - Drop lifecycle and memory management
 * - Performance monitoring
 * - Renderer integration
 * - LocalStorage persistence
 */
export function useMatrixMode(): UseMatrixModeReturn {
  // ============================================================================
  // Core State
  // ============================================================================
  
  const state = ref<MatrixModeState>({
    isEnabled: false,
    renderMode: 'canvas',
    config: { ...DEFAULT_CONFIG },
    isTransitioning: false,
    lastToggleTime: 0
  });
  
  const config = ref<MatrixConfig>({ ...DEFAULT_CONFIG });
  const drops = ref<MatrixDrop[]>([]);
  const dropPool = ref<DropPool>(createDropPool(1000));
  
  // Performance Monitoring
  const performance = ref<MatrixPerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    dropCount: 0,
    characterCount: 0,
    renderTime: 0,
    isThrottling: false,
    fpsHistory: [],
    memoryHistory: [],
    lastMeasurement: Date.now()
  });
  
  // Error State
  const errorState = ref<{ hasError: boolean; currentError: MatrixError | null }>({
    hasError: false,
    currentError: null
  });
  
  // Renderer Integration
  let currentRenderer: MatrixCanvasRenderer | MatrixWebGLRenderer | null = null;
  
  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const isEnabled = computed(() => state.value.isEnabled);
  const isTransitioning = computed(() => state.value.isTransitioning);
  
  // ============================================================================
  // Configuration Management
  // ============================================================================
  
  /**
   * Update Matrix configuration
   */
  function updateConfig(newConfig: Partial<MatrixConfig>): void {
    config.value = { ...config.value, ...newConfig };
    state.value.config = { ...config.value };
    
    // Save to localStorage
    savePersistentState({
      isEnabled: state.value.isEnabled,
      config: newConfig,
      preset: 'custom',
      lastUsed: Date.now(),
      version: STORAGE_VERSION
    });
  }
  
  /**
   * Reset configuration to defaults
   */
  function resetConfig(): void {
    config.value = { ...DEFAULT_CONFIG };
    state.value.config = { ...DEFAULT_CONFIG };
    
    savePersistentState({
      isEnabled: state.value.isEnabled,
      config: {},
      preset: 'classic',
      lastUsed: Date.now(),
      version: STORAGE_VERSION
    });
  }
  
  /**
   * Apply configuration preset
   */
  function applyPreset(preset: MatrixPreset): void {
    const presets: Record<MatrixPreset, Partial<MatrixConfig>> = {
      classic: DEFAULT_CONFIG,
      performance: {
        ...DEFAULT_CONFIG,
        maxDrops: 500,
        trailLength: 8,
        glowIntensity: 0.3,
        adaptiveQuality: true
      },
      quality: {
        ...DEFAULT_CONFIG,
        maxDrops: 2000,
        trailLength: 20,
        glowIntensity: 1.0,
        targetFPS: 120
      },
      minimal: {
        ...DEFAULT_CONFIG,
        maxDrops: 100,
        trailLength: 5,
        glowIntensity: 0,
        spawnRate: 0.1
      },
      rainbow: {
        ...DEFAULT_CONFIG,
        colorScheme: {
          ...DEFAULT_CONFIG.colorScheme,
          type: 'rainbow',
          primary: '#ff0000',
          fade: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff']
        }
      }
    };
    
    updateConfig(presets[preset]);
  }
  
  // ============================================================================
  // Mode Control
  // ============================================================================
  
  /**
   * Enable Matrix mode with transition
   */
  async function enable(): Promise<void> {
    if (state.value.isEnabled || state.value.isTransitioning) return;
    
    state.value.isTransitioning = true;
    state.value.lastToggleTime = Date.now();
    
    try {
      // Initialize renderer if needed
      if (currentRenderer && typeof currentRenderer.initialize === 'function') {
        // Renderer initialization handled by Canvas component
      }
      
      // Enable state
      state.value.isEnabled = true;
      
      // Wait for transition
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Save state
      savePersistentState({
        isEnabled: true,
        config: {},
        preset: 'classic',
        lastUsed: Date.now(),
        version: STORAGE_VERSION
      });
      
    } catch (error) {
      console.error('Failed to enable Matrix mode:', error);
      errorState.value = {
        hasError: true,
        currentError: {
          code: 'CANVAS_INIT_FAILED',
          message: 'Failed to initialize Matrix mode',
          details: error,
          timestamp: Date.now(),
          recoverable: true,
          suggested_action: 'Try refreshing the page or check browser compatibility'
        }
      };
    } finally {
      state.value.isTransitioning = false;
    }
  }
  
  /**
   * Disable Matrix mode with cleanup
   */
  async function disable(): Promise<void> {
    if (!state.value.isEnabled || state.value.isTransitioning) return;
    
    state.value.isTransitioning = true;
    state.value.lastToggleTime = Date.now();
    
    try {
      // Stop animations
      if (currentRenderer && typeof currentRenderer.stopAnimation === 'function') {
        currentRenderer.stopAnimation();
      }
      
      // Clear drops
      clearAllDrops();
      
      // Disable state
      state.value.isEnabled = false;
      
      // Wait for transition
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Save state
      savePersistentState({
        isEnabled: false,
        config: {},
        preset: 'classic',
        lastUsed: Date.now(),
        version: STORAGE_VERSION
      });
      
    } finally {
      state.value.isTransitioning = false;
    }
  }
  
  /**
   * Toggle Matrix mode
   */
  async function toggle(): Promise<void> {
    if (state.value.isEnabled) {
      await disable();
    } else {
      await enable();
    }
  }
  
  // ============================================================================
  // Drop Management
  // ============================================================================
  
  /**
   * Add a new drop to the active collection
   */
  function addDrop(drop: MatrixDrop): void {
    if (drops.value.length >= config.value.maxDrops) {
      // Remove oldest drop to make space
      const oldestDrop = drops.value.shift();
      if (oldestDrop) {
        dropPool.value.releaseDrop(oldestDrop);
      }
    }
    
    drops.value.push(drop);
    dropPool.value.active.set(drop.id, drop);
    
    // Update performance metrics immediately
    const totalCharacters = drops.value.reduce((total, d) => total + d.characters.length, 0);
    performance.value.dropCount = drops.value.length;
    performance.value.characterCount = totalCharacters;
    performance.value.memoryUsage = estimateMemoryUsage(drops.value.length, totalCharacters / Math.max(drops.value.length, 1));
  }
  
  /**
   * Remove a drop by ID
   */
  function removeDrop(dropId: string): void {
    const index = drops.value.findIndex(d => d.id === dropId);
    if (index !== -1) {
      const drop = drops.value.splice(index, 1)[0];
      dropPool.value.releaseDrop(drop);
      
      // Update performance metrics immediately
      const totalCharacters = drops.value.reduce((total, d) => total + d.characters.length, 0);
      performance.value.dropCount = drops.value.length;
      performance.value.characterCount = totalCharacters;
      performance.value.memoryUsage = estimateMemoryUsage(drops.value.length, totalCharacters / Math.max(drops.value.length, 1));
    }
  }
  
  /**
   * Clear all drops
   */
  function clearAllDrops(): void {
    drops.value.forEach(drop => dropPool.value.releaseDrop(drop));
    drops.value = [];
    
    // Update performance metrics
    performance.value.dropCount = 0;
    performance.value.characterCount = 0;
    performance.value.memoryUsage = estimateMemoryUsage(0, 0);
  }
  
  // ============================================================================
  // Event Processing
  // ============================================================================
  
  /**
   * Process a single HookEvent and create Matrix drops using the sophisticated transformer
   */
  function processEvent(event: HookEvent): void {
    if (!state.value.isEnabled) return;
    
    // For testing and immediate synchronous processing, try sync approach first
    try {
      // Try to use the sophisticated transformer synchronously if already loaded
      if (typeof window !== 'undefined' && (window as any).__matrixTransformer) {
        processEventWithTransformer(event, (window as any).__matrixTransformer);
        return;
      }
    } catch (error) {
      // Fall through to async import or fallback
    }
    
    try {
      // Use dynamic import for transformer
      import('../utils/eventToMatrix').then(({ createEventToDropTransformer }) => {
        try {
          // Create transformer with current canvas dimensions
          const canvasWidth = window.innerWidth || 800;
          const canvasHeight = window.innerHeight || 600;
          const transformer = createEventToDropTransformer(canvasWidth, canvasHeight, config.value.columnWidth);
          
          // Cache transformer for future synchronous use
          if (typeof window !== 'undefined') {
            (window as any).__matrixTransformer = transformer;
          }
          
          processEventWithTransformer(event, transformer);
        } catch (transformError) {
          console.warn('Transformer error, using fallback:', transformError);
          processEventFallback(event);
        }
      }).catch(error => {
        console.warn('Failed to load transformer module, using fallback:', error);
        processEventFallback(event);
      });
    } catch (error) {
      console.warn('Error in processEvent, using fallback:', error);
      processEventFallback(event);
    }
  }

  /**
   * Process event with a given transformer
   */
  function processEventWithTransformer(event: HookEvent, transformer: any): void {
    // Transform event to matrix drop using sophisticated pipeline
    const matrixDrop = transformer.transform(event);
    
    // Convert to useMatrixMode drop format for Canvas renderer compatibility
    const drop = dropPool.value.available.pop() || dropPool.value.createDrop();
    
    // Map sophisticated MatrixDrop to useMatrixMode format
    drop.id = matrixDrop.id;
    drop.column = matrixDrop.column;
    drop.position = matrixDrop.position;
    drop.speed = matrixDrop.speed / 60; // Convert px/second to frame-based speed
    drop.sourceEvent = event;
    drop.isEventDrop = true;
    drop.spawnTime = matrixDrop.createdAt;
    drop.brightness = matrixDrop.brightness[0] || 1; // Use head brightness
    drop.trail = true;
    
    // Convert character sequence to MatrixCharacter format
    const chars: MatrixCharacter[] = [];
    matrixDrop.characters.forEach((char, index) => {
      chars.push({
        char: char,
        age: index / matrixDrop.characters.length,
        brightness: matrixDrop.brightness[index] || (1 - index / matrixDrop.characters.length),
        color: index === 0 ? matrixDrop.headColor : matrixDrop.trailColor,
        isLeading: index === 0,
        position: index
      });
    });
    
    drop.characters = chars;
    addDrop(drop);
  }

  /**
   * Fallback event processing when transformer is unavailable
   */
  function processEventFallback(event: HookEvent): void {
    // Basic event to drop transformation as fallback
    const drop = dropPool.value.available.pop() || dropPool.value.createDrop();
    
    // Basic mapping for fallback
    drop.id = generateDropId();
    drop.column = Math.abs(hashCode(event.session_id || event.id?.toString() || 'default')) % 50; // Assume 50 columns
    drop.position = 0;
    drop.speed = Math.random() * 0.5 + 0.5; // Random speed
    drop.sourceEvent = event;
    drop.isEventDrop = true;
    drop.spawnTime = Date.now();
    drop.lastUpdate = Date.now();
    drop.brightness = 1;
    drop.trail = true;
    
    // Generate basic characters from event
    const chars: MatrixCharacter[] = [];
    const eventTypeChar = event.hook_event_type?.[0]?.toUpperCase() || '?';
    
    chars.push({
      char: eventTypeChar,
      age: 0,
      brightness: 1,
      color: config.value.colorScheme.primary,
      isLeading: true,
      position: 0
    });
    
    // Add katakana characters
    for (let i = 1; i < config.value.trailLength; i++) {
      const randomKatakana = MATRIX_CHARACTERS.katakana[Math.floor(Math.random() * MATRIX_CHARACTERS.katakana.length)];
      chars.push({
        char: randomKatakana,
        age: i / config.value.trailLength,
        brightness: 1 - (i / config.value.trailLength),
        color: config.value.colorScheme.fade[Math.min(i, config.value.colorScheme.fade.length - 1)],
        isLeading: false,
        position: i
      });
    }
    
    drop.characters = chars;
    addDrop(drop);
  }
    const drop = dropPool.value.available.pop() || dropPool.value.createDrop();
    
    // Basic mapping
    drop.id = generateDropId();
    drop.column = Math.abs(hashCode(event.session_id || '')) % 50; // Assume 50 columns
    drop.position = 0;
    drop.speed = Math.random() * 0.5 + 0.5; // Random speed
    drop.sourceEvent = event;
    drop.isEventDrop = true;
    drop.spawnTime = Date.now();
    drop.lastUpdate = Date.now();
    drop.brightness = 1;
    drop.trail = true;
    
    // Generate basic characters from event
    const chars: MatrixCharacter[] = [];
    const eventTypeChar = event.hook_event_type?.[0]?.toUpperCase() || '?';
    
    chars.push({
      char: eventTypeChar,
      age: 0,
      brightness: 1,
      color: config.value.colorScheme.primary,
      isLeading: true,
      position: 0
    });
    
    // Add katakana characters
    for (let i = 1; i < config.value.trailLength; i++) {
      const randomKatakana = MATRIX_CHARACTERS.katakana[Math.floor(Math.random() * MATRIX_CHARACTERS.katakana.length)];
      chars.push({
        char: randomKatakana,
        age: i / config.value.trailLength,
        brightness: 1 - (i / config.value.trailLength),
        color: config.value.colorScheme.fade[Math.min(i, config.value.colorScheme.fade.length - 1)],
        isLeading: false,
        position: i
      });
    }
    
    drop.characters = chars;
    addDrop(drop);
  }
  
  /**
   * Process multiple events in batch
   */
  function processEventBatch(events: HookEvent[]): void {
    events.forEach(event => processEvent(event));
  }
  
  // ============================================================================
  // Performance Management
  // ============================================================================
  
  /**
   * Update performance metrics
   */
  function updatePerformanceMetrics(): void {
    const now = Date.now();
    const deltaTime = now - performance.value.lastMeasurement;
    
    if (deltaTime > 100) { // Update every 100ms
      // Calculate character count
      const totalCharacters = drops.value.reduce((total, drop) => total + drop.characters.length, 0);
      const avgCharactersPerDrop = totalCharacters / Math.max(drops.value.length, 1);
      
      performance.value.characterCount = totalCharacters;
      performance.value.dropCount = drops.value.length;
      performance.value.memoryUsage = estimateMemoryUsage(drops.value.length, avgCharactersPerDrop);
      
      // Update FPS history (last 60 measurements)
      if (performance.value.fpsHistory.length >= 60) {
        performance.value.fpsHistory.shift();
      }
      performance.value.fpsHistory.push(performance.value.fps);
      
      // Update memory history
      if (performance.value.memoryHistory.length >= 60) {
        performance.value.memoryHistory.shift();
      }
      performance.value.memoryHistory.push(performance.value.memoryUsage);
      
      performance.value.lastMeasurement = now;
    }
  }
  
  /**
   * Adjust quality based on performance
   */
  function adjustQualityIfNeeded(): void {
    if (!config.value.adaptiveQuality) return;
    
    const avgFPS = performance.value.fpsHistory.reduce((sum, fps) => sum + fps, 0) / 
                   Math.max(performance.value.fpsHistory.length, 1);
    
    if (avgFPS < config.value.targetFPS * 0.8) {
      // Reduce quality
      if (config.value.trailLength > 5) {
        updateConfig({ trailLength: config.value.trailLength - 2 });
      }
      if (config.value.glowIntensity > 0.1) {
        updateConfig({ glowIntensity: config.value.glowIntensity * 0.8 });
      }
      performance.value.isThrottling = true;
    } else if (avgFPS > config.value.targetFPS * 0.95 && performance.value.isThrottling) {
      // Increase quality back
      if (config.value.trailLength < DEFAULT_CONFIG.trailLength) {
        updateConfig({ trailLength: Math.min(DEFAULT_CONFIG.trailLength, config.value.trailLength + 1) });
      }
      if (config.value.glowIntensity < DEFAULT_CONFIG.glowIntensity) {
        updateConfig({ glowIntensity: Math.min(DEFAULT_CONFIG.glowIntensity, config.value.glowIntensity * 1.1) });
      }
      performance.value.isThrottling = false;
    }
  }
  
  /**
   * Enforce memory limit
   */
  function enforceMemoryLimit(): void {
    const memoryLimitMB = 50; // 50MB limit
    
    while (performance.value.memoryUsage > memoryLimitMB && drops.value.length > 0) {
      const oldestDrop = drops.value.shift();
      if (oldestDrop) {
        dropPool.value.releaseDrop(oldestDrop);
      }
      
      // Recalculate memory usage
      performance.value.memoryUsage = estimateMemoryUsage(
        drops.value.length,
        drops.value.reduce((total, d) => total + d.characters.length, 0) / Math.max(drops.value.length, 1)
      );
    }
  }
  
  /**
   * Get current memory usage
   */
  function getMemoryUsage(): number {
    // Update memory usage calculation
    const currentMemory = estimateMemoryUsage(
      drops.value.length,
      drops.value.reduce((total, d) => total + d.characters.length, 0) / Math.max(drops.value.length, 1)
    );
    performance.value.memoryUsage = currentMemory;
    return currentMemory;
  }
  
  // ============================================================================
  // Renderer Integration
  // ============================================================================
  
  /**
   * Set the current renderer
   */
  function setRenderer(renderer: MatrixCanvasRenderer | MatrixWebGLRenderer): void {
    currentRenderer = renderer;
  }
  
  /**
   * Get the current renderer
   */
  function getRenderer(): MatrixCanvasRenderer | MatrixWebGLRenderer | null {
    return currentRenderer;
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Cleanup resources
   */
  function cleanup(): void {
    clearAllDrops();
    dropPool.value.cleanup();
    
    if (currentRenderer && typeof currentRenderer.cleanup === 'function') {
      currentRenderer.cleanup();
    }
    
    currentRenderer = null;
  }
  
  // ============================================================================
  // Watchers & Lifecycle
  // ============================================================================
  
  // Watch for memory limit enforcement
  watch(() => performance.value.memoryUsage, () => {
    enforceMemoryLimit();
  });
  
  // Watch for performance adjustments
  watch(() => performance.value.fps, () => {
    updatePerformanceMetrics();
    adjustQualityIfNeeded();
  });
  
  // Initialize from localStorage
  const persistentState = loadPersistentState();
  if (persistentState) {
    state.value.isEnabled = persistentState.isEnabled;
    if (persistentState.config && Object.keys(persistentState.config).length > 0) {
      updateConfig(persistentState.config);
    }
  }
  
  // Cleanup on unmount (only in component context)
  try {
    onUnmounted(() => {
      cleanup();
    });
  } catch (error) {
    // onUnmounted not available outside component context (e.g., in tests)
    // This is normal for unit testing scenarios
  }
  
  // ============================================================================
  // Return Interface
  // ============================================================================
  
  return {
    // State
    state,
    config,
    isEnabled,
    isTransitioning,
    
    // Drop Management
    drops,
    dropPool,
    addDrop,
    removeDrop,
    clearAllDrops,
    
    // Configuration
    updateConfig,
    resetConfig,
    applyPreset,
    
    // Mode Control
    enable,
    disable,
    toggle,
    
    // Event Integration
    processEvent,
    processEventBatch,
    
    // Performance
    performance,
    updatePerformanceMetrics,
    adjustQualityIfNeeded,
    
    // Memory Management
    enforceMemoryLimit,
    getMemoryUsage,
    cleanup,
    
    // Renderer Integration
    setRenderer,
    getRenderer
  };
}

// ============================================================================
// Utility Functions Export
// ============================================================================

/**
 * Simple hash function for string to number conversion
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export { MATRIX_CHARACTERS, DEFAULT_CONFIG, hashCode };