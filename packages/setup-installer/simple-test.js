/**
 * Simple test to debug tarball extraction
 */

const { GitHubFetcher } = require('./src/fetcher/github');

async function simpleTest() {
  console.log('Testing tarball extraction...');
  
  const fetcher = new GitHubFetcher();
  
  try {
    const result = await fetcher.fetchAsTarball({ version: 'main' });
    
    console.log('\nResult structure:');
    console.log('Keys:', Object.keys(result));
    
    if (result['.claude']) {
      console.log('.claude structure:');
      console.log('  type:', result['.claude'].type);
      console.log('  files count:', result['.claude'].files?.length || 0);
      console.log('  children count:', result['.claude'].children?.length || 0);
      
      if (result['.claude'].files?.length > 0) {
        console.log('  First few files:');
        result['.claude'].files.slice(0, 3).forEach(file => {
          console.log(`    - ${file.path} (${file.content?.length || 0} chars)`);
        });
      }
    }
    
    if (result['CLAUDE.md']) {
      console.log('\nCLAUDE.md:');
      console.log('  content length:', result['CLAUDE.md'].content?.length || 0);
      console.log('  first 100 chars:', result['CLAUDE.md'].content?.slice(0, 100) || 'null');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

simpleTest();