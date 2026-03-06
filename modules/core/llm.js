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

  async generateJSON(prompt, schema) {
    const enhancedPrompt = `${prompt}

IMPORTANT: Return ONLY valid JSON. No markdown formatting, no code blocks, no additional text.
The response must be parseable by JSON.parse().

${schema ? `Expected schema: ${JSON.stringify(schema, null, 2)}` : ''}`;

    const response = await this.generate(enhancedPrompt, { temperature: 0.3 }); // Lower temperature for JSON
    
    try {
      // Clean the response - remove markdown code blocks if present
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      console.log('Raw response:', response);
      return null;
    }
  }

  async generateWithContext(prompt, context, options = {}) {
    const contextualPrompt = `Context information:
${context}

Based on the above context, ${prompt}`;

    return this.generate(contextualPrompt, options);
  }
}