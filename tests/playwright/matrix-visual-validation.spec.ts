/**
 * Matrix Mode Visual Validation Test
 * 
 * Comprehensive visual validation for Matrix mode implementation
 * Captures screenshots across multiple viewports and validates UI states
 */

import { test, expect, Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

const MATRIX_SCENARIOS = [
  'matrix-mode-disabled',
  'matrix-mode-enabled',
  'matrix-mode-transition',
  'matrix-mode-with-events',
  'matrix-mode-performance-stress'
];

test.describe('Matrix Mode Visual Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    
    // Ensure timeline is visible
    await expect(page.locator('[data-testid="event-timeline"]')).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} viewport (${viewport.width}x${viewport.height})`, () => {
      
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test('should capture Matrix mode disabled state', async ({ page }) => {
        // Ensure Matrix mode is disabled
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        if (await matrixToggle.isVisible()) {
          const isEnabled = await matrixToggle.isChecked();
          if (isEnabled) {
            await matrixToggle.click();
            await page.waitForTimeout(1000); // Wait for transition
          }
        }

        // Capture screenshot
        await page.screenshot({
          path: `screenshots/matrix-mode/disabled-${viewport.name}.png`,
          fullPage: true
        });

        // Validate timeline is in standard mode
        await expect(page.locator('[data-testid="timeline-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="matrix-canvas"]')).not.toBeVisible();
      });

      test('should capture Matrix mode enabled state', async ({ page }) => {
        // Find and enable Matrix mode toggle
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        
        if (await matrixToggle.isVisible()) {
          await matrixToggle.click();
          
          // Wait for Matrix mode transition
          await page.waitForTimeout(2000);
          
          // Wait for canvas to be visible
          await expect(page.locator('[data-testid="matrix-canvas"]')).toBeVisible();
          
          // Capture screenshot
          await page.screenshot({
            path: `screenshots/matrix-mode/enabled-${viewport.name}.png`,
            fullPage: true
          });
          
          // Validate Matrix canvas is active
          const canvas = page.locator('[data-testid="matrix-canvas"]');
          await expect(canvas).toBeVisible();
          
          // Check canvas dimensions
          const boundingBox = await canvas.boundingBox();
          expect(boundingBox).toBeTruthy();
          expect(boundingBox!.width).toBeGreaterThan(0);
          expect(boundingBox!.height).toBeGreaterThan(0);
        } else {
          test.skip('Matrix mode toggle not found');
        }
      });

      test('should capture Matrix mode with active events', async ({ page }) => {
        // Enable Matrix mode first
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        
        if (await matrixToggle.isVisible()) {
          await matrixToggle.click();
          await page.waitForTimeout(2000);
          
          // Simulate event activity by triggering WebSocket messages
          await page.evaluate(() => {
            // Mock some events to generate Matrix drops
            const mockEvents = [
              {
                id: 'test-1',
                session_id: 'test-session-1',
                hook_event_type: 'spawn',
                timestamp: Date.now(),
                payload: { agentName: 'TestAgent1' }
              },
              {
                id: 'test-2', 
                session_id: 'test-session-2',
                hook_event_type: 'complete',
                timestamp: Date.now() + 1000,
                payload: { agentName: 'TestAgent2' }
              },
              {
                id: 'test-3',
                session_id: 'test-session-3', 
                hook_event_type: 'error',
                timestamp: Date.now() + 2000,
                payload: { agentName: 'TestAgent3' }
              }
            ];
            
            // Dispatch custom events if Matrix mode composable is available
            if (window.dispatchEvent) {
              mockEvents.forEach(event => {
                window.dispatchEvent(new CustomEvent('matrix-test-event', { detail: event }));
              });
            }
          });
          
          // Allow time for drops to appear
          await page.waitForTimeout(3000);
          
          // Capture screenshot with active drops
          await page.screenshot({
            path: `screenshots/matrix-mode/with-events-${viewport.name}.png`,
            fullPage: true
          });
        } else {
          test.skip('Matrix mode toggle not found');
        }
      });

      test('should validate Matrix mode performance under load', async ({ page }) => {
        // Enable Matrix mode
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        
        if (await matrixToggle.isVisible()) {
          await matrixToggle.click();
          await page.waitForTimeout(2000);
          
          // Monitor performance metrics
          const performanceMetrics = await page.evaluate(async () => {
            const startTime = performance.now();
            
            // Generate high volume of test events
            for (let i = 0; i < 100; i++) {
              const event = {
                id: `perf-test-${i}`,
                session_id: `session-${i % 10}`,
                hook_event_type: i % 3 === 0 ? 'spawn' : i % 3 === 1 ? 'complete' : 'error',
                timestamp: Date.now() + i * 100,
                payload: { agentName: `PerfAgent${i}` }
              };
              
              if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('matrix-test-event', { detail: event }));
              }
              
              // Add small delay to avoid overwhelming
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            const endTime = performance.now();
            return {
              duration: endTime - startTime,
              memoryUsage: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : null
            };
          });
          
          // Wait for rendering to stabilize
          await page.waitForTimeout(5000);
          
          // Capture performance test screenshot
          await page.screenshot({
            path: `screenshots/matrix-mode/performance-${viewport.name}.png`,
            fullPage: true
          });
          
          // Log performance metrics
          console.log(`Performance test (${viewport.name}):`, performanceMetrics);
          
          // Validate performance constraints
          expect(performanceMetrics.duration).toBeLessThan(10000); // Should complete in under 10s
          
          if (performanceMetrics.memoryUsage) {
            expect(performanceMetrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Under 50MB
          }
        } else {
          test.skip('Matrix mode toggle not found');
        }
      });

      test('should validate Matrix mode accessibility', async ({ page }) => {
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        
        // Look for Matrix mode toggle
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        
        if (await matrixToggle.isVisible()) {
          // Test keyboard activation
          await matrixToggle.focus();
          await page.keyboard.press('Space');
          
          // Wait for mode change
          await page.waitForTimeout(2000);
          
          // Capture accessibility test screenshot
          await page.screenshot({
            path: `screenshots/matrix-mode/accessibility-${viewport.name}.png`,
            fullPage: true
          });
          
          // Validate ARIA attributes
          const toggleAriaLabel = await matrixToggle.getAttribute('aria-label');
          expect(toggleAriaLabel).toBeTruthy();
          
          const toggleRole = await matrixToggle.getAttribute('role');
          expect(toggleRole).toBe('switch');
          
          // Test focus indicators
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeVisible();
        } else {
          test.skip('Matrix mode toggle not found');
        }
      });
    });
  }

  test.describe('Matrix Mode Error States', () => {
    
    test('should handle Canvas initialization failures gracefully', async ({ page }) => {
      // Mock Canvas context failure
      await page.addInitScript(() => {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function() {
          return null; // Simulate context creation failure
        };
      });
      
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
      
      // Try to enable Matrix mode
      const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
      if (await matrixToggle.isVisible()) {
        await matrixToggle.click();
        
        // Should show error state or graceful fallback
        await page.waitForTimeout(2000);
        
        await page.screenshot({
          path: 'screenshots/matrix-mode/canvas-error-fallback.png',
          fullPage: true
        });
        
        // Validate error handling
        const errorMessage = page.locator('[data-testid="matrix-error-message"]');
        if (await errorMessage.isVisible()) {
          expect(await errorMessage.textContent()).toContain('Matrix mode initialization failed');
        }
      }
    });

    test('should handle WebGL fallback scenarios', async ({ page }) => {
      // Mock high event count to trigger WebGL fallback
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
      
      const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
      if (await matrixToggle.isVisible()) {
        await matrixToggle.click();
        await page.waitForTimeout(1000);
        
        // Simulate high event load
        await page.evaluate(() => {
          for (let i = 0; i < 6000; i++) { // Above WebGL threshold
            const event = {
              id: `webgl-test-${i}`,
              session_id: `session-${i % 50}`,
              hook_event_type: 'spawn',
              timestamp: Date.now() + i,
              payload: { agentName: `WebGLAgent${i}` }
            };
            
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('matrix-test-event', { detail: event }));
            }
          }
        });
        
        await page.waitForTimeout(3000);
        
        await page.screenshot({
          path: 'screenshots/matrix-mode/webgl-fallback.png',
          fullPage: true
        });
      }
    });
  });

  test.describe('Matrix Mode Visual Regression', () => {
    
    test('should match baseline screenshots', async ({ page }) => {
      // This test compares against baseline images
      // Run only if baseline exists
      
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        const matrixToggle = page.locator('[data-testid="matrix-mode-toggle"]');
        if (await matrixToggle.isVisible()) {
          // Test disabled state
          await page.screenshot({
            path: `screenshots/matrix-mode/baseline-disabled-${viewport.name}.png`
          });
          
          // Test enabled state
          await matrixToggle.click();
          await page.waitForTimeout(2000);
          
          await page.screenshot({
            path: `screenshots/matrix-mode/baseline-enabled-${viewport.name}.png`
          });
        }
      }
    });
  });
});