const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'screenshots', 'sessions-timeline');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  
  console.log('Navigating to dashboard...');
  await page.goto('http://localhost:5181/', { waitUntil: 'networkidle' });
  
  // Wait for the Vue app to mount
  await page.waitForTimeout(2000);
  
  // Click on Sessions tab
  console.log('Clicking on Sessions tab...');
  const sessionsTab = await page.locator('button:has-text("Sessions")').first();
  await sessionsTab.click();
  
  // Wait for sessions timeline to render
  await page.waitForTimeout(3000);
  
  // Capture desktop viewport (1920x1080)
  console.log('Capturing desktop viewport (1920x1080)...');
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-desktop-1920x1080.png'),
    fullPage: false
  });
  
  // Test different time windows
  const timeWindows = ['15m', '1h', '6h', '24h'];
  
  for (const window of timeWindows) {
    console.log(`Testing ${window} time window...`);
    const windowButton = await page.locator(`button:has-text("${window}")`).first();
    await windowButton.click();
    await page.waitForTimeout(1500);
    
    await page.screenshot({
      path: path.join(screenshotsDir, `sessions-${window}-window.png`),
      fullPage: false
    });
  }
  
  // Test zoom functionality
  console.log('Testing zoom in...');
  const zoomInButton = await page.locator('button:has-text("Zoom In")').first();
  await zoomInButton.click();
  await page.waitForTimeout(500);
  await zoomInButton.click();
  await page.waitForTimeout(500);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-zoomed-in.png'),
    fullPage: false
  });
  
  // Reset view
  const resetButton = await page.locator('button:has-text("Reset View")').first();
  await resetButton.click();
  await page.waitForTimeout(1000);
  
  // Test mobile viewport (375x667 - iPhone)
  console.log('Testing mobile viewport (375x667)...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-mobile-375x667.png'),
    fullPage: false
  });
  
  // Test tablet viewport (768x1024 - iPad)
  console.log('Testing tablet viewport (768x1024)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-tablet-768x1024.png'),
    fullPage: false
  });
  
  // Test laptop viewport (1366x768)
  console.log('Testing laptop viewport (1366x768)...');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-laptop-1366x768.png'),
    fullPage: false
  });
  
  // Test 4K viewport (3840x2160)
  console.log('Testing 4K viewport (3840x2160)...');
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'sessions-4k-3840x2160.png'),
    fullPage: false
  });
  
  console.log('Screenshots captured successfully!');
  console.log(`Screenshots saved to: ${screenshotsDir}`);
  
  await browser.close();
})();