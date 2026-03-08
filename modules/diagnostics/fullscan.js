import { DatabaseManager } from '../core/database.js';
import { EmbeddingService } from '../core/embeddings.js';
import { StateManager } from '../core/state.js';
import { Scanner } from '../scanner/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runFullScan(services = null) {
  console.log('\n' + '🔍'.repeat(30));
  console.log('🔍 FULL DIAGNOSTIC SCAN');
  console.log('🔍'.repeat(30) + '\n');
  
  // Use existing services if provided, otherwise create new ones
  const db = services?.db || new DatabaseManager();
  const embeddings = services?.embeddings || new EmbeddingService();
  const state = services?.state || new StateManager();
  
  if (!services) {
    await db.initialize();
    await state.load();
  }
  
  // Log initial state
  console.log('\n📊 INITIAL STATE:');
  console.log('='.repeat(50));
  const initialCount = await db.count();
  console.log(`📚 ChromaDB documents: ${initialCount}`);
  console.log(`📁 Tracked files in state: ${state.getIndexedCount()}`);
  console.log(`📁 Monitored folders:`, state.getFolders());
  
  // Preview each folder in detail
  console.log('\n🔍 PREVIEWING ALL FOLDERS:');
  console.log('='.repeat(50));
  
  const folders = state.getFolders();
  const folderStats = [];
  
  for (const folder of folders) {
    const stats = await previewFolder(folder);
    if (stats) {
      folderStats.push({
        path: folder,
        ...stats
      });
    }
    console.log('-'.repeat(60));
  }
  
  // Calculate total expected files
  const totalExpected = folderStats.reduce((sum, f) => sum + f.total, 0);
  const totalJsExamples = folderStats.reduce((sum, f) => sum + f.jsExamples, 0);
  
  console.log('\n📈 TOTAL EXPECTED FILES:');
  console.log('='.repeat(50));
  console.log(`📁 All files: ${totalExpected}`);
  console.log(`🎯 JS Examples: ${totalJsExamples}`);
  console.log(`📝 Explanations: ${folderStats.reduce((sum, f) => sum + f.explanations, 0)}`);
  console.log(`🔧 Other JS: ${folderStats.reduce((sum, f) => sum + f.otherJs, 0)}`);
  console.log(`🌐 HTML: ${folderStats.reduce((sum, f) => sum + f.html, 0)}`);
  
  // Ask for confirmation
  console.log('\n⚠️  This will scan ALL folders and may take a long time.');
  console.log(`   Estimated files to process: ${totalExpected}`);
  
  const { default: readline } = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question('\n📥 Continue with full scan? (y/n): ', resolve);
  });
  rl.close();
  
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ Scan cancelled.');
    return { cancelled: true };
  }
  
  // Create scanner
  const scanner = new Scanner(db, embeddings, state);
  
  // Track progress
  console.log('\n🔍 STARTING SCAN...');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  let lastLoggedCount = initialCount;
  
  // Override processFileBatch for better progress tracking
  const originalProcessFileBatch = scanner.processFileBatch;
  scanner.processFileBatch = async function(files) {
    // Group files by their parent folder
    const folderGroups = {};
    
    for (const file of files) {
      const fullPath = file.path;
      let context = '';
      
      for (const baseFolder of folders) {
        if (fullPath.startsWith(baseFolder)) {
          const relativePath = fullPath.substring(baseFolder.length + 1);
          const pathParts = relativePath.split('/');
          
          if (pathParts.length > 2) {
            context = `${path.basename(baseFolder)}/${pathParts[0]}/${pathParts[1]}`;
          } else if (pathParts.length > 1) {
            context = `${path.basename(baseFolder)}/${pathParts[0]}`;
          } else {
            context = `${path.basename(baseFolder)}`;
          }
          break;
        }
      }
      
      if (!context) {
        context = path.dirname(fullPath);
      }
      
      if (!folderGroups[context]) {
        folderGroups[context] = [];
      }
      folderGroups[context].push(file);
    }
    
    console.log(`\n  📦 Processing batch of ${files.length} files from:`);
    
    for (const [context, groupFiles] of Object.entries(folderGroups)) {
      console.log(`     📁 ${context}/ (${groupFiles.length} files)`);
      
      groupFiles.slice(0, 2).forEach(file => {
        const indicator = file.action === 'changed' ? '📝' : '📄';
        console.log(`        ${indicator} ${path.basename(file.path)}`);
      });
      
      if (groupFiles.length > 2) {
        console.log(`        ... and ${groupFiles.length - 2} more`);
      }
    }
    
    const result = await originalProcessFileBatch.call(this, files);
    
    const currentCount = await db.count();
    const newCount = currentCount - lastLoggedCount;
    lastLoggedCount = currentCount;
    
    const elapsed = ((Date.now() - startTime)/1000).toFixed(1);
    const progress = ((currentCount / totalExpected) * 100).toFixed(1);
    
    console.log(`     ✅ Total: ${currentCount}/${totalExpected} (${progress}%)`);
    console.log(`     ⏱️  Time: ${elapsed}s | This batch: +${newCount}`);
    
    return result;
  };
  
  // Run the scan
  const stats = await scanner.updateIndex(true);
  
  // Final results
  console.log('\n' + '🎯'.repeat(30));
  console.log('🎯 SCAN COMPLETE');
  console.log('🎯'.repeat(30) + '\n');
  
  const finalCount = await db.count();
  const elapsedTime = ((Date.now() - startTime)/60).toFixed(1);
  
  console.log('📊 SCAN STATISTICS:');
  console.log('='.repeat(50));
  console.log(`⏱️  Total time: ${elapsedTime} minutes`);
  console.log(`📚 Initial documents: ${initialCount}`);
  console.log(`📚 Final documents: ${finalCount}`);
  console.log(`📈 New documents added: ${finalCount - initialCount}`);
  console.log(`📁 Files scanned: ${stats.scanned}`);
  console.log(`✅ New files: ${stats.new}`);
  console.log(`📝 Changed files: ${stats.changed}`);
  console.log(`⏺️ Unchanged: ${stats.unchanged}`);
  console.log(`🗑️ Deleted: ${stats.deleted}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log(`📦 Batches processed: ${stats.batches}`);
  
  // Coverage analysis
  console.log('\n📊 COVERAGE ANALYSIS:');
  console.log('='.repeat(50));
  console.log(`📁 Total files on disk: ${totalExpected}`);
  console.log(`📚 Total in ChromaDB: ${finalCount}`);
  console.log(`📊 Coverage: ${((finalCount / totalExpected) * 100).toFixed(1)}%`);
  
  if (finalCount < totalExpected) {
    console.log('\n⚠️  MISSING FILES DETECTED!');
    console.log('   Check the error messages above for details.');
  } else {
    console.log('\n✅ ALL FILES SUCCESSFULLY INDEXED!');
  }
  
  return { success: true, stats, finalCount, totalExpected };
}

async function previewFolder(folderPath) {
  console.log(`\n📁 PREVIEW: ${folderPath}`);
  console.log('-'.repeat(60));
  
  const stats = {
    total: 0,
    jsExamples: 0,
    explanations: 0,
    otherJs: 0,
    html: 0,
    other: 0,
    folders: 0,
    samples: []
  };
  
  async function scan(dir, depth = 0) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const indent = '  '.repeat(depth);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            stats.folders++;
            if (depth === 0) {
              console.log(`${indent}📂 ${entry.name}/`);
            }
            await scan(fullPath, depth + 1);
          }
        } else {
          stats.total++;
          
          if (/^[A-Z]+#\d+\.js$/i.test(entry.name)) {
            stats.jsExamples++;
            if (stats.samples.length < 10) {
              stats.samples.push(entry.name);
            }
            if (depth === 0) {
              console.log(`${indent}📄 ${entry.name} (JS Example)`);
            }
          } else if (entry.name.endsWith('.js')) {
            stats.otherJs++;
          } else if (entry.name.match(/\.(txt|md)$/i)) {
            stats.explanations++;
          } else if (entry.name.match(/\.html?$/i)) {
            stats.html++;
          } else {
            stats.other++;
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error scanning ${dir}: ${error.message}`);
    }
  }
  
  await scan(folderPath);
  
  console.log('\n📊 Folder Summary:');
  console.log(`   Total files: ${stats.total}`);
  console.log(`   JS Examples: ${stats.jsExamples}`);
  console.log(`   Explanations: ${stats.explanations}`);
  console.log(`   Other JS: ${stats.otherJs}`);
  console.log(`   HTML files: ${stats.html}`);
  console.log(`   Other files: ${stats.other}`);
  console.log(`   Subfolders: ${stats.folders}`);
  
  if (stats.samples.length > 0) {
    console.log('\n   Sample JS Examples:');
    stats.samples.slice(0, 10).forEach(s => console.log(`     • ${s}`));
  }
  
  return stats;
}

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runFullScan();
  process.exit(result?.cancelled ? 0 : 1);
}