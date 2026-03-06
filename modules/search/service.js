// modules/search/service.js
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
    
    // Get query embedding
    const queryEmbedding = await this.embeddings.getQueryEmbedding(query);
    
    // Search in database
    const results = await this.db.query(queryEmbedding, limit);
    
    if (!results.ids[0] || results.ids[0].length === 0) {
      console.log('❌ No results found.');
      return;
    }

    console.log('\n📚 Search Results:');
    console.log('='.repeat(60));

    results.ids[0].forEach((id, i) => {
      const metadata = results.metadatas[0][i];
      const distance = results.distances ? results.distances[0][i] : 0;
      const relevance = (1 - distance).toFixed(2);
      
      console.log(`\n${i + 1}. ${metadata.filename}`);
      console.log(`   📁 ${metadata.path}`);
      console.log(`   📊 Relevance: ${relevance}`);
      
      if (metadata.topic) {
        console.log(`   📌 Topic: ${metadata.topic}`);
      }
      
      if (metadata.patternPrefix) {
        console.log(`   🔢 Pattern: ${metadata.patternPrefix}#${metadata.patternNumber}`);
      }
      
      // Show preview
      const preview = results.documents[0][i].substring(0, 200).replace(/\n/g, ' ');
      console.log(`   📝 Preview: ${preview}...`);
    });

    // Ask if user wants to see full code
    await this.offerFullCode(results);
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

    results.ids.forEach((id, i) => {
      const meta = results.metadatas[i];
      console.log(`\n${i + 1}. ${meta.filename}`);
      console.log(`   📁 ${meta.path}`);
      if (meta.topic) console.log(`   📌 Topic: ${meta.topic}`);
    });

    await this.offerFullCode(results);
  }

  async listAllPatterns() {
    const results = await this.db.getRecords({
      include: ["metadatas"],
      limit: 1000
    });

    const patterns = new Map();
    
    results.metadatas.forEach(meta => {
      if (meta.patternPrefix && meta.patternNumber !== undefined) {
        const key = `${meta.patternPrefix}#${meta.patternNumber}`;
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
    
    sorted.forEach(p => {
      console.log(`\n  ${p.pattern}`);
      console.log(`     Topic: ${p.topic || 'unknown'}`);
      console.log(`     Example: ${p.path}`);
      if (p.count > 1) console.log(`     (${p.count} related files)`);
    });

    console.log(`\n📊 Total: ${sorted.length} unique patterns`);
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
    if (index >= 0 && index < results.ids[0].length) {
      console.log('\n' + '💻'.repeat(30));
      console.log('💻 FULL CODE');
      console.log('💻'.repeat(30));
      console.log('\n' + results.documents[0][index]);
    }

    rl.close();
  }

  async findExamplesByTopic(topic) {
    const results = await this.db.getRecords({
      where: { topic: { $eq: topic } },
      include: ["documents", "metadatas"],
      limit: 50
    });

    return results;
  }

  async findSimilarExamples(code, limit = 3) {
    const embedding = await this.embeddings.getEmbedding(code);
    const results = await this.db.query(embedding, limit + 1); // +1 to exclude the query itself if it's in DB
    
    return results;
  }
}