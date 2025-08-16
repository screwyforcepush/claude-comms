# Production Monitoring Guide - Priority Event Buckets

## Overview

This guide provides comprehensive monitoring strategies for the dual-bucket priority event system in production environments. It covers performance metrics, alerting thresholds, and observability best practices to ensure the system operates within specified limits.

## Key Performance Indicators (KPIs)

### 1. Client-Side Metrics

#### Memory Usage
- **Client Memory Consumption**: `<50MB per client`
- **Priority Bucket Size**: `≤200 events`
- **Regular Bucket Size**: `≤100 events`
- **Total Display Events**: `≤250 events`
- **Memory Efficiency**: `<200KB per event average`

#### Performance Metrics
- **Event Classification Time**: `<1ms per event`
- **Bucket Switch Time**: `<10ms`
- **Rendering FPS**: `≥50fps (target 60fps)`
- **Frame Drop Rate**: `<2%`

### 2. Server-Side Metrics

#### Database Performance
- **Priority Query Time**: `<100ms (95th percentile)`
- **Insert Throughput**: `≥1000 events/second`
- **Index Efficiency**: `Query time 10x faster with indexes`
- **Connection Pool Usage**: `<80% utilization`

#### Memory Management
- **Server Memory Growth**: `<50MB per 1000 events`
- **Memory Leak Rate**: `<10% growth over 24 hours`
- **Garbage Collection Efficiency**: `≥80% memory recovery`

#### WebSocket Performance
- **Message Overhead**: `<5% from priority metadata`
- **Broadcast Latency**: `<10ms`
- **Connection Concurrency**: `Support 1000+ concurrent clients`
- **Message Queue Size**: `<25MB`

### 3. System-Wide Metrics

#### Event Processing
- **Priority Classification Accuracy**: `>99%`
- **Event Retention Compliance**: `24h priority, 4h regular`
- **Dual-Bucket Balance**: `Priority events preserved during overflow`
- **End-to-End Latency**: `<100ms from insert to client display`

## Monitoring Implementation

### 1. Application Metrics Collection

#### Client-Side Instrumentation

```typescript
// Client memory monitoring
class ClientPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    memoryUsage: 0,
    eventCounts: { priority: 0, regular: 0, total: 0 },
    renderingStats: { fps: 0, frameDrops: 0 },
    lastCleanup: Date.now()
  };

  startMonitoring(): void {
    // Memory monitoring every 30 seconds
    setInterval(() => {
      this.collectMemoryMetrics();
    }, 30000);

    // Performance monitoring every 5 seconds
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 5000);

    // Send metrics to monitoring system every minute
    setInterval(() => {
      this.sendMetrics();
    }, 60000);
  }

  private collectMemoryMetrics(): void {
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
    
    // Monitor bucket sizes
    const priorityBucket = this.getPriorityBucket();
    const regularBucket = this.getRegularBucket();
    
    this.metrics.eventCounts = {
      priority: priorityBucket.length,
      regular: regularBucket.length,
      total: priorityBucket.length + regularBucket.length
    };

    // Alert if memory limit exceeded
    if (this.metrics.memoryUsage > 50 * 1024 * 1024) {
      this.sendAlert('CLIENT_MEMORY_LIMIT_EXCEEDED', {
        current: this.metrics.memoryUsage,
        limit: 50 * 1024 * 1024
      });
    }
  }

  private collectPerformanceMetrics(): void {
    // Collect FPS and frame drop metrics
    if ('getEntriesByType' in performance) {
      const entries = performance.getEntriesByType('measure');
      // Process rendering performance entries
      this.calculateFPS(entries);
    }
  }

  private sendMetrics(): void {
    // Send to monitoring system (Prometheus, DataDog, etc.)
    fetch('/api/metrics/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        clientId: this.getClientId(),
        metrics: this.metrics
      })
    });
  }
}
```

#### Server-Side Instrumentation

```typescript
// Server performance monitoring
class ServerPerformanceMonitor {
  private db: Database;
  private metrics: ServerMetrics = {
    queryTimes: [],
    memoryUsage: process.memoryUsage(),
    eventCounts: { priority: 0, regular: 0 },
    connectionCount: 0,
    lastReset: Date.now()
  };

  constructor(database: Database) {
    this.db = database;
    this.startMonitoring();
  }

  // Instrument database queries
  instrumentQuery<T>(queryName: string, query: () => T): T {
    const startTime = performance.now();
    try {
      const result = query();
      const duration = performance.now() - startTime;
      
      this.recordQueryTime(queryName, duration);
      
      // Alert on slow queries
      if (duration > 100) {
        this.sendAlert('SLOW_QUERY_DETECTED', {
          queryName,
          duration,
          threshold: 100
        });
      }
      
      return result;
    } catch (error) {
      this.sendAlert('QUERY_ERROR', { queryName, error: String(error) });
      throw error;
    }
  }

  // Monitor priority event processing
  monitorEventInsertion(event: HookEvent): void {
    const priority = this.calculateEventPriority(event.hook_event_type);
    
    if (priority > 0) {
      this.metrics.eventCounts.priority++;
    } else {
      this.metrics.eventCounts.regular++;
    }

    // Check event processing rate
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const recentEvents = this.getRecentEventCount(timeWindow);
    
    if (recentEvents > 60000) { // More than 1000 events/second sustained
      this.sendAlert('HIGH_EVENT_RATE', {
        eventsPerMinute: recentEvents,
        threshold: 60000
      });
    }
  }

  // Monitor WebSocket connections
  monitorWebSocketConnection(action: 'connect' | 'disconnect'): void {
    if (action === 'connect') {
      this.metrics.connectionCount++;
    } else {
      this.metrics.connectionCount--;
    }

    // Alert on connection limits
    if (this.metrics.connectionCount > 1000) {
      this.sendAlert('HIGH_CONNECTION_COUNT', {
        current: this.metrics.connectionCount,
        threshold: 1000
      });
    }
  }

  private startMonitoring(): void {
    // Memory monitoring every 30 seconds
    setInterval(() => {
      this.collectMemoryMetrics();
    }, 30000);

    // Performance summary every 5 minutes
    setInterval(() => {
      this.generatePerformanceSummary();
    }, 300000);
  }

  private collectMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage;

    // Alert on memory growth
    const memoryGrowth = memUsage.heapUsed - this.metrics.memoryUsage.heapUsed;
    if (memoryGrowth > 100 * 1024 * 1024) { // 100MB growth
      this.sendAlert('MEMORY_GROWTH_DETECTED', {
        growth: memoryGrowth,
        current: memUsage.heapUsed
      });
    }
  }
}
```

### 2. Prometheus Metrics Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "priority_bucket_alerts.yml"

scrape_configs:
  - job_name: 'priority-event-system'
    static_configs:
      - targets: ['localhost:4000']
    scrape_interval: 5s
    metrics_path: '/metrics'

  - job_name: 'client-metrics'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 30s
    metrics_path: '/api/metrics'
```

### 3. Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Priority Event Buckets - Production Monitoring",
    "panels": [
      {
        "title": "Client Memory Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "avg(client_memory_usage_bytes) / 1024 / 1024",
            "legendFormat": "Average Memory (MB)"
          }
        ],
        "thresholds": {
          "steps": [
            { "color": "green", "value": 0 },
            { "color": "yellow", "value": 40 },
            { "color": "red", "value": 50 }
          ]
        }
      },
      {
        "title": "Database Query Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, database_query_duration_seconds_bucket)",
            "legendFormat": "95th Percentile"
          },
          {
            "expr": "histogram_quantile(0.50, database_query_duration_seconds_bucket)",
            "legendFormat": "50th Percentile"
          }
        ],
        "yAxes": [
          {
            "max": 0.2,
            "unit": "s"
          }
        ]
      },
      {
        "title": "Event Processing Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(priority_events_total[5m])",
            "legendFormat": "Priority Events/sec"
          },
          {
            "expr": "rate(regular_events_total[5m])",
            "legendFormat": "Regular Events/sec"
          }
        ]
      },
      {
        "title": "WebSocket Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "websocket_message_overhead_ratio",
            "legendFormat": "Message Overhead %"
          },
          {
            "expr": "avg(websocket_broadcast_latency_ms)",
            "legendFormat": "Broadcast Latency (ms)"
          }
        ]
      }
    ]
  }
}
```

## Alerting Rules

### 1. Critical Alerts (Immediate Response Required)

```yaml
# priority_bucket_alerts.yml
groups:
  - name: priority_buckets_critical
    rules:
      - alert: ClientMemoryLimitExceeded
        expr: client_memory_usage_bytes > 52428800  # 50MB
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Client memory usage exceeded 50MB limit"
          description: "Client {{ $labels.client_id }} memory usage is {{ $value | humanize }} bytes"

      - alert: DatabaseQueryTooSlow
        expr: histogram_quantile(0.95, database_query_duration_seconds_bucket) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database queries too slow"
          description: "95th percentile query time is {{ $value }}s, exceeding 100ms limit"

      - alert: EventProcessingStalled
        expr: rate(events_processed_total[5m]) == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Event processing has stalled"
          description: "No events processed in the last 5 minutes"

      - alert: MemoryLeakDetected
        expr: increase(process_memory_usage_bytes[1h]) > 104857600  # 100MB/hour
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "Potential memory leak detected"
          description: "Memory usage increased by {{ $value | humanize }} bytes in 1 hour"
```

### 2. Warning Alerts (Investigation Required)

```yaml
  - name: priority_buckets_warning
    rules:
      - alert: HighPriorityEventRatio
        expr: (rate(priority_events_total[10m]) / rate(events_total[10m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High ratio of priority events"
          description: "{{ $value | humanizePercentage }} of events are priority events"

      - alert: WebSocketOverheadHigh
        expr: websocket_message_overhead_ratio > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket message overhead too high"
          description: "Message overhead is {{ $value | humanizePercentage }}, exceeding 5% limit"

      - alert: LowEventThroughput
        expr: rate(events_processed_total[5m]) < 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Event processing throughput below target"
          description: "Processing {{ $value }} events/second, below 1000 target"

      - alert: HighConnectionCount
        expr: websocket_connections_active > 800
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of WebSocket connections"
          description: "{{ $value }} active connections, approaching 1000 limit"
```

## Health Checks

### 1. Application Health Endpoints

```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: Date.now(),
    checks: {
      database: checkDatabaseHealth(),
      memory: checkMemoryHealth(),
      priority_system: checkPrioritySystemHealth(),
      websocket: checkWebSocketHealth()
    }
  };

  const allHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  health.status = allHealthy ? 'healthy' : 'unhealthy';

  res.status(allHealthy ? 200 : 503).json(health);
});

function checkDatabaseHealth() {
  try {
    const start = performance.now();
    db.prepare('SELECT 1').get();
    const duration = performance.now() - start;

    return {
      status: duration < 100 ? 'healthy' : 'degraded',
      responseTime: duration,
      details: { threshold: 100 }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: String(error)
    };
  }
}

function checkMemoryHealth() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  return {
    status: heapUsedMB < 1000 ? 'healthy' : 'unhealthy',
    heapUsedMB,
    details: { threshold: 1000 }
  };
}

function checkPrioritySystemHealth() {
  try {
    // Test priority classification
    const testEvent = {
      hook_event_type: 'UserPromptSubmit',
      source_app: 'health-check',
      session_id: 'health-check',
      payload: { test: true },
      timestamp: Date.now()
    };

    const start = performance.now();
    const priority = calculateEventPriority(testEvent.hook_event_type);
    const duration = performance.now() - start;

    return {
      status: priority === 1 && duration < 10 ? 'healthy' : 'unhealthy',
      classificationTime: duration,
      details: { expectedPriority: 1, actualPriority: priority }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: String(error)
    };
  }
}

function checkWebSocketHealth() {
  return {
    status: wsClients.size < 1000 ? 'healthy' : 'degraded',
    activeConnections: wsClients.size,
    details: { threshold: 1000 }
  };
}
```

### 2. Kubernetes Readiness and Liveness Probes

```yaml
# kubernetes-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: priority-event-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: priority-event-system
  template:
    metadata:
      labels:
        app: priority-event-system
    spec:
      containers:
      - name: app
        image: priority-event-system:latest
        ports:
        - containerPort: 4000
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## Performance Regression Detection

### 1. Automated Performance Testing

```bash
#!/bin/bash
# performance-check.sh - CI/CD performance validation

echo "🔍 Running Performance Regression Tests..."

# Run performance test suite
bun run scripts/performance-regression-testing.ts ci

PERFORMANCE_EXIT_CODE=$?

if [ $PERFORMANCE_EXIT_CODE -ne 0 ]; then
    echo "❌ Performance regression detected!"
    echo "📊 Check performance-report.json for details"
    exit 1
else
    echo "✅ Performance tests passed"
fi

# Optional: Update baseline if on main branch
if [ "$CI_BRANCH" = "main" ]; then
    echo "📊 Updating performance baseline..."
    bun run scripts/performance-regression-testing.ts baseline
fi
```

### 2. CI/CD Integration

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: |
        cd apps/server && bun install
        cd ../client && bun install
        
    - name: Run performance tests
      run: |
        cd apps/server
        bun run test:performance
        
    - name: Check regression
      run: |
        bun run scripts/performance-regression-testing.ts ci
        
    - name: Upload performance report
      uses: actions/upload-artifact@v2
      if: always()
      with:
        name: performance-report
        path: performance-report.json
```

## Troubleshooting Guide

### 1. Common Performance Issues

#### High Client Memory Usage
- **Symptoms**: Client memory >50MB, browser slowdown
- **Investigation**: Check bucket sizes, event cleanup frequency
- **Resolution**: Increase cleanup frequency, reduce event retention

#### Slow Database Queries
- **Symptoms**: Query time >100ms, high database CPU
- **Investigation**: Check index usage, query execution plans
- **Resolution**: Optimize indexes, adjust query patterns

#### High WebSocket Overhead
- **Symptoms**: Message overhead >5%, increased bandwidth usage
- **Investigation**: Review priority metadata size, message frequency
- **Resolution**: Optimize metadata structure, batch messages

### 2. Escalation Procedures

#### Severity Levels
1. **Critical**: System unavailable, data loss risk
   - Response time: 15 minutes
   - Escalation: On-call engineer immediately

2. **High**: Performance degradation affecting users
   - Response time: 1 hour
   - Escalation: Engineering team lead

3. **Medium**: Metrics approaching thresholds
   - Response time: 4 hours
   - Escalation: Product team

4. **Low**: Minor performance variations
   - Response time: Next business day
   - Escalation: Development team

## Monitoring Tools Integration

### 1. Recommended Stack
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **APM**: Datadog, New Relic, or AppDynamics
- **Alerting**: PagerDuty, OpsGenie

### 2. Cost Optimization
- Use sampling for high-volume metrics
- Implement metric retention policies
- Archive historical data to cold storage
- Monitor monitoring infrastructure costs

## Maintenance Schedule

### Daily
- Review critical alerts and trends
- Check system health dashboard
- Validate performance metrics within SLA

### Weekly
- Analyze performance trends
- Review alert configurations
- Update monitoring documentation

### Monthly
- Performance baseline review
- Capacity planning assessment
- Monitoring tool maintenance

### Quarterly
- Complete performance audit
- Review and update thresholds
- Disaster recovery testing