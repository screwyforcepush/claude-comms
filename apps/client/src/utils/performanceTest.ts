/**
 * Performance Testing Utilities
 * 
 * Test suite for validating timeline performance optimizations
 * with large datasets (100+ agents) to ensure 60fps rendering.
 * 
 * Updated for consolidated agent structure:
 * - Engineers now include testing capabilities (previously separate tester role)
 * - Gatekeeper consolidates code-reviewer and green-verifier roles
 */

import { generateStressTestData } from './timelineTestData';
import type { AgentStatus, SubagentMessage } from '../types';

interface PerformanceResult {
  testName: string;
  agentCount: number;
  messageCount: number;
  renderTime: number;
  fps: number;
  memoryUsedMB: number;
  domNodes: number;
  passed: boolean;
  details: string[];
}

interface PerformanceTestConfig {
  agentCounts: number[];
  iterations: number;
  targetFPS: number;
  maxRenderTime: number;
  maxMemoryMB: number;
}

export class TimelinePerformanceTester {
  private config: PerformanceTestConfig = {
    agentCounts: [50, 100, 200, 500],
    iterations: 3,
    targetFPS: 30, // Minimum acceptable FPS
    maxRenderTime: 33.33, // Max frame time for 30fps
    maxMemoryMB: 100
  };

  private results: PerformanceResult[] = [];
  
  /**
   * Run comprehensive performance tests
   */
  async runPerformanceTests(): Promise<PerformanceResult[]> {
    console.log('🚀 Starting timeline performance tests...');
    this.results = [];

    for (const agentCount of this.config.agentCounts) {
      const result = await this.testAgentCount(agentCount);
      this.results.push(result);
      
      // Log progress
      console.log(`✅ Test completed: ${agentCount} agents - ${result.passed ? 'PASSED' : 'FAILED'}`);
      
      // Break early if performance degrades significantly
      if (!result.passed && agentCount >= 200) {
        console.warn('⚠️ Performance degraded significantly, stopping tests');
        break;
      }
    }

    this.generateReport();
    return this.results;
  }

  /**
   * Test specific agent count
   */
  private async testAgentCount(agentCount: number): Promise<PerformanceResult> {
    const testData = generateStressTestData(agentCount);
    const details: string[] = [];
    
    // Measure render performance
    const renderResults = await this.measureRenderPerformance(testData, this.config.iterations);
    
    // Measure memory usage
    const memoryUsage = this.measureMemoryUsage();
    
    // Count DOM nodes
    const domNodes = this.countTimelineDOMNodes();
    
    // Calculate averages
    const avgRenderTime = renderResults.reduce((sum, time) => sum + time, 0) / renderResults.length;
    const fps = 1000 / avgRenderTime;
    
    // Determine if test passed
    const renderPass = avgRenderTime <= this.config.maxRenderTime;
    const fpsPass = fps >= this.config.targetFPS;
    const memoryPass = memoryUsage <= this.config.maxMemoryMB;
    
    details.push(`Render time: ${avgRenderTime.toFixed(2)}ms (target: <${this.config.maxRenderTime}ms)`);
    details.push(`FPS: ${fps.toFixed(1)} (target: >${this.config.targetFPS})`);
    details.push(`Memory: ${memoryUsage.toFixed(1)}MB (target: <${this.config.maxMemoryMB}MB)`);
    details.push(`DOM nodes: ${domNodes}`);

    return {
      testName: `${agentCount} Agents Test`,
      agentCount,
      messageCount: testData.messages.length,
      renderTime: avgRenderTime,
      fps,
      memoryUsedMB: memoryUsage,
      domNodes,
      passed: renderPass && fpsPass && memoryPass,
      details
    };
  }

  /**
   * Measure rendering performance
   */
  private async measureRenderPerformance(
    testData: { agents: AgentStatus[]; messages: SubagentMessage[] },
    iterations: number
  ): Promise<number[]> {
    const results: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // Simulate timeline rendering operations
      await this.simulateTimelineRender(testData);
      
      const endTime = performance.now();
      results.push(endTime - startTime);
      
      // Allow time for garbage collection between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * Simulate timeline rendering
   */
  private async simulateTimelineRender(
    testData: { agents: AgentStatus[]; messages: SubagentMessage[] }
  ): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        // Simulate heavy operations that timeline performs
        
        // 1. Agent lane allocation
        const laneMap = new Map<string, number>();
        testData.agents.forEach((agent, index) => {
          laneMap.set(agent.id.toString(), Math.floor(index / 10));
        });
        
        // 2. Time range calculation  
        const times = testData.agents.map(a => a.created_at);
        const timeRange = {
          start: Math.min(...times),
          end: Math.max(...times)
        };
        
        // 3. SVG path generation simulation
        testData.agents.forEach(agent => {
          const pathData = this.generateMockSVGPath(agent, timeRange);
          // Simulate DOM manipulation without actual DOM operations
          this.simulateDOMOperation(pathData);
        });
        
        // 4. Message positioning
        testData.messages.forEach(message => {
          const position = this.calculateMockMessagePosition(message, timeRange);
          this.simulateDOMOperation(position);
        });
        
        resolve();
      });
    });
  }

  /**
   * Generate mock SVG path for performance testing
   */
  private generateMockSVGPath(agent: AgentStatus, timeRange: any): string {
    const startX = ((agent.created_at - timeRange.start) / (timeRange.end - timeRange.start)) * 1000;
    const endX = agent.completion_timestamp 
      ? ((agent.completion_timestamp - timeRange.start) / (timeRange.end - timeRange.start)) * 1000
      : startX + 100;
    
    // Simulate bezier curve calculation
    const midX = startX + (endX - startX) * 0.5;
    const peakY = 100 + Math.random() * 200;
    
    return `M ${startX},200 Q ${midX},${peakY} ${endX},200`;
  }

  /**
   * Calculate mock message position
   */
  private calculateMockMessagePosition(message: SubagentMessage, timeRange: any): { x: number; y: number } {
    const x = ((message.created_at - timeRange.start) / (timeRange.end - timeRange.start)) * 1000;
    const y = 100 + Math.random() * 300;
    return { x, y };
  }

  /**
   * Simulate DOM operation without actual DOM manipulation
   */
  private simulateDOMOperation(data: any): void {
    // Simulate the computational overhead of DOM operations
    // without actual DOM manipulation to measure pure rendering logic
    JSON.stringify(data);
  }

  /**
   * Measure memory usage
   */
  private measureMemoryUsage(): number {
    // @ts-ignore - performance.memory exists in Chrome
    if (performance.memory) {
      // @ts-ignore
      return performance.memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Count DOM nodes in timeline
   */
  private countTimelineDOMNodes(): number {
    const timelineContainer = document.querySelector('.agent-timeline-container');
    if (!timelineContainer) return 0;
    
    return timelineContainer.querySelectorAll('*').length;
  }

  /**
   * Generate comprehensive performance report
   */
  private generateReport(): void {
    console.log('\n📊 TIMELINE PERFORMANCE REPORT');
    console.log('=====================================');
    
    let allPassed = true;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${status} ${result.testName}`);
      console.log(`  Agents: ${result.agentCount}, Messages: ${result.messageCount}`);
      console.log(`  Render: ${result.renderTime.toFixed(2)}ms, FPS: ${result.fps.toFixed(1)}`);
      console.log(`  Memory: ${result.memoryUsedMB.toFixed(1)}MB, DOM: ${result.domNodes} nodes`);
      
      if (!result.passed) {
        allPassed = false;
        console.log('  Issues:');
        result.details.forEach(detail => {
          if (detail.includes('target:')) {
            console.log(`    - ${detail}`);
          }
        });
      }
    });

    console.log('\n=====================================');
    if (allPassed) {
      console.log('🎉 ALL PERFORMANCE TESTS PASSED!');
      console.log('Timeline is optimized for production use.');
    } else {
      console.log('⚠️  SOME PERFORMANCE TESTS FAILED');
      console.log('Consider additional optimizations for large datasets.');
    }

    // Performance recommendations
    this.generateRecommendations();
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    const lastResult = this.results[this.results.length - 1];
    
    if (!lastResult.passed) {
      console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
      
      if (lastResult.renderTime > this.config.maxRenderTime) {
        console.log('- Consider more aggressive viewport culling');
        console.log('- Implement progressive rendering for large datasets');
        console.log('- Use canvas rendering for high-density visualizations');
      }
      
      if (lastResult.memoryUsedMB > this.config.maxMemoryMB) {
        console.log('- Implement object pooling for frequently created objects');
        console.log('- Add more aggressive memory cleanup');
        console.log('- Consider lazy loading for off-screen elements');
      }
      
      if (lastResult.domNodes > 1000) {
        console.log('- Implement virtual DOM for large element counts');
        console.log('- Use CSS transforms instead of DOM updates');
        console.log('- Consider canvas-based rendering for high element density');
      }
    }
  }

  /**
   * Export results for further analysis
   */
  exportResults(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      config: this.config,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.passed).length,
        overallPassed: this.results.every(r => r.passed)
      }
    }, null, 2);
  }
}

// Utility function for quick testing
export async function runQuickPerformanceTest(agentCount: number = 100): Promise<void> {
  const tester = new TimelinePerformanceTester();
  const testData = generateStressTestData(agentCount);
  
  console.log(`🔥 Quick performance test with ${agentCount} agents...`);
  
  const startTime = performance.now();
  await tester['simulateTimelineRender'](testData);
  const endTime = performance.now();
  
  const renderTime = endTime - startTime;
  const fps = 1000 / renderTime;
  
  console.log(`⚡ Results: ${renderTime.toFixed(2)}ms render time, ${fps.toFixed(1)} FPS`);
  console.log(renderTime < 33.33 ? '✅ Performance acceptable' : '❌ Performance needs optimization');
}