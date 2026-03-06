// modules/generator/exampleCreator.js
import fs from 'fs/promises';
import path from 'path';
import { createInterface } from 'readline';

export class ExampleCreator {
  constructor(llm, database, state) {
    this.llm = llm;
    this.db = database;
    this.state = state;
    this.basePaths = [
      '/home/admin/Bak/Angular/JS-TEST1',
      '/home/admin/Bak/Angular/JS-TEST2',
      '/home/admin/Bak/Angular/JS-TEST3'
    ];
  }

  async generateForWeakTopic() {
    // Get weakest topics from logger (would need logger injected)
    console.log('\n📊 Analyzing your performance to find weak topics...');
    
    // For now, ask user directly
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const topic = await new Promise(resolve => {
      rl.question('\n🎯 Which topic do you want to practice? ', resolve);
    });

    rl.close();

    if (!topic) return;

    await this.generateExamplesForTopic(topic);
  }

  async generateExamplesForTopic(topic, count = 1) {
    console.log(`\n🤔 Generating ${count} new example(s) about ${topic}...`);

    // Get existing examples for context
    const existing = await this.db.getRecords({
      where: { topic: { $eq: topic } },
      include: ["documents", "metadatas"],
      limit: 10
    });

    // Determine prefix from existing examples or create new
    let prefix = this.determinePrefix(topic, existing);
    
    // Find next available number
    const startNumber = this.state.getNextExampleNumber(topic, prefix);

    for (let i = 0; i < count; i++) {
      const exampleNumber = startNumber + i;
      console.log(`\n📝 Generating example #${exampleNumber}...`);

      const example = await this.generateSingleExample(topic, existing, exampleNumber);
      
      if (!example) {
        console.log(`❌ Failed to generate example #${exampleNumber}`);
        continue;
      }

      // Preview the example
      await this.previewExample(example);

      // Ask for approval
      const approved = await this.getApproval();
      
      if (approved) {
        const saved = await this.saveExample(example, topic, prefix, exampleNumber);
        if (saved) {
          console.log(`✅ Example saved as: ${saved.filename}`);
          this.state.trackGeneratedExample(topic, saved.path, exampleNumber);
          await this.state.save();
        }
      } else {
        console.log('⏭️  Skipping this example.');
      }
    }
  }

  determinePrefix(topic, existing) {
    // Look for existing pattern
    if (existing.metadatas && existing.metadatas.length > 0) {
      for (const meta of existing.metadatas) {
        if (meta.patternPrefix) {
          return meta.patternPrefix;
        }
      }
    }

    // Create new prefix from topic
    // e.g., "async-await" -> "AA", "bigint" -> "BG"
    const words = topic.split(/[-_]/);
    if (words.length === 1) {
      return topic.substring(0, 2).toUpperCase();
    } else {
      return words.map(w => w[0]).join('').toUpperCase();
    }
  }

  async generateSingleExample(topic, existing, number) {
    const existingCode = existing.documents || [];
    
    const prompt = `You are a JavaScript teacher. Create a new example about "${topic}" that will help someone learn.

${existingCode.length > 0 ? 'Existing examples on this topic (make yours DIFFERENT):\n' + 
  existingCode.slice(0, 3).map((code, i) => 
    `Example ${i + 1}:\n\`\`\`javascript\n${code.substring(0, 200)}...\n\`\`\``).join('\n') : ''}

Create a NEW example (#${number}) that:
- Tests understanding of ${topic} in a unique way
- Is educational and has a clear output
- Includes comments explaining key points
- Covers edge cases or tricky aspects

Return in this EXACT JSON format:
{
  "code": "The complete JavaScript code example",
  "description": "What this example demonstrates (1-2 sentences)",
  "output": "Expected output when run",
  "explanation": "Step-by-step explanation of what happens",
  "concepts": ["specific concept 1", "concept 2", "concept 3"],
  "difficulty": "easy|medium|hard"
}

Make sure the code:
- Is complete and runnable
- Has clear comments
- Demonstrates the concept effectively
- Is different from existing examples
- Includes console.log statements to show output

Return ONLY the JSON.`;

    return this.llm.generateJSON(prompt);
  }

  async previewExample(example) {
    console.log('\n' + '='.repeat(60));
    console.log('📝 EXAMPLE PREVIEW');
    console.log('='.repeat(60));
    
    console.log(`\n📌 Description: ${example.description}`);
    console.log(`\n📊 Difficulty: ${example.difficulty}`);
    console.log(`\n📚 Concepts: ${example.concepts.join(', ')}`);
    
    console.log('\n💻 Code:');
    console.log('-'.repeat(40));
    console.log(example.code);
    console.log('-'.repeat(40));
    
    console.log(`\n🔮 Expected Output: ${example.output}`);
    console.log(`\n💡 Explanation: ${example.explanation}`);
    console.log('='.repeat(60));
  }

  async getApproval() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n❓ Save this example? (y/n/e for edit): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() === 'e') {
      // Allow editing (simplified - in real system you'd open an editor)
      console.log('📝 Edit mode - please manually edit the file after creation.');
      return true;
    }

    return answer.toLowerCase() === 'y';
  }

  async saveExample(example, topic, prefix, number) {
    // Determine target folder
    let targetFolder = null;
    
    // Check existing folders
    for (const basePath of this.basePaths) {
      const potentialFolder = path.join(basePath, this.topicToFolderName(topic));
      try {
        await fs.access(potentialFolder);
        targetFolder = potentialFolder;
        break;
      } catch {
        // Folder doesn't exist, continue
      }
    }

    // If no existing folder, create in JS-TEST3
    if (!targetFolder) {
      targetFolder = path.join(this.basePaths[2], this.topicToFolderName(topic));
      await fs.mkdir(targetFolder, { recursive: true });
      console.log(`📁 Created new folder: ${targetFolder}`);
    }

    const filename = `${prefix}#${number.toString().padStart(2, '0')}.js`;
    const filePath = path.join(targetFolder, filename);

    // Check if file already exists
    try {
      await fs.access(filePath);
      console.log(`❌ File already exists: ${filename}`);
      return null;
    } catch {
      // File doesn't exist, good to create
    }

    // Format code with proper spacing
    const formattedCode = `// ${topic} Example #${number}
// ${example.description}
// Difficulty: ${example.difficulty}
// Concepts: ${example.concepts.join(', ')}

${example.code}`;

    // Write the file
    await fs.writeFile(filePath, formattedCode);
    
    // Also create an explanation file
    await this.saveExplanation(example, topic, prefix, number, targetFolder, filePath);

    return {
      path: filePath,
      filename,
      folder: targetFolder,
      number
    };
  }

  async saveExplanation(example, topic, prefix, number, targetFolder, jsPath) {
    const explanationPath = jsPath.replace('.js', '.md');
    
    const explanation = `# ${topic} Example #${number}

## Description
${example.description}

## Difficulty
${example.difficulty}

## Concepts Covered
${example.concepts.map(c => `- ${c}`).join('\n')}

## Code
\`\`\`javascript
${example.code}
\`\`\`

## Expected Output
\`\`\`
${example.output}
\`\`\`

## Explanation
${example.explanation}

## What To Look For
- Pay attention to how ${example.concepts[0]} works
- Notice the edge cases
- Try modifying the code to test your understanding

## Related Examples
- Check other ${prefix}# examples in this folder
- Compare with different difficulty levels
`;

    await fs.writeFile(explanationPath, explanation);
  }

  topicToFolderName(topic) {
    // Convert 'async-await' to 'AsyncAwait'
    return topic.split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  async generateBatchForTopic(topic, count = 3) {
    console.log(`\n📚 Generating batch of ${count} examples for ${topic}...`);
    
    const results = {
      topic,
      requested: count,
      generated: 0,
      saved: 0,
      examples: []
    };

    for (let i = 0; i < count; i++) {
      results.generated++;
      await this.generateExamplesForTopic(topic, 1);
    }

    return results;
  }

  async generateMissingTopics() {
    // This would integrate with GapAnalyzer to generate examples for missing topics
    console.log('\n🔍 This feature requires GapAnalyzer integration.');
    console.log('Please run option 9 first to analyze gaps.');
  }
}