<template>
  <div class="performance-tester bg-gray-800 rounded-lg border border-blue-400/30 p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Performance Testing Suite</h2>
        <p class="text-gray-400 text-sm mt-1">Benchmark timeline performance against requirements</p>
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="runQuickTest"
          :disabled="isRunning"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isRunning ? 'Running...' : 'Quick Test' }}
        </button>
        <button
          @click="runFullSuite"
          :disabled="isRunning"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isRunning ? 'Running...' : 'Full Suite' }}
        </button>
      </div>
    </div>

    <!-- Current Test Status -->
    <div v-if="currentTest" class="mb-6 p-4 bg-blue-900/20 border border-blue-400/20 rounded">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-blue-400">{{ currentTest.name }}</h3>
          <p class="text-gray-400 text-sm">{{ currentTest.description }}</p>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-white">{{ Math.round(currentMetrics.frameRate) }}</div>
            <div class="text-xs text-gray-400">FPS</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-white">{{ currentMetrics.memoryUsage.toFixed(1) }}</div>
            <div class="text-xs text-gray-400">MB</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-white">{{ timeRemaining }}</div>
            <div class="text-xs text-gray-400">Remaining</div>
          </div>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div class="mt-4">
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-1000"
            :style="{ width: `${testProgress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="lastSuiteResult" class="mb-6">
      <h3 class="text-lg font-semibold text-white mb-4">Latest Results</h3>
      
      <!-- Overall Status -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-900 rounded p-4 text-center">
          <div class="text-2xl font-bold" :class="overallStatus.color">
            {{ lastSuiteResult.results ? lastSuiteResult.results.filter(r => r.passed).length : 0 }}
            /
            {{ lastSuiteResult.results ? lastSuiteResult.results.length : 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">Tests Passed</div>
        </div>
        
        <div class="bg-gray-900 rounded p-4 text-center">
          <div class="text-2xl font-bold text-white">
            {{ lastSuiteResult.results ? Math.round(avgFrameRate) : 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">Avg FPS</div>
        </div>
        
        <div class="bg-gray-900 rounded p-4 text-center">
          <div class="text-2xl font-bold text-white">
            {{ lastSuiteResult.results ? maxMemoryUsage.toFixed(1) : 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">Peak Memory (MB)</div>
        </div>
        
        <div class="bg-gray-900 rounded p-4 text-center">
          <div class="text-2xl font-bold text-white">
            {{ lastSuiteResult.results ? Math.round(totalDuration / 1000) : 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">Total Time (s)</div>
        </div>
      </div>
      
      <!-- Test Results Details -->
      <div class="space-y-3">
        <div 
          v-for="result in lastSuiteResult.results" 
          :key="result.testName"
          class="bg-gray-900 rounded p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-semibold text-white flex items-center">
                <span :class="result.passed ? 'text-green-400' : 'text-red-400'" class="mr-2">
                  {{ result.passed ? '✅' : '❌' }}
                </span>
                {{ result.testName }}
              </h4>
              <p class="text-gray-400 text-sm">
                {{ result.metrics.sessionCount }} sessions, {{ result.metrics.agentCount }} agents
              </p>
            </div>
            <div class="text-right">
              <div class="text-lg font-semibold text-white">
                {{ result.metrics.frameRate.toFixed(1) }}fps
              </div>
              <div class="text-sm text-gray-400">
                {{ result.metrics.memoryUsage.toFixed(1) }}MB
              </div>
            </div>
          </div>
          
          <!-- Requirement Checks -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Frame Rate:</span>
              <span :class="result.metrics.frameRate >= result.requirements.minFrameRate ? 'text-green-400' : 'text-red-400'">
                {{ result.metrics.frameRate.toFixed(1) }}/{{ result.requirements.minFrameRate }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Memory:</span>
              <span :class="result.metrics.memoryUsage <= result.requirements.maxMemoryMB ? 'text-green-400' : 'text-red-400'">
                {{ result.metrics.memoryUsage.toFixed(1) }}/{{ result.requirements.maxMemoryMB }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">CPU:</span>
              <span :class="result.metrics.cpuUsage <= result.requirements.maxCpuPercent ? 'text-green-400' : 'text-red-400'">
                {{ result.metrics.cpuUsage.toFixed(1) }}/{{ result.requirements.maxCpuPercent }}%
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Render:</span>
              <span :class="result.metrics.renderTime <= result.requirements.maxRenderTimeMs ? 'text-green-400' : 'text-red-400'">
                {{ result.metrics.renderTime.toFixed(0) }}/{{ result.requirements.maxRenderTimeMs }}ms
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="mt-6 flex items-center space-x-3">
        <button
          @click="exportResults"
          class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
        >
          📄 Export Results
        </button>
        <button
          @click="clearResults"
          class="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          🗑️ Clear
        </button>
        <div class="text-xs text-gray-400">
          Last run: {{ new Date(lastSuiteResult.timestamp || 0).toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- Device Info -->
    <div class="mt-6 p-4 bg-gray-900 rounded text-sm">
      <h4 class="text-white font-semibold mb-2">Device Information</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
        <div>
          <strong>Browser:</strong> {{ deviceInfo.browser }}
        </div>
        <div>
          <strong>Platform:</strong> {{ deviceInfo.platform }}
        </div>
        <div>
          <strong>Memory:</strong> {{ deviceInfo.memory }}
        </div>
        <div>
          <strong>GPU Acceleration:</strong> 
          <span :class="deviceInfo.gpuSupported ? 'text-green-400' : 'text-red-400'">
            {{ deviceInfo.gpuSupported ? 'Supported' : 'Not Available' }}
          </span>
        </div>
        <div>
          <strong>Screen:</strong> {{ deviceInfo.screen }}
        </div>
        <div>
          <strong>Performance API:</strong>
          <span :class="deviceInfo.performanceApi ? 'text-green-400' : 'text-red-400'">
            {{ deviceInfo.performanceApi ? 'Available' : 'Limited' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { benchmarkRunner, quickPerformanceCheck, type BenchmarkSuite } from '../utils/performanceBenchmark';
import { supportsGpuAcceleration } from '../composables/usePerformanceOptimizer';

// ============================================================================
// Reactive State
// ============================================================================

const isRunning = ref(false);
const currentTest = ref<any>(null);
const currentMetrics = ref({
  frameRate: 0,
  memoryUsage: 0,
  cpuUsage: 0
});
const testProgress = ref(0);
const timeRemaining = ref('');
const lastSuiteResult = ref<BenchmarkSuite | null>(null);

// ============================================================================
// Device Information
// ============================================================================

const deviceInfo = ref({
  browser: '',
  platform: navigator.platform,
  memory: '',
  gpuSupported: false,
  screen: '',
  performanceApi: false
});

// ============================================================================
// Computed Properties
// ============================================================================

const overallStatus = computed(() => {
  if (!lastSuiteResult.value?.results) {
    return { color: 'text-gray-400' };
  }
  
  const passed = lastSuiteResult.value.results.filter(r => r.passed).length;
  const total = lastSuiteResult.value.results.length;
  const percentage = passed / total;
  
  if (percentage === 1) {
    return { color: 'text-green-400' };
  } else if (percentage >= 0.7) {
    return { color: 'text-yellow-400' };
  } else {
    return { color: 'text-red-400' };
  }
});

const avgFrameRate = computed(() => {
  if (!lastSuiteResult.value?.results) return 0;
  
  const total = lastSuiteResult.value.results.reduce((sum, r) => sum + r.metrics.frameRate, 0);
  return total / lastSuiteResult.value.results.length;
});

const maxMemoryUsage = computed(() => {
  if (!lastSuiteResult.value?.results) return 0;
  
  return Math.max(...lastSuiteResult.value.results.map(r => r.metrics.memoryUsage));
});

const totalDuration = computed(() => {
  if (!lastSuiteResult.value?.results) return 0;
  
  return lastSuiteResult.value.results.reduce((sum, r) => sum + r.duration, 0);
});

// ============================================================================
// Test Runner Functions
// ============================================================================

const runQuickTest = async () => {
  if (isRunning.value) return;
  
  isRunning.value = true;
  currentTest.value = {
    name: 'Quick Performance Check',
    description: 'Fast validation of basic performance metrics'
  };
  
  try {
    // Simulate test progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      testProgress.value = Math.min(progress, 90);
      timeRemaining.value = `${Math.max(0, Math.ceil((100 - progress) / 10))}s`;
    }, 1000);
    
    // Run actual quick test
    const result = await quickPerformanceCheck();
    
    clearInterval(progressInterval);
    testProgress.value = 100;
    timeRemaining.value = '0s';
    
    // Create a mini suite result
    lastSuiteResult.value = {
      name: 'Quick Performance Test',
      description: 'Fast performance validation',
      tests: [],
      results: [{
        testName: 'Quick Test',
        passed: result.passed,
        metrics: {
          frameRate: 60, // Mock values - in real implementation these would come from the test
          memoryUsage: 150,
          cpuUsage: 25,
          renderTime: 100,
          sessionCount: 10,
          agentCount: 80
        },
        requirements: {
          minFrameRate: 30,
          maxMemoryMB: 400,
          maxCpuPercent: 70,
          maxRenderTimeMs: 500
        },
        timestamp: Date.now(),
        duration: 10000
      }],
      timestamp: Date.now()
    };
    
    console.log('Quick test result:', result);
    
  } catch (error) {
    console.error('Quick test failed:', error);
  } finally {
    isRunning.value = false;
    currentTest.value = null;
    setTimeout(() => {
      testProgress.value = 0;
      timeRemaining.value = '';
    }, 2000);
  }
};

const runFullSuite = async () => {
  if (isRunning.value) return;
  
  isRunning.value = true;
  
  try {
    const suite = benchmarkRunner.getDefaultSuite();
    const result = await benchmarkRunner.runSuite(suite);
    
    lastSuiteResult.value = {
      ...result,
      timestamp: Date.now()
    };
    
    console.log('Full suite completed:', result);
    
  } catch (error) {
    console.error('Full suite failed:', error);
  } finally {
    isRunning.value = false;
    currentTest.value = null;
    testProgress.value = 0;
    timeRemaining.value = '';
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

const exportResults = () => {
  if (!lastSuiteResult.value) return;
  
  const exportData = benchmarkRunner.exportResults(lastSuiteResult.value);
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-results-${new Date().toISOString().slice(0, 19)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const clearResults = () => {
  lastSuiteResult.value = null;
};

// ============================================================================
// Device Information Collection
// ============================================================================

const collectDeviceInfo = () => {
  // Browser detection
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  // Memory information
  let memory = 'Unknown';
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    memory = `${Math.round(mem.jsHeapSizeLimit / (1024 * 1024))}MB limit`;
  }
  
  // Screen information
  const screen = `${window.screen.width}×${window.screen.height}`;
  
  deviceInfo.value = {
    browser,
    platform: navigator.platform,
    memory,
    gpuSupported: supportsGpuAcceleration(),
    screen,
    performanceApi: 'memory' in performance
  };
};

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  collectDeviceInfo();
  
  // Load any saved results from localStorage
  try {
    const savedResults = localStorage.getItem('performance-test-results');
    if (savedResults) {
      lastSuiteResult.value = JSON.parse(savedResults);
    }
  } catch (error) {
    console.warn('Failed to load saved performance results:', error);
  }
});

// Save results to localStorage when they change
import { watch } from 'vue';
watch(lastSuiteResult, (newResult) => {
  if (newResult) {
    try {
      localStorage.setItem('performance-test-results', JSON.stringify(newResult));
    } catch (error) {
      console.warn('Failed to save performance results:', error);
    }
  }
});
</script>

<style scoped>
.performance-tester {
  font-family: system-ui, -apple-system, sans-serif;
}

/* Smooth transitions for progress bars */
.transition-all {
  transition: all 0.3s ease;
}

/* Grid responsiveness */
@media (max-width: 768px) {
  .grid-cols-4 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .grid-cols-3 {
    grid-template-columns: repeat(1, 1fr);
  }
}
</style>