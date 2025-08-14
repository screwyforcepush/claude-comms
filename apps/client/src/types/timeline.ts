/**
 * Timeline Visualization Types
 * 
 * Complete type definitions for the agent timeline visualization system.
 * These types support the SVG rendering, data transformation, and interaction
 * features across all timeline-related components and composables.
 */

import type { Ref, ComputedRef } from 'vue';

// ============================================================================
// Core Data Models
// ============================================================================

export interface TimelineData {
  orchestratorEvents: OrchestratorEvent[];
  userPrompts: UserPrompt[];
  agentBatches: AgentBatch[];
  agentPaths: AgentPath[];
  messages: TimelineMessage[];
  timeRange: TimeRange;
  sessionId: string;
  lastUpdated: number;
}

export interface OrchestratorEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'spawn' | 'wait' | 'complete' | 'error';
  sessionId: string;
  metadata?: Record<string, any>;
  batchId?: string;
}

export interface UserPrompt {
  id: string;
  timestamp: number;
  content: string;
  sessionId: string;
  eventId: number; // Reference to events table
  responseTime?: number; // Time to first agent spawn
  agentCount?: number; // Number of agents spawned from this prompt
}

export interface AgentBatch {
  id: string;
  spawnTimestamp: number;
  completionTimestamp?: number;
  agents: AgentSpawn[];
  batchNumber: number;
  orchestratorEventId: string;
  parallelCount: number; // Number of agents running in parallel
  status: 'spawning' | 'running' | 'completed' | 'error';
}

export interface AgentSpawn {
  agentId: string;
  name: string;
  type: AgentType;
  color: string;
  description?: string;
  task?: string;
}

export type AgentType = 
  | 'architect'
  | 'engineer' 
  | 'gatekeeper'
  | 'planner'
  | 'business-analyst'
  | 'designer'
  | 'deep-researcher'
  | 'agent-orchestrator';

export interface AgentPath {
  agentId: string;
  name: string;
  type: AgentType;
  startTime: number;
  endTime: number | null;
  status: AgentStatus;
  curveData: CurvePoint[];
  laneIndex: number;
  batchId: string;
  messages: TimelineMessage[];
  metrics?: AgentMetrics;
  sessionId: string;
}

export type AgentStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'terminated';

export interface AgentMetrics {
  duration: number;
  tokenCount: number;
  toolUseCount: number;
  messageCount: number;
  completionRate: number; // 0-1
}

export interface TimelineMessage {
  id: string;
  timestamp: number;
  sender: string;
  position: Point2D;
  content: string;
  recipients?: string[];
  type?: 'broadcast' | 'direct' | 'status' | 'error';
  agentId?: string; // Associated agent
  sessionId: string;
}

export interface CurvePoint {
  x: number;
  y: number;
  controlX?: number;
  controlY?: number;
  type?: 'move' | 'line' | 'quadratic' | 'cubic';
}

export interface Point2D {
  x: number;
  y: number;
}

export interface TimeRange {
  start: number;
  end: number;
  duration: number;
  pixelsPerMs: number;
  visibleStart?: number;
  visibleEnd?: number;
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface TimelineConfig {
  width: number;
  height: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  orchestratorY: number;
  agentLaneHeight: number;
  maxAgentLanes: number;
  colors: TimelineColors;
  animations: AnimationConfig;
  performance: PerformanceConfig;
}

export interface TimelineColors {
  orchestrator: string;
  orchestratorGlow: string;
  userPrompt: string;
  spawnPoint: string;
  message: string;
  background: string;
  grid: string;
  agentTypes: Record<AgentType, string>;
}

export interface AnimationConfig {
  enabled: boolean;
  spawnDuration: number;
  messagePulseDuration: number;
  pathTransitionDuration: number;
  hoverTransitionDuration: number;
  easing: string;
  reducedMotion?: boolean;
}

export interface PerformanceConfig {
  virtualizeThreshold: number;
  lodZoomThresholds: {
    messages: number;
    labels: number;
    details: number;
  };
  updateThrottleMs: number;
  maxVisibleAgents: number;
  useCanvasForMessages: boolean;
  progressiveRenderBatchSize: number;
  enableGPUAcceleration: boolean;
}

export interface LevelOfDetail {
  showLabels: boolean;
  showMessages: boolean;
  showDetails: boolean;
  simplifyPaths: boolean;
  maxAgents: number;
  maxMessages: number;
  pathSimplificationTolerance: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryMB: number;
  renderCount: number;
  cullRatio: number;
  elementCount: {
    agents: number;
    messages: number;
    visible: number;
  };
}

// ============================================================================
// Component Props & Events
// ============================================================================

export interface TimelineProps {
  sessionId: string;
  height?: number;
  showControls?: boolean;
  autoZoom?: boolean;
  followLatest?: boolean;
  initialData?: TimelineData;
  config?: Partial<TimelineConfig>;
}

export interface TimelineEmits {
  (e: 'agent-selected', agent: AgentPath): void;
  (e: 'message-clicked', message: TimelineMessage): void;
  (e: 'prompt-clicked', prompt: UserPrompt): void;
  (e: 'batch-clicked', batch: AgentBatch): void;
  (e: 'zoom-changed', zoom: number): void;
  (e: 'time-range-changed', range: TimeRange): void;
  (e: 'data-updated', data: TimelineData): void;
}

// ============================================================================
// Interaction Interfaces
// ============================================================================

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
  timeRange: TimeRange;
  followMode?: boolean; // Auto-scroll to latest
}

export interface InteractionState {
  hoveredElement: TimelineElement | null;
  selectedAgents: Set<string>;
  selectedMessages: Set<string>;
  selectedBatches: Set<string>;
  isDragging: boolean;
  dragStart: Point2D | null;
  multiSelect: boolean; // Ctrl/Cmd held
}

export interface TimelineElement {
  type: 'agent' | 'message' | 'prompt' | 'spawn' | 'batch';
  id: string;
  data: any;
  bounds: DOMRect;
  svgElement: SVGElement;
}

export interface TooltipData {
  element: TimelineElement;
  position: Point2D;
  content: string | TooltipContent;
  visible: boolean;
}

export interface TooltipContent {
  title: string;
  subtitle?: string;
  details: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;
  actions?: TooltipAction[];
}

export interface TooltipAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

// ============================================================================
// Rendering Interfaces
// ============================================================================

export interface RenderContext {
  svg: SVGElement;
  canvas?: HTMLCanvasElement;
  viewport: ViewportState;
  config: TimelineConfig;
  data: TimelineData;
  dpr: number; // Device pixel ratio
}

export interface LayerRenderer {
  name: string;
  mount(context: RenderContext): void;
  render(data: any, force?: boolean): void;
  update(partialData: any): void;
  destroy(): void;
  isVisible(): boolean;
  getBounds(): DOMRect;
}

export interface D3Scales {
  xScale: (value: number) => number;
  yScale: (value: string | number) => number;
  colorScale: (value: string) => string;
  timeScale: (value: number) => number;
}

// ============================================================================
// WebSocket Update Interfaces
// ============================================================================

export interface TimelineUpdate {
  type: 'agent_spawn' | 'agent_status' | 'agent_complete' | 'message' | 'prompt' | 'batch_complete' | 'session_end';
  data: any;
  timestamp: number;
  sessionId: string;
  priority: 'low' | 'normal' | 'high';
}

export interface UpdateQueue {
  updates: TimelineUpdate[];
  lastProcessedTime: number;
  pendingRender: boolean;
  batchSize: number;
}

// ============================================================================
// Transform Pipeline Interfaces
// ============================================================================

export interface TransformPipeline {
  extractUserPrompts(events: any[]): UserPrompt[];
  groupAgentsIntoBatches(agents: any[]): AgentBatch[];
  calculateAgentPaths(agents: any[], batches: AgentBatch[]): AgentPath[];
  mapMessagesToTimeline(messages: any[], paths: AgentPath[]): TimelineMessage[];
  generateOrchestratorEvents(prompts: UserPrompt[], batches: AgentBatch[]): OrchestratorEvent[];
  updateTimeRange(data: TimelineData): TimeRange;
}

export interface PathCalculator {
  calculateLaneIndex(agent: any, batch: AgentBatch | undefined): number;
  generateBezierCurve(startX: number, startY: number, endX: number, endY: number, peakY: number): CurvePoint[];
  calculateMessagePosition(message: any, path: AgentPath): Point2D;
  optimizeLaneAssignment(paths: AgentPath[]): Map<string, number>;
}

// ============================================================================
// Performance Optimization Interfaces
// ============================================================================

export interface OptimizationStrategy {
  cullOutsideViewport<T>(items: T[], viewport: ViewportState): T[];
  applyLevelOfDetail(data: TimelineData, zoom: number): TimelineData;
  simplifyPaths(paths: AgentPath[], tolerance: number): AgentPath[];
  aggregateMessages(messages: TimelineMessage[], viewport: ViewportState): TimelineMessage[];
  shouldUseCanvas(elementCount: number, zoom: number): boolean;
}

export interface VirtualizationState {
  visibleRange: { start: number; end: number };
  virtualizedItems: Set<string>;
  overscan: number;
  scrollPosition: number;
}

export interface CanvasRenderState {
  context: CanvasRenderingContext2D;
  dirty: boolean;
  layers: Map<string, ImageData>;
  lastRenderTime: number;
  frameRate: number;
}

// ============================================================================
// Data Transform Interface Types
// ============================================================================

export interface TimelineTransformOptions {
  viewport_width: number;
  viewport_height: number;
  show_messages: boolean;
  show_user_prompts: boolean;
  auto_fit: boolean;
  compact_mode: boolean;
  session_filter?: string;
}

export interface TimelineAgent {
  agentId: string;
  name: string;
  type: AgentType;
  startTime: number;
  endTime: number | null;
  status: AgentStatus;
  laneIndex: number;
  batchId: string;
  sessionId: string;
}

// ============================================================================
// Composable Return Types
// ============================================================================

export interface UseTimelineReturn {
  data: Ref<TimelineData | null>;
  viewport: Ref<ViewportState>;
  config: Ref<TimelineConfig>;
  isLoading: Ref<boolean>;
  isReady: Ref<boolean>;
  isRendering: Ref<boolean>;
  error: Ref<string | null>;
  renderCount: Ref<number>;
  
  // Actions
  render: (data: TimelineData) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  resetZoom: () => void;
  panTo: (x: number, y: number) => void;
  selectAgent: (agentId: string) => void;
  clearSelection: () => void;
  followLatest: (enabled: boolean) => void;
  updateConfig: (config: Partial<TimelineConfig>) => void;
}

export interface UseTimelineDataReturn {
  timelineData: ComputedRef<TimelineData>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  lastUpdate: Ref<number>;
  
  // Actions
  updateFromWebSocket: (message: any) => void;
  refreshData: () => Promise<void>;
  clearData: () => void;
  setSessionId: (sessionId: string) => void;
}

export interface UseTimelineInteractionReturn {
  interactionState: Ref<InteractionState>;
  tooltip: Ref<TooltipData | null>;
  
  // Event handlers
  handleMouseMove: (event: MouseEvent) => void;
  handleMouseEnter: (event: MouseEvent) => void;
  handleMouseLeave: (event: MouseEvent) => void;
  handleClick: (event: MouseEvent) => void;
  handleKeyboard: (event: KeyboardEvent) => void;
  handleWheel: (event: WheelEvent) => void;
  
  // Utility
  showTooltip: (element: TimelineElement, position: Point2D) => void;
  hideTooltip: () => void;
  selectElement: (element: TimelineElement) => void;
  clearSelection: () => void;
}

export interface UseTimelineAnimationReturn {
  animationQueue: Ref<any[]>;
  isAnimating: Ref<boolean>;
  
  // Animation controls
  playSpawnAnimation: (batch: AgentBatch) => Promise<void>;
  playMessageAnimation: (message: TimelineMessage) => Promise<void>;
  playCompletionAnimation: (agent: AgentPath) => Promise<void>;
  playBatchTransition: (from: AgentBatch, to: AgentBatch) => Promise<void>;
  stopAllAnimations: () => void;
  
  // Settings
  enableAnimations: (enabled: boolean) => void;
  setAnimationSpeed: (speed: number) => void;
}

// ============================================================================
// Event Types
// ============================================================================

export interface TimelineEventHandlers {
  onAgentClick?: (agent: AgentPath, event: MouseEvent) => void;
  onMessageClick?: (message: TimelineMessage, event: MouseEvent) => void;
  onPromptClick?: (prompt: UserPrompt, event: MouseEvent) => void;
  onBatchClick?: (batch: AgentBatch, event: MouseEvent) => void;
  onZoomChange?: (zoom: number) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onSelectionChange?: (selected: InteractionState) => void;
}

// ============================================================================
// Filter and Search Types
// ============================================================================

export interface TimelineFilters {
  agentTypes: Set<AgentType>;
  agentStatus: Set<AgentStatus>;
  messageTypes: Set<string>;
  timeRange?: { start: number; end: number };
  sessionId?: string;
  searchQuery?: string;
}

export interface SearchResult {
  type: 'agent' | 'message' | 'prompt' | 'batch';
  id: string;
  relevance: number;
  matchedFields: string[];
  data: any;
}

// ============================================================================
// Export/Import Types
// ============================================================================

export interface TimelineExportOptions {
  format: 'svg' | 'png' | 'json' | 'csv';
  includeMessages: boolean;
  includeMetrics: boolean;
  timeRange?: TimeRange;
  resolution?: { width: number; height: number };
}

export interface TimelineSnapshot {
  timestamp: number;
  sessionId: string;
  data: TimelineData;
  viewport: ViewportState;
  config: TimelineConfig;
  version: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface TimelineError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: TimelineError | null;
  errorInfo: any;
}

// ============================================================================
// Accessibility Types
// ============================================================================

export interface AccessibilityConfig {
  enabled: boolean;
  announceUpdates: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimizations: boolean;
}

export interface A11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

// ============================================================================
// Testing and Debug Types
// ============================================================================

export interface TimelineDebugInfo {
  renderTime: number;
  elementCount: {
    agents: number;
    messages: number;
    prompts: number;
    batches: number;
  };
  memoryUsage: number;
  frameRate: number;
  lastError?: TimelineError;
}

export interface MockTimelineData {
  generateAgents: (count: number) => AgentPath[];
  generateMessages: (count: number) => TimelineMessage[];
  generateBatches: (count: number) => AgentBatch[];
  generateSession: (agentCount: number, duration: number) => TimelineData;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isAgentPath(obj: any): obj is AgentPath {
  return obj && typeof obj === 'object' && 
         typeof obj.agentId === 'string' && 
         typeof obj.type === 'string' &&
         typeof obj.startTime === 'number';
}

export function isTimelineMessage(obj: any): obj is TimelineMessage {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.sender === 'string' &&
         typeof obj.timestamp === 'number';
}

export function isAgentBatch(obj: any): obj is AgentBatch {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         Array.isArray(obj.agents) &&
         typeof obj.spawnTimestamp === 'number';
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type TimelineEventType = 'mount' | 'unmount' | 'render' | 'update' | 'error' | 'interaction';

export interface TimelineLifecycleEvent {
  type: TimelineEventType;
  timestamp: number;
  data?: any;
}