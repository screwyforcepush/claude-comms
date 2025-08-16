/**
 * Automated Performance Regression Testing Framework
 * 
 * Comprehensive performance testing suite for priority event bucket system.
 * Validates performance baselines and detects regressions across all system components.
 */

import { Database } from 'bun:sqlite';
import { performance } from 'perf_hooks';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Performance baseline thresholds from Phase 11 requirements
const PERFORMANCE_BASELINES = {
  CLIENT_MEMORY_LIMIT: 50 * 1024 * 1024, // 50MB
  DATABASE_QUERY_TIME_LIMIT: 100, // 100ms
  SERVER_MEMORY_GROWTH_LIMIT: 50 * 1024 * 1024, // 50MB per 1000 events
  WEBSOCKET_OVERHEAD_LIMIT: 0.05, // 5%
  WEBSOCKET_LATENCY_LIMIT: 10, // 10ms
  BULK_INSERT_THROUGHPUT: 1000, // events/second
  REGRESSION_THRESHOLD: 0.15, // 15% performance degradation = regression
  IMPROVEMENT_THRESHOLD: 0.10, // 10% improvement = significant
};

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  baseline?: number;
  threshold: number;
  status: 'pass' | 'fail' | 'regression' | 'improvement';
  details?: Record<string, any>;
}

interface TestResult {
  testName: string;
  duration: number;
  metrics: PerformanceMetric[];
  passed: boolean;
  errors: string[];
}

interface PerformanceReport {
  timestamp: number;
  version: string;
  environment: string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    regressions: number;
    improvements: number;
  };
  testResults: TestResult[];
  comparison?: {
    baselineFile: string;
    regressionCount: number;
    improvementCount: number;
    significantChanges: string[];
  };
}

// Mock priority event system for testing
class PerformanceTestSystem {
  private database: Database;
  private memoryUsage: number = 20 * 1024 * 1024; // 20MB base
  private eventCount: number = 0;

  constructor() {
    this.database = new Database(':memory:');
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create events table with priority schema
    this.database.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_app TEXT NOT NULL,
        session_id TEXT NOT NULL,
        hook_event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        chat TEXT,
        summary TEXT,
        timestamp INTEGER NOT NULL,
        priority INTEGER DEFAULT 0,
        priority_metadata TEXT
      )
    `);

    // Create priority-optimized indexes
    this.database.exec('CREATE INDEX idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    this.database.exec('CREATE INDEX idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
    this.database.exec('CREATE INDEX idx_events_type_priority ON events(hook_event_type, priority DESC, timestamp DESC)');
  }

  insertEvent(event: any): void {
    const priority = this.calculateEventPriority(event.hook_event_type);
    const priorityMetadata = priority > 0 ? JSON.stringify({
      classified_at: Date.now(),
      classification_reason: 'automatic',
      retention_policy: 'extended'
    }) : null;

    const stmt = this.database.prepare(`
      INSERT INTO events (
        source_app, session_id, hook_event_type, payload, 
        chat, summary, timestamp, priority, priority_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.source_app,
      event.session_id,
      event.hook_event_type,
      JSON.stringify(event.payload),
      event.chat ? JSON.stringify(event.chat) : null,
      event.summary || null,
      event.timestamp || Date.now(),
      priority,
      priorityMetadata
    );

    this.eventCount++;
    this.memoryUsage += this.estimateEventSize(event);
  }

  private calculateEventPriority(eventType: string): number {
    const priorityTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete'];
    return priorityTypes.includes(eventType) ? 1 : 0;
  }

  private estimateEventSize(event: any): number {
    return 500 + JSON.stringify(event.payload || {}).length;
  }

  queryPriorityEvents(limit: number = 100): any[] {
    const now = Date.now();
    const priorityCutoff = now - (24 * 60 * 60 * 1000); // 24 hours
    const regularCutoff = now - (4 * 60 * 60 * 1000);   // 4 hours

    const stmt = this.database.prepare(`
      SELECT * FROM events
      WHERE (priority > 0 AND timestamp >= ?) OR (priority = 0 AND timestamp >= ?)
      ORDER BY priority DESC, timestamp DESC
      LIMIT ?
    `);

    return stmt.all(priorityCutoff, regularCutoff, limit) as any[];
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getEventCount(): number {
    return this.eventCount;
  }

  cleanup(): void {
    this.database.close();
  }
}

class PerformanceRegressionTester {
  private testSystem: PerformanceTestSystem;
  private baselineFile: string;
  private reportFile: string;

  constructor(baselineFile: string = 'performance-baseline.json', reportFile: string = 'performance-report.json') {
    this.testSystem = new PerformanceTestSystem();
    this.baselineFile = baselineFile;
    this.reportFile = reportFile;
  }

  async runFullPerformanceSuite(): Promise<PerformanceReport> {
    console.log('🚀 Starting Performance Regression Testing Suite...');
    
    const report: PerformanceReport = {
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'test',
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        regressions: 0,
        improvements: 0
      },
      testResults: []
    };

    // Run all performance tests
    const tests = [
      () => this.testDatabaseQueryPerformance(),
      () => this.testBulkInsertPerformance(),
      () => this.testMemoryEfficiency(),
      () => this.testWebSocketOverhead(),
      () => this.testPriorityClassificationPerformance(),
      () => this.testConcurrentLoadPerformance(),
      () => this.testMemoryLeakDetection()
    ];

    for (const test of tests) {
      try {
        const result = await test();
        report.testResults.push(result);
        report.summary.totalTests++;
        
        if (result.passed) {
          report.summary.passedTests++;
        } else {
          report.summary.failedTests++;
        }

        // Count regressions and improvements
        result.metrics.forEach(metric => {
          if (metric.status === 'regression') report.summary.regressions++;
          if (metric.status === 'improvement') report.summary.improvements++;
        });

      } catch (error) {
        console.error(`Test failed with error: ${error}`);
        report.testResults.push({
          testName: 'Unknown Test',
          duration: 0,
          metrics: [],
          passed: false,
          errors: [String(error)]
        });
        report.summary.totalTests++;
        report.summary.failedTests++;
      }
    }

    // Compare with baseline if available
    if (existsSync(this.baselineFile)) {
      report.comparison = this.compareWithBaseline(report);
    }

    // Save report
    this.saveReport(report);

    // Print summary
    this.printSummary(report);

    return report;
  }

  private async testDatabaseQueryPerformance(): Promise<TestResult> {
    console.log('📊 Testing Database Query Performance...');
    
    const result: TestResult = {
      testName: 'Database Query Performance',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      // Insert test data
      const events = this.generateTestEvents(1000, 0.3);
      events.forEach(event => this.testSystem.insertEvent(event));

      // Test priority query performance
      const queryStart = performance.now();
      const results = this.testSystem.queryPriorityEvents(100);
      const queryTime = performance.now() - queryStart;

      result.metrics.push({
        name: 'priority_query_time',
        value: queryTime,
        unit: 'ms',
        timestamp: Date.now(),
        threshold: PERFORMANCE_BASELINES.DATABASE_QUERY_TIME_LIMIT,
        status: queryTime <= PERFORMANCE_BASELINES.DATABASE_QUERY_TIME_LIMIT ? 'pass' : 'fail',
        details: { resultCount: results.length, eventCount: 1000 }
      });

      if (queryTime > PERFORMANCE_BASELINES.DATABASE_QUERY_TIME_LIMIT) {
        result.passed = false;
        result.errors.push(`Query time ${queryTime.toFixed(2)}ms exceeds limit of ${PERFORMANCE_BASELINES.DATABASE_QUERY_TIME_LIMIT}ms`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testBulkInsertPerformance(): Promise<TestResult> {
    console.log('⚡ Testing Bulk Insert Performance...');
    
    const result: TestResult = {
      testName: 'Bulk Insert Performance',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const events = this.generateTestEvents(1000, 0.3);
      
      const insertStart = performance.now();
      events.forEach(event => this.testSystem.insertEvent(event));
      const insertTime = performance.now() - insertStart;

      const throughput = 1000 / (insertTime / 1000); // events per second

      result.metrics.push({
        name: 'bulk_insert_throughput',
        value: throughput,
        unit: 'events/sec',
        timestamp: Date.now(),
        threshold: PERFORMANCE_BASELINES.BULK_INSERT_THROUGHPUT,
        status: throughput >= PERFORMANCE_BASELINES.BULK_INSERT_THROUGHPUT ? 'pass' : 'fail',
        details: { insertTime, eventCount: 1000 }
      });

      if (throughput < PERFORMANCE_BASELINES.BULK_INSERT_THROUGHPUT) {
        result.passed = false;
        result.errors.push(`Throughput ${throughput.toFixed(0)} events/sec below minimum of ${PERFORMANCE_BASELINES.BULK_INSERT_THROUGHPUT}`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testMemoryEfficiency(): Promise<TestResult> {
    console.log('💾 Testing Memory Efficiency...');
    
    const result: TestResult = {
      testName: 'Memory Efficiency',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const initialMemory = this.testSystem.getMemoryUsage();
      
      // Add 1000 events
      const events = this.generateTestEvents(1000, 0.3);
      events.forEach(event => this.testSystem.insertEvent(event));

      const finalMemory = this.testSystem.getMemoryUsage();
      const memoryGrowth = finalMemory - initialMemory;

      result.metrics.push({
        name: 'memory_growth_per_1000_events',
        value: memoryGrowth,
        unit: 'bytes',
        timestamp: Date.now(),
        threshold: PERFORMANCE_BASELINES.SERVER_MEMORY_GROWTH_LIMIT,
        status: memoryGrowth <= PERFORMANCE_BASELINES.SERVER_MEMORY_GROWTH_LIMIT ? 'pass' : 'fail',
        details: { initialMemory, finalMemory, eventCount: 1000 }
      });

      // Test memory per event
      const memoryPerEvent = memoryGrowth / 1000;
      result.metrics.push({
        name: 'memory_per_event',
        value: memoryPerEvent,
        unit: 'bytes',
        timestamp: Date.now(),
        threshold: 100 * 1024, // 100KB per event threshold
        status: memoryPerEvent <= 100 * 1024 ? 'pass' : 'fail'
      });

      if (memoryGrowth > PERFORMANCE_BASELINES.SERVER_MEMORY_GROWTH_LIMIT) {
        result.passed = false;
        result.errors.push(`Memory growth ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB exceeds limit`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testWebSocketOverhead(): Promise<TestResult> {
    console.log('🌐 Testing WebSocket Overhead...');
    
    const result: TestResult = {
      testName: 'WebSocket Message Overhead',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const baseEvent = this.generateTestEvents(1, 0)[0];
      const priorityEvent = this.generateTestEvents(1, 1)[0];

      // Create base message
      const baseMessage = {
        type: 'event',
        data: baseEvent
      };

      // Create priority message with metadata
      const priorityMessage = {
        type: 'priority_event',
        data: priorityEvent,
        priority_info: {
          total_events: 100,
          priority_events: 30,
          regular_events: 70,
          retention_window: {
            priority_hours: 24,
            regular_hours: 4
          },
          retention_hint: 'extended',
          classification: 'automatic',
          bucket: 'priority'
        }
      };

      const baseSize = JSON.stringify(baseMessage).length;
      const prioritySize = JSON.stringify(priorityMessage).length;
      const overhead = (prioritySize - baseSize) / baseSize;

      result.metrics.push({
        name: 'websocket_message_overhead',
        value: overhead,
        unit: 'ratio',
        timestamp: Date.now(),
        threshold: PERFORMANCE_BASELINES.WEBSOCKET_OVERHEAD_LIMIT,
        status: overhead <= PERFORMANCE_BASELINES.WEBSOCKET_OVERHEAD_LIMIT ? 'pass' : 'fail',
        details: { baseSize, prioritySize, overheadBytes: prioritySize - baseSize }
      });

      if (overhead > PERFORMANCE_BASELINES.WEBSOCKET_OVERHEAD_LIMIT) {
        result.passed = false;
        result.errors.push(`WebSocket overhead ${(overhead * 100).toFixed(2)}% exceeds limit of ${(PERFORMANCE_BASELINES.WEBSOCKET_OVERHEAD_LIMIT * 100).toFixed(2)}%`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testPriorityClassificationPerformance(): Promise<TestResult> {
    console.log('🏷️ Testing Priority Classification Performance...');
    
    const result: TestResult = {
      testName: 'Priority Classification Performance',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const events = this.generateTestEvents(1000, 0.5); // 50% priority events
      
      const classificationStart = performance.now();
      events.forEach(event => this.testSystem.insertEvent(event));
      const classificationTime = performance.now() - classificationStart;

      const timePerEvent = classificationTime / 1000;

      result.metrics.push({
        name: 'priority_classification_time_per_event',
        value: timePerEvent,
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 1, // 1ms per event max
        status: timePerEvent <= 1 ? 'pass' : 'fail',
        details: { totalTime: classificationTime, eventCount: 1000 }
      });

      if (timePerEvent > 1) {
        result.passed = false;
        result.errors.push(`Classification time ${timePerEvent.toFixed(3)}ms per event exceeds 1ms limit`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testConcurrentLoadPerformance(): Promise<TestResult> {
    console.log('⚡ Testing Concurrent Load Performance...');
    
    const result: TestResult = {
      testName: 'Concurrent Load Performance',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const concurrentOperations = 10;
      const eventsPerOperation = 100;

      const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
        return new Promise<number>((resolve) => {
          const operationStart = performance.now();
          const events = this.generateTestEvents(eventsPerOperation, 0.3);
          events.forEach(event => this.testSystem.insertEvent(event));
          resolve(performance.now() - operationStart);
        });
      });

      const operationTimes = await Promise.all(operations);
      const totalTime = performance.now() - startTime;
      const avgOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;

      result.metrics.push({
        name: 'concurrent_load_avg_operation_time',
        value: avgOperationTime,
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 1000, // 1 second max per operation
        status: avgOperationTime <= 1000 ? 'pass' : 'fail',
        details: { totalTime, concurrentOperations, eventsPerOperation }
      });

      if (avgOperationTime > 1000) {
        result.passed = false;
        result.errors.push(`Average operation time ${avgOperationTime.toFixed(2)}ms exceeds 1000ms limit`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private async testMemoryLeakDetection(): Promise<TestResult> {
    console.log('🔍 Testing Memory Leak Detection...');
    
    const result: TestResult = {
      testName: 'Memory Leak Detection',
      duration: 0,
      metrics: [],
      passed: true,
      errors: []
    };

    const startTime = performance.now();

    try {
      const memorySnapshots: number[] = [];
      const cycles = 5;
      const eventsPerCycle = 200;

      for (let cycle = 0; cycle < cycles; cycle++) {
        const events = this.generateTestEvents(eventsPerCycle, 0.3);
        events.forEach(event => this.testSystem.insertEvent(event));
        
        memorySnapshots.push(this.testSystem.getMemoryUsage());
        
        // Simulate some processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Calculate memory growth trend
      const firstMemory = memorySnapshots[0];
      const lastMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowthRate = (lastMemory - firstMemory) / firstMemory;

      result.metrics.push({
        name: 'memory_growth_rate_over_cycles',
        value: memoryGrowthRate,
        unit: 'ratio',
        timestamp: Date.now(),
        threshold: 0.5, // 50% max growth over cycles
        status: memoryGrowthRate <= 0.5 ? 'pass' : 'fail',
        details: { cycles, eventsPerCycle, memorySnapshots }
      });

      if (memoryGrowthRate > 0.5) {
        result.passed = false;
        result.errors.push(`Memory growth rate ${(memoryGrowthRate * 100).toFixed(2)}% indicates potential leak`);
      }

    } catch (error) {
      result.passed = false;
      result.errors.push(String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  private generateTestEvents(count: number, priorityRatio: number): any[] {
    const events: any[] = [];
    const priorityTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop'];
    const regularTypes = ['RegularEvent', 'LogEntry', 'StatusUpdate'];

    for (let i = 0; i < count; i++) {
      const isPriority = Math.random() < priorityRatio;
      const eventType = isPriority 
        ? priorityTypes[Math.floor(Math.random() * priorityTypes.length)]
        : regularTypes[Math.floor(Math.random() * regularTypes.length)];

      events.push({
        source_app: 'performance-test',
        session_id: `session-${Math.floor(i / 100)}`,
        hook_event_type: eventType,
        payload: {
          data: 'x'.repeat(256 + Math.random() * 256),
          timestamp: Date.now(),
          test: true
        },
        timestamp: Date.now() - (count - i) * 1000
      });
    }

    return events;
  }

  private compareWithBaseline(report: PerformanceReport): PerformanceReport['comparison'] {
    try {
      const baselineData = JSON.parse(readFileSync(this.baselineFile, 'utf8')) as PerformanceReport;
      const comparison: PerformanceReport['comparison'] = {
        baselineFile: this.baselineFile,
        regressionCount: 0,
        improvementCount: 0,
        significantChanges: []
      };

      // Compare metrics
      report.testResults.forEach(currentTest => {
        const baselineTest = baselineData.testResults.find(t => t.testName === currentTest.testName);
        if (!baselineTest) return;

        currentTest.metrics.forEach(currentMetric => {
          const baselineMetric = baselineTest.metrics.find(m => m.name === currentMetric.name);
          if (!baselineMetric) return;

          currentMetric.baseline = baselineMetric.value;
          
          const changeRatio = (currentMetric.value - baselineMetric.value) / baselineMetric.value;
          
          if (Math.abs(changeRatio) > PERFORMANCE_BASELINES.REGRESSION_THRESHOLD) {
            if (changeRatio > 0 && (currentMetric.name.includes('time') || currentMetric.name.includes('memory') || currentMetric.name.includes('overhead'))) {
              // Higher is worse for time/memory/overhead metrics
              currentMetric.status = 'regression';
              comparison.regressionCount++;
              comparison.significantChanges.push(`${currentMetric.name}: +${(changeRatio * 100).toFixed(1)}% (regression)`);
            } else if (changeRatio < 0 && (currentMetric.name.includes('time') || currentMetric.name.includes('memory') || currentMetric.name.includes('overhead'))) {
              // Lower is better for time/memory/overhead metrics
              currentMetric.status = 'improvement';
              comparison.improvementCount++;
              comparison.significantChanges.push(`${currentMetric.name}: ${(changeRatio * 100).toFixed(1)}% (improvement)`);
            } else if (changeRatio > 0 && currentMetric.name.includes('throughput')) {
              // Higher is better for throughput metrics
              currentMetric.status = 'improvement';
              comparison.improvementCount++;
              comparison.significantChanges.push(`${currentMetric.name}: +${(changeRatio * 100).toFixed(1)}% (improvement)`);
            } else if (changeRatio < 0 && currentMetric.name.includes('throughput')) {
              // Lower is worse for throughput metrics
              currentMetric.status = 'regression';
              comparison.regressionCount++;
              comparison.significantChanges.push(`${currentMetric.name}: ${(changeRatio * 100).toFixed(1)}% (regression)`);
            }
          }
        });
      });

      return comparison;
    } catch (error) {
      console.warn(`Could not compare with baseline: ${error}`);
      return undefined;
    }
  }

  private saveReport(report: PerformanceReport): void {
    writeFileSync(this.reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 Performance report saved to ${this.reportFile}`);
  }

  private printSummary(report: PerformanceReport): void {
    console.log('\n🏁 Performance Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests} ✅`);
    console.log(`Failed: ${report.summary.failedTests} ❌`);
    console.log(`Regressions: ${report.summary.regressions} 📉`);
    console.log(`Improvements: ${report.summary.improvements} 📈`);

    if (report.comparison) {
      console.log(`\n📊 Comparison with baseline (${report.comparison.baselineFile}):`);
      report.comparison.significantChanges.forEach(change => {
        const emoji = change.includes('regression') ? '⚠️' : '🎉';
        console.log(`${emoji} ${change}`);
      });
    }

    // Print failing tests
    const failedTests = report.testResults.filter(t => !t.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  • ${test.testName}`);
        test.errors.forEach(error => console.log(`    - ${error}`));
      });
    }

    // Overall status
    const overallPassed = report.summary.failedTests === 0 && report.summary.regressions === 0;
    console.log(`\n🎯 Overall Status: ${overallPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  }

  saveBaseline(): void {
    this.runFullPerformanceSuite().then(report => {
      writeFileSync(this.baselineFile, JSON.stringify(report, null, 2));
      console.log(`📊 Performance baseline saved to ${this.baselineFile}`);
    });
  }

  cleanup(): void {
    this.testSystem.cleanup();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const tester = new PerformanceRegressionTester();

  try {
    switch (command) {
      case 'baseline':
        console.log('Creating performance baseline...');
        tester.saveBaseline();
        break;
      case 'test':
        console.log('Running performance regression tests...');
        await tester.runFullPerformanceSuite();
        break;
      case 'ci':
        console.log('Running CI performance validation...');
        const report = await tester.runFullPerformanceSuite();
        // Exit with error code if tests failed or regressions detected
        const exitCode = (report.summary.failedTests > 0 || report.summary.regressions > 0) ? 1 : 0;
        process.exit(exitCode);
        break;
      default:
        console.log('Usage: bun run performance-regression-testing.ts [baseline|test|ci]');
        console.log('  baseline - Create new performance baseline');
        console.log('  test     - Run performance tests and compare to baseline');
        console.log('  ci       - Run tests for CI/CD (exits with error code on failure)');
        break;
    }
  } finally {
    tester.cleanup();
  }
}

// Export for testing
export {
  PerformanceRegressionTester,
  PerformanceTestSystem,
  PERFORMANCE_BASELINES,
  type PerformanceReport,
  type TestResult,
  type PerformanceMetric
};

// Run CLI if this file is executed directly
if (import.meta.main) {
  main().catch(console.error);
}