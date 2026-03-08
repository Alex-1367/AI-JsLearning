// test-random.js
import { DatabaseManager } from './modules/core/database.js';
import { EmbeddingService } from './modules/core/embeddings.js';
import { Generator } from './modules/quiz/generator.js';
import { QuizLogger } from './modules/quiz/logger.js';
import { QuizEngine } from './modules/quiz/engine.js';
import { LLMService } from './modules/core/llm.js';

async function testRandomness() {
  const db = new DatabaseManager();
  await db.initialize();
  
  const llm = new LLMService();
  const generator = new Generator(llm);
  const logger = new QuizLogger();
  const engine = new QuizEngine(db, generator, logger);
  
  console.log('🎲 Testing randomness (20 samples):\n');
  
  const counts = {};
  
  for (let i = 0; i < 20; i++) {
    const example = await engine.getRandomExample();
    if (example) {
      const folder = example.metadata.folder;
      counts[folder] = (counts[folder] || 0) + 1;
      console.log(`${i + 1}. ${folder}/${example.metadata.filename}`);
    }
  }
  
  console.log('\n📊 Distribution:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([folder, count]) => {
      const bar = '█'.repeat(Math.min(20, count));
      console.log(`${folder.padEnd(20)}: ${bar} ${count}`);
    });
}

testRandomness().catch(console.error);