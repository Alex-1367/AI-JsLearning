import readline from 'readline';
import { runFullScan } from '../diagnostics/fullscan.js';

export class MenuSystem {
  constructor(services) {
    this.services = services;
    this.rl = null;
    this.handlers = new Map();
    this.registerDefaultHandlers();
    this.menuActive = false;
  }

  registerDefaultHandlers() {
    this.registerHandler('1', () => this.services.quizEngine.runQuiz());
    this.registerHandler('2', () => this.services.search.searchByConcept());
    this.registerHandler('3', () => this.services.search.searchByPattern());
    this.registerHandler('4', () => this.services.search.listAllPatterns());
    this.registerHandler('5', () => this.services.scanner.updateIndex());
    this.registerHandler('6', () => this.services.dashboard.showDashboard());
    this.registerHandler('7', () => this.services.creator.generateForWeakTopic());
    this.registerHandler('8', () => this.services.recommender?.getPersonalizedRecommendation?.());
    this.registerHandler('9', () => this.services.gapAnalyzer.analyzeGaps());
    this.registerHandler('10', () => this.runFullDiagnosticScan());
    this.registerHandler('11', () => this.exit());
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
    console.log('  ║  CORE FUNCTIONS                              ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  1. 🎯 Take random quiz                      ║');
    console.log('  ║  2. 🔍 Search examples by concept            ║');
    console.log('  ║  3. 🔢 Search by pattern (e.g., RP#01)       ║');
    console.log('  ║  4. 📋 List all patterns                     ║');
    console.log('  ║  5. 🔄 Quick scan (changes only)             ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  DIAGNOSTICS                                 ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  6. 📊 Show performance dashboard            ║');
    console.log('  ║  7. 🎲 Generate example for weak topic       ║');
    console.log('  ║  8. 💡 Get personalized recommendations      ║');
    console.log('  ║  9. 🔬 Analyze knowledge gaps                ║');
    console.log('  ║  10. 🔍 JS folders with examples diagnostic  ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  11. 🚪 Exit                                 ║');
    console.log('  ╚══════════════════════════════════════════════╝');
  }

  async start() {
    // Create readline only once
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Handle SIGINT
    this.rl.on('SIGINT', () => this.exit());

    // Start the menu loop
    await this.menuLoop();
  }

  async menuLoop() {
    while (true) {
      this.showMenu();
      
      // Get user choice
      const choice = await this.question('\n👉 Enter your choice: ');
      const trimmedChoice = choice.trim();

      const handler = this.handlers.get(trimmedChoice);
      if (handler) {
        // CRITICAL: Close the readline BEFORE executing handler
        // This prevents multiple readline instances from conflicting
        this.rl.close();
        this.rl = null;
        
        // Execute the handler
        await handler();
        
        // Recreate readline for next menu iteration
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: true
        });
        
        this.rl.on('SIGINT', () => this.exit());
      } else {
        console.log('❌ Invalid choice. Please try again.');
      }
    }
  }

  async runFullDiagnosticScan() {
    console.log('\n🔍 Starting full diagnostic scan...');
    console.log('This will analyze all folders and show detailed statistics.\n');
    
    await runFullScan(this.services);
    
    console.log('\n✅ Press Enter to return to menu...');
    await new Promise(resolve => {
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      tempRl.question('', () => {
        tempRl.close();
        resolve();
      });
    });
  }

  question(prompt) {
    return new Promise((resolve) => {
      if (!this.rl) {
        // Recreate if somehow lost
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: true
        });
        this.rl.on('SIGINT', () => this.exit());
      }
      this.rl.question(prompt, resolve);
    });
  }

  async exit() {
    console.log('\n👋 Good luck with your JavaScript journey!');
    console.log('📊 Check data/quiz-log.jsonl to track your progress.\n');
    
    if (this.rl) {
      this.rl.close();
    }
    
    process.exit(0);
  }
}