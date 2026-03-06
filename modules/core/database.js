// modules/core/database.js
import { ChromaClient } from './chroma-client.js';

export class DatabaseManager {
  constructor() {
    this.chroma = new ChromaClient('http://localhost:8000');
    this.collectionName = 'js_examples';
    this.collectionId = null;
  }

  async initialize() {
    const collection = await this.chroma.getOrCreateCollection(this.collectionName, {
      space: 'cosine',
      description: 'JavaScript examples for learning'
    });
    this.collectionId = collection.id;
    return this;
  }

  async addDocuments(docs, ids, embeddings, metadatas) {
    return this.chroma.addDocuments(
      this.collectionId,
      docs,
      ids,
      embeddings,
      metadatas
    );
  }

  async deleteRecords(ids) {
    return this.chroma.deleteRecords(this.collectionId, { ids });
  }

  async query(queryEmbedding, nResults = 5, where = {}) {
    return this.chroma.query(this.collectionId, queryEmbedding, nResults, where);
  }

  async getRecords(options = {}) {
    return this.chroma.getRecords(this.collectionId, options);
  }

  async count() {
    return this.chroma.countRecords(this.collectionId);
  }

  async getAllExamples() {
    const results = await this.getRecords({
      include: ["documents", "metadatas", "embeddings"],
      limit: 1000
    });
    
    return results.ids.map((id, i) => ({
      id,
      code: results.documents[i],
      metadata: results.metadatas[i],
      embedding: results.embeddings?.[i]
    }));
  }

  async getExamplesByTopic(topic) {
    return this.getRecords({
      where: { topic: { $eq: topic } },
      include: ["documents", "metadatas"],
      limit: 100
    });
  }
}