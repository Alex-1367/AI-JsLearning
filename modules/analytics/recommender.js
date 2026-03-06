// modules/analytics/recommender.js
export class ExampleRecommender {
  constructor(database, quizLogger, gapAnalyzer, exampleCreator) {
    this.db = database;
    this.logger = quizLogger;
    self.gapAnalyzer = gapAnalyzer;
    this.creator = exampleCreator;
  }

  async getPersonalizedRecommendation() {
    // Get weakest topics
    const weakTopics = await this.logger.getWeakestTopics(1);
    
    if (weakTopics.length > 0) {
      const topic = weakTopics[0].topic;
      return {
        type: 'weak-topic',
        topic,
        reason: `You're struggling with ${topic} (${weakTopics[0].successRate}% success rate)`,
        action: 'generate-new'
      };
    }

    // Check for missing topics
    const gaps = await this.gapAnalyzer.analyzeGaps();
    
    if (gaps.missingTopics.length > 0) {
      // Prioritize fundamental topics
      const fundamental = ['closures', 'promises', 'async-await', 'prototypes'];
      const missingFundamental = gaps.missingTopics.find(t => fundamental.includes(t));
      
      if (missingFundamental) {
        return {
          type: 'missing-fundamental',
          topic: missingFundamental,
          reason: `You haven't explored ${missingFundamental} yet`,
          action: 'create-first'
        };
      }
      
      // Otherwise suggest any missing topic
      return {
        type: 'missing-topic',
        topic: gaps.missingTopics[0],
        reason: `Topic not covered: ${gaps.missingTopics[0]}`,
        action: 'create-new'
      };
    }

    // Check for underrepresented topics
    if (gaps.underrepresented.length > 0) {
      return {
        type: 'underrepresented',
        topic: gaps.underrepresented[0],
        reason: `Only ${gaps.coverage[gaps.underrepresented[0]]} examples for this topic`,
        action: 'add-more'
      };
    }

    return null;
  }

  async suggestNextExample() {
    const recommendation = await this.getPersonalizedRecommendation();
    
    if (!recommendation) {
      return {
        hasRecommendation: false,
        message: "You've covered all topics well! Try exploring advanced concepts."
      };
    }

    // Generate appropriate example based on recommendation
    let difficulty = 'medium';
    if (recommendation.type === 'weak-topic') {
      difficulty = 'easy'; // Start with easier examples for weak topics
    }

    const example = await this.creator.generateNewExample(
      recommendation.topic,
      difficulty
    );

    return {
      hasRecommendation: true,
      recommendation,
      example
    };
  }
}