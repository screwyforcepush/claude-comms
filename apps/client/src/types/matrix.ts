/**
 * Matrix Mode Types
 * 
 * Complete type definitions for the Matrix mode visualization system.
 * These types support state management, Canvas rendering, and data transformation
 * for the Matrix rain effect in the EventTimeline component.
 */

import type { Ref, ComputedRef } from 'vue';
import type { HookEvent } from './index';

// ============================================================================
// Core Matrix Configuration
// ============================================================================

export interface MatrixModeState {
  isEnabled: boolean;
  renderMode: 'canvas' | 'webgl';
  config: MatrixConfig;
  isTransitioning: boolean;
  lastToggleTime: number;
}

export interface MatrixConfig {
  // Visual Configuration
  columnWidth: number;          // 20px default - spacing between character columns
  dropSpeed: number;            // 30-120 chars/sec - base falling speed
  trailLength: number;          // 10-20 characters - length of character trails
  colorScheme: MatrixColorScheme;
  characterSet: MatrixCharacterSet;
  glowIntensity: number;        // 0-1 - glow effect strength
  
  // Performance Configuration
  maxDrops: number;             // 1000 default - memory limit
  targetFPS: number;            // 60 default - target frame rate
  adaptiveQuality: boolean;     // true - auto-adjust quality based on performance
  webglThreshold: number;       // 5000 - switch to WebGL above this event count
  
  // Animation Configuration
  spawnRate: number;            // 0.1-1.0 - frequency of new drops spawning
  fadeSpeed: number;            // 0.01-0.1 - how fast characters fade
  variability: number;          // 0-1 - speed and timing randomness
  gravity: number;              // 0.5-2.0 - falling acceleration multiplier
}

export interface MatrixColorScheme {
  type: 'classic' | 'blue' | 'rainbow' | 'custom';
  primary: string;              // Main character color
  highlight: string;            // Leading character color
  background: string;           // Canvas background
  fade: string[];               // Gradient colors for trail fade
  glow: string;                 // Glow effect color
  special: {                    // Special event colors
    spawn: string;
    complete: string;
    error: string;
    message: string;
  };
}

export interface MatrixCharacterSet {
  katakana: string[];           // Japanese characters for agent names
  symbols: string[];            // Special symbols for event types
  numbers: string[];            // Numeric characters for timestamps/IDs
  alphanumeric: string[];       // Latin characters for fallback
  custom: string[];             // User-defined character set
}

// ============================================================================
// Drop Management
// ============================================================================

/**
 * Types of Matrix drops for different rendering behaviors
 */
export type MatrixDropType = 
  | 'event-data'      // Real event data
  | 'ambient'         // Background atmosphere
  | 'status-update'   // Agent status changes
  | 'error'           // Error events
  | 'completion'      // Completion events
  | 'spawn';          // New agent spawn

/**
 * Special visual effects that can be applied to drops
 */
export interface MatrixDropEffect {
  /** Effect type */
  type: 'pulse' | 'glow' | 'flash' | 'pause' | 'accelerate';
  
  /** Effect duration in milliseconds */
  duration: number;
  
  /** Effect intensity (0-1) */
  intensity: number;
  
  /** Effect start time */
  startTime: number;
}

export interface MatrixDrop {
  id: string;                   // Unique drop identifier
  column: number;               // Column index (0-based)
  position: number;             // Y position in pixels from top
  speed: number;                // Falling speed in pixels per second
  characters: MatrixCharacter[]; // Array of characters in this drop
  brightness: number[];         // Brightness values for each character (0-1)
  headColor: string;            // Color for the head character (hex color)
  trailColor: string;           // Color for trail characters (hex color)
  sourceEvent?: HookEvent;      // Original event data if mapped
  isEventDrop: boolean;         // True if represents real event data
  spawnTime: number;            // When this drop was created
  lastUpdate: number;           // Last animation frame time
  type: MatrixDropType;         // Drop type for special rendering
  effects?: MatrixDropEffect[]; // Special effects to apply
  trailLength: number;          // Trail length (number of visible characters)
  isActive: boolean;            // Whether this drop is still actively falling
  // Legacy compatibility fields
  createdAt?: number;           // Alias for spawnTime
  age?: number;                 // Calculated from spawnTime
  color?: string;               // Alias for headColor
  trail?: boolean;              // Whether to show trail effect
  y?: number;                   // Alias for position
}

export interface MatrixCharacter {
  char: string;                 // The character to display
  age: number;                  // 0-1, how long character has existed
  brightness: number;           // 0-1, character brightness
  color: string;                // Hex color for this character
  isLeading: boolean;           // True if this is the leading character
  position: number;             // Relative position in drop (0-1)
}

export interface DropPool {
  available: MatrixDrop[];      // Reusable drop instances
  active: Map<string, MatrixDrop>; // Currently falling drops
  maxSize: number;              // Memory limit for pool
  createDrop: () => MatrixDrop;
  releaseDrop: (drop: MatrixDrop) => void;
  getActiveDrop: (id: string) => MatrixDrop | undefined;
  cleanup: () => void;
}

// ============================================================================
// Event Transformation
// ============================================================================

export interface EventToMatrixMapper {
  transform: (event: HookEvent) => MatrixDrop;
  mapAgentNameToKatakana: (agentName: string) => string[];
  mapEventTypeToSymbol: (eventType: string) => string;
  calculateColumnFromSessionId: (sessionId: string) => number;
  calculateSpeedFromEventAge: (timestamp: number) => number;
  generateCharactersFromEvent: (event: HookEvent) => MatrixCharacter[];
}

export interface MatrixTransformOptions {
  columnCount: number;          // Number of available columns
  characterCount: number;       // Characters per drop
  speedVariation: number;       // Random speed variation (0-1)
  colorMapping: Record<string, string>; // Event type to color mapping
  prioritizeRecentEvents: boolean; // Give recent events higher brightness
}

// ============================================================================
// Rendering Interfaces
// ============================================================================

export interface MatrixCanvasRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  isInitialized: boolean;
  animationFrameId: number | null;
  
  // Core Methods
  initialize: (canvas: HTMLCanvasElement) => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  render: (drops: MatrixDrop[]) => void;
  resize: (width: number, height: number) => void;
  cleanup: () => void;
  
  // Rendering Methods
  renderDrop: (drop: MatrixDrop) => void;
  renderCharacter: (char: MatrixCharacter, x: number, y: number) => void;
  applyGlowEffect: (x: number, y: number, intensity: number) => void;
  clearCanvas: () => void;
}

export interface MatrixWebGLRenderer {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  isInitialized: boolean;
  
  // Core Methods
  initialize: (canvas: HTMLCanvasElement) => void;
  render: (drops: MatrixDrop[]) => void;
  cleanup: () => void;
  
  // WebGL Specific
  createShaderProgram: () => WebGLProgram;
  setupBuffers: () => void;
  updateUniforms: (config: MatrixConfig) => void;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface MatrixPerformanceMetrics {
  fps: number;                  // Current frames per second
  frameTime: number;            // Average frame render time (ms)
  memoryUsage: number;          // Memory usage in MB
  dropCount: number;            // Active drops count
  characterCount: number;       // Total rendered characters
  renderTime: number;           // Last render duration (ms)
  isThrottling: boolean;        // True if quality is being reduced
  
  // Performance History
  fpsHistory: number[];         // Last 60 FPS measurements
  memoryHistory: number[];      // Memory usage over time
  lastMeasurement: number;      // Timestamp of last measurement
}

export interface QualityController {
  currentLevel: number;         // 0-10, current quality level
  targetFPS: number;            // Desired FPS target
  adjustQuality: (metrics: MatrixPerformanceMetrics) => void;
  getQualitySettings: (level: number) => Partial<MatrixConfig>;
  shouldSwitchToWebGL: (metrics: MatrixPerformanceMetrics) => boolean;
}

// ============================================================================
// State Management Composable
// ============================================================================

export interface UseMatrixModeReturn {
  // State
  state: Ref<MatrixModeState>;
  config: Ref<MatrixConfig>;
  isEnabled: ComputedRef<boolean>;
  isTransitioning: ComputedRef<boolean>;
  
  // Drop Management
  drops: Ref<MatrixDrop[]>;
  dropPool: Ref<DropPool>;
  addDrop: (drop: MatrixDrop) => void;
  removeDrop: (dropId: string) => void;
  clearAllDrops: () => void;
  
  // Configuration
  updateConfig: (newConfig: Partial<MatrixConfig>) => void;
  resetConfig: () => void;
  applyPreset: (preset: MatrixPreset) => void;
  
  // Mode Control
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  toggle: () => Promise<void>;
  
  // Event Integration
  processEvent: (event: HookEvent) => void;
  processEventBatch: (events: HookEvent[]) => void;
  
  // Performance
  performance: Ref<MatrixPerformanceMetrics>;
  updatePerformanceMetrics: () => void;
  adjustQualityIfNeeded: () => void;
  
  // Memory Management
  enforceMemoryLimit: () => void;
  getMemoryUsage: () => number;
  cleanup: () => void;
  
  // Renderer Integration
  setRenderer: (renderer: MatrixCanvasRenderer | MatrixWebGLRenderer) => void;
  getRenderer: () => MatrixCanvasRenderer | MatrixWebGLRenderer | null;
}

// ============================================================================
// Configuration Presets
// ============================================================================

export type MatrixPreset = 'classic' | 'performance' | 'quality' | 'minimal' | 'rainbow';

export interface MatrixPresetDefinition {
  name: string;
  description: string;
  config: MatrixConfig;
  performanceProfile: 'low' | 'medium' | 'high';
  memoryFootprint: 'small' | 'medium' | 'large';
}

// ============================================================================
// Animation & Transitions
// ============================================================================

export interface MatrixTransition {
  type: 'enable' | 'disable' | 'config-change';
  duration: number;             // Transition duration in ms
  easing: string;               // CSS easing function
  onStart?: () => void;
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
}

export interface MatrixAnimationState {
  isAnimating: boolean;
  currentTransition: MatrixTransition | null;
  animationStartTime: number;
  pausedAt: number | null;
}

// ============================================================================
// Local Storage & Persistence
// ============================================================================

export interface MatrixPersistentState {
  isEnabled: boolean;
  config: Partial<MatrixConfig>;
  preset: MatrixPreset;
  lastUsed: number;
  version: string;
}

export interface MatrixStorageManager {
  save: (state: MatrixPersistentState) => void;
  load: () => MatrixPersistentState | null;
  clear: () => void;
  migrate: (oldVersion: string, newVersion: string) => void;
}

// ============================================================================
// Error Handling
// ============================================================================

export interface MatrixError {
  code: 'CANVAS_INIT_FAILED' | 'WEBGL_NOT_SUPPORTED' | 'MEMORY_LIMIT_EXCEEDED' | 'PERFORMANCE_DEGRADED' | 'CONFIG_INVALID';
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
  suggested_action?: string;
}

export interface MatrixErrorState {
  hasError: boolean;
  currentError: MatrixError | null;
  errorHistory: MatrixError[];
  retryCount: number;
  lastErrorTime: number;
}

// ============================================================================
// Accessibility
// ============================================================================

export interface MatrixAccessibilityConfig {
  respectReducedMotion: boolean;
  announceToggle: boolean;
  keyboardShortcuts: boolean;
  screenReaderDescriptions: boolean;
  highContrastMode: boolean;
}

export interface MatrixA11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

// ============================================================================
// Testing & Debug
// ============================================================================

export interface MatrixDebugInfo {
  state: MatrixModeState;
  performance: MatrixPerformanceMetrics;
  dropCount: number;
  memoryUsage: number;
  renderMode: 'canvas' | 'webgl';
  lastError?: MatrixError;
  configHistory: Array<{ timestamp: number; config: Partial<MatrixConfig> }>;
}

export interface MockMatrixData {
  generateTestDrops: (count: number) => MatrixDrop[];
  generateTestEvents: (count: number) => HookEvent[];
  simulatePerformanceScenario: (scenario: 'low-end' | 'high-end' | 'mobile') => MatrixPerformanceMetrics;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isMatrixDrop(obj: any): obj is MatrixDrop {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.column === 'number' &&
         typeof obj.position === 'number' &&
         Array.isArray(obj.characters);
}

export function isMatrixCharacter(obj: any): obj is MatrixCharacter {
  return obj && typeof obj === 'object' &&
         typeof obj.char === 'string' &&
         typeof obj.age === 'number' &&
         typeof obj.brightness === 'number';
}

export function isMatrixConfig(obj: any): obj is MatrixConfig {
  return obj && typeof obj === 'object' &&
         typeof obj.columnWidth === 'number' &&
         typeof obj.dropSpeed === 'number' &&
         typeof obj.trailLength === 'number';
}

// ============================================================================
// Utility Types
// ============================================================================

export type MatrixEventHandler<T = any> = (data: T) => void;
export type MatrixLifecycleEvent = 'mount' | 'unmount' | 'enable' | 'disable' | 'error' | 'performance-warning';

export interface MatrixEventBus {
  on: <T>(event: MatrixLifecycleEvent, handler: MatrixEventHandler<T>) => void;
  off: <T>(event: MatrixLifecycleEvent, handler: MatrixEventHandler<T>) => void;
  emit: <T>(event: MatrixLifecycleEvent, data?: T) => void;
  clear: () => void;
}