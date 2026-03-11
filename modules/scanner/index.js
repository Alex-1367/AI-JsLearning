// modules/scanner/index.js - COMPLETELY REPAIRED
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class Scanner {
  constructor(database, embeddings, state) {
    this.db = database;
    this.embeddings = embeddings;
    this.state = state;
    this.processedLog = path.join(process.cwd(), 'data', 'processed_files.log');
  }

  async updateIndex(forceRescan = false) {
    console.log('\n🔍 Scanning for updates...');
    console.log(`📁 Force rescan: ${forceRescan}`);

    const stats = {
      scanned: 0,
      new: 0,
      alreadyInDb: 0,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      errors: 0,
      totalIndexed: 0,
      batches: 0
    };

    // STEP 1: Get ALL files currently in database
    console.log('\n📚 Loading existing database records...');
    const dbFiles = await this.getAllDatabaseFiles();
    console.log(`   ✅ Found ${dbFiles.size} unique files in database`);

    // STEP 2: Scan folders for files on disk
    const folders = this.state.getFolders();
    console.log(`\n📁 Scanning folders: ${folders.join(', ')}`);

    const diskFiles = new Map();
    for (const folder of folders) {
      console.log(`  Scanning ${folder}...`);
      const files = await this.scanFolder(folder);
      console.log(`    Found ${files.length} files in ${folder}`);
      for (const file of files) {
        diskFiles.set(file.path, file);
      }
    }

    console.log(`\n📊 Total files on disk: ${diskFiles.size}`);

    // STEP 3: Check which files need processing
    console.log('\n🔍 Comparing with database...');
    const filesToProcess = [];

    for (const [filePath, fileInfo] of diskFiles) {
      stats.scanned++;

      try {
        // Check if file is already in database
        if (dbFiles.has(filePath) && !forceRescan) {
          stats.alreadyInDb++;
          if (stats.alreadyInDb % 100 === 0) {
            console.log(`   ✅ ${stats.alreadyInDb} files already in database (skipped)`);
          }
          continue;
        }

        // New file - read and prepare for processing
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = this.calculateHash(content);
        
        console.log(`  📄 New file: ${path.basename(filePath)}`);
        filesToProcess.push({ 
          ...fileInfo, 
          content, 
          hash, 
          action: 'new' 
        });
        stats.new++;

        // Process in batches
        if (filesToProcess.length >= 5) {
          console.log(`\n  📦 Processing batch ${++stats.batches} (${filesToProcess.length} files)...`);
          await this.processFileBatch(filesToProcess);
          stats.totalIndexed += filesToProcess.length;
          filesToProcess.length = 0;
          
          // Log progress
          const percent = ((stats.totalIndexed / (stats.new || 1)) * 100).toFixed(1);
          console.log(`  ✅ Progress: ${stats.totalIndexed}/${stats.new} new files (${percent}%)`);
        }

      } catch (error) {
        console.error(`❌ Error reading ${filePath}:`, error.message);
        stats.errors++;
      }
    }

    // Process remaining files
    if (filesToProcess.length > 0) {
      console.log(`\n  📦 Processing final batch (${filesToProcess.length} files)...`);
      await this.processFileBatch(filesToProcess);
      stats.totalIndexed += filesToProcess.length;
      stats.batches++;
    }

    // Check for deleted files
    console.log('\n🔍 Checking for deleted files...');
    for (const dbPath of dbFiles.keys()) {
      if (!diskFiles.has(dbPath)) {
        await this.deleteDocument(dbPath);
        stats.deleted++;
        console.log(`  🗑️  Deleted from DB: ${path.basename(dbPath)}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCAN COMPLETE - FINAL STATISTICS');
    console.log('='.repeat(60));
    console.log(`📁 Total files on disk: ${diskFiles.size}`);
    console.log(`📚 Already in database: ${stats.alreadyInDb}`);
    console.log(`📤 New files added: ${stats.totalIndexed}`);
    console.log(`📝 Changed files: ${stats.changed}`);
    console.log(`🗑️  Deleted from DB: ${stats.deleted}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`📦 Batches processed: ${stats.batches}`);
    
    const finalCount = await this.db.count();
    console.log(`\n📚 Final documents in database: ${finalCount}`);
    
    // Save processed files log
    await this.saveProcessedLog(diskFiles);
    
    return stats;
  }

  async getAllDatabaseFiles() {
    const dbFiles = new Map();
    let offset = 0;
    const limit = 1000;
    
    while (true) {
      try {
        const results = await this.db.getRecords({
          include: ["metadatas"],
          limit: limit,
          offset: offset
        });
        
        if (results.ids.length === 0) break;
        
        for (let i = 0; i < results.ids.length; i++) {
          const metadata = results.metadatas[i];
          if (metadata?.path) {
            dbFiles.set(metadata.path, {
              id: results.ids[i],
              hash: metadata.hash,
              indexedAt: metadata.indexedAt
            });
          }
        }
        
        offset += limit;
        console.log(`   Loaded ${dbFiles.size} database records...`);
        
      } catch (error) {
        console.error('Error loading database files:', error.message);
        break;
      }
    }
    
    return dbFiles;
  }

  async saveProcessedLog(diskFiles) {
    try {
      const logLines = [];
      for (const [path, info] of diskFiles) {
        logLines.push(`${new Date().toISOString()}|${path}|${info.filename}`);
      }
      await fs.writeFile(this.processedLog, logLines.join('\n'));
      console.log(`\n📝 Processed files log saved to: ${this.processedLog}`);
    } catch (error) {
      console.error('Error saving processed log:', error.message);
    }
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
    return folderName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  async processFileBatch(files) {
    const failedFiles = []; // CRITICAL FIX!
    
    console.log(`\n  📦 Processing batch of ${files.length} files:`);

    const docs = [];
    const ids = [];
    const embeddings = [];
    const metadatas = [];

    for (const file of files) {
      try {
        console.log(`    📄 Processing: ${path.basename(file.path)}`);

        const content = file.content || await fs.readFile(file.path, 'utf-8');

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

      } catch (error) {
        console.error(`    ❌ Failed to process ${path.basename(file.path)}:`, error.message);
        failedFiles.push(file.path); // Now this works!
      }
    }

    if (docs.length > 0) {
      try {
        console.log(`    💾 Storing ${docs.length} documents in ChromaDB...`);
        await this.db.addDocuments(docs, ids, embeddings, metadatas);
        console.log(`    ✅ Successfully stored ${docs.length} files`);
        
        // Update state for successful files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!failedFiles.includes(file.path)) {
            this.state.updateFileInfo(file.path, {
              hash: file.hash,
              fileId: ids[i],
              metadata: metadatas[i]
            });
          }
        }
        
        await this.state.save();
        
      } catch (error) {
        console.error(`    ❌ ChromaDB error:`, error.message);
      }
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
        this.state.removeFileInfo(filePath);
      } catch (error) {
        console.error(`Error deleting ${filePath}:`, error.message);
      }
    }
  }

  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}