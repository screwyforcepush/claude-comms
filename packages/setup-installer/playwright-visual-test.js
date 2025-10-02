const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Test NPM page for claude-comms
  console.log('📸 Capturing NPM package page...');
  await page.goto('https://www.npmjs.com/package/claude-comms');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ 
    path: 'screenshots/npm-package-desktop.png',
    fullPage: true 
  });

  // Test GitHub workflow page
  console.log('📸 Capturing GitHub workflow page...');
  await page.goto('https://github.com/alexsavage/claude-comms/actions');
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'screenshots/github-workflows-desktop.png',
    fullPage: true
  });

  await browser.close();
  console.log('✅ Visual validation screenshots captured');
})();