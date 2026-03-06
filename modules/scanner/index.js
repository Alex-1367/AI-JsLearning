// modules/scanner/index.js
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
    
    const stats = {
      scanned: 0,
      new: 0,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      errors: 0
    };

    // Get all current files from folders
    const folders = this.state.getFolders();
    const currentFiles = new Map();
    
    for (const folder of folders) {
      const files = await this.scanFolder(folder);
      for (const file of files) {
        currentFiles.set(file.path, file);
      }
    }

    // Check for deleted files
    const previousPaths = Object.keys(this.state.state.indexedFiles);
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

    for (const [filePath, fileInfo] of currentFiles) {
      stats.scanned++;
      
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = this.calculateHash(content);
      const previous = this.state.getFileInfo(filePath);

      if (!previous) {
        filesToProcess.push({ ...fileInfo, content, hash, action: 'new' });
        stats.new++;
      } else if (previous.hash !== hash) {
        filesToProcess.push({ ...fileInfo, content, hash, action: 'changed' });
        stats.changed++;
      } else {
        stats.unchanged++;
      }

      if (filesToProcess.length >= batchSize) {
        await this.processFileBatch(filesToProcess);
        filesToProcess.length = 0;
      }
    }

    if (filesToProcess.length > 0) {
      await this.processFileBatch(filesToProcess);
    }

    // Update state
    this.state.state.lastScan = new Date().toISOString();
    await this.state.save();

    this.printSummary(stats);
    return stats;
  }

  async scanFolder(folderPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden folders
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

    if (patterns.jsExamples.test(filename)) {
      const pattern = this.extractNumberingPattern(filename);
      return {
        path: fullPath,
        type: 'example',
        filename,
        pattern,
        category: 'js-example'
      };
    }
    else if (patterns.explanations.test(filename)) {
      return {
        path: fullPath,
        type: 'explanation',
        filename,
        category: 'explanation',
        relatedExample: this.findRelatedExample(filename, path.dirname(fullPath))
      };
    }
    else if (patterns.otherJs.test(filename)) {
      return {
        path: fullPath,
        type: 'other',
        filename,
        category: 'other-js'
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

  async processFileBatch(files) {
    const docs = [];
    const ids = [];
    const embeddings = [];
    const metadatas = [];

    for (const file of files) {
      try {
        const content = file.content || await fs.readFile(file.path, 'utf-8');
        
        // Extract topic from folder structure
        const folderName = path.basename(path.dirname(file.path));
        const topic = this.folderToTopic(folderName);

        const metadata = {
          path: file.path,
          folder: folderName,
          filename: file.filename,
          type: file.type,
          category: file.category,
          topic: topic,
          indexedAt: new Date().toISOString(),
          hash: file.hash
        };

        if (file.pattern) {
          metadata.patternPrefix = file.pattern.prefix;
          metadata.patternNumber = file.pattern.number;
          metadata.hasNumbering = true;
        }

        if (file.relatedExample && file.relatedExample.length > 0) {
          metadata.relatedExamples = file.relatedExample.join('|');
        }

        // Generate embedding
        const embedding = await this.embeddings.getEmbedding(content);
        
        const fileId = `${file.category}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        docs.push(content);
        ids.push(fileId);
        embeddings.push(embedding);
        metadatas.push(metadata);

        // Update state
        this.state.updateFileInfo(file.path, {
          hash: file.hash,
          fileId,
          metadata
        });

      } catch (error) {
        console.error(`❌ Error processing ${file.path}:`, error.message);
      }
    }

    if (docs.length > 0) {
      // For changed files, delete old versions first
      const changedFiles = files.filter(f => f.action === 'changed');
      for (const file of changedFiles) {
        await this.deleteDocument(file.path);
      }

      // Add new versions
      await this.db.addDocuments(docs, ids, embeddings, metadatas);
      
      const action = files.some(f => f.action === 'changed') ? 'Updated' : 'Added';
      console.log(`  ${action} ${files.length} files`);
    }
  }

  folderToTopic(folderName) {
    // Convert folder names like "BigInt" to "bigint", "AsyncAwait" to "async-await"
    return folderName
      .replace(/([A-Z])/g, '-$1') // Add hyphen before capitals
      .toLowerCase()
      .replace(/^-/, ''); // Remove leading hyphen
  }

  async deleteDocument(filePath) {
    const fileInfo = this.state.getFileInfo(filePath);
    if (fileInfo && fileInfo.fileId) {
      await this.db.deleteRecords([fileInfo.fileId]);
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
    if (stats.errors > 0) console.log(`  ❌ Errors: ${stats.errors}`);
  }
}