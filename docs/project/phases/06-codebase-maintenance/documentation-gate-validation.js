const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function captureDocumentationScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const screenshotDir = path.join(__dirname, 'documentation-screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  
  const results = [];
  
  // Test README.md rendering (if served locally)
  try {
    // Start a simple HTTP server to serve markdown
    const { exec } = require('child_process');
    const serverProcess = exec('python3 -m http.server 8080', {
      cwd: '/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability'
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for server
    
    // Capture README rendering
    await page.goto('http://localhost:8080/');
    await page.screenshot({ 
      path: path.join(screenshotDir, 'readme-homepage.png'),
      fullPage: true
    });
    
    results.push({
      file: 'README.md',
      screenshot: 'readme-homepage.png',
      issues: []
    });
    
    // Check for broken images
    const images = await page.$$('img');
    for (const img of images) {
      const src = await img.getAttribute('src');
      const isLoaded = await img.evaluate(el => el.complete && el.naturalWidth > 0);
      if (!isLoaded) {
        results[0].issues.push(`Broken image: ${src}`);
      }
    }
    
    // Check for markdown rendering issues
    const codeBlocks = await page.$$('pre code');
    results[0].codeBlockCount = codeBlocks.length;
    
    const headings = await page.$$('h1, h2, h3, h4');
    results[0].headingCount = headings.length;
    
    const links = await page.$$('a');
    results[0].linkCount = links.length;
    
    // Check for broken internal links
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('/') || href.startsWith('./')) {
        const response = await fetch(`http://localhost:8080${href}`);
        if (!response.ok) {
          results[0].issues.push(`Broken link: ${href}`);
        }
      }
    }
    
    serverProcess.kill();
  } catch (error) {
    console.error('Error capturing documentation screenshots:', error);
    results.push({
      file: 'README.md',
      error: error.message,
      issues: ['Could not render documentation for visual validation']
    });
  }
  
  await browser.close();
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    validator: 'WendyDocs',
    results: results,
    summary: {
      totalFiles: results.length,
      filesWithIssues: results.filter(r => r.issues && r.issues.length > 0).length,
      totalIssues: results.reduce((acc, r) => acc + (r.issues ? r.issues.length : 0), 0)
    }
  };
  
  await fs.writeFile(
    path.join(screenshotDir, 'visual-validation-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('Visual validation complete:', report.summary);
  return report;
}

// Run if executed directly
if (require.main === module) {
  captureDocumentationScreenshots()
    .then(report => {
      console.log('Documentation visual validation completed');
      console.log('Results saved to documentation-screenshots/');
      process.exit(report.summary.totalIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Visual validation failed:', error);
      process.exit(1);
    });
}

module.exports = { captureDocumentationScreenshots };