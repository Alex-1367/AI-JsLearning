process.on('uncaughtException', (err) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:');
  console.error(err);
  console.error('\n💡 The program will continue running...');
  // Don't exit - just log and continue
});

process.on('unhandledRejection', (err) => {
  console.error('\n❌ UNHANDLED REJECTION:');
  console.error(err);
  console.error('\n💡 The program will continue running...');
  // Don't exit - just log and continue
});

// index.js - CLEAN VERSION
import { DatabaseManager } from './modules/core/database.js';
import { EmbeddingService } from './modules/core/embeddings.js';
import { LLMService } from './modules/core/llm.js';
import { StateManager } from './modules/core/state.js';
import { Scanner } from './modules/scanner/index.js';
import { QuizEngine } from './modules/quiz/engine.js';
import { QuizLogger } from './modules/quiz/logger.js';
import { Generator } from './modules/quiz/generator.js';
import { GapAnalyzer } from './modules/analytics/gapAnalyzer.js';
import { Dashboard } from './modules/analytics/dashboard.js';
import { ExampleRecommender } from './modules/analytics/recommender.js';
import { ExampleCreator } from './modules/generator/exampleCreator.js';
import { SearchService } from './modules/search/service.js';
import { MenuSystem } from './modules/ui/menu.js';
import readline from 'readline';

class JSLearningSystem {
  constructor() {
    this.services = {};
  }

  async initialize() {
    console.log('\n🚀 Initializing JavaScript Learning System...\n');

    // Core services
    this.services.db = new DatabaseManager();
    await this.services.db.initialize();

    this.services.embeddings = new EmbeddingService();
    this.services.llm = new LLMService();
    this.services.state = new StateManager();
    await this.services.state.load();

    // Quiz services
    this.services.logger = new QuizLogger();
    this.services.generator = new Generator(this.services.llm);
    this.services.quizEngine = new QuizEngine(
      this.services.db,
      this.services.generator,
      this.services.logger
    );

    // Analytics services
    this.services.gapAnalyzer = new GapAnalyzer(
      this.services.db,
      this.services.logger,
      this.services.llm
    );

    this.services.dashboard = new Dashboard(
      this.services.logger,
      this.services.db,
      this.services.gapAnalyzer
    );

    // Example creation
    this.services.creator = new ExampleCreator(
      this.services.llm,
      this.services.db,
      this.services.state
    );

    // Recommendation engine - FIXED: 'this' not 'self'
    this.services.recommender = new ExampleRecommender(
      this.services.db,
      this.services.logger,
      this.services.gapAnalyzer,
      this.services.creator
    );

    // Search
    this.services.search = new SearchService(
      this.services.db,
      this.services.embeddings
    );

    // Scanner
    this.services.scanner = new Scanner(
      this.services.db,
      this.services.embeddings,
      this.services.state
    );

    return this;
  }

  async promptYesNo(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async start() {
    // Check first run
    const count = await this.services.db.count();

    if (count === 0) {
      console.log('📥 First run detected.');
      const shouldScan = await this.promptYesNo('Scan your folders now? (y/n): ');

      if (shouldScan) {
        console.log('📚 Scanning folders...');
        await this.services.scanner.updateIndex();
        console.log('✅ Scan complete!');
      }
    }

    // Start menu system
    const menu = new MenuSystem(this.services);
    await menu.start();
  }
}

// Start the system
try {
  const system = new JSLearningSystem();
  await system.initialize();
  await system.start();
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}