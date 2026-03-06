// modules/analytics/gapAnalyzer.js
import fs from 'fs/promises';
import path from 'path';

export class GapAnalyzer {
  constructor(database, quizLogger, llm) {
    this.db = database;
    this.logger = quizLogger;
    this.llm = llm;
    this.jsTopics = [
      'closures',
      'prototypes',
      'promises',
      'async-await',
      'event-loop',
      'scope',
      'hoisting',
      'this-keyword',
      'classes',
      'modules',
      'generators',
      'iterators',
      'proxy',
      'reflect',
      'symbols',
      'weakmap-weakset',
      'set-map',
      'array-methods',
      'object-methods',
      'destructuring',
      'spread-operator',
      'rest-parameters',
      'template-literals',
      'tagged-templates',
      'arrow-functions',
      'default-parameters',
      'optional-chaining',
      'nullish-coalescing',
      'bigint',
      'symbol',
      'typed-arrays',
      'shared-memory',
      'atomics',
      'web-workers',
      'service-workers',
      'indexeddb',
      'fetch-api',
      'websockets',
      'shadow-dom',
      'custom-elements',
      'html-templates',
      'decorators',
      'reflect-metadata',
      'error-handling',
      'strict-mode',
      'ecmascript-proposals'
    ];
  }

  async analyzeGaps() {
    console.log('\n🔍 Analyzing knowledge gaps...');
    
    // Get all existing examples
    const examples = await this.db.getAllExamples();
    const existingTopics = new Set();
    const topicCoverage = {};

    // Analyze current examples
    examples.forEach(example => {
      const metadata = example.metadata;
      if (metadata.topic) {
        existingTopics.add(metadata.topic);
        topicCoverage[metadata.topic] = (topicCoverage[metadata.topic] || 0) + 1;
      }
    });

    // Get performance data
    const performance = await this.logger.getPerformanceByTopic();

    // Find missing topics
    const missingTopics = this.jsTopics.filter(t => !existingTopics.has(t));

    // Find weak topics (based on performance)
    const weakTopics = Object.entries(performance)
      .filter(([_, stats]) => stats.successRate < 70)
      .map(([topic]) => topic);

    // Find underrepresented topics (less than 3 examples)
    const underrepresented = Object.entries(topicCoverage)
      .filter(([_, count]) => count < 3)
      .map(([topic]) => topic);

    return {
      missingTopics,
      weakTopics,
      underrepresented,
      coverage: topicCoverage,
      performance
    };
  }

  async generateRecommendations() {
    const gaps = await this.analyzeGaps();
    const recommendations = [];

    // Priority 1: Weak topics you're struggling with
    if (gaps.weakTopics.length > 0) {
      for (const topic of gaps.weakTopics.slice(0, 2)) {
        recommendations.push({
          priority: 'HIGH',
          reason: `You're struggling with ${topic} (success rate < 70%)`,
          topic,
          action: 'create',
          suggestedCount: 3
        });
      }
    }

    // Priority 2: Missing fundamental topics
    const fundamentalTopics = [
      'closures', 'prototypes', 'promises', 'async-await', 'event-loop'
    ];
    
    const missingFundamental = fundamentalTopics.filter(
      t => gaps.missingTopics.includes(t)
    );

    if (missingFundamental.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        reason: `Missing fundamental topic: ${missingFundamental.join(', ')}`,
        topic: missingFundamental[0],
        action: 'create',
        suggestedCount: 2
      });
    }

    // Priority 3: Underrepresented topics
    if (gaps.underrepresented.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        reason: `Topic needs more examples: ${gaps.underrepresented[0]}`,
        topic: gaps.underrepresented[0],
        action: 'add',
        suggestedCount: 2
      });
    }

    // Priority 4: Advanced topics not covered
    const advancedTopics = [
      'proxy', 'reflect', 'generators', 'weakmap-weakset', 'shared-memory'
    ];
    
    const missingAdvanced = advancedTopics.filter(
      t => gaps.missingTopics.includes(t)
    );

    if (missingAdvanced.length > 0 && recommendations.length < 3) {
      recommendations.push({
        priority: 'LOW',
        reason: `Advanced topic not covered: ${missingAdvanced[0]}`,
        topic: missingAdvanced[0],
        action: 'create',
        suggestedCount: 1
      });
    }

    return recommendations;
  }

  async suggestNewTopic() {
    const gaps = await this.analyzeGaps();
    
    // Use LLM to suggest the most relevant missing topic
    const prompt = `Based on this JavaScript learning data:
    
Existing topics with example counts:
${Object.entries(gaps.coverage).map(([t, c]) => `- ${t}: ${c} examples`).join('\n')}

Missing topics:
${gaps.missingTopics.join(', ')}

Performance on weak topics:
${Object.entries(gaps.performance)
  .filter(([_, p]) => p.successRate < 70)
  .map(([t, p]) => `- ${t}: ${p.successRate}% success rate`)
  .join('\n')}

Which ONE JavaScript topic would be MOST valuable to add next? 
Consider:
1. Fill knowledge gaps
2. Build on existing examples
3. Address weak performance areas
4. Follow logical learning progression

Return ONLY the topic name.`;

    const response = await this.llm.generate(prompt);
    return response.trim();
  }
}