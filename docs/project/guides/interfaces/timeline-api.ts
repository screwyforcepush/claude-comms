/**
 * Agent Timeline Visualization - API Interfaces
 * 
 * Complete type definitions for the timeline visualization component.
 * These interfaces define the contract between components and data layers.
 */

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
}

export interface OrchestratorEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'spawn' | 'wait' | 'complete' | 'error';
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface UserPrompt {
  id: string;
  timestamp: number;
  content: string;
  sessionId: string;
  eventId: number; // Reference to events table
  responseTime?: number; // Time to first agent spawn
}

export interface AgentBatch {
  id: string;
  spawnTimestamp: number;
  completionTimestamp?: number;
  agents: AgentSpawn[];
  batchNumber: number;
  orchestratorEventId: string;
  parallelCount: number; // Number of agents running in parallel
}

export interface AgentSpawn {
  agentId: string;
  name: string;
  type: AgentType;
  color: string;
  description?: string;
}

export type AgentType = 
  | 'architect'
  | 'engineer' 
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'verifier'
  | 'planner'
  | 'analyst'
  | 'researcher'
  | 'designer'
  | 'cloud-cicd';

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
}

export type AgentStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface AgentMetrics {
  duration: number;
  tokenCount: number;
  toolUseCount: number;
  messageCount: number;
}

export interface TimelineMessage {
  id: string;
  timestamp: number;
  sender: string;
  position: Point2D;
  content: string;
  recipients?: string[];
  type?: 'broadcast' | 'direct' | 'status';
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
}

export interface TimelineEmits {
  (e: 'agent-selected', agent: AgentPath): void;
  (e: 'message-clicked', message: TimelineMessage): void;
  (e: 'prompt-clicked', prompt: UserPrompt): void;
  (e: 'zoom-changed', zoom: number): void;
  (e: 'time-range-changed', range: TimeRange): void;
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
}

export interface InteractionState {
  hoveredElement: TimelineElement | null;
  selectedAgents: Set<string>;
  selectedMessages: Set<string>;
  isDragging: boolean;
  dragStart: Point2D | null;
}

export interface TimelineElement {
  type: 'agent' | 'message' | 'prompt' | 'spawn';
  id: string;
  data: any;
  bounds: DOMRect;
}

export interface TooltipData {
  element: TimelineElement;
  position: Point2D;
  content: string | TooltipContent;
}

export interface TooltipContent {
  title: string;
  subtitle?: string;
  details: Array<{
    label: string;
    value: string | number;
  }>;
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
}

export interface LayerRenderer {
  mount(context: RenderContext): void;
  render(data: any): void;
  update(data: any): void;
  destroy(): void;
}

export interface D3Scale {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleOrdinal<string, number>;
  colorScale: d3.ScaleOrdinal<string, string>;
}

// ============================================================================
// WebSocket Update Interfaces
// ============================================================================

export interface TimelineUpdate {
  type: 'agent_spawn' | 'agent_status' | 'message' | 'prompt' | 'batch_complete';
  data: any;
  timestamp: number;
}

export interface UpdateQueue {
  updates: TimelineUpdate[];
  lastProcessedTime: number;
  pendingRender: boolean;
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
}

export interface PathCalculator {
  calculateLaneIndex(agent: any, batch: AgentBatch | undefined): number;
  generateBezierCurve(startX: number, startY: number, endX: number, endY: number, peakY: number): CurvePoint[];
  calculateMessagePosition(message: any, path: AgentPath): Point2D;
}

// ============================================================================
// Performance Optimization Interfaces
// ============================================================================

export interface OptimizationStrategy {
  cullOutsideViewport<T>(items: T[], viewport: ViewportState): T[];
  applyLevelOfDetail(data: TimelineData, zoom: number): TimelineData;
  simplifyPaths(paths: AgentPath[]): AgentPath[];
  aggregateMessages(messages: TimelineMessage[], viewport: ViewportState): TimelineMessage[];
}

export interface VirtualizationState {
  visibleRange: { start: number; end: number };
  virtualizedItems: Set<string>;
  overscan: number;
}

export interface CanvasRenderState {
  context: CanvasRenderingContext2D;
  dirty: boolean;
  layers: Map<string, ImageData>;
}

// ============================================================================
// Export Composables Types
// ============================================================================

export interface UseTimelineReturn {
  data: Ref<TimelineData>;
  viewport: Ref<ViewportState>;
  config: Ref<TimelineConfig>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  panTo: (x: number, y: number) => void;
  selectAgent: (agentId: string) => void;
  clearSelection: () => void;
}

export interface UseTimelineDataReturn {
  timelineData: ComputedRef<TimelineData>;
  updateFromWebSocket: (message: any) => void;
  refreshData: () => Promise<void>;
}

export interface UseTimelineInteractionReturn {
  interactionState: Ref<InteractionState>;
  handleMouseMove: (event: MouseEvent) => void;
  handleClick: (event: MouseEvent) => void;
  handleKeyboard: (event: KeyboardEvent) => void;
  tooltip: Ref<TooltipData | null>;
}

export interface UseTimelineAnimationReturn {
  animationQueue: Ref<any[]>;
  playSpawnAnimation: (batch: AgentBatch) => void;
  playMessageAnimation: (message: TimelineMessage) => void;
  playCompletionAnimation: (agent: AgentPath) => void;
  stopAllAnimations: () => void;
}