// modules/core/state.js
import fs from 'fs/promises';
import path from 'path';

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
        lastQuizDate: null
      },
      generatedExamples: {} // Track examples we've generated
    };
  }

  async load() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(data);
      console.log('📂 State loaded successfully');
    } catch (e) {
      console.log('🆕 No existing state found, starting fresh');
      await this.ensureDirectory();
      await this.save();
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
    
    // Find first gap
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
    
    // Track per-topic stats
    if (!this.state.stats.topicStats) {
      this.state.stats.topicStats = {};
    }
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
    return this.state.stats.topicStats?.[topic] || { correct: 0, wrong: 0 };
  }

  getOverallStats() {
    const stats = this.state.stats;
    return {
      ...stats,
      successRate: stats.totalQuizzes > 0 
        ? (stats.correctAnswers / stats.totalQuizzes * 100).toFixed(1)
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