// modules/scanner/index.js - FIXED
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class Scanner {
  constructor(database, embeddings, state) {
    this.db = database;
    this.embeddings = embeddings;
    this.state = state;
  }

  async updateIndex(forceRescan = false) {
    console.log('\n🔍 Scanning for updates...');
    console.log(`📁 Force rescan: ${forceRescan}`);

    const stats = {
      scanned: 0,
      new: 0,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      errors: 0,
      totalIndexed: 0,
      batches: 0
    };

    // Get all current files from folders
    const folders = this.state.getFolders();
    console.log(`📁 Scanning folders: ${folders.join(', ')}`);

    const currentFiles = new Map();

    for (const folder of folders) {
      console.log(`  Scanning ${folder}...`);
      const files = await this.scanFolder(folder);
      console.log(`    Found ${files.length} files in ${folder}`);
      for (const file of files) {
        currentFiles.set(file.path, file);
      }
    }

    console.log(`📊 Found ${currentFiles.size} total files to process`);

    if (currentFiles.size === 0) {
      console.log('❌ No files found! Check folder paths.');
      return stats;
    }

    // Check for deleted files
    const previousPaths = Object.keys(this.state.state.indexedFiles || {});
    console.log(`📋 Previously indexed: ${previousPaths.length} files`);

    for (const prevPath of previousPaths) {
      if (!currentFiles.has(prevPath)) {
        await this.deleteDocument(prevPath);
        this.state.removeFileInfo(prevPath);
        stats.deleted++;
      }
    }

    // Process current files in batches
    const batchSize = 5;
    const filesToProcess = [];
    let totalProcessed = 0;

    for (const [filePath, fileInfo] of currentFiles) {
      stats.scanned++;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = this.calculateHash(content);
        const previous = this.state.getFileInfo(filePath);

        if (!previous) {
          filesToProcess.push({ ...fileInfo, content, hash, action: 'new' });
          stats.new++;
          console.log(`  📄 New file: ${path.basename(filePath)}`);
        } else if (previous.hash !== hash || forceRescan) {
          filesToProcess.push({ ...fileInfo, content, hash, action: 'changed' });
          stats.changed++;
          console.log(`  📝 Changed file: ${path.basename(filePath)}`);
        } else {
          stats.unchanged++;
        }

        if (filesToProcess.length >= batchSize) {
          console.log(`\n  📦 Processing batch ${++stats.batches} (${filesToProcess.length} files)...`);
          await this.processFileBatch(filesToProcess);
          stats.totalIndexed += filesToProcess.length;
          totalProcessed += filesToProcess.length;
          console.log(`  ✅ Batch complete. Total processed: ${totalProcessed}/${currentFiles.size}`);
          filesToProcess.length = 0;
        }
      } catch (error) {
        console.error(`❌ Error reading ${filePath}:`, error.message);
        stats.errors++;
      }
    }

    if (filesToProcess.length > 0) {
      console.log(`\n  📦 Processing final batch (${filesToProcess.length} files)...`);
      await this.processFileBatch(filesToProcess);
      stats.totalIndexed += filesToProcess.length;
      totalProcessed += filesToProcess.length;
      stats.batches++;
    }

    // Update state
    this.state.state.lastScan = new Date().toISOString();
    await this.state.save();

    console.log('\n' + '='.repeat(50));
    console.log('📈 SCAN COMPLETE');
    console.log('='.repeat(50));
    console.log(`📁 Total files found: ${currentFiles.size}`);
    console.log(`📦 Total batches: ${stats.batches}`);
    console.log(`✅ Total indexed: ${stats.totalIndexed}`);
    console.log(`📊 New files: ${stats.new}`);
    console.log(`📝 Changed files: ${stats.changed}`);
    console.log(`⏺️ Unchanged: ${stats.unchanged}`);
    console.log(`🗑️ Deleted: ${stats.deleted}`);
    if (stats.errors > 0) console.log(`❌ Errors: ${stats.errors}`);

    // Show final count
    const finalCount = await this.db.count();
    console.log(`\n📚 Final documents in database: ${finalCount}`);

    return stats;
  }

  async scanFolder(folderPath) {
    const files = [];

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subFiles = await this.scanFolder(fullPath);
            files.push(...subFiles);
          }
        } else {
          const fileInfo = this.categorizeFile(fullPath, entry.name);
          if (fileInfo) {
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${folderPath}:`, error.message);
    }

    return files;
  }

  categorizeFile(fullPath, filename) {
    const patterns = this.state.state.filePatterns;

    // Check for JS examples with pattern (RP#01.js, BG#00.js)
    if (patterns.jsExamples.test(filename)) {
      const pattern = this.extractNumberingPattern(filename);
      const folderName = path.basename(path.dirname(fullPath));
      const topic = this.folderToTopic(folderName);

      return {
        path: fullPath,
        type: 'example',
        filename,
        pattern,
        category: 'js-example',
        topic: topic
      };
    }
    // Check for explanation files
    else if (patterns.explanations.test(filename)) {
      return {
        path: fullPath,
        type: 'explanation',
        filename,
        category: 'explanation',
        relatedExample: this.findRelatedExample(filename, path.dirname(fullPath))
      };
    }
    // Check for other JS files
    else if (patterns.otherJs.test(filename)) {
      const folderName = path.basename(path.dirname(fullPath));
      const topic = this.folderToTopic(folderName);

      return {
        path: fullPath,
        type: 'other',
        filename,
        category: 'other-js',
        topic: topic
      };
    }

    return null;
  }

  extractNumberingPattern(filename) {
    const match = filename.match(/^([A-Z]+)#(\d+)\.js$/i);
    if (match) {
      return {
        prefix: match[1],
        number: parseInt(match[2]),
        full: filename
      };
    }
    return null;
  }

  findRelatedExample(filename, folderPath) {
    const base = filename.replace(/\.(txt|md|html?)$/i, '');
    const possibleJsFiles = [
      `${base}.js`,
      `${base}#01.js`,
      `${base.split('#')[0]}#${base.split('#')[1] || '01'}.js`
    ];

    return possibleJsFiles
      .map(jsFile => path.join(folderPath, jsFile))
      .filter(jsPath => {
        try {
          return fs.access(jsPath).then(() => true).catch(() => false);
        } catch {
          return false;
        }
      });
  }

  folderToTopic(folderName) {
    // Convert folder names like "BigInt" to "bigint", "AsyncAwait" to "async-await"
    return folderName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  async processFileBatch(files) {
    console.log(`\n  📦 Processing batch of ${files.length} files:`);

    // Group by top-level folder for better organization
    const byBaseFolder = {};

    for (const file of files) {
      const baseFolder = path.basename(path.dirname(path.dirname(file.path))) +
        '/' + path.basename(path.dirname(file.path));

      if (!byBaseFolder[baseFolder]) {
        byBaseFolder[baseFolder] = [];
      }
      byBaseFolder[baseFolder].push(file);
    }

    // Log each group
    for (const [folder, groupFiles] of Object.entries(byBaseFolder)) {
      console.log(`     📁 ${folder}/ (${groupFiles.length} files):`);

      // Show first 3 files in this group
      groupFiles.slice(0, 3).forEach(file => {
        const action = file.action === 'changed' ? '📝' : '📄';
        console.log(`        ${action} ${path.basename(file.path)}`);
      });

      if (groupFiles.length > 3) {
        console.log(`        ... and ${groupFiles.length - 3} more`);
      }
    }

    // Continue with actual processing...
    const docs = [];
    const ids = [];
    const embeddings = [];
    const metadatas = [];

    for (const file of files) {
      try {
        console.log(`    📄 Processing: ${path.basename(file.path)}`);

        const content = file.content || await fs.readFile(file.path, 'utf-8');

        // Skip empty files
        if (!content || content.trim().length === 0) {
          console.log(`    ⚠️  Skipping empty file: ${path.basename(file.path)}`);
          continue;
        }

        const metadata = {
          path: file.path,
          folder: path.basename(path.dirname(file.path)),
          filename: file.filename,
          type: file.type,
          category: file.category,
          topic: file.topic || 'unknown',
          indexedAt: new Date().toISOString(),
          hash: file.hash
        };

        if (file.pattern) {
          metadata.patternPrefix = file.pattern.prefix;
          metadata.patternNumber = file.pattern.number;
          metadata.hasNumbering = true;
        }

        console.log(`      Generating embedding...`);
        const embedding = await this.embeddings.getEmbedding(content);
        console.log(`      ✅ Embedding generated (${embedding.length} dimensions)`);

        const fileId = `${file.category}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        docs.push(content);
        ids.push(fileId);
        embeddings.push(embedding);
        metadatas.push(metadata);

        this.state.updateFileInfo(file.path, {
          hash: file.hash,
          fileId,
          metadata
        });

      } catch (error) {
        console.error(`    ❌ Failed to process ${path.basename(file.path)}:`, error.message);
        failedFiles.push(file.path);
      }
    }

    if (docs.length > 0) {
      try {
        console.log(`    💾 Storing ${docs.length} documents in ChromaDB...`);

        // Delete old versions first
        const changedFiles = files.filter(f => f.action === 'changed');
        for (const file of changedFiles) {
          await this.deleteDocument(file.path);
        }

        await this.db.addDocuments(docs, ids, embeddings, metadatas);

        const action = files.some(f => f.action === 'changed') ? 'Updated' : 'Added';
        console.log(`    ✅ ${action} ${docs.length} files successfully`);

        // Save state after successful batch
        await this.state.save();

      } catch (error) {
        console.error(`    ❌ ChromaDB error:`, error.message);
        console.error(`    Files in this batch were not saved`);
      }
    } else {
      console.log(`    ⚠️  No valid documents in this batch`);
    }

    if (failedFiles.length > 0) {
      console.log(`    ⚠️  Failed files: ${failedFiles.length}`);
      failedFiles.forEach(f => console.log(`      - ${path.basename(f)}`));
    }
  }

  async deleteDocument(filePath) {
    const fileInfo = this.state.getFileInfo(filePath);
    if (fileInfo && fileInfo.fileId) {
      try {
        await this.db.deleteRecords([fileInfo.fileId]);
      } catch (error) {
        // Ignore if already deleted
      }
    }
  }

  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  printSummary(stats) {
    console.log('\n📈 Scan Summary:');
    console.log(`  📁 Scanned: ${stats.scanned} files`);
    console.log(`  ✅ New: ${stats.new}`);
    console.log(`  📝 Changed: ${stats.changed}`);
    console.log(`  ⏺️ Unchanged: ${stats.unchanged}`);
    console.log(`  🗑️ Deleted: ${stats.deleted}`);
    console.log(`  📚 Indexed: ${stats.totalIndexed}`);
    if (stats.errors > 0) console.log(`  ❌ Errors: ${stats.errors}`);
  }
}