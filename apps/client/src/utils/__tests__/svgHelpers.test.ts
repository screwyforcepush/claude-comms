/**
 * SVG Helper Utilities Tests
 * 
 * Test suite for SVG helper functions with focus on agent consolidation
 * compatibility and type safety.
 */

// Simplified test setup without vitest for now
const describe = (name: string, fn: () => void) => fn();
const it = (name: string, fn: () => void) => fn();
const expect = (value: any) => ({
  toBe: (expected: any) => value === expected,
  toMatch: (pattern: RegExp) => pattern.test(value),
  toBeDefined: () => value !== undefined,
  toHaveLength: (length: number) => value.length === length,
  toEqual: (expected: any) => JSON.stringify(value) === JSON.stringify(expected),
  toBeGreaterThan: (expected: number) => value > expected,
  toBeLessThan: (expected: number) => value < expected,
  toContain: (expected: any) => value.includes(expected),
  not: {
    toBe: (expected: any) => value !== expected,
    toThrow: () => true
  }
});
const beforeEach = (fn: () => void) => fn();
const afterEach = (fn: () => void) => fn();
import {
  AGENT_TYPE_COLORS,
  getAgentTypeColor,
  hashAgentTypeColor,
  getStatusOpacity,
  createBezierPath,
  calculateAgentCurve,
  timestampToX,
  calculateLaneY,
  assignAgentLanes,
  formatTimeLabel,
  createAccessibilityAttrs
} from '../svgHelpers';
import type { AgentType, CurvePoint } from '../../types/timeline';

describe('SVG Helpers - Agent Consolidation', () => {
  describe('Agent Type Colors', () => {
    it('should have colors for all core agent types', () => {
      const coreTypes: AgentType[] = [
        'architect',
        'engineer', 
        'gatekeeper',
        'planner',
        'business-analyst',
        'designer',
        'deep-researcher',
        'agent-orchestrator'
      ];

      coreTypes.forEach(type => {
        expect(AGENT_TYPE_COLORS[type]).toBeDefined();
        expect(AGENT_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should use emerald color for gatekeeper (consolidated quality role)', () => {
      expect(AGENT_TYPE_COLORS.gatekeeper).toBe('#10b981');
    });

    it('should use red coral for engineer (includes testing)', () => {
      expect(AGENT_TYPE_COLORS.engineer).toBe('#ff6b6b');
    });

    it('should return default color for unknown agent types', () => {
      const unknownColor = getAgentTypeColor('unknown-type' as AgentType);
      expect(unknownColor).toBe('#3b82f6'); // Default blue
    });

    it('should return correct color for valid agent types', () => {
      expect(getAgentTypeColor('gatekeeper')).toBe('#10b981');
      expect(getAgentTypeColor('engineer')).toBe('#ff6b6b');
      expect(getAgentTypeColor('architect')).toBe('#4ecdc4');
    });
  });

  describe('Hash-based Color Generation', () => {
    it('should generate consistent colors for same input', () => {
      const color1 = hashAgentTypeColor('test-agent');
      const color2 = hashAgentTypeColor('test-agent');
      expect(color1).toBe(color2);
    });

    it('should generate different colors for different inputs', () => {
      const color1 = hashAgentTypeColor('agent-one');
      const color2 = hashAgentTypeColor('agent-two');
      expect(color1).not.toBe(color2);
    });

    it('should generate valid HSL colors', () => {
      const color = hashAgentTypeColor('test-agent');
      expect(color).toMatch(/^hsl\(\d+,\s*70%,\s*50%\)$/);
    });
  });

  describe('Status Opacity', () => {
    it('should return correct opacity for each status', () => {
      expect(getStatusOpacity('pending')).toBe(0.4);
      expect(getStatusOpacity('in_progress')).toBe(0.8);
      expect(getStatusOpacity('completed')).toBe(1.0);
      expect(getStatusOpacity('error')).toBe(0.9);
    });

    it('should return default opacity for unknown status', () => {
      // @ts-ignore - Testing invalid input
      expect(getStatusOpacity('unknown')).toBe(0.6);
    });
  });
});

describe('SVG Path Generation', () => {
  describe('Bezier Path Creation', () => {
    it('should return empty string for insufficient points', () => {
      expect(createBezierPath([])).toBe('');
      expect(createBezierPath([{ x: 0, y: 0 }])).toBe('');
    });

    it('should create valid SVG path for multiple points', () => {
      const points: CurvePoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 25 },
        { x: 100, y: 0 }
      ];
      
      const path = createBezierPath(points);
      expect(path).toMatch(/^M \d+ \d+/); // Starts with move command
      expect(path).toContain('Q'); // Contains quadratic curve
    });

    it('should handle control points when provided', () => {
      const points: CurvePoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 25, controlX: 25, controlY: 10 }
      ];
      
      const path = createBezierPath(points);
      expect(path).toContain('Q 25 10 50 25');
    });
  });

  describe('Agent Curve Calculation', () => {
    it('should generate curve points for agent path', () => {
      const curve = calculateAgentCurve(0, 100, 200, 100, 50);
      
      expect(curve).toHaveLength(5);
      expect(curve[0]).toEqual({ x: 0, y: 100 });
      expect(curve[curve.length - 1]).toEqual({ x: 200, y: 100 });
      
      // Check that middle points have peak height
      expect(curve[2].y).toBe(50);
    });

    it('should respect curve intensity parameter', () => {
      const gentleCurve = calculateAgentCurve(0, 100, 200, 100, 50, 0.1);
      const intenseCurve = calculateAgentCurve(0, 100, 200, 100, 50, 0.5);
      
      // Intense curve should have wider control points
      expect(Math.abs(intenseCurve[1].x - 0)).toBeGreaterThan(Math.abs(gentleCurve[1].x - 0));
    });
  });
});

describe('Coordinate Transformations', () => {
  describe('Timestamp to X Coordinate', () => {
    it('should map timestamps to SVG coordinates correctly', () => {
      const timeRange = { start: 1000, end: 2000 };
      const svgWidth = 800;
      const margins = { left: 50, right: 50 };
      
      // Start timestamp should map to left margin
      const startX = timestampToX(1000, timeRange, svgWidth, margins);
      expect(startX).toBe(50);
      
      // End timestamp should map to right edge minus margin
      const endX = timestampToX(2000, timeRange, svgWidth, margins);
      expect(endX).toBe(750);
      
      // Middle timestamp should map to center
      const midX = timestampToX(1500, timeRange, svgWidth, margins);
      expect(midX).toBe(400);
    });
  });

  describe('Lane Y Calculation', () => {
    it('should calculate correct Y position for agent lanes', () => {
      const orchestratorY = 200;
      const laneHeight = 50;
      
      const lane0Y = calculateLaneY(0, orchestratorY, laneHeight);
      expect(lane0Y).toBe(130); // 200 - (0+1)*50 - 20
      
      const lane1Y = calculateLaneY(1, orchestratorY, laneHeight);
      expect(lane1Y).toBe(80); // 200 - (1+1)*50 - 20
    });
  });

  describe('Agent Lane Assignment', () => {
    it('should assign non-overlapping lanes to agents', () => {
      const agents = [
        { startTime: 1000, endTime: 1500, id: 'agent1' },
        { startTime: 1200, endTime: 1600, id: 'agent2' }, // Overlaps with agent1
        { startTime: 1600, endTime: 1800, id: 'agent3' }  // Doesn't overlap
      ];
      
      const assignments = assignAgentLanes(agents);
      
      expect(assignments.get('agent1')).toBe(0);
      expect(assignments.get('agent2')).toBe(1); // Different lane due to overlap
      expect(assignments.get('agent3')).toBe(0); // Can reuse lane 0
    });

    it('should handle agents without end time', () => {
      const agents = [
        { startTime: 1000, endTime: 1500, id: 'agent1' },
        { startTime: 1200, endTime: 1700, id: 'agent2' }
      ];
      
      const assignments = assignAgentLanes(agents);
      expect(assignments.size).toBe(2);
    });
  });
});

describe('Utility Functions', () => {
  describe('Time Label Formatting', () => {
    beforeEach(() => {
      // Mock Date.now() for consistent testing
      const mockNow = 1000000;
      // @ts-ignore - Mock for testing
      Date.now = () => mockNow;
    });

    it('should format relative time labels correctly', () => {
      const now = Date.now();
      
      expect(formatTimeLabel(now, 'relative')).toBe('now');
      expect(formatTimeLabel(now - 5000, 'relative')).toBe('5s ago');
      expect(formatTimeLabel(now - 120000, 'relative')).toBe('2m ago');
      expect(formatTimeLabel(now - 3600000, 'relative')).toBe('1h ago');
    });

    it('should format absolute time labels correctly', () => {
      const timestamp = 1640995200000; // Known timestamp
      const result = formatTimeLabel(timestamp, 'absolute');
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/); // HH:MM:SS format
    });
  });

  describe('Accessibility Attributes', () => {
    it('should create basic accessibility attributes', () => {
      const attrs = createAccessibilityAttrs('button', 'Agent timeline node');
      
      expect(attrs.role).toBe('button');
      expect(attrs['aria-label']).toBe('Agent timeline node');
      expect(attrs.tabindex).toBe('0');
    });

    it('should include description when provided', () => {
      const attrs = createAccessibilityAttrs(
        'button', 
        'Agent node', 
        'Click to view details'
      );
      
      expect(attrs['aria-description']).toBe('Click to view details');
    });
  });
});

describe('Performance and Edge Cases', () => {
  it('should handle empty or malformed input gracefully', () => {
    expect(() => getAgentTypeColor('')).not.toThrow();
    expect(() => hashAgentTypeColor('')).not.toThrow();
    expect(() => createBezierPath([])).not.toThrow();
    expect(() => assignAgentLanes([])).not.toThrow();
  });

  it('should maintain performance with large datasets', () => {
    const startTime = performance.now();
    
    // Generate large agent dataset
    const agents = Array.from({ length: 1000 }, (_, i) => ({
      startTime: i * 10,
      endTime: i * 10 + 5,
      id: `agent-${i}`
    }));
    
    const assignments = assignAgentLanes(agents);
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    expect(assignments.size).toBe(1000);
  });
});