// test-index-subset.js
import { DatabaseManager } from './modules/core/database.js';
import { EmbeddingService } from './modules/core/embeddings.js';
import { StateManager } from './modules/core/state.js';
import { Scanner } from './modules/scanner/index.js';
import path from 'path';

async function testSubset() {
  console.log('🧪 Testing with small subset...');
  
  const db = new DatabaseManager();
  await db.initialize();
  
  const embeddings = new EmbeddingService();
  const state = new StateManager();
  await state.load();
  
  // Temporarily modify folders to just one
  const originalFolders = state.getFolders();
  state.state.folderPatterns = ['/home/admin/Bak/Angular/JS-TEST1/AddReplaceProperty'];
  
  const scanner = new Scanner(db, embeddings, state);
  
  console.log('📁 Scanning only: AddReplaceProperty folder');
  const stats = await scanner.updateIndex(true);
  
  console.log('\n📊 Results:', stats);
  
  const count = await db.count();
  console.log(`📚 Final count: ${count}`);
  
  // Restore original folders
  state.state.folderPatterns = originalFolders;
  await state.save();
}

testSubset().catch(console.error);