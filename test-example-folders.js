import fs from 'fs/promises';
import path from 'path';

const folders = [
  '/home/admin/Bak/Angular/JS-TEST1',
  '/home/admin/Bak/Angular/JS-TEST2',
  '/home/admin/Bak/Angular/JS-TEST3'
];

async function analyze() {
  console.log('📊 FOLDER ANALYSIS\n');
  
  for (const folder of folders) {
    console.log(`📁 ${folder}`);
    console.log('-'.repeat(50));
    
    try {
      await fs.access(folder);
      const stats = await analyzeFolder(folder);
      
      console.log(`   Total files: ${stats.total}`);
      console.log(`   JS Examples (RP#01.js format): ${stats.jsExamples}`);
      console.log(`   Other JS files: ${stats.otherJs}`);
      console.log(`   HTML files: ${stats.html}`);
      console.log(`   Text/Markdown: ${stats.docs}`);
      console.log(`   Other files: ${stats.other}`);
      
      // Show sample of JS examples
      if (stats.samples.length > 0) {
        console.log('\n   Sample JS Examples:');
        stats.samples.slice(0, 5).forEach(f => {
          console.log(`     • ${f}`);
        });
      }
      
    } catch (e) {
      console.log(`   ❌ Folder not accessible: ${e.message}`);
    }
    console.log('');
  }
}

async function analyzeFolder(dir) {
  const stats = {
    total: 0,
    jsExamples: 0,
    otherJs: 0,
    html: 0,
    docs: 0,
    other: 0,
    samples: []
  };
  
  async function scan(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else {
        stats.total++;
        
        if (/^[A-Z]+#\d+\.js$/i.test(entry.name)) {
          stats.jsExamples++;
          if (stats.samples.length < 10) {
            stats.samples.push(entry.name);
          }
        } else if (entry.name.endsWith('.js')) {
          stats.otherJs++;
        } else if (entry.name.match(/\.html?$/i)) {
          stats.html++;
        } else if (entry.name.match(/\.(txt|md)$/i)) {
          stats.docs++;
        } else {
          stats.other++;
        }
      }
    }
  }
  
  await scan(dir);
  return stats;
}

analyze().catch(console.error);