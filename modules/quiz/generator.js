// modules/quiz/generator.js
export class Generator {
  constructor(llm) {
    this.llm = llm;
  }

  async generateQuiz(jsCode, metadata) {
    const prompt = `You are a JavaScript teacher. Given this JavaScript code from file "${metadata.filename}":

\`\`\`javascript
${jsCode}
\`\`\`

Generate a quiz question in this EXACT JSON format:
{
  "question": "What will this code output? (or ask what it does)",
  "explanation": "Brief explanation of what the code does",
  "correctAnswer": "The exact output or result",
  "wrongAnswers": [
    "plausible wrong answer 1",
    "plausible wrong answer 2", 
    "plausible wrong answer 3"
  ],
  "hint": "A helpful hint without giving away the answer",
  "difficulty": "easy|medium|hard",
  "topic": "${metadata.topic || 'general'}"
}

Make wrong answers reflect common JavaScript misconceptions:
- Type coercion mistakes
- Scope misunderstandings
- Async confusion
- Array/object reference errors
- Hoisting misconceptions
- Closure traps
- Prototype chain confusion

Return ONLY the JSON, no other text.`;

    return this.llm.generateJSON(prompt);
  }

  async generateExplanation(jsCode, output) {
    const prompt = `Explain this JavaScript code and why it produces: ${output}

Code:
\`\`\`javascript
${jsCode}
\`\`\`

Provide a clear, educational explanation covering:
1. What the code does step by step
2. Key JavaScript concepts demonstrated
3. Why the output is what it is
4. Common pitfalls to avoid

Return as JSON with fields: explanation, concepts, pitfalls`;

    return this.llm.generateJSON(prompt);
  }

  async generateDistractors(jsCode, correctAnswer, count = 3) {
    const prompt = `For this JavaScript code:

\`\`\`javascript
${jsCode}
\`\`\`

The correct output is: "${correctAnswer}"

Generate ${count} plausible but WRONG answers that someone learning JavaScript might think.
Each wrong answer should be based on a common misconception about:
- Type coercion
- Operator precedence
- Scope
- Closure
- Async behavior
- Prototype chain
- 'this' binding

Return as JSON array of strings.`;

    const result = await this.llm.generateJSON(prompt);
    return Array.isArray(result) ? result : [];
  }

  async adaptDifficulty(quiz, userPerformance) {
    // Adjust quiz difficulty based on user performance
    if (!userPerformance) return quiz;

    const successRate = userPerformance.correct / userPerformance.total;
    
    let difficulty = 'medium';
    if (successRate < 0.4) difficulty = 'easy';
    else if (successRate > 0.8) difficulty = 'hard';

    if (quiz.difficulty === difficulty) return quiz;

    // Generate new quiz with adjusted difficulty
    const prompt = `Adapt this JavaScript quiz to ${difficulty} difficulty:

Original question: "${quiz.question}"
Original correct answer: "${quiz.correctAnswer}"

Create a ${difficulty} version that:
- Easy: Focuses on basic concepts, obvious output
- Medium: Includes some tricky aspects
- Hard: Tests edge cases, complex interactions

Return the adapted quiz in the same JSON format.`;

    return this.llm.generateJSON(prompt);
  }
}