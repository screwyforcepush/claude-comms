import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Opening application...');
  await page.goto('http://localhost:5173');
  
  // Wait for app to load
  await page.waitForTimeout(3000);
  
  // Click on Sessions tab
  console.log('Navigating to Sessions tab...');
  await page.click('text=Sessions');
  await page.waitForTimeout(2000);
  
  // Take screenshot of Sessions Timeline
  console.log('Capturing Sessions Timeline screenshot...');
  await page.screenshot({ 
    path: 'screenshots/sessions-timeline-verification.png',
    fullPage: false 
  });
  
  // Click on Agents tab for comparison
  console.log('Navigating to Agents tab for comparison...');
  await page.click('text=Agents');
  await page.waitForTimeout(2000);
  
  // Take screenshot of Agents Timeline for reference
  console.log('Capturing Agents Timeline for reference...');
  await page.screenshot({ 
    path: 'screenshots/agents-timeline-reference.png',
    fullPage: false 
  });
  
  // Go back to Sessions tab to check console
  console.log('Checking for console errors...');
  await page.click('text=Sessions');
  
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console Error:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.error('Page Error:', error.message);
  });
  
  // Wait to capture any errors
  await page.waitForTimeout(3000);
  
  console.log('Visual testing complete!');
  console.log('Screenshots saved to:');
  console.log('  - screenshots/sessions-timeline-verification.png');
  console.log('  - screenshots/agents-timeline-reference.png');
  
  await browser.close();
})();