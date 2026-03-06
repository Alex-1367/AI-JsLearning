// modules/quiz/logger.js
import fs from 'fs/promises';
import path from 'path';

export class QuizLogger {
  constructor() {
    this.logFile = path.join(process.cwd(), 'data', 'quiz-log.jsonl');
    this.ensureLogFile();
  }

  async ensureLogFile() {
    const dir = path.dirname(this.logFile);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async logAnswer(entry) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
  }

  async getPerformanceByTopic() {
    const logs = await this.readLogs();
    const performance = {};

    logs.forEach(log => {
      if (!log.topic) return;
      
      if (!performance[log.topic]) {
        performance[log.topic] = {
          attempts: 0,
          correct: 0,
          wrong: 0,
          examples: new Set()
        };
      }
      
      performance[log.topic].attempts++;
      if (log.correct) {
        performance[log.topic].correct++;
      } else {
        performance[log.topic].wrong++;
      }
      performance[log.topic].examples.add(log.exampleId || log.examplePath);
    });

    // Calculate success rates
    Object.keys(performance).forEach(topic => {
      const p = performance[topic];
      p.successRate = (p.correct / p.attempts * 100).toFixed(1);
      p.exampleCount = p.examples.size;
      delete p.examples;
    });

    return performance;
  }

  async getWeakestTopics(limit = 3) {
    const performance = await this.getPerformanceByTopic();
    
    return Object.entries(performance)
      .map(([topic, stats]) => ({
        topic,
        ...stats,
        struggleScore: (stats.wrong / stats.attempts * 100) // Higher = more struggles
      }))
      .filter(t => t.attempts >= 3) // Only topics with enough data
      .sort((a, b) => b.struggleScore - a.struggleScore)
      .slice(0, limit);
  }

  async readLogs() {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  async getRecentMistakes(limit = 5) {
    const logs = await this.readLogs();
    return logs
      .filter(log => !log.correct)
      .reverse()
      .slice(0, limit);
  }
}