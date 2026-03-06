// index.js
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
      this.services.db
    );

    // Recommendation engine
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

    // Check if first run
    const count = await this.services.db.count();
    if (count === 0) {
      console.log('📥 First run detected. Would you like to scan your folders?');
      const menu = new MenuSystem(this.services);
      const answer = await menu.question('Scan now? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        await this.services.scanner.updateIndex();
      }
    }

    return this;
  }

  async start() {
    const menu = new MenuSystem(this.services);
    await menu.start();
  }
}

// Start the system
const system = new JSLearningSystem();
await system.initialize();
await system.start();