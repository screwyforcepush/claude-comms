/**
 * Visual Regression Tests for Matrix Mode
 * Tests visual rendering, animations, and UI consistency
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const MATRIX_MODE_SELECTORS = {
  toggleButton: '[data-testid="matrix-mode-toggle"]',
  canvas: '[data-testid="matrix-rain-canvas"]',
  timeline: '[data-testid="event-timeline"]',
  performanceMonitor: '[data-testid="performance-monitor"]',
  qualityIndicator: '[data-testid="quality-indicator"]'
};

const VISUAL_TEST_CONFIG = {
  threshold: 0.05, // 5% difference tolerance
  maxDiffPixels: 100,
  animations: 'disabled' as const
};

const SCREENSHOT_OPTIONS = {
  fullPage: false,
  clip: { x: 0, y: 0, width: 1200, height: 800 },
  timeout: 10000
};

/**
 * Setup Matrix Mode for testing
 */
async function setupMatrixMode(page: Page, options: {
  enableMatrix?: boolean;
  mockEvents?: boolean;
  eventCount?: number;
} = {}) {
  const { enableMatrix = false, mockEvents = true, eventCount = 50 } = options;

  // Navigate to the test page
  await page.goto('/');
  
  // Wait for timeline to load
  await page.waitForSelector(MATRIX_MODE_SELECTORS.timeline, { timeout: 10000 });
  
  // Inject mock event data if requested
  if (mockEvents) {
    await page.evaluate((count) => {
      // Mock WebSocket with test events
      const mockEvents = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        source_app: 'client',
        session_id: `session-${Math.floor(i / 10) + 1}`,
        hook_event_type: ['pre_response', 'post_response', 'tool_use', 'error'][i % 4],
        payload: { agentName: `Agent${Math.floor(i / 5) + 1}` },
        timestamp: Date.now() - (count - i) * 1000
      }));
      
      // Store events for Matrix mode to consume
      (window as any).__mockEvents = mockEvents;
      
      // Trigger initial event load
      if ((window as any).__timeline) {
        (window as any).__timeline.setEvents(mockEvents);
      }
    }, eventCount);
  }
  
  // Enable Matrix mode if requested
  if (enableMatrix) {
    await enableMatrixMode(page);
  }
}

/**
 * Enable Matrix Mode with animation wait
 */
async function enableMatrixMode(page: Page) {
  const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
  await toggleButton.click();
  
  // Wait for transition to complete
  await page.waitForTimeout(2000);
  
  // Verify Matrix mode is active
  await expect(page.locator(MATRIX_MODE_SELECTORS.canvas)).toBeVisible();
}

/**
 * Disable Matrix Mode with animation wait
 */
async function disableMatrixMode(page: Page) {
  const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
  await toggleButton.click();
  
  // Wait for transition to complete
  await page.waitForTimeout(2000);
  
  // Verify normal timeline is visible
  await expect(page.locator(MATRIX_MODE_SELECTORS.timeline)).toBeVisible();
}

/**
 * Wait for Matrix rain to stabilize
 */
async function waitForMatrixStabilization(page: Page, timeout = 5000) {
  // Wait for animation to reach steady state
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="matrix-rain-canvas"]') as HTMLCanvasElement;
    if (!canvas) return false;
    
    // Check if Matrix renderer is active and has drops
    const matrixMode = (window as any).__matrixMode;
    return matrixMode && matrixMode.getDropCount && matrixMode.getDropCount() > 0;
  }, { timeout });
  
  // Additional wait for visual stabilization
  await page.waitForTimeout(1000);
}

test.describe('Matrix Mode Visual Regression', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Disable animations for consistent screenshots
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--animation-duration', '0s');
    });
  });

  test.describe('Toggle Button Visual States', () => {
    
    test('toggle button default state', async ({ page }) => {
      await setupMatrixMode(page);
      
      const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
      await expect(toggleButton).toBeVisible();
      
      await expect(toggleButton).toHaveScreenshot('matrix-toggle-default.png', VISUAL_TEST_CONFIG);
    });

    test('toggle button hover state', async ({ page }) => {
      await setupMatrixMode(page);
      
      const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
      await toggleButton.hover();
      
      await expect(toggleButton).toHaveScreenshot('matrix-toggle-hover.png', VISUAL_TEST_CONFIG);
    });

    test('toggle button active state', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true });
      
      const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
      
      await expect(toggleButton).toHaveScreenshot('matrix-toggle-active.png', VISUAL_TEST_CONFIG);
    });

    test('toggle button focus state', async ({ page }) => {
      await setupMatrixMode(page);
      
      const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
      await toggleButton.focus();
      
      await expect(toggleButton).toHaveScreenshot('matrix-toggle-focus.png', VISUAL_TEST_CONFIG);
    });
  });

  test.describe('Matrix Canvas Rendering', () => {
    
    test('matrix canvas initial render', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 20 });
      await waitForMatrixStabilization(page);
      
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      await expect(canvas).toHaveScreenshot('matrix-canvas-initial.png', VISUAL_TEST_CONFIG);
    });

    test('matrix canvas with moderate load', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 100 });
      await waitForMatrixStabilization(page);
      
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      await expect(canvas).toHaveScreenshot('matrix-canvas-moderate.png', VISUAL_TEST_CONFIG);
    });

    test('matrix canvas with high load', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 500 });
      await waitForMatrixStabilization(page);
      
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      await expect(canvas).toHaveScreenshot('matrix-canvas-high-load.png', VISUAL_TEST_CONFIG);
    });

    test('matrix canvas character rendering accuracy', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 50 });
      await waitForMatrixStabilization(page);
      
      // Focus on a specific area for character detail validation
      const canvasSection = page.locator(MATRIX_MODE_SELECTORS.canvas);
      
      await expect(canvasSection).toHaveScreenshot('matrix-characters-detail.png', {
        ...VISUAL_TEST_CONFIG,
        threshold: 0.02, // Higher precision for character rendering
        clip: { x: 0, y: 0, width: 400, height: 300 }
      });
    });
  });

  test.describe('Mode Transitions', () => {
    
    test('normal to matrix transition', async ({ page }) => {
      await setupMatrixMode(page, { eventCount: 30 });
      
      // Capture normal mode
      await expect(page.locator(MATRIX_MODE_SELECTORS.timeline)).toHaveScreenshot(
        'transition-normal-mode.png', 
        VISUAL_TEST_CONFIG
      );
      
      // Start transition
      await page.locator(MATRIX_MODE_SELECTORS.toggleButton).click();
      
      // Capture mid-transition (if visible)
      await page.waitForTimeout(500);
      
      // Wait for completion and capture Matrix mode
      await waitForMatrixStabilization(page);
      await expect(page.locator(MATRIX_MODE_SELECTORS.canvas)).toHaveScreenshot(
        'transition-matrix-mode.png', 
        VISUAL_TEST_CONFIG
      );
    });

    test('matrix to normal transition', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 30 });
      await waitForMatrixStabilization(page);
      
      // Capture Matrix mode
      await expect(page.locator(MATRIX_MODE_SELECTORS.canvas)).toHaveScreenshot(
        'reverse-transition-matrix.png', 
        VISUAL_TEST_CONFIG
      );
      
      // Start transition back
      await disableMatrixMode(page);
      
      // Capture normal mode
      await expect(page.locator(MATRIX_MODE_SELECTORS.timeline)).toHaveScreenshot(
        'reverse-transition-normal.png', 
        VISUAL_TEST_CONFIG
      );
    });
  });

  test.describe('Visual Effects', () => {
    
    test('character trail effects', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 20 });
      await waitForMatrixStabilization(page);
      
      // Focus on trail effect area
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      
      await expect(canvas).toHaveScreenshot('matrix-trail-effects.png', {
        ...VISUAL_TEST_CONFIG,
        clip: { x: 200, y: 100, width: 800, height: 600 }
      });
    });

    test('spawn effect visualization', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 5 });
      
      // Trigger new event spawn
      await page.evaluate(() => {
        const matrixMode = (window as any).__matrixMode;
        if (matrixMode && matrixMode.addEvent) {
          matrixMode.addEvent({
            id: Date.now(),
            source_app: 'client',
            session_id: 'new-session',
            hook_event_type: 'pre_response',
            payload: { agentName: 'NewAgent' },
            timestamp: Date.now()
          });
        }
      });
      
      // Capture spawn effect
      await page.waitForTimeout(500);
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      
      await expect(canvas).toHaveScreenshot('matrix-spawn-effect.png', VISUAL_TEST_CONFIG);
    });

    test('error event glow effect', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 10 });
      
      // Add error event
      await page.evaluate(() => {
        const matrixMode = (window as any).__matrixMode;
        if (matrixMode && matrixMode.addEvent) {
          matrixMode.addEvent({
            id: Date.now(),
            source_app: 'client',
            session_id: 'error-session',
            hook_event_type: 'error',
            payload: { agentName: 'ErrorAgent', error: 'Test error' },
            timestamp: Date.now()
          });
        }
      });
      
      await page.waitForTimeout(1000);
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      
      await expect(canvas).toHaveScreenshot('matrix-error-glow.png', VISUAL_TEST_CONFIG);
    });
  });

  test.describe('Performance Indicators', () => {
    
    test('performance monitor display', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 200 });
      await waitForMatrixStabilization(page);
      
      const perfMonitor = page.locator(MATRIX_MODE_SELECTORS.performanceMonitor);
      if (await perfMonitor.isVisible()) {
        await expect(perfMonitor).toHaveScreenshot('performance-monitor.png', VISUAL_TEST_CONFIG);
      }
    });

    test('quality indicator states', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 800 });
      await waitForMatrixStabilization(page);
      
      // Quality should adapt under high load
      const qualityIndicator = page.locator(MATRIX_MODE_SELECTORS.qualityIndicator);
      if (await qualityIndicator.isVisible()) {
        await expect(qualityIndicator).toHaveScreenshot('quality-indicator-adapted.png', VISUAL_TEST_CONFIG);
      }
    });
  });

  test.describe('Cross-Browser Consistency', () => {
    
    test('matrix rendering cross-browser baseline', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 50 });
      await waitForMatrixStabilization(page);
      
      // Full view for cross-browser comparison
      await expect(page).toHaveScreenshot('matrix-cross-browser-baseline.png', {
        ...VISUAL_TEST_CONFIG,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
    });

    test('font rendering consistency', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 30 });
      await waitForMatrixStabilization(page);
      
      // Focus on character rendering for font consistency
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      
      await expect(canvas).toHaveScreenshot('font-rendering-consistency.png', {
        ...VISUAL_TEST_CONFIG,
        threshold: 0.01, // Very strict for font rendering
        clip: { x: 100, y: 100, width: 600, height: 400 }
      });
    });
  });

  test.describe('Responsive Design', () => {
    
    test('matrix mode mobile view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 20 });
      await waitForMatrixStabilization(page);
      
      await expect(page).toHaveScreenshot('matrix-mobile-view.png', {
        ...VISUAL_TEST_CONFIG,
        fullPage: false
      });
    });

    test('matrix mode tablet view', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 40 });
      await waitForMatrixStabilization(page);
      
      await expect(page).toHaveScreenshot('matrix-tablet-view.png', {
        ...VISUAL_TEST_CONFIG,
        fullPage: false
      });
    });

    test('matrix mode desktop large view', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 100 });
      await waitForMatrixStabilization(page);
      
      await expect(page).toHaveScreenshot('matrix-desktop-large.png', {
        ...VISUAL_TEST_CONFIG,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
    });
  });

  test.describe('Accessibility Visual Validation', () => {
    
    test('high contrast mode compatibility', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ forcedColors: 'active' });
      
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 30 });
      await waitForMatrixStabilization(page);
      
      await expect(page).toHaveScreenshot('matrix-high-contrast.png', VISUAL_TEST_CONFIG);
    });

    test('reduced motion respect', async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 30 });
      
      // Matrix mode should show static or minimal animation
      await expect(page).toHaveScreenshot('matrix-reduced-motion.png', VISUAL_TEST_CONFIG);
    });

    test('focus indicators visibility', async ({ page }) => {
      await setupMatrixMode(page);
      
      // Tab to focus the toggle button
      await page.keyboard.press('Tab');
      
      const toggleButton = page.locator(MATRIX_MODE_SELECTORS.toggleButton);
      await expect(toggleButton).toHaveScreenshot('focus-indicator-visible.png', VISUAL_TEST_CONFIG);
    });
  });

  test.describe('Edge Cases and Error States', () => {
    
    test('empty state visualization', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, mockEvents: false });
      
      // Should show empty Matrix rain or placeholder
      const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
      await expect(canvas).toHaveScreenshot('matrix-empty-state.png', VISUAL_TEST_CONFIG);
    });

    test('loading state visual', async ({ page }) => {
      await page.goto('/');
      
      // Capture loading state before data arrives
      await expect(page).toHaveScreenshot('matrix-loading-state.png', {
        ...VISUAL_TEST_CONFIG,
        timeout: 2000
      });
    });

    test('error state handling', async ({ page }) => {
      await setupMatrixMode(page);
      
      // Inject Canvas error
      await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="matrix-rain-canvas"]') as HTMLCanvasElement;
        if (canvas) {
          // Simulate Canvas context error
          (canvas as any).__contextError = true;
        }
      });
      
      await enableMatrixMode(page);
      
      // Should show error state or fallback
      await expect(page).toHaveScreenshot('matrix-error-state.png', VISUAL_TEST_CONFIG);
    });
  });

  test.describe('Animation Consistency', () => {
    
    test('frame-by-frame animation stability', async ({ page }) => {
      await setupMatrixMode(page, { enableMatrix: true, eventCount: 50 });
      await waitForMatrixStabilization(page);
      
      // Capture multiple frames to verify consistency
      const screenshots: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(100); // 6fps sampling
        screenshots.push(`matrix-frame-${i}.png`);
        
        const canvas = page.locator(MATRIX_MODE_SELECTORS.canvas);
        await expect(canvas).toHaveScreenshot(screenshots[i], {
          threshold: 0.1, // Allow for animation differences
          maxDiffPixels: 1000
        });
      }
    });

    test('transition smoothness validation', async ({ page }) => {
      await setupMatrixMode(page, { eventCount: 30 });
      
      // Enable animations for this test
      await page.addInitScript(() => {
        document.documentElement.style.removeProperty('--animation-duration');
      });
      
      // Capture transition states
      await page.locator(MATRIX_MODE_SELECTORS.toggleButton).click();
      
      // Mid-transition capture
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('transition-midpoint.png', {
        threshold: 0.2, // Allow for transition variations
        maxDiffPixels: 2000
      });
    });
  });
});

test.describe('Matrix Mode Visual Regression - Real Data', () => {
  
  test('with real WebSocket events', async ({ page }) => {
    // This test would connect to actual WebSocket for real data testing
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Enable Matrix mode with real events
    await enableMatrixMode(page);
    
    // Wait for real events to populate
    await page.waitForTimeout(5000);
    
    await expect(page.locator(MATRIX_MODE_SELECTORS.canvas)).toHaveScreenshot(
      'matrix-real-events.png', 
      {
        threshold: 0.1, // More tolerance for real data variation
        maxDiffPixels: 500
      }
    );
  });
});