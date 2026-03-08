// modules/core/state.js - FIXED
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class StateManager {
  constructor() {
    this.stateFile = path.join(process.cwd(), 'data', 'state.json');
    this.state = {
      lastScan: null,
      indexedFiles: {},
      folderPatterns: [
        '/home/admin/Bak/Angular/JS-TEST1',
        '/home/admin/Bak/Angular/JS-TEST2',
        '/home/admin/Bak/Angular/JS-TEST3'
      ],
      filePatterns: {
        jsExamples: /^[A-Z]+#\d+\.js$/i,
        explanations: /\.(txt|md|html?)$/i,
        otherJs: /\.js$/i
      },
      stats: {
        totalQuizzes: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        lastQuizDate: null,
        topicStats: {}
      },
      generatedExamples: {}
    };
    this.initialized = false;
  }

  async load() {
    try {
      await this.ensureDirectory();
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const loadedState = JSON.parse(data);
      
      // Merge with defaults to ensure all fields exist
      this.state = {
        ...this.state,
        ...loadedState,
        stats: {
          ...this.state.stats,
          ...(loadedState.stats || {})
        },
        filePatterns: this.state.filePatterns // Keep default patterns
      };
      
      this.initialized = true;
      console.log('📂 State loaded successfully');
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('🆕 No existing state found, creating new state');
        await this.save();
        this.initialized = true;
        return false;
      }
      console.error('Error loading state:', e);
      return false;
    }
  }

  async ensureDirectory() {
    const dir = path.dirname(this.stateFile);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async save() {
    await this.ensureDirectory();
    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  // File tracking
  isFileIndexed(filePath) {
    return !!this.state.indexedFiles[filePath];
  }

  getFileInfo(filePath) {
    return this.state.indexedFiles[filePath];
  }

  updateFileInfo(filePath, info) {
    this.state.indexedFiles[filePath] = {
      ...info,
      lastUpdated: new Date().toISOString()
    };
  }

  removeFileInfo(filePath) {
    delete this.state.indexedFiles[filePath];
  }

  getIndexedCount() {
    return Object.keys(this.state.indexedFiles).length;
  }

  // Generated examples tracking
  trackGeneratedExample(topic, filePath, number) {
    if (!this.state.generatedExamples[topic]) {
      this.state.generatedExamples[topic] = [];
    }
    this.state.generatedExamples[topic].push({
      path: filePath,
      number,
      createdAt: new Date().toISOString()
    });
  }

  getNextExampleNumber(topic, prefix) {
    const examples = this.state.generatedExamples[topic] || [];
    const numbers = examples
      .filter(e => e.path.includes(`${prefix}#`))
      .map(e => {
        const match = e.path.match(/#(\d+)\.js/);
        return match ? parseInt(match[1]) : -1;
      })
      .filter(n => n >= 0)
      .sort((a, b) => a - b);

    if (numbers.length === 0) return 0;
    
    for (let i = 0; i <= numbers.length; i++) {
      if (numbers[i] !== i) return i;
    }
    return numbers.length;
  }

  // Quiz stats
  recordQuizResult(correct, topic) {
    this.state.stats.totalQuizzes++;
    if (correct) {
      this.state.stats.correctAnswers++;
    } else {
      this.state.stats.wrongAnswers++;
    }
    this.state.stats.lastQuizDate = new Date().toISOString();
    
    if (!this.state.stats.topicStats[topic]) {
      this.state.stats.topicStats[topic] = { correct: 0, wrong: 0 };
    }
    
    if (correct) {
      this.state.stats.topicStats[topic].correct++;
    } else {
      this.state.stats.topicStats[topic].wrong++;
    }
  }

  getTopicStats(topic) {
    return this.state.stats.topicStats[topic] || { correct: 0, wrong: 0 };
  }

  getOverallStats() {
    return {
      ...this.state.stats,
      successRate: this.state.stats.totalQuizzes > 0 
        ? (this.state.stats.correctAnswers / this.state.stats.totalQuizzes * 100).toFixed(1)
        : 0
    };
  }

  // Folder management
  addFolder(folderPath) {
    if (!this.state.folderPatterns.includes(folderPath)) {
      this.state.folderPatterns.push(folderPath);
    }
  }

  removeFolder(folderPath) {
    this.state.folderPatterns = this.state.folderPatterns.filter(f => f !== folderPath);
  }

  getFolders() {
    return [...this.state.folderPatterns];
  }
}