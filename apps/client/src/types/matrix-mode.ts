/**
 * Matrix Mode Type Definitions
 * 
 * This file defines all TypeScript interfaces and types for the Matrix Mode
 * event transformation pipeline. These interfaces will be used by the
 * EventToDropTransformer and canvas rendering system.
 */

import type { HookEvent } from '../types';

// ============================================================================
// Core Matrix Drop Interface
// ============================================================================

/**
 * Represents a single Matrix drop (character stream) falling down a column
 */
export interface MatrixDrop {
  /** Unique identifier for this drop */
  id: string;
  
  /** Column index (0-based from left) */
  column: number;
  
  /** Current Y position in pixels from top */
  position: number;
  
  /** Fall speed in pixels per second */
  speed: number;
  
  /** Array of characters in this drop (head to tail) */
  characters: string[];
  
  /** Brightness values for each character (0-1, head is brightest) */
  brightness: number[];
  
  /** Color for the head character (hex color) */
  headColor: string;
  
  /** Color for trail characters (hex color) */
  trailColor: string;
  
  /** The source event that created this drop (optional for ambient drops) */
  sourceEvent?: HookEvent;
  
  /** Timestamp when drop was created */
  createdAt: number;
  
  /** Drop type for special rendering */
  type: MatrixDropType;
  
  /** Special effects to apply */
  effects?: MatrixDropEffect[];
  
  /** Trail length (number of visible characters) */
  trailLength: number;
  
  /** Whether this drop is still actively falling */
  isActive: boolean;
}

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

// ============================================================================
// Event Transformation Interfaces
// ============================================================================

/**
 * Main interface for converting HookEvents to MatrixDrops
 */
export interface EventToDropTransformer {
  /**
   * Transform a single event into a Matrix drop
   */
  transform(event: HookEvent): MatrixDrop;
  
  /**
   * Transform multiple events into drops (batch processing)
   */
  transformBatch(events: HookEvent[]): MatrixDrop[];
  
  /**
   * Update transformer configuration
   */
  updateConfig(config: Partial<TransformerConfig>): void;
  
  /**
   * Get current transformer configuration
   */
  getConfig(): TransformerConfig;
  
  /**
   * Get column assignment for a session/source combination
   */
  getColumnForSession(sessionId: string, sourceApp: string): number;
  
  /**
   * Get available columns for new drops
   */
  getAvailableColumns(): number[];
  
  /**
   * Release a column (when drop completes)
   */
  releaseColumn(column: number): void;
}

/**
 * Configuration for the event transformer
 */
export interface TransformerConfig {
  /** Canvas width in pixels */
  canvasWidth: number;
  
  /** Canvas height in pixels */
  canvasHeight: number;
  
  /** Width of each column in pixels */
  columnWidth: number;
  
  /** Number of available columns */
  totalColumns: number;
  
  /** Maximum drops allowed simultaneously */
  maxDrops: number;
  
  /** Default trail length for event drops */
  defaultTrailLength: number;
  
  /** Speed multiplier for all drops */
  speedMultiplier: number;
  
  /** Character sets to use */
  characterSets: CharacterSets;
  
  /** Color schemes */
  colorSchemes: ColorSchemes;
  
  /** Effect presets */
  effectPresets: EffectPresets;
}

// ============================================================================
// Character System Interfaces
// ============================================================================

/**
 * Character mapping functions for different data types
 */
export interface CharacterMapper {
  /**
   * Convert agent name to stylized characters (katakana preferred)
   */
  mapAgentName(agentName: string): string[];
  
  /**
   * Convert session ID to stylized alphanumeric
   */
  mapSessionId(sessionId: string): string[];
  
  /**
   * Convert timestamp to numeric sequence
   */
  mapTimestamp(timestamp: number): string[];
  
  /**
   * Get symbol for event type
   */
  mapEventTypeToSymbol(eventType: string): string;
  
  /**
   * Get symbol for agent status
   */
  mapStatusToSymbol(status: string): string;
  
  /**
   * Generate random Matrix characters for padding
   */
  generateRandomChars(count: number): string[];
}

/**
 * Available character sets
 */
export interface CharacterSets {
  /** Japanese katakana characters */
  katakana: string[];
  
  /** Special symbols for event types */
  symbols: string[];
  
  /** Numeric characters (0-9) */
  numeric: string[];
  
  /** Alphanumeric characters */
  alphanumeric: string[];
  
  /** Random Matrix-style characters */
  matrix: string[];
}

/**
 * Color schemes for different drop types
 */
export interface ColorSchemes {
  /** Standard Matrix green */
  standard: {
    head: string;
    trail: string;
    background: string;
  };
  
  /** Error events (red-tinted) */
  error: {
    head: string;
    trail: string;
    background: string;
  };
  
  /** Success/completion events */
  success: {
    head: string;
    trail: string;
    background: string;
  };
  
  /** New spawn events */
  spawn: {
    head: string;
    trail: string;
    background: string;
  };
}

/**
 * Predefined effect configurations
 */
export interface EffectPresets {
  /** New event spawn effect */
  spawn: MatrixDropEffect[];
  
  /** Error event effect */
  error: MatrixDropEffect[];
  
  /** Completion event effect */
  completion: MatrixDropEffect[];
  
  /** Status change effect */
  statusChange: MatrixDropEffect[];
}

// ============================================================================
// Column Management Interfaces
// ============================================================================

/**
 * Manages column assignments and availability
 */
export interface ColumnManager {
  /**
   * Assign a column for a new drop
   */
  assignColumn(sessionId: string, sourceApp: string, dropType: MatrixDropType): number;
  
  /**
   * Release a column when drop is complete
   */
  releaseColumn(column: number): void;
  
  /**
   * Get current column usage statistics
   */
  getColumnStats(): ColumnStats;
  
  /**
   * Check if a column is available
   */
  isColumnAvailable(column: number): boolean;
  
  /**
   * Get all occupied columns
   */
  getOccupiedColumns(): number[];
  
  /**
   * Reserve columns for specific sessions
   */
  reserveColumnForSession(sessionId: string): number;
}

/**
 * Column usage statistics
 */
export interface ColumnStats {
  /** Total number of columns */
  total: number;
  
  /** Number of occupied columns */
  occupied: number;
  
  /** Number of available columns */
  available: number;
  
  /** Column utilization percentage */
  utilization: number;
  
  /** Mapping of sessions to their assigned columns */
  sessionColumns: Map<string, number>;
}

// ============================================================================
// Position Calculation Interfaces
// ============================================================================

/**
 * Calculates spawn positions and movement for drops
 */
export interface PositionCalculator {
  /**
   * Calculate initial spawn position for a drop
   */
  calculateSpawnPosition(column: number, dropType: MatrixDropType): Position;
  
  /**
   * Calculate next position for a falling drop
   */
  calculateNextPosition(
    currentPosition: Position, 
    speed: number, 
    deltaTime: number
  ): Position;
  
  /**
   * Check if drop has fallen off screen
   */
  isOffScreen(position: Position, canvasHeight: number): boolean;
  
  /**
   * Calculate speed based on event properties
   */
  calculateSpeed(event: HookEvent, baseSpeed: number): number;
  
  /**
   * Calculate column X position from column index
   */
  getColumnXPosition(column: number, columnWidth: number): number;
}

/**
 * 2D position coordinates
 */
export interface Position {
  x: number;
  y: number;
}

// ============================================================================
// Event Mapping Rules
// ============================================================================

/**
 * Rules for mapping event types to visual characteristics
 */
export interface EventMappingRules {
  /** Event type to speed multiplier mapping */
  speedMap: Record<string, number>;
  
  /** Event type to color mapping */
  colorMap: Record<string, string>;
  
  /** Event type to effect mapping */
  effectMap: Record<string, MatrixDropEffect[]>;
  
  /** Agent status to symbol mapping */
  statusSymbolMap: Record<string, string>;
  
  /** Session priority mapping (higher priority = better columns) */
  sessionPriorityMap: Record<string, number>;
}

// ============================================================================
// Transformation Pipeline Interfaces
// ============================================================================

/**
 * Main transformation pipeline that coordinates all components
 */
export interface TransformationPipeline {
  /** Character mapper */
  characterMapper: CharacterMapper;
  
  /** Column manager */
  columnManager: ColumnManager;
  
  /** Position calculator */
  positionCalculator: PositionCalculator;
  
  /** Event mapping rules */
  mappingRules: EventMappingRules;
  
  /** Transformer configuration */
  config: TransformerConfig;
}

/**
 * Factory for creating transformation pipeline components
 */
export interface TransformationPipelineFactory {
  /**
   * Create a new EventToDropTransformer with given configuration
   */
  createTransformer(config: TransformerConfig): EventToDropTransformer;
  
  /**
   * Create character mapper with specified character sets
   */
  createCharacterMapper(characterSets: CharacterSets): CharacterMapper;
  
  /**
   * Create column manager for given canvas dimensions
   */
  createColumnManager(totalColumns: number): ColumnManager;
  
  /**
   * Create position calculator
   */
  createPositionCalculator(): PositionCalculator;
  
  /**
   * Create default mapping rules
   */
  createDefaultMappingRules(): EventMappingRules;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Event data extraction result
 */
export interface EventDataExtraction {
  /** Agent name (if available) */
  agentName?: string;
  
  /** Session identifier */
  sessionId: string;
  
  /** Source application */
  sourceApp: string;
  
  /** Event type */
  eventType: string;
  
  /** Agent status (if available) */
  status?: string;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Additional payload data */
  payload: Record<string, any>;
}

/**
 * Drop generation parameters
 */
export interface DropGenerationParams {
  /** Source event data */
  eventData: EventDataExtraction;
  
  /** Assigned column */
  column: number;
  
  /** Calculated spawn position */
  spawnPosition: Position;
  
  /** Character sequence */
  characters: string[];
  
  /** Drop type */
  type: MatrixDropType;
  
  /** Speed */
  speed: number;
  
  /** Effects to apply */
  effects: MatrixDropEffect[];
}