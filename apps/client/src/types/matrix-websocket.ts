/**
 * Matrix Mode WebSocket Integration Types
 * 
 * Type definitions for Matrix mode WebSocket event handling, transformation,
 * and integration with existing WebSocket infrastructure.
 */

import type { HookEvent, WebSocketMessage } from '../types';
import type { Ref } from 'vue';

// ============================================================================
// Core Matrix WebSocket Types
// ============================================================================

export interface MatrixEventSubscription {
  isActive: boolean;
  eventTypes: Set<string>;
  sessionFilter?: string;
  maxEventHistory: number; // 1000 for performance
  transformOptions: MatrixTransformOptions;
}

export interface MatrixEventProcessor {
  processInitialEvents(events: HookEvent[]): MatrixDrop[];
  processNewEvent(event: HookEvent): MatrixDrop | null;
  updateEventStatus(event: HookEvent): MatrixDropUpdate | null;
  cleanupOldEvents(maxAge: number): void;
}

// ============================================================================
// Matrix Drop Representation
// ============================================================================

export interface MatrixDrop {
  id: string;
  column: number; // 0-based column index (0-119 for 120 columns)
  character: string; // Rendered character (katakana/symbol)
  speed: number; // pixels per frame (1-8)
  brightness: number; // 0.3-1.0
  trail: string[]; // Previous characters in trail (8-15 chars)
  color: MatrixColor; // Green variants or special colors
  age: number; // milliseconds since creation
  eventType: string; // Original hook_event_type
  agentName?: string; // For agent-related events
  sessionId: string;
  metadata: MatrixDropMetadata;
}

export interface MatrixDropMetadata {
  originalEvent: HookEvent;
  spawnTime: number;
  lastUpdate: number;
  isNewEvent: boolean; // For glow effects
  isCompleting: boolean; // For completion effects
  hasError: boolean; // For error highlighting
}

export interface MatrixDropUpdate {
  dropId: string;
  updates: Partial<MatrixDrop>;
  animationType?: 'glow' | 'fade' | 'complete' | 'error';
}

// ============================================================================
// Matrix Color System
// ============================================================================

export type MatrixColor = 'primary' | 'agent' | 'user' | 'error' | 'complete' | 'new';

export interface MatrixColorPalette {
  primary: string; // Classic green #00ff41
  agent: string; // Blue-green for agent events
  user: string; // Bright green for user prompts
  error: string; // Red tint for errors
  complete: string; // Yellow-green for completions
  new: string; // Bright white for new events
}

// ============================================================================
// Event Filtering and Transformation
// ============================================================================

export interface MatrixEventFilter {
  includeEventTypes: Set<string>;
  excludeSessionIds?: Set<string>;
  maxAge: number; // Events older than this (ms) are excluded
  priorityEvents: Set<string>; // Events that get special visual treatment
}

export interface MatrixTransformOptions {
  columnCount: number; // 120 columns for 1920px width (16px per column)
  characterSets: MatrixCharacterSets;
  speedMapping: EventSpeedMapping;
  colorMapping: EventColorMapping;
  trailLength: number; // 8-15 characters
}

export interface MatrixCharacterSets {
  katakana: string[]; // Primary character set for agent names
  symbols: string[]; // Special symbols for event types
  alphanumeric: string[]; // Fallback characters
  statusSymbols: string[]; // Status indicators (✓, ⚡, ❌, etc.)
}

export interface EventSpeedMapping {
  new_event: number; // Fastest speed (6-8 pixels/frame)
  agent_spawn: number; // Fast speed (4-6 pixels/frame)
  message: number; // Medium speed (2-4 pixels/frame)
  status_update: number; // Slow speed (1-3 pixels/frame)
  default: number; // Base speed (2 pixels/frame)
}

export interface EventColorMapping {
  user_prompt: MatrixColor;
  agent_spawn: MatrixColor;
  agent_complete: MatrixColor;
  subagent_message: MatrixColor;
  error_event: MatrixColor;
  status_update: MatrixColor;
}

// ============================================================================
// WebSocket Integration
// ============================================================================

export interface UseMatrixWebSocketOptions {
  normalMode: boolean; // Continue normal event handling
  matrixMode: boolean; // Enable Matrix event processing
  sharedConnection: boolean; // Use existing WebSocket connection
  eventHistory: number; // Events to maintain in Matrix buffer
}

export interface MatrixWebSocketState {
  isConnected: boolean;
  matrixEvents: MatrixDrop[];
  eventBuffer: HookEvent[]; // Recent events for processing
  subscription: MatrixEventSubscription | null;
  processor: MatrixEventProcessor | null;
  lastCleanup: number;
  connectionError: string | null;
}

export interface MatrixWebSocketReturn {
  // Reactive state
  matrixEvents: Ref<MatrixDrop[]>;
  matrixEventStream: Ref<MatrixDrop[]>;
  subscription: Ref<MatrixEventSubscription | null>;
  isProcessing: Ref<boolean>;
  connectionState: Ref<MatrixWebSocketState>;
  
  // Event management
  enableMatrixMode: (enabled: boolean) => void;
  updateSubscription: (subscription: Partial<MatrixEventSubscription>) => void;
  clearEventBuffer: () => void;
  forceCleanup: () => void;
  
  // Event processing
  processWebSocketMessage: (message: WebSocketMessage) => void;
  addManualEvent: (event: HookEvent) => MatrixDrop | null;
  updateEventStatus: (eventId: string, status: Partial<MatrixDropMetadata>) => void;
  
  // Performance monitoring
  getPerformanceMetrics: () => MatrixPerformanceMetrics;
}

// ============================================================================
// Performance and Monitoring
// ============================================================================

export interface MatrixPerformanceMetrics {
  eventCount: number;
  dropsPerSecond: number;
  memoryUsageMB: number;
  processingLatency: number; // ms from WebSocket to Matrix drop
  cleanupFrequency: number; // cleanups per minute
  bufferSize: number; // current event buffer size
  lastFrameTime: number; // time for last processing frame
}

export interface MatrixPerformanceConfig {
  maxDrops: number;
  maxAge: number; // milliseconds
  targetFPS: number;
  batchSize: number; // Events per batch
  throttleMs: number; // Processing throttle
  adaptiveQuality: {
    highLoad: { trailLength: number; effects: boolean };
    normalLoad: { trailLength: number; effects: boolean };
    lowLoad: { trailLength: number; effects: boolean };
  };
}

// ============================================================================
// Event Type Mappings
// ============================================================================

export interface MatrixEventTypeMapping {
  [eventType: string]: {
    character: string;
    speedMultiplier: number;
    color: MatrixColor;
    trailLength: number;
    priority: number; // 1-5, higher = more priority
  };
}

// ============================================================================
// Column Management
// ============================================================================

export interface MatrixColumnState {
  columnIndex: number;
  activeDrops: string[]; // Drop IDs currently in this column
  lastSpawnTime: number;
  density: number; // 0-1, how crowded this column is
  reservedFor?: string; // Session ID or agent name
}

export interface MatrixColumnManager {
  getColumnForEvent: (event: HookEvent) => number;
  isColumnAvailable: (columnIndex: number) => boolean;
  reserveColumn: (columnIndex: number, reservedFor: string) => void;
  releaseColumn: (columnIndex: number) => void;
  getColumnDensity: (columnIndex: number) => number;
  optimizeColumnDistribution: () => void;
}

// ============================================================================
// Integration with Existing Systems
// ============================================================================

export interface MatrixWebSocketIntegration {
  normalHandler: (event: MessageEvent) => void;
  matrixHandler: (event: MessageEvent) => void;
  matrixEnabled: Ref<boolean>;
  
  handleMessage: (event: MessageEvent) => void;
  enableDualMode: (enabled: boolean) => void;
  getIntegrationStatus: () => MatrixIntegrationStatus;
}

export interface MatrixIntegrationStatus {
  normalModeActive: boolean;
  matrixModeActive: boolean;
  sharedConnection: boolean;
  eventsThroughput: number; // events per second
  errorCount: number;
  lastSyncTime: number;
}

// ============================================================================
// Error Handling
// ============================================================================

export interface MatrixWebSocketError {
  code: string;
  message: string;
  timestamp: number;
  eventId?: string;
  recoverable: boolean;
  details?: any;
}

export type MatrixErrorType = 
  | 'connection_failed'
  | 'message_parse_error'
  | 'event_processing_error'
  | 'memory_limit_exceeded'
  | 'performance_degradation'
  | 'integration_conflict';

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_MATRIX_CHARACTER_SETS: MatrixCharacterSets = {
  katakana: [
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ',
    'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン'
  ],
  symbols: ['◆', '◇', '●', '○', '■', '□', '▲', '△', '▼', '▽'],
  alphanumeric: [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z'
  ],
  statusSymbols: ['✓', '⚡', '❌', '⚠', '●', '◉', '⟳', '▶', '⏸', '⏹']
};

export const DEFAULT_EVENT_SPEED_MAPPING: EventSpeedMapping = {
  new_event: 7,
  agent_spawn: 5,
  message: 3,
  status_update: 2,
  default: 2
};

export const DEFAULT_EVENT_COLOR_MAPPING: EventColorMapping = {
  user_prompt: 'user',
  agent_spawn: 'agent',
  agent_complete: 'complete',
  subagent_message: 'primary',
  error_event: 'error',
  status_update: 'primary'
};

export const DEFAULT_MATRIX_COLOR_PALETTE: MatrixColorPalette = {
  primary: '#00ff41',   // Classic Matrix green
  agent: '#41ff80',     // Blue-green for agents
  user: '#80ff41',      // Bright green for user prompts
  error: '#ff4141',     // Red for errors
  complete: '#ffff41',  // Yellow-green for completions
  new: '#ffffff'        // Bright white for new events
};

export const DEFAULT_MATRIX_PERFORMANCE_CONFIG: MatrixPerformanceConfig = {
  maxDrops: 1000,
  maxAge: 60000, // 60 seconds
  targetFPS: 60,
  batchSize: 10,
  throttleMs: 16, // ~60fps
  adaptiveQuality: {
    highLoad: { trailLength: 6, effects: false },
    normalLoad: { trailLength: 12, effects: true },
    lowLoad: { trailLength: 15, effects: true }
  }
};

export const DEFAULT_EVENT_TYPE_MAPPING: MatrixEventTypeMapping = {
  'user_prompt': {
    character: 'ユ',
    speedMultiplier: 1.5,
    color: 'user',
    trailLength: 12,
    priority: 5
  },
  'subagent_registered': {
    character: 'エ',
    speedMultiplier: 1.0,
    color: 'agent',
    trailLength: 10,
    priority: 4
  },
  'agent_status_update': {
    character: 'ス',
    speedMultiplier: 0.8,
    color: 'primary',
    trailLength: 8,
    priority: 2
  },
  'subagent_message': {
    character: 'メ',
    speedMultiplier: 1.2,
    color: 'primary',
    trailLength: 15,
    priority: 3
  },
  'error': {
    character: '❌',
    speedMultiplier: 2.0,
    color: 'error',
    trailLength: 8,
    priority: 5
  },
  'complete': {
    character: '✓',
    speedMultiplier: 1.5,
    color: 'complete',
    trailLength: 12,
    priority: 4
  }
};

// ============================================================================
// Type Guards
// ============================================================================

export function isMatrixDrop(obj: any): obj is MatrixDrop {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.column === 'number' &&
         typeof obj.character === 'string' &&
         typeof obj.speed === 'number';
}

export function isMatrixWebSocketMessage(obj: any): obj is WebSocketMessage {
  return obj && typeof obj === 'object' &&
         ['initial', 'event'].includes(obj.type) &&
         (obj.data !== undefined);
}

export function isMatrixColor(color: string): color is MatrixColor {
  return ['primary', 'agent', 'user', 'error', 'complete', 'new'].includes(color);
}

// ============================================================================
// Utility Types
// ============================================================================

export type MatrixEventHandler = (event: HookEvent) => MatrixDrop | null;
export type MatrixDropRenderer = (drop: MatrixDrop, context: CanvasRenderingContext2D) => void;
export type MatrixColumnSelector = (event: HookEvent, availableColumns: number[]) => number;

export interface MatrixEventPipeline {
  filter: (event: HookEvent) => boolean;
  transform: MatrixEventHandler;
  render: MatrixDropRenderer;
}