// Session Introspection UI Visual Validation Tests
const { test, expect } = require('@playwright/test');

test.describe('Session Introspection Feature - Quality Gate Visual Validation', () => {
  // Test against the dev server
  const BASE_URL = 'http://localhost:5176';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for initial load
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
  });

  test('Initial page load and SubagentComms tab navigation', async ({ page }) => {
    // Capture initial state
    await page.screenshot({ 
      path: 'screenshots/quality-gate/01-initial-load.png',
      fullPage: true 
    });

    // Click on SubagentComms tab
    const subagentTab = page.locator('button:has-text("SubagentComms")');
    await subagentTab.click();
    await page.waitForTimeout(1000);

    // Capture SubagentComms tab view
    await page.screenshot({ 
      path: 'screenshots/quality-gate/02-subagentcomms-tab.png',
      fullPage: true 
    });

    // Verify session selector is visible
    const sessionSelector = page.locator('select').first();
    await expect(sessionSelector).toBeVisible();
  });

  test('Session selector functionality', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Open session dropdown
    const sessionSelector = page.locator('select').first();
    await sessionSelector.click();
    
    // Capture dropdown open state
    await page.screenshot({ 
      path: 'screenshots/quality-gate/03-session-dropdown-open.png',
      fullPage: true 
    });

    // Select first session if available
    const options = await sessionSelector.locator('option').count();
    if (options > 1) {
      await sessionSelector.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
      
      // Capture session selected state
      await page.screenshot({ 
        path: 'screenshots/quality-gate/04-session-selected.png',
        fullPage: true 
      });
    }
  });

  test('View mode switching - Timeline, List, Orchestration', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Select a session first
    const sessionSelector = page.locator('select').first();
    const options = await sessionSelector.locator('option').count();
    if (options > 1) {
      await sessionSelector.selectOption({ index: 1 });
      await page.waitForTimeout(2000);

      // Timeline View (default)
      await page.screenshot({ 
        path: 'screenshots/quality-gate/05-timeline-view.png',
        fullPage: true 
      });

      // List View
      const listViewBtn = page.locator('button:has-text("List View")');
      if (await listViewBtn.isVisible()) {
        await listViewBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'screenshots/quality-gate/06-list-view.png',
          fullPage: true 
        });
      }

      // Orchestration View
      const orchViewBtn = page.locator('button:has-text("Orchestration")');
      if (await orchViewBtn.isVisible()) {
        await orchViewBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'screenshots/quality-gate/07-orchestration-view.png',
          fullPage: true 
        });
      }
    }
  });

  test('Orchestration timeline session selector', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Select a session
    const sessionSelector = page.locator('select').first();
    const options = await sessionSelector.locator('option').count();
    if (options > 1) {
      await sessionSelector.selectOption({ index: 1 });
      await page.waitForTimeout(2000);

      // Go to Orchestration view
      const orchViewBtn = page.locator('button:has-text("Orchestration")');
      if (await orchViewBtn.isVisible()) {
        await orchViewBtn.click();
        await page.waitForTimeout(1000);

        // Check for SessionSelector component
        const sessionSelectorComponent = page.locator('[data-testid="session-selector"]');
        if (await sessionSelectorComponent.isVisible()) {
          await page.screenshot({ 
            path: 'screenshots/quality-gate/08-orchestration-session-selector.png',
            fullPage: true 
          });

          // Try searching in sessions
          const searchInput = page.locator('[data-testid="session-search"]');
          if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            await page.waitForTimeout(500);
            await page.screenshot({ 
              path: 'screenshots/quality-gate/09-session-search.png',
              fullPage: true 
            });
          }

          // Click refresh button
          const refreshBtn = page.locator('[data-testid="refresh-sessions"]');
          if (await refreshBtn.isVisible()) {
            await refreshBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ 
              path: 'screenshots/quality-gate/10-session-refresh.png',
              fullPage: true 
            });
          }
        }
      }
    }
  });

  test('Message expansion and interaction', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Select a session
    const sessionSelector = page.locator('select').first();
    const options = await sessionSelector.locator('option').count();
    if (options > 1) {
      await sessionSelector.selectOption({ index: 1 });
      await page.waitForTimeout(2000);

      // Go to Orchestration view
      const orchViewBtn = page.locator('button:has-text("Orchestration")');
      if (await orchViewBtn.isVisible()) {
        await orchViewBtn.click();
        await page.waitForTimeout(1000);

        // Look for message items
        const messageItems = page.locator('[data-testid="message-item"]');
        const messageCount = await messageItems.count();
        
        if (messageCount > 0) {
          // Click first message to expand
          await messageItems.first().click();
          await page.waitForTimeout(500);
          await page.screenshot({ 
            path: 'screenshots/quality-gate/11-message-expanded.png',
            fullPage: true 
          });
        }
      }
    }
  });

  test('Responsive design check', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Desktop viewport (already default)
    await page.screenshot({ 
      path: 'screenshots/quality-gate/12-desktop-viewport.png',
      fullPage: true 
    });

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/13-tablet-viewport.png',
      fullPage: true 
    });

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/14-mobile-viewport.png',
      fullPage: true 
    });
  });

  test('Empty states and error handling', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Capture empty state
    await page.screenshot({ 
      path: 'screenshots/quality-gate/15-empty-state.png',
      fullPage: true 
    });

    // Select a session and go to orchestration
    const sessionSelector = page.locator('select').first();
    const options = await sessionSelector.locator('option').count();
    if (options > 1) {
      await sessionSelector.selectOption({ index: 1 });
      await page.waitForTimeout(2000);

      const orchViewBtn = page.locator('button:has-text("Orchestration")');
      if (await orchViewBtn.isVisible()) {
        await orchViewBtn.click();
        await page.waitForTimeout(1000);

        // Check for empty timeline message
        const emptyState = page.locator('[data-testid="empty-state"]');
        if (await emptyState.isVisible()) {
          await page.screenshot({ 
            path: 'screenshots/quality-gate/16-empty-timeline.png',
            fullPage: true 
          });
        }
      }
    }
  });

  test('Accessibility check - keyboard navigation', async ({ page }) => {
    // Navigate to SubagentComms
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/17-keyboard-nav-1.png',
      fullPage: true 
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/18-keyboard-nav-2.png',
      fullPage: true 
    });

    // Try Enter/Space on focused element
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/19-keyboard-activation.png',
      fullPage: true 
    });
  });

  test('Performance - large dataset visualization', async ({ page }) => {
    // This would test with many messages/sessions if available
    await page.locator('button:has-text("SubagentComms")').click();
    await page.waitForTimeout(1000);

    const sessionSelector = page.locator('select').first();
    const options = await sessionSelector.locator('option').count();
    
    // Select last session (potentially largest)
    if (options > 1) {
      await sessionSelector.selectOption({ index: options - 1 });
      await page.waitForTimeout(3000); // Give more time for large data
      
      await page.screenshot({ 
        path: 'screenshots/quality-gate/20-large-dataset.png',
        fullPage: true 
      });
    }
  });
});