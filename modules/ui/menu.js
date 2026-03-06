// modules/ui/menu.js
import readline from 'readline';

export class MenuSystem {
  constructor(services) {
    this.services = services;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  registerDefaultHandlers() {
    this.registerHandler('1', () => this.services.quizEngine.runQuiz());
    this.registerHandler('2', () => this.services.search.searchByConcept());
    this.registerHandler('3', () => this.services.search.searchByPattern());
    this.registerHandler('4', () => this.services.search.listAllPatterns());
    this.registerHandler('5', () => this.services.scanner.updateIndex());
    this.registerHandler('6', () => this.services.analytics.showDashboard());
    this.registerHandler('7', () => this.services.generator.generateForWeakTopic());
    this.registerHandler('8', () => this.services.recommender.showRecommendations());
    this.registerHandler('9', () => this.services.analytics.analyzeGaps());
    this.registerHandler('10', () => this.exit());
  }

  registerHandler(option, handler) {
    this.handlers.set(option, handler);
  }

  showMenu() {
    console.log('\n' + '🎯'.repeat(30));
    console.log('🎯 JAVASCRIPT LEARNING SYSTEM - INTELLIGENT EDITION');
    console.log('🎯'.repeat(30));
    console.log('\n📋 MAIN MENU:');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║  CORE FUNCTIONS                               ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  1. 🎯 Take random quiz                      ║');
    console.log('  ║  2. 🔍 Search examples by concept            ║');
    console.log('  ║  3. 🔢 Search by pattern (e.g., RP#01)       ║');
    console.log('  ║  4. 📋 List all patterns                      ║');
    console.log('  ║  5. 🔄 Update index (scan for changes)        ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  INTELLIGENT FEATURES                         ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  6. 📊 Show performance dashboard            ║');
    console.log('  ║  7. 🎲 Generate example for weak topic       ║');
    console.log('  ║  8. 💡 Get personalized recommendations      ║');
    console.log('  ║  9. 🔬 Analyze knowledge gaps                ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  10. 🚪 Exit                                  ║');
    console.log('  ╚══════════════════════════════════════════════╝');
  }

  async start() {
    this.showMenu();
    await this.promptLoop();
  }

  async promptLoop() {
    while (true) {
      const choice = await this.question('\n👉 Enter your choice: ');
      
      const handler = this.handlers.get(choice);
      if (handler) {
        await handler();
        this.showMenu(); // Show menu after each action
      } else {
        console.log('❌ Invalid choice. Please try again.');
      }
    }
  }

  question(prompt) {
    return new Promise(resolve => this.rl.question(prompt, resolve));
  }

  async exit() {
    console.log('\n👋 Good luck with your JavaScript journey!');
    console.log('📊 Check data/quiz-log.jsonl to track your progress.\n');
    this.rl.close();
    process.exit(0);
  }
}