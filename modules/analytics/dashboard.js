// modules/analytics/dashboard.js
export class Dashboard {
  constructor(quizLogger, database, gapAnalyzer) {
    this.logger = quizLogger;
    this.db = database;
    this.gapAnalyzer = gapAnalyzer;
  }

  async showDashboard() {
    console.log('\n' + '📊'.repeat(30));
    console.log('📊 PERFORMANCE DASHBOARD');
    console.log('📊'.repeat(30));

    // Get all data
    const performance = await this.logger.getPerformanceByTopic();
    const gaps = await this.gapAnalyzer.analyzeGaps();
    const totalExamples = await this.db.count();
    const recentMistakes = await this.logger.getRecentMistakes(3);

    console.log(`\n📚 Database: ${totalExamples} total examples`);

    console.log('\n📈 Topic Coverage:');
    Object.entries(gaps.coverage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([topic, count]) => {
        const perf = performance[topic];
        const successRate = perf ? perf.successRate : 'N/A';
        const bar = '█'.repeat(Math.min(20, Math.floor(count * 2)));
        console.log(`  ${topic.padEnd(15)} ${bar.padEnd(20)} ${count} ex (${successRate}% success)`);
      });

    console.log('\n🎯 Weakest Topics (need more practice):');
    const weakTopics = await this.logger.getWeakestTopics(3);
    weakTopics.forEach(t => {
      console.log(`  🔴 ${t.topic}: ${t.wrong}/${t.attempts} wrong (${t.successRate}% success)`);
    });

    console.log('\n❌ Recent Mistakes:');
    recentMistakes.forEach(mistake => {
      console.log(`  • ${mistake.question.substring(0, 60)}...`);
      console.log(`    Your answer: "${mistake.userAnswer}", Correct: "${mistake.correctAnswer}"`);
    });

    console.log('\n📋 Missing Topics:');
    if (gaps.missingTopics.length > 0) {
      gaps.missingTopics.slice(0, 5).forEach(t => console.log(`  • ${t}`));
      if (gaps.missingTopics.length > 5) {
        console.log(`  ... and ${gaps.missingTopics.length - 5} more`);
      }
    } else {
      console.log('  ✅ Great coverage! All major topics present.');
    }

    console.log('\n' + '📊'.repeat(30));
  }
}