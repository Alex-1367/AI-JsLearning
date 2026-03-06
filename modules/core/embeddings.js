// modules/core/embeddings.js
export class EmbeddingService {
  constructor(baseURL = 'http://localhost:11434', model = 'qwen2.5-coder:1.5b') {
    this.baseURL = baseURL;
    this.model = model;
  }

  async getEmbedding(text) {
    const response = await fetch(`${this.baseURL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  async getEmbeddings(texts) {
    // Process in batches to avoid overwhelming Ollama
    const batchSize = 5;
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.getEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return embeddings;
  }

  async getQueryEmbedding(query) {
    // For search queries, we can add some optimization
    // Like prefixing with "Search for: " to get better embeddings
    return this.getEmbedding(`Search for: ${query}`);
  }
}