// diagnose-indexing.js
import { DatabaseManager } from './modules/core/database.js';
import { EmbeddingService } from './modules/core/embeddings.js';
import { StateManager } from './modules/core/state.js';
import { Scanner } from './index.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

async function diagnose() {
  console.log('\n🔍 DIAGNOSTIC TOOL');
  console.log('='.repeat(60));

  // 1. Check ChromaDB connection
  console.log('\n1️⃣ Checking ChromaDB connection...');
  const db = new DatabaseManager();
  await db.initialize();
  const count = await db.count();
  console.log(`   ✅ Connected. Current documents: ${count}`);

  // 2. Check State
  console.log('\n2️⃣ Checking State...');
  const state = new StateManager();
  await state.load();
  const indexedCount = state.getIndexedCount();
  console.log(`   📁 Tracked files in state: ${indexedCount}`);
  console.log(`   📁 Monitored folders:`, state.getFolders());

  // 3. Scan folders and show what would be indexed
  console.log('\n3️⃣ Scanning folders (preview)...');
  const scanner = new Scanner(db, new EmbeddingService(), state);
  
  for (const folder of state.getFolders()) {
    console.log(`\n   📁 Analyzing: ${folder}`);
    const files = await scanFolderDetailed(folder);
    
    // Categorize files
    const jsExamples = files.filter(f => f.category === 'js-example');
    const explanations = files.filter(f => f.category === 'explanation');
    const otherJs = files.filter(f => f.category === 'other-js');
    const skipped = files.filter(f => f.category === 'skipped');
    
    console.log(`      JS Examples with pattern: ${jsExamples.length}`);
    console.log(`      Explanation files: ${explanations.length}`);
    console.log(`      Other JS files: ${otherJs.length}`);
    console.log(`      Skipped files: ${skipped.length}`);
    
    // Show first 5 JS examples as sample
    if (jsExamples.length > 0) {
      console.log(`\n      Sample JS Examples (first 5):`);
      jsExamples.slice(0, 5).forEach((f, i) => {
        console.log(`        ${i+1}. ${path.basename(f.path)}`);
        if (f.pattern) {
          console.log(`           Pattern: ${f.pattern.prefix}#${f.pattern.number}`);
        }
      });
    }
  }

  // 4. Check for potential issues
  console.log('\n4️⃣ Checking for potential issues...');
  
  // Check file permissions
  const firstFolder = state.getFolders()[0];
  try {
    await fs.access(firstFolder, fs.constants.R_OK);
    console.log(`   ✅ Read access to ${firstFolder}`);
  } catch {
    console.log(`   ❌ Cannot read ${firstFolder}`);
  }

  // Check for very large files (> 1MB)
  console.log(`\n   Checking file sizes...`);
  const allFiles = await scanAllFiles(state.getFolders());
  const largeFiles = allFiles.filter(f => f.size > 1024 * 1024);
  if (largeFiles.length > 0) {
    console.log(`   ⚠️  Found ${largeFiles.length} files > 1MB:`);
    largeFiles.slice(0, 3).forEach(f => {
      console.log(`      ${path.basename(f.path)} (${(f.size/1024/1024).toFixed(2)}MB)`);
    });
  }

  // 5. Show ChromaDB contents
  console.log('\n5️⃣ Current ChromaDB contents:');
  const records = await db.getRecords({
    include: ["documents", "metadatas"],
    limit: 10
  });
  
  if (records.ids.length > 0) {
    console.log(`\n   Last ${records.ids.length} indexed items:`);
    for (let i = 0; i < records.ids.length; i++) {
      const meta = records.metadatas[i];
      console.log(`\n   ${i+1}. ${meta.filename || 'Unknown'}`);
      console.log(`      Path: ${meta.path || 'N/A'}`);
      console.log(`      Type: ${meta.type || 'N/A'}`);
      console.log(`      Category: ${meta.category || 'N/A'}`);
      if (meta.patternPrefix) {
        console.log(`      Pattern: ${meta.patternPrefix}#${meta.patternNumber}`);
      }
    }
  } else {
    console.log('   ❌ No documents in database');
  }

  console.log('\n' + '='.repeat(60));
}

async function scanFolderDetailed(folderPath) {
  const files = [];
  
  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else {
        const stats = await fs.stat(fullPath);
        const category = categorizeFile(entry.name);
        const pattern = extractNumberingPattern(entry.name);
        
        files.push({
          path: fullPath,
          name: entry.name,
          size: stats.size,
          category,
          pattern,
          modified: stats.mtime
        });
      }
    }
  }
  
  await scan(folderPath);
  return files;
}

async function scanAllFiles(folders) {
  const allFiles = [];
  for (const folder of folders) {
    const files = await scanFolderDetailed(folder);
    allFiles.push(...files);
  }
  return allFiles;
}

function categorizeFile(filename) {
  const jsExamplePattern = /^[A-Z]+#\d+\.js$/i;
  const explanationPattern = /\.(txt|md|html?)$/i;
  const otherJsPattern = /\.js$/i;
  
  if (jsExamplePattern.test(filename)) return 'js-example';
  if (explanationPattern.test(filename)) return 'explanation';
  if (otherJsPattern.test(filename)) return 'other-js';
  return 'skipped';
}

function extractNumberingPattern(filename) {
  const match = filename.match(/^([A-Z]+)#(\d+)\.js$/i);
  if (match) {
    return {
      prefix: match[1],
      number: parseInt(match[2])
    };
  }
  return null;
}

// Run diagnosis
diagnose().catch(console.error);