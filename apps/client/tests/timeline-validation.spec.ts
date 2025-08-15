import { test, expect } from '@playwright/test';

test.describe('Timeline Visual Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('capture sessions timeline screenshots', async ({ page }) => {
    // Navigate to Sessions tab
    await page.click('button:has-text("Sessions")');
    await page.waitForSelector('.sessions-timeline-container');
    
    // Wait for timeline to render
    await page.waitForTimeout(2000);
    
    // Desktop viewport (1920x1080) screenshot
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-1920x1080.png',
      fullPage: false 
    });
    
    // Test interactivity - click on an agent path
    const agentPath = await page.locator('.agent-path path').first();
    if (await agentPath.isVisible()) {
      await agentPath.click();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'screenshots/timeline/desktop-agent-selected.png',
        fullPage: false 
      });
    }
    
    // Test time window controls
    await page.click('button:has-text("15m")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-15min-window.png',
      fullPage: false 
    });
    
    // Test auto-pan toggle
    await page.click('button:has-text("Auto-Pan")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-autopan-disabled.png',
      fullPage: false 
    });
    
    // Test zoom controls
    await page.click('button:has-text("Zoom In")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-zoomed-in.png',
      fullPage: false 
    });
    
    // Test reset view
    await page.click('button:has-text("Reset View")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-reset-view.png',
      fullPage: false 
    });
    
    // Tablet viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ 
      path: 'screenshots/timeline/tablet-768x1024.png',
      fullPage: false 
    });
    
    // Mobile viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ 
      path: 'screenshots/timeline/mobile-375x667.png',
      fullPage: false 
    });
  });
  
  test('verify no click blocking issues', async ({ page }) => {
    await page.click('button:has-text("Sessions")');
    await page.waitForSelector('.sessions-timeline-container');
    await page.waitForTimeout(2000);
    
    // Test clicking on various interactive elements
    const interactiveElements = [
      '.agent-path path',
      '.session-messages circle',
      'button:has-text("15m")',
      'button:has-text("Auto-Pan")',
      'button:has-text("Zoom In")'
    ];
    
    for (const selector of interactiveElements) {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        // Verify element is clickable (not blocked)
        const isClickable = await element.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const elementAtPoint = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return elementAtPoint === el || el.contains(elementAtPoint);
        });
        
        expect(isClickable).toBeTruthy();
      }
    }
  });
  
  test('verify dynamic spacing adjusts correctly', async ({ page }) => {
    await page.click('button:has-text("Sessions")');
    await page.waitForSelector('.sessions-timeline-container');
    await page.waitForTimeout(2000);
    
    // Check that sessions have different heights based on agent batch sizes
    const sessionHeights = await page.evaluate(() => {
      const sessionRects = Array.from(document.querySelectorAll('.session-lane rect'));
      return sessionRects.map(rect => rect.getAttribute('height'));
    });
    
    // Verify that heights vary (not all the same)
    const uniqueHeights = new Set(sessionHeights);
    expect(uniqueHeights.size).toBeGreaterThan(1);
  });
});