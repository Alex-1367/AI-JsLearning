// modules/search/service.js - FIXED
import { createInterface } from 'readline';

export class SearchService {
  constructor(database, embeddings) {
    this.db = database;
    this.embeddings = embeddings;
  }

  async searchByConcept() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const query = await new Promise(resolve => {
      rl.question('\n🔍 Enter concept to search for: ', resolve);
    });

    rl.close();
    
    if (!query) return;
    
    await this.performSearch(query);
  }

  async performSearch(query, limit = 5) {
    console.log(`\n🔎 Searching for: "${query}"`);
    
    // If query looks like a pattern (e.g., EV#20), use pattern search
    if (query.includes('#')) {
      await this.searchByPatternString(query);
      return;
    }
    
    // Otherwise do semantic search
    try {
      const queryEmbedding = await this.embeddings.getQueryEmbedding(query);
      const results = await this.db.query(queryEmbedding, limit);
      
      if (!results.ids[0] || results.ids[0].length === 0) {
        console.log('❌ No results found.');
        return;
      }

      console.log('\n📚 Search Results:');
      console.log('='.repeat(60));

      for (let i = 0; i < results.ids[0].length; i++) {
        const metadata = results.metadatas[0][i];
        const distance = results.distances ? results.distances[0][i] : 0;
        const relevance = (1 - distance).toFixed(2);
        
        console.log(`\n${i + 1}. ${metadata.filename || 'Unknown'}`);
        console.log(`   📁 ${metadata.path || 'Unknown path'}`);
        console.log(`   📊 Relevance: ${relevance}`);
        
        if (metadata.topic) {
          console.log(`   📌 Topic: ${metadata.topic}`);
        }
        
        if (metadata.patternPrefix) {
          console.log(`   🔢 Pattern: ${metadata.patternPrefix}#${metadata.patternNumber}`);
        }
        
        const preview = results.documents[0][i].substring(0, 150).replace(/\n/g, ' ');
        console.log(`   📝 Preview: ${preview}...`);
      }
    } catch (error) {
      console.error('Search error:', error.message);
    }
  }

  async searchByPattern() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const pattern = await new Promise(resolve => {
      rl.question('\n🔢 Enter pattern (e.g., BG#05 or just BG): ', resolve);
    });

    rl.close();

    if (!pattern) return;

    await this.searchByPatternString(pattern);
  }

  async searchByPatternString(pattern) {
    console.log(`\n🔎 Searching for pattern: ${pattern}`);
    
    try {
      let where = {};
      
      if (pattern.includes('#')) {
        const [prefix, number] = pattern.split('#');
        where = {
          $and: [
            { patternPrefix: { $eq: prefix } },
            { patternNumber: { $eq: parseInt(number) } }
          ]
        };
      } else {
        where = { patternPrefix: { $eq: pattern } };
      }

      const results = await this.db.getRecords({
        where,
        include: ["documents", "metadatas"],
        limit: 20
      });

      if (results.ids.length === 0) {
        console.log(`❌ No files found with pattern: ${pattern}`);
        return;
      }

      console.log(`\n📚 Found ${results.ids.length} files with pattern ${pattern}:`);
      console.log('='.repeat(60));

      for (let i = 0; i < results.ids.length; i++) {
        const meta = results.metadatas[i];
        console.log(`\n${i + 1}. ${meta.filename}`);
        console.log(`   📁 ${meta.path}`);
        if (meta.topic) console.log(`   📌 Topic: ${meta.topic}`);
      }

      // Ask if user wants to see full code
      await this.offerFullCode(results);
      
    } catch (error) {
      console.error('Pattern search error:', error.message);
    }
  }

  async listAllPatterns() {
    try {
      const results = await this.db.getRecords({
        include: ["metadatas"],
        limit: 1000
      });

      const patterns = new Map();
      
      results.metadatas.forEach(meta => {
        if (meta.patternPrefix && meta.patternNumber !== undefined) {
          const key = `${meta.patternPrefix}#${meta.patternNumber.toString().padStart(2, '0')}`;
          if (!patterns.has(key)) {
            patterns.set(key, {
              pattern: key,
              topic: meta.topic,
              path: meta.path,
              count: 1
            });
          } else {
            patterns.get(key).count++;
          }
        }
      });

      const sorted = Array.from(patterns.values())
        .sort((a, b) => a.pattern.localeCompare(b.pattern));

      console.log('\n📋 Available Patterns:');
      console.log('='.repeat(60));
      
      if (sorted.length === 0) {
        console.log('  No patterns found. Run update index first.');
        return;
      }
      
      sorted.forEach(p => {
        console.log(`\n  ${p.pattern}`);
        console.log(`     Topic: ${p.topic || 'unknown'}`);
        console.log(`     Example: ${p.path}`);
        if (p.count > 1) console.log(`     (${p.count} related files)`);
      });

      console.log(`\n📊 Total: ${sorted.length} unique patterns`);
      
    } catch (error) {
      console.error('Error listing patterns:', error.message);
    }
  }

  async offerFullCode(results) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n📝 View full code? (Enter number or n): ', resolve);
    });

    if (answer.toLowerCase() === 'n') {
      rl.close();
      return;
    }

    const index = parseInt(answer) - 1;
    if (index >= 0 && index < results.ids.length) {
      console.log('\n' + '💻'.repeat(30));
      console.log('💻 FULL CODE');
      console.log('💻'.repeat(30));
      console.log('\n' + results.documents[index]);
    }

    rl.close();
  }
}