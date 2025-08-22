import { chromium } from 'playwright';

async function captureTimelineScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to application...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Sessions tab
    console.log('Clicking Sessions tab...');
    const sessionsTab = page.locator('button', { hasText: 'Sessions' });
    await sessionsTab.click();
    await page.waitForTimeout(2000);
    
    // Capture initial state
    console.log('Capturing sessions timeline initial state...');
    await page.screenshot({ 
      path: 'screenshots/sessions-timeline-initial-1920x1080.png',
      fullPage: false
    });
    
    // Check NOW marker position
    console.log('Verifying NOW marker position...');
    const svgElement = await page.locator('.sessions-timeline-container svg');
    const nowMarkerLine = await page.locator('line').filter({ hasText: 'NOW' }).first();
    
    if (await nowMarkerLine.isVisible()) {
      const svgBox = await svgElement.boundingBox();
      const nowBox = await nowMarkerLine.boundingBox();
      
      if (svgBox && nowBox) {
        const markerPosition = nowBox.x - svgBox.x;
        const containerWidth = svgBox.width;
        const positionRatio = markerPosition / containerWidth;
        console.log(`NOW marker position ratio: ${positionRatio.toFixed(3)} (expected ~0.92)`);
      }
    }
    
    // Toggle auto-pan off
    console.log('Testing auto-pan toggle...');
    const autoPanButton = page.locator('button', { hasText: 'Auto-Pan' });
    if (await autoPanButton.isVisible()) {
      await autoPanButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'screenshots/sessions-timeline-autopan-off-1920x1080.png',
        fullPage: false
      });
      
      // Toggle back on
      await autoPanButton.click();
      await page.waitForTimeout(500);
    }
    
    // Test different time windows
    const timeWindows = ['15m', '1h', '6h', '24h'];
    for (const window of timeWindows) {
      console.log(`Testing ${window} time window...`);
      const windowButton = page.locator('button', { hasText: window }).first();
      if (await windowButton.isVisible()) {
        await windowButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: `screenshots/sessions-timeline-${window}-1920x1080.png`,
          fullPage: false
        });
      }
    }
    
    // Test different viewports
    const viewports = [
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' }
    ];
    
    for (const viewport of viewports) {
      console.log(`Testing ${viewport.name} viewport...`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: `screenshots/sessions-timeline-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: false
      });
    }
    
    console.log('Screenshots captured successfully!');
    
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

captureTimelineScreenshots().catch(console.error);