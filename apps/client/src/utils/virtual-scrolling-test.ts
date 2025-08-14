/**
 * Virtual Scrolling Performance Test Utilities
 * 
 * Test utilities for validating the virtual scrolling implementation
 * in InteractiveSessionsTimeline component.
 */

import type { SessionTimelineData } from '../types/multi-session';

// Mock session data generator
export function generateMockSessions(count: number): SessionTimelineData[] {
  const sessions: SessionTimelineData[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const sessionStart = now - (count - i) * 300000; // 5 minutes apart
    const sessionEnd = sessionStart + 600000; // 10 minutes duration
    
    sessions.push({
      sessionId: `session-${i.toString().padStart(3, '0')}`,
      displayName: `Session ${i + 1}`,
      startTime: sessionStart,
      endTime: sessionEnd,
      status: i < count * 0.8 ? 'completed' : (i < count * 0.9 ? 'active' : 'failed'),
      orchestratorEvents: [],
      userPrompts: [],
      agentBatches: [],
      agentPaths: generateMockAgents(Math.floor(Math.random() * 5) + 2),
      messages: generateMockMessages(Math.floor(Math.random() * 10) + 5),
      sessionLaneOffset: i * 84, // 80px lane + 4px gap
      sessionLaneHeight: 80,
      metrics: {
        totalDuration: 600000,
        agentCount: Math.floor(Math.random() * 5) + 2,
        messageCount: Math.floor(Math.random() * 10) + 5,
        batchCount: 1,
        averageAgentDuration: 120000,
        completionRate: Math.random(),
        errorRate: Math.random() * 0.1
      },
      color: `hsl(${(i * 137.5) % 360}, 60%, 50%)`
    });
  }
  
  return sessions;
}

function generateMockAgents(count: number) {
  const agents = [];
  const agentTypes = ['engineer', 'architect', 'reviewer', 'tester', 'planner'];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const startTime = now - (count - i) * 60000;
    const endTime = startTime + 180000; // 3 minutes
    
    agents.push({
      agentId: `agent-${i}`,
      name: `Agent${i}`,
      type: agentTypes[i % agentTypes.length],
      startTime,
      endTime,
      status: Math.random() > 0.8 ? 'error' : 'completed',
      laneIndex: i + 1,
      curveData: [],
      batchId: 'batch-1',
      messages: [],
      sessionId: '',
      color: '#3b82f6',
      metadata: {
        duration: 180000,
        tokens: 1000,
        toolUseCount: 3
      }
    });
  }
  
  return agents;
}

function generateMockMessages(count: number) {
  const messages = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    messages.push({
      id: `message-${i}`,
      timestamp: now - (count - i) * 30000,
      sender: `Agent${i % 3}`,
      content: `Test message ${i + 1}`,
      type: 'inter_agent',
      agentId: `agent-${i % 3}`,
      read: Math.random() > 0.5,
      recipients: [`agent-${(i + 1) % 3}`],
      position: { x: 0, y: 0 },
      sessionId: ''
    });
  }
  
  return messages;
}

// Performance testing utilities
export class VirtualScrollingPerformanceTester {
  private frameCount = 0;
  private startTime = 0;
  private animationId: number | null = null;
  
  constructor(
    private container: HTMLElement,
    private targetFPS = 30
  ) {}
  
  startPerformanceTest(): Promise<{ averageFPS: number; memoryUsage: number }> {
    return new Promise((resolve) => {
      this.frameCount = 0;
      this.startTime = performance.now();
      
      const measureFrame = () => {
        this.frameCount++;
        
        // Test for 5 seconds
        if (performance.now() - this.startTime < 5000) {
          this.animationId = requestAnimationFrame(measureFrame);
        } else {
          this.stopTest();
          
          const duration = performance.now() - this.startTime;
          const averageFPS = (this.frameCount / duration) * 1000;
          const memoryUsage = this.getMemoryUsage();
          
          resolve({ averageFPS, memoryUsage });
        }
      };
      
      this.animationId = requestAnimationFrame(measureFrame);
    });
  }
  
  private stopTest() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return 0;
  }
  
  testScrollingPerformance(sessionCount: number): Promise<{
    renderTime: number;
    virtualizedSessions: number;
    memoryEfficiency: number;
  }> {
    return new Promise((resolve) => {
      const sessions = generateMockSessions(sessionCount);
      const renderStart = performance.now();
      
      // Simulate virtual scrolling logic
      const VIRTUAL_THRESHOLD = 20;
      const OVERSCAN_COUNT = 2;
      const viewportHeight = 600;
      const laneHeight = 84; // 80px + 4px gap
      
      const isVirtualized = sessions.length >= VIRTUAL_THRESHOLD;
      const visibleCount = isVirtualized 
        ? Math.ceil(viewportHeight / laneHeight) + (OVERSCAN_COUNT * 2)
        : sessions.length;
      
      const renderTime = performance.now() - renderStart;
      const memoryUsage = this.getMemoryUsage();
      
      resolve({
        renderTime,
        virtualizedSessions: Math.min(visibleCount, sessions.length),
        memoryEfficiency: sessionCount / memoryUsage || 0
      });
    });
  }
}

// Test validation utilities
export function validateVirtualScrollingLogic(
  totalSessions: number,
  scrollTop: number,
  viewportHeight: number,
  laneHeight: number,
  overscan: number
): {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  isOptimized: boolean;
} {
  const VIRTUAL_THRESHOLD = 20;
  
  if (totalSessions < VIRTUAL_THRESHOLD) {
    return {
      startIndex: 0,
      endIndex: totalSessions - 1,
      visibleCount: totalSessions,
      isOptimized: false
    };
  }
  
  const startIndex = Math.max(0, Math.floor(scrollTop / laneHeight) - overscan);
  const visibleInViewport = Math.ceil(viewportHeight / laneHeight);
  const endIndex = Math.min(totalSessions - 1, startIndex + visibleInViewport + (overscan * 2));
  
  return {
    startIndex,
    endIndex,
    visibleCount: endIndex - startIndex + 1,
    isOptimized: true
  };
}

// Test scenarios
export const TEST_SCENARIOS = {
  // Should NOT virtualize (< 20 sessions)
  SMALL_LOAD: { sessionCount: 10, expectedVirtualized: false },
  
  // Should virtualize (>= 20 sessions)
  MEDIUM_LOAD: { sessionCount: 25, expectedVirtualized: true },
  LARGE_LOAD: { sessionCount: 50, expectedVirtualized: true },
  STRESS_LOAD: { sessionCount: 100, expectedVirtualized: true },
  
  // Performance targets
  PERFORMANCE_TARGETS: {
    minFPS: 30,
    maxMemoryMB: 500,
    maxRenderTimeMs: 100
  }
};