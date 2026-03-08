// modules/quiz/engine.js
import { createInterface } from 'readline';

export class QuizEngine {
  constructor(database, generator, logger) {
    this.db = database;
    this.generator = generator;
    this.logger = logger;
  }

  async runQuiz(options = {}) {
    const {
      topic = null,
      difficulty = null,
      pattern = null
    } = options;

    console.log('\n🎯 JavaScript Learning Quiz');
    console.log('='.repeat(60));

    // Get random example based on filters
    const example = await this.getRandomExample({ topic, pattern });

    if (!example) {
      console.log('❌ No examples found matching criteria.');
      return;
    }

    this.displayExample(example);

    // Generate quiz question
    const quiz = await this.generator.generateQuiz(example.code, example.metadata);

    if (!quiz) {
      console.log('❌ Failed to generate quiz. Try again.');
      return;
    }

    // Run the quiz
    const result = await this.presentQuiz(quiz, example);

    // Log the result
    await this.logger.logAnswer({
      question: quiz.question,
      topic: example.metadata.topic || 'unknown',
      correct: result.correct,
      userAnswer: result.userAnswer,
      correctAnswer: quiz.correctAnswer,
      examplePath: example.metadata.path,
      timeSpent: result.timeSpent
    });

    // Show explanation
    this.showExplanation(quiz, result.correct);

    return result;
  }


  async getRandomExample({ topic = null, pattern = null } = {}) {
    try {
      console.log('\n🔍 Getting random example...');

      // Build where clause only if needed
      let where = null;  // Start with null, not empty object

      if (topic) {
        where = { topic: { $eq: topic } };
      }

      if (pattern) {
        const [prefix, number] = pattern.split('#');
        where = {
          $and: [
            { patternPrefix: { $eq: prefix } },
            { patternNumber: { $eq: parseInt(number) } }
          ]
        };
      }

      // Get ALL records (no where clause if null)
      const results = await this.db.getAllRecords(where);

      if (results.ids.length === 0) {
        console.log('⚠️  No examples found');
        return null;
      }

      // Filter for JS examples only
      const examples = [];
      for (let i = 0; i < results.ids.length; i++) {
        const metadata = results.metadatas[i];
        const filename = metadata?.filename || '';

        // Check if it's a JS example - look for .js files
        if (filename.endsWith('.js')) {
          examples.push({
            id: results.ids[i],
            code: results.documents[i],
            metadata: metadata
          });
        }
      }

      if (examples.length === 0) {
        console.log('⚠️  No JS examples found');
        return null;
      }

      console.log(`   Found ${examples.length} JS examples out of ${results.ids.length} total records`);

      // Select random example
      const randomIndex = Math.floor(Math.random() * examples.length);
      const selected = examples[randomIndex];

      console.log(`   Selected: ${selected.metadata.folder}/${selected.metadata.filename}`);

      return selected;

    } catch (error) {
      console.error('❌ Error:', error.message);
      return null;
    }
  }


  displayExample(example) {
    console.log(`\n📁 From: ${example.metadata.path}`);
    if (example.metadata.patternPrefix) {
      console.log(`🔢 Pattern: ${example.metadata.patternPrefix}#${example.metadata.patternNumber}`);
    }
    if (example.metadata.topic) {
      console.log(`📌 Topic: ${example.metadata.topic}`);
    }

    console.log('\n📝 Code:');
    console.log('-'.repeat(60));
    console.log(example.code);
    console.log('-'.repeat(60));
  }

  async presentQuiz(quiz, example) {
    const startTime = Date.now();

    console.log(`\n❓ ${quiz.question}`);
    console.log('');

    const allAnswers = [quiz.correctAnswer, ...quiz.wrongAnswers];
    const shuffled = this.shuffleArray(allAnswers);

    shuffled.forEach((answer, index) => {
      console.log(`   ${index + 1}. ${answer}`);
    });

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n👉 Your answer (1-4): ', resolve);
    });

    const selectedAnswer = shuffled[parseInt(answer) - 1];
    const isCorrect = selectedAnswer === quiz.correctAnswer;

    const timeSpent = (Date.now() - startTime) / 1000;

    rl.close();

    return {
      correct: isCorrect,
      userAnswer: selectedAnswer,
      timeSpent
    };
  }

  showExplanation(quiz, wasCorrect) {
    console.log('\n' + '='.repeat(60));

    if (wasCorrect) {
      console.log('✅ Correct! 🎉');
    } else {
      console.log(`❌ Not quite. The correct answer is: ${quiz.correctAnswer}`);
    }

    console.log(`\n💡 Explanation: ${quiz.explanation}`);

    if (quiz.hint && !wasCorrect) {
      console.log(`\n🔍 Hint: ${quiz.hint}`);
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async runQuizBatch(count = 5, topic = null) {
    const results = {
      total: 0,
      correct: 0,
      wrong: 0,
      details: []
    };

    for (let i = 0; i < count; i++) {
      console.log(`\n📝 Question ${i + 1} of ${count}`);
      const result = await this.runQuiz({ topic });

      if (result) {
        results.total++;
        if (result.correct) results.correct++;
        else results.wrong++;

        results.details.push({
          correct: result.correct,
          timeSpent: result.timeSpent
        });
      }
    }

    console.log('\n' + '📊'.repeat(30));
    console.log('📊 BATCH RESULTS');
    console.log('📊'.repeat(30));
    console.log(`\n✅ Correct: ${results.correct}/${results.total} (${(results.correct / results.total * 100).toFixed(1)}%)`);
    console.log(`⏱️  Average time: ${(results.details.reduce((sum, d) => sum + d.timeSpent, 0) / results.total).toFixed(1)}s`);

    return results;
  }
}