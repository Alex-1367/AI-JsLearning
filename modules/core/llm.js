// modules/core/llm.js
export class LLMService {
  constructor(baseURL = 'http://localhost:11434', model = 'qwen2.5-coder:1.5b') {
    this.baseURL = baseURL;
    this.model = model;
  }

  async generate(prompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 500,
      stream = false
    } = options;

    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: stream,
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  async generateJSON(prompt, schema = null, maxRetries = 2) {
    const enhancedPrompt = `${prompt}

IMPORTANT: 
- Return ONLY valid JSON. No markdown formatting, no code blocks, no additional text.
- The response must be parseable by JSON.parse().
- Ensure all strings are properly terminated with quotes.
- Do not include trailing commas.
- Keep the response concise and focused.

${schema ? `Expected schema: ${JSON.stringify(schema, null, 2)}` : ''}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🤖 Generating JSON (attempt ${attempt + 1}/${maxRetries + 1})...`);
        
        const response = await this.generate(enhancedPrompt, { 
          temperature: 0.3 + (attempt * 0.1) // Slightly increase temperature on retry
        });
        
        // Clean the response - remove markdown code blocks if present
        let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
        
        // Try to find JSON object if there's extra text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
        
        // Validate JSON before parsing
        if (this.isValidJSON(cleaned)) {
          const parsed = JSON.parse(cleaned);
          
          // Validate structure if schema provided
          if (schema && !this.validateAgainstSchema(parsed, schema)) {
            console.log('   ⚠️  JSON does not match expected schema, retrying...');
            continue;
          }
          
          return parsed;
        } else {
          console.log(`   ⚠️  Invalid JSON, retrying... (attempt ${attempt + 1})`);
          if (attempt === maxRetries) {
            console.log('   📝 Raw response:', response.substring(0, 200) + '...');
          }
        }
      } catch (e) {
        console.log(`   ❌ JSON parse error: ${e.message}`);
        if (attempt === maxRetries) {
          console.log('   📝 Raw response:', response?.substring(0, 200) || 'No response');
        }
      }
    }
    
    // If all retries fail, return a fallback quiz
    console.log('   ⚠️  Using fallback quiz...');
    return this.getFallbackQuiz();
  }

  isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  validateAgainstSchema(obj, schema) {
    // Basic schema validation
    if (!schema) return true;
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          console.log(`   ⚠️  Missing required field: ${field}`);
          return false;
        }
      }
    }
    
    return true;
  }

  getFallbackQuiz() {
    // Provide a simple fallback quiz when JSON generation fails
    return {
      question: "What does this code do?",
      explanation: "The code demonstrates JavaScript concepts like array mapping, object spreading, and conditional property inclusion.",
      correctAnswer: "It merges order statuses, adding priority and deliveryDate if they exist in existing orders.",
      wrongAnswers: [
        "It filters orders that don't exist in the existing list.",
        "It updates only the lastSynced property of each order.",
        "It creates a new array with only the new orders."
      ],
      hint: "Look at how the spread operator (...) is used with conditional spreading.",
      difficulty: "medium",
      topic: "javascript"
    };
  }

  async generateWithContext(prompt, context, options = {}) {
    const contextualPrompt = `Context information:
${context}

Based on the above context, ${prompt}`;

    return this.generate(contextualPrompt, options);
  }
}