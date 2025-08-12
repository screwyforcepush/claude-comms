/**
 * Timeline Renderer Composable
 * 
 * Core rendering logic for the agent timeline visualization.
 * Provides reactive SVG rendering with real-time updates, animations,
 * and interactive features for multi-agent orchestration display.
 */

import { ref, computed, watch, onMounted, onUnmounted, readonly, type Ref } from 'vue';
import type { 
  TimelineData, 
  ViewportState, 
  TimelineConfig,
  AgentPath,
  TimelineMessage,
  UserPrompt,
  AgentBatch,
  Point2D,
  InteractionState,
  TooltipData,
  AgentType
} from '../types/timeline';

import {
  getAgentTypeColor,
  createBezierPath,
  calculateAgentCurve,
  createOrchestratorPath,
  createSVGDefs,
  timestampToX,
  calculateLaneY,
  assignAgentLanes,
  formatTimeLabel,
  createAccessibilityAttrs,
  isElementVisible
} from '../utils/svgHelpers';

import { useEventColors } from './useEventColors';

// ============================================================================
// Configuration & Constants
// ============================================================================

const DEFAULT_CONFIG: TimelineConfig = {
  width: 1200,
  height: 400,
  margins: { top: 40, right: 60, bottom: 60, left: 60 },
  orchestratorY: 200,
  agentLaneHeight: 30,
  maxAgentLanes: 10,
  colors: {
    orchestrator: '#00d4ff',
    orchestratorGlow: '#00d4ff',
    userPrompt: '#ffffff',
    spawnPoint: '#3b82f6',
    message: '#ffffff',
    background: '#1f2937',
    grid: 'rgba(59, 130, 246, 0.1)',
    agentTypes: {} as Record<AgentType, string>
  },
  animations: {
    enabled: true,
    spawnDuration: 300,
    messagePulseDuration: 2000,
    pathTransitionDuration: 250,
    hoverTransitionDuration: 150,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  performance: {
    virtualizeThreshold: 100,
    lodZoomThresholds: { messages: 1.5, labels: 0.8, details: 2.0 },
    updateThrottleMs: 100,
    maxVisibleAgents: 200,
    useCanvasForMessages: false,
    progressiveRenderBatchSize: 20
  }
};

// ============================================================================
// Main Composable
// ============================================================================

export function useTimelineRenderer(
  containerRef: Ref<HTMLElement | null>,
  initialConfig?: Partial<TimelineConfig>
) {
  // ============================================================================
  // Reactive State
  // ============================================================================
  
  const config = ref<TimelineConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const svgRef = ref<SVGElement | null>(null);
  const isReady = ref(false);
  const isRendering = ref(false);
  const renderCount = ref(0);
  
  const viewport = ref<ViewportState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    width: config.value.width,
    height: config.value.height,
    timeRange: { start: Date.now() - 300000, end: Date.now(), duration: 300000, pixelsPerMs: 1 }
  });

  const interactionState = ref<InteractionState>({
    hoveredElement: null,
    selectedAgents: new Set(),
    selectedMessages: new Set(),
    isDragging: false,
    dragStart: null
  });

  const tooltip = ref<TooltipData | null>(null);
  const { getHexColorForSession } = useEventColors();

  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const chartArea = computed(() => ({
    x: config.value.margins.left,
    y: config.value.margins.top,
    width: config.value.width - config.value.margins.left - config.value.margins.right,
    height: config.value.height - config.value.margins.top - config.value.margins.bottom
  }));

  const timeScale = computed(() => {
    const { start, end } = viewport.value.timeRange;
    const timeSpan = end - start;
    return chartArea.value.width / timeSpan;
  });

  // ============================================================================
  // Core Rendering Functions
  // ============================================================================

  /**
   * Initialize SVG structure and render layers
   */
  function initializeSVG(): SVGElement {
    if (!containerRef.value) throw new Error('Container ref not available');
    
    // Clear existing content
    containerRef.value.innerHTML = '';
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', config.value.height.toString());
    svg.setAttribute('viewBox', `0 0 ${config.value.width} ${config.value.height}`);
    svg.setAttribute('class', 'timeline-svg');
    svg.style.background = config.value.colors.background;
    
    // Add defs for filters and gradients
    svg.innerHTML = createSVGDefs(config.value.colors);
    
    // Create layer groups
    const layers = [
      'grid-layer',
      'orchestrator-layer', 
      'agents-layer',
      'messages-layer',
      'prompts-layer',
      'spawn-points-layer',
      'axis-layer'
    ];
    
    layers.forEach(layerClass => {
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.setAttribute('class', layerClass);
      svg.appendChild(layer);
    });
    
    containerRef.value.appendChild(svg);
    return svg;
  }

  /**
   * Render the orchestrator main timeline with glow effect
   */
  function renderOrchestratorLine(data: TimelineData): void {
    const orchestratorLayer = svgRef.value?.querySelector('.orchestrator-layer');
    if (!orchestratorLayer) return;

    // Clear existing content
    orchestratorLayer.innerHTML = '';

    const { start, end } = viewport.value.timeRange;
    const startX = timestampToX(start, viewport.value.timeRange, config.value.width, config.value.margins);
    const endX = timestampToX(end, viewport.value.timeRange, config.value.width, config.value.margins);
    const y = config.value.orchestratorY;

    // Calculate spawn points for subtle effects
    const spawnPoints = data.agentBatches.map(batch => ({
      x: timestampToX(batch.spawnTimestamp, viewport.value.timeRange, config.value.width, config.value.margins),
      intensity: Math.min(batch.agents.length / 5, 1) // Normalize batch size
    }));

    // Create the main orchestrator path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', createOrchestratorPath(startX, endX, y, spawnPoints));
    path.setAttribute('stroke', 'url(#orchestrator-gradient)');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('fill', 'none');
    path.setAttribute('filter', 'url(#orchestrator-glow)');
    path.setAttribute('class', 'orchestrator-line');
    
    // Accessibility
    Object.entries(createAccessibilityAttrs(
      'presentation',
      'Main orchestrator timeline',
      'Shows the primary execution flow and agent spawn points'
    )).forEach(([key, value]) => {
      path.setAttribute(key, value);
    });

    orchestratorLayer.appendChild(path);
  }

  /**
   * Render user prompt nodes as white circles with timestamps
   */
  function renderUserPrompts(prompts: UserPrompt[]): void {
    const promptsLayer = svgRef.value?.querySelector('.prompts-layer');
    if (!promptsLayer) return;

    promptsLayer.innerHTML = '';

    prompts.forEach(prompt => {
      const x = timestampToX(prompt.timestamp, viewport.value.timeRange, config.value.width, config.value.margins);
      const y = config.value.orchestratorY;

      // Create prompt node group
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'prompt-node');
      group.setAttribute('data-prompt-id', prompt.id);

      // Main circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', config.value.colors.userPrompt);
      circle.setAttribute('stroke', config.value.colors.orchestrator);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('filter', 'url(#node-shadow)');

      // Accessibility
      Object.entries(createAccessibilityAttrs(
        'button',
        `User prompt at ${formatTimeLabel(prompt.timestamp)}`,
        prompt.content.substring(0, 100) + '...'
      )).forEach(([key, value]) => {
        circle.setAttribute(key, value);
      });

      group.appendChild(circle);

      // Add timestamp label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', (y + 25).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', config.value.colors.userPrompt);
      text.setAttribute('font-size', '11');
      text.setAttribute('font-family', 'system-ui, sans-serif');
      text.textContent = formatTimeLabel(prompt.timestamp);

      group.appendChild(text);
      promptsLayer.appendChild(group);
    });
  }

  /**
   * Render agent spawn points as blue nodes
   */
  function renderAgentSpawnPoints(batches: AgentBatch[]): void {
    const spawnLayer = svgRef.value?.querySelector('.spawn-points-layer');
    if (!spawnLayer) return;

    spawnLayer.innerHTML = '';

    batches.forEach(batch => {
      const x = timestampToX(batch.spawnTimestamp, viewport.value.timeRange, config.value.width, config.value.margins);
      const y = config.value.orchestratorY;

      // Create spawn point group
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'spawn-point');
      group.setAttribute('data-batch-id', batch.id);

      // Main spawn circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', '6');
      circle.setAttribute('fill', config.value.colors.spawnPoint);
      circle.setAttribute('stroke', config.value.colors.orchestrator);
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('opacity', '0.8');

      // Accessibility
      Object.entries(createAccessibilityAttrs(
        'button',
        `Batch spawn: ${batch.agents.length} agents`,
        `Spawned ${batch.agents.map(a => a.name).join(', ')} at ${formatTimeLabel(batch.spawnTimestamp)}`
      )).forEach(([key, value]) => {
        circle.setAttribute(key, value);
      });

      group.appendChild(circle);

      // Add agent count indicator
      if (batch.agents.length > 1) {
        const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        countText.setAttribute('x', x.toString());
        countText.setAttribute('y', (y + 3).toString());
        countText.setAttribute('text-anchor', 'middle');
        countText.setAttribute('fill', 'white');
        countText.setAttribute('font-size', '9');
        countText.setAttribute('font-weight', 'bold');
        countText.textContent = batch.agents.length.toString();

        group.appendChild(countText);
      }

      spawnLayer.appendChild(group);
    });
  }

  /**
   * Render agent execution paths as curved bezier lines
   */
  function renderAgentPaths(paths: AgentPath[]): void {
    const agentsLayer = svgRef.value?.querySelector('.agents-layer');
    if (!agentsLayer) return;

    agentsLayer.innerHTML = '';

    // Assign lanes to prevent overlapping
    const laneAssignments = assignAgentLanes(
      paths.map(p => ({ 
        startTime: p.startTime, 
        endTime: p.endTime || Date.now(), 
        id: p.agentId 
      })),
      config.value.maxAgentLanes
    );

    paths.forEach(agentPath => {
      const laneIndex = laneAssignments.get(agentPath.agentId) || 0;
      const startX = timestampToX(agentPath.startTime, viewport.value.timeRange, config.value.width, config.value.margins);
      const endX = timestampToX(agentPath.endTime || Date.now(), viewport.value.timeRange, config.value.width, config.value.margins);
      const peakY = calculateLaneY(laneIndex, config.value.orchestratorY, config.value.agentLaneHeight);

      // Generate curve points
      const curvePoints = calculateAgentCurve(
        startX, 
        config.value.orchestratorY, 
        endX, 
        config.value.orchestratorY, 
        peakY
      );

      // Create path element
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', createBezierPath(curvePoints));
      path.setAttribute('stroke', getAgentTypeColor(agentPath.type));
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', agentPath.status === 'completed' ? '1' : '0.7');
      path.setAttribute('class', `agent-line agent-${agentPath.type}`);
      path.setAttribute('data-agent-id', agentPath.agentId);
      path.setAttribute('filter', 'url(#agent-glow)');

      // Status-based styling
      if (agentPath.status === 'in_progress') {
        path.setAttribute('stroke-dasharray', '8 4');
        path.style.animation = 'dash-flow 2s linear infinite';
      }

      // Accessibility
      Object.entries(createAccessibilityAttrs(
        'button',
        `${agentPath.type} agent: ${agentPath.name}`,
        `Status: ${agentPath.status}, Duration: ${agentPath.endTime ? 
          Math.round((agentPath.endTime - agentPath.startTime) / 1000) : 'ongoing'} seconds`
      )).forEach(([key, value]) => {
        path.setAttribute(key, value);
      });

      agentsLayer.appendChild(path);

      // Add agent label at peak
      const midX = startX + (endX - startX) * 0.5;
      const labelY = peakY - 10;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX.toString());
      label.setAttribute('y', labelY.toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', getAgentTypeColor(agentPath.type));
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '600');
      label.setAttribute('class', 'agent-label');
      label.textContent = agentPath.name;

      agentsLayer.appendChild(label);
    });
  }

  /**
   * Render message dots along agent paths with pulsing animation
   */
  function renderMessageDots(messages: TimelineMessage[], agentPaths: AgentPath[]): void {
    const messagesLayer = svgRef.value?.querySelector('.messages-layer');
    if (!messagesLayer) return;

    messagesLayer.innerHTML = '';

    messages.forEach(message => {
      // Find the agent path for this message
      const agentPath = agentPaths.find(p => p.name === message.sender);
      if (!agentPath) return;

      // Calculate position along the agent's path
      const progressAlongPath = (message.timestamp - agentPath.startTime) / 
        ((agentPath.endTime || Date.now()) - agentPath.startTime);
      
      const x = message.position.x || timestampToX(
        message.timestamp, 
        viewport.value.timeRange, 
        config.value.width, 
        config.value.margins
      );
      
      // Approximate Y position on curve (simplified)
      const laneIndex = assignAgentLanes([{
        startTime: agentPath.startTime,
        endTime: agentPath.endTime || Date.now(),
        id: agentPath.agentId
      }]).get(agentPath.agentId) || 0;
      
      const peakY = calculateLaneY(laneIndex, config.value.orchestratorY, config.value.agentLaneHeight);
      const y = config.value.orchestratorY - (Math.sin(Math.PI * progressAlongPath) * 
        (config.value.orchestratorY - peakY));

      // Create message dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', config.value.colors.message);
      circle.setAttribute('stroke', getAgentTypeColor(agentPath.type));
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('class', 'message-dot');
      circle.setAttribute('data-message-id', message.id);
      circle.setAttribute('filter', 'url(#message-glow)');

      // Pulsing animation
      if (config.value.animations.enabled) {
        circle.style.animation = `message-pulse ${config.value.animations.messagePulseDuration}ms infinite`;
      }

      // Accessibility
      Object.entries(createAccessibilityAttrs(
        'button',
        `Message from ${message.sender}`,
        `${message.content.substring(0, 100)}... at ${formatTimeLabel(message.timestamp)}`
      )).forEach(([key, value]) => {
        circle.setAttribute(key, value);
      });

      messagesLayer.appendChild(circle);
    });
  }

  /**
   * Render time axis with actual timestamps
   */
  function renderTimeAxis(): void {
    const axisLayer = svgRef.value?.querySelector('.axis-layer');
    if (!axisLayer) return;

    axisLayer.innerHTML = '';

    const { start, end } = viewport.value.timeRange;
    const timeSpan = end - start;
    const tickCount = Math.min(8, Math.max(4, Math.floor(chartArea.value.width / 120)));
    const tickInterval = timeSpan / tickCount;

    // Create axis line
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', chartArea.value.x.toString());
    axisLine.setAttribute('y1', (config.value.height - config.value.margins.bottom).toString());
    axisLine.setAttribute('x2', (chartArea.value.x + chartArea.value.width).toString());
    axisLine.setAttribute('y2', (config.value.height - config.value.margins.bottom).toString());
    axisLine.setAttribute('stroke', config.value.colors.grid);
    axisLine.setAttribute('stroke-width', '1');

    axisLayer.appendChild(axisLine);

    // Create time ticks
    for (let i = 0; i <= tickCount; i++) {
      const tickTime = start + (i * tickInterval);
      const tickX = timestampToX(tickTime, viewport.value.timeRange, config.value.width, config.value.margins);
      const tickY = config.value.height - config.value.margins.bottom;

      // Tick mark
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', tickX.toString());
      tick.setAttribute('y1', tickY.toString());
      tick.setAttribute('x2', tickX.toString());
      tick.setAttribute('y2', (tickY + 6).toString());
      tick.setAttribute('stroke', config.value.colors.grid);
      tick.setAttribute('stroke-width', '1');

      axisLayer.appendChild(tick);

      // Time label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', tickX.toString());
      label.setAttribute('y', (tickY + 18).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', config.value.colors.userPrompt);
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', 'monospace');
      label.textContent = formatTimeLabel(tickTime, 'relative');

      axisLayer.appendChild(label);
    }
  }

  /**
   * Main render function that orchestrates all rendering layers
   */
  function render(data: TimelineData): void {
    if (!svgRef.value || isRendering.value) return;

    isRendering.value = true;
    renderCount.value++;

    try {
      // Update time range based on data
      if (data.userPrompts.length > 0 || data.agentPaths.length > 0) {
        const timestamps = [
          ...data.userPrompts.map(p => p.timestamp),
          ...data.agentPaths.map(p => p.startTime),
          ...data.agentPaths.map(p => p.endTime).filter(Boolean)
        ].filter(Boolean) as number[];

        if (timestamps.length > 0) {
          const minTime = Math.min(...timestamps);
          const maxTime = Math.max(...timestamps, Date.now());
          const padding = (maxTime - minTime) * 0.1; // 10% padding

          viewport.value.timeRange = {
            start: minTime - padding,
            end: maxTime + padding,
            duration: maxTime - minTime + 2 * padding,
            pixelsPerMs: chartArea.value.width / (maxTime - minTime + 2 * padding)
          };
        }
      }

      // Render all layers in correct order
      renderOrchestratorLine(data);
      renderUserPrompts(data.userPrompts);
      renderAgentSpawnPoints(data.agentBatches);
      renderAgentPaths(data.agentPaths);
      renderMessageDots(data.messages, data.agentPaths);
      renderTimeAxis();

    } finally {
      isRendering.value = false;
    }
  }

  // ============================================================================
  // Interaction Handlers
  // ============================================================================

  function setupInteractions(): void {
    if (!svgRef.value) return;

    // Agent path hover/click
    svgRef.value.addEventListener('mouseover', (event) => {
      const target = event.target as SVGElement;
      if (target.classList.contains('agent-line')) {
        const agentId = target.getAttribute('data-agent-id');
        if (agentId) {
          interactionState.value.hoveredElement = {
            type: 'agent',
            id: agentId,
            data: target,
            bounds: target.getBoundingClientRect()
          };
        }
      }
    });

    svgRef.value.addEventListener('mouseout', (event) => {
      const target = event.target as SVGElement;
      if (target.classList.contains('agent-line')) {
        interactionState.value.hoveredElement = null;
        tooltip.value = null;
      }
    });

    svgRef.value.addEventListener('click', (event) => {
      const target = event.target as SVGElement;
      
      if (target.classList.contains('agent-line')) {
        const agentId = target.getAttribute('data-agent-id');
        if (agentId) {
          if (interactionState.value.selectedAgents.has(agentId)) {
            interactionState.value.selectedAgents.delete(agentId);
          } else {
            interactionState.value.selectedAgents.add(agentId);
          }
        }
      } else if (target.classList.contains('message-dot')) {
        const messageId = target.getAttribute('data-message-id');
        if (messageId) {
          // Handle message click
          console.log('Message clicked:', messageId);
        }
      }
    });
  }

  // ============================================================================
  // Lifecycle & API
  // ============================================================================

  onMounted(() => {
    if (containerRef.value) {
      svgRef.value = initializeSVG();
      setupInteractions();
      isReady.value = true;
    }
  });

  onUnmounted(() => {
    // Cleanup
  });

  // Watch for config changes
  watch(() => config.value, () => {
    if (isReady.value && svgRef.value) {
      // Re-render with new config
      const currentData = svgRef.value.getAttribute('data-timeline') ? 
        JSON.parse(svgRef.value.getAttribute('data-timeline') || '{}') : null;
      if (currentData) {
        render(currentData);
      }
    }
  }, { deep: true });

  return {
    // State
    config: readonly(config),
    viewport: readonly(viewport),
    isReady: readonly(isReady),
    isRendering: readonly(isRendering),
    renderCount: readonly(renderCount),
    interactionState: readonly(interactionState),
    tooltip: readonly(tooltip),

    // Methods
    render,
    
    // Render individual layers (for advanced usage)
    renderOrchestratorLine,
    renderUserPrompts,
    renderAgentSpawnPoints,
    renderAgentPaths,
    renderMessageDots,
    renderTimeAxis,

    // Configuration
    updateConfig: (newConfig: Partial<TimelineConfig>) => {
      config.value = { ...config.value, ...newConfig };
    },

    // Viewport control
    setZoom: (zoom: number) => {
      viewport.value.zoom = Math.max(0.1, Math.min(5, zoom));
    },
    
    pan: (deltaX: number, deltaY: number) => {
      viewport.value.panX += deltaX;
      viewport.value.panY += deltaY;
    },

    resetView: () => {
      viewport.value.zoom = 1;
      viewport.value.panX = 0;
      viewport.value.panY = 0;
    }
  };
}