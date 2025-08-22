import { test, expect } from '@playwright/test';

test.describe('Sessions Timeline Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Sessions tab
    const sessionsTab = page.locator('button', { hasText: 'Sessions' });
    await sessionsTab.click();
    await page.waitForTimeout(500);
  });

  test('verify NOW marker positioning at 92% from left', async ({ page }) => {
    // Wait for timeline to render
    await page.waitForSelector('.sessions-timeline-container');
    
    // Find the NOW marker line
    const nowMarker = page.locator('line').filter({ has: page.locator('text:has-text("NOW")').locator('..') });
    
    // Get container and marker positions
    const containerBox = await page.locator('.sessions-timeline-container svg').boundingBox();
    const nowMarkerBox = await nowMarker.boundingBox();
    
    if (containerBox && nowMarkerBox) {
      const markerPosition = nowMarkerBox.x - containerBox.x;
      const containerWidth = containerBox.width;
      const positionRatio = markerPosition / containerWidth;
      
      // Verify NOW marker is positioned around 92% from left (allowing for margin)
      expect(positionRatio).toBeGreaterThan(0.85);
      expect(positionRatio).toBeLessThan(0.95);
      
      console.log(`NOW marker position ratio: ${positionRatio.toFixed(2)} (expected ~0.92)`);
    }
    
    // Capture screenshot for visual verification
    await page.screenshot({ 
      path: 'screenshots/sessions-timeline-now-marker-1920x1080.png',
      fullPage: false
    });
  });

  test('verify agent lane spacing with increased height', async ({ page }) => {
    // Wait for timeline to render with agents
    await page.waitForSelector('.session-agents');
    
    // Get all agent paths
    const agentPaths = await page.locator('.agent-path').all();
    
    if (agentPaths.length > 1) {
      // Measure vertical spacing between agents
      const firstAgentBox = await agentPaths[0].boundingBox();
      const secondAgentBox = await agentPaths[1].boundingBox();
      
      if (firstAgentBox && secondAgentBox) {
        const verticalSpacing = Math.abs(secondAgentBox.y - firstAgentBox.y);
        
        // Verify spacing is at least 38px (agentLaneHeight)
        expect(verticalSpacing).toBeGreaterThanOrEqual(38);
        
        console.log(`Agent lane vertical spacing: ${verticalSpacing}px (expected >= 38px)`);
      }
    }
    
    // Capture screenshot showing agent lanes
    await page.screenshot({ 
      path: 'screenshots/sessions-timeline-agent-lanes-1920x1080.png',
      fullPage: false
    });
  });

  test('verify session height scales properly with agents', async ({ page }) => {
    // Get all session lanes
    const sessionLanes = await page.locator('.session-lane').all();
    
    for (let i = 0; i < Math.min(sessionLanes.length, 3); i++) {
      const sessionLane = sessionLanes[i];
      const sessionBox = await sessionLane.boundingBox();
      
      if (sessionBox) {
        // Verify minimum session height is at least 60px
        expect(sessionBox.height).toBeGreaterThanOrEqual(60);
        
        console.log(`Session ${i + 1} height: ${sessionBox.height}px (minimum expected: 60px)`);
      }
    }
    
    // Capture full timeline showing multiple sessions
    await page.screenshot({ 
      path: 'screenshots/sessions-timeline-scaling-1920x1080.png',
      fullPage: false
    });
  });

  test('verify auto-pan toggle functionality', async ({ page }) => {
    // Find auto-pan button
    const autoPanButton = page.locator('button', { hasText: 'Auto-Pan' });
    
    // Check initial state (should be enabled)
    const initialClasses = await autoPanButton.getAttribute('class');
    expect(initialClasses).toContain('bg-green-600');
    
    // Toggle auto-pan off
    await autoPanButton.click();
    await page.waitForTimeout(200);
    
    const disabledClasses = await autoPanButton.getAttribute('class');
    expect(disabledClasses).toContain('bg-gray-600');
    
    // Toggle back on
    await autoPanButton.click();
    await page.waitForTimeout(200);
    
    const enabledClasses = await autoPanButton.getAttribute('class');
    expect(enabledClasses).toContain('bg-green-600');
    
    // Capture screenshot showing auto-pan state
    await page.screenshot({ 
      path: 'screenshots/sessions-timeline-autopan-1920x1080.png',
      fullPage: false
    });
  });

  test('capture timeline at different viewports', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: `screenshots/sessions-timeline-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: false
      });
      
      console.log(`Captured ${viewport.name} viewport: ${viewport.width}x${viewport.height}`);
    }
  });
});