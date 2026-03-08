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

  async getAllRecords(where = null) {  // Change default to null, not undefined
    try {
      // First, get total count
      const totalCount = await this.count();
      console.log(`📚 Total records in database: ${totalCount}`);

      // Then get all records in batches
      const batchSize = 1000;
      const allIds = [];
      const allDocuments = [];
      const allMetadatas = [];

      for (let offset = 0; offset < totalCount; offset += batchSize) {
        console.log(`   Fetching batch ${offset / batchSize + 1}/${Math.ceil(totalCount / batchSize)}...`);

        // Only include where if it's not null
        const options = {
          include: ["documents", "metadatas"],
          limit: batchSize,
          offset
        };

        // Add where clause only if provided
        if (where && Object.keys(where).length > 0) {
          options.where = where;
        }

        const batch = await this.getRecords(options);

        allIds.push(...batch.ids);
        allDocuments.push(...batch.documents);
        allMetadatas.push(...batch.metadatas);
      }

      console.log(`   ✅ Retrieved ${allIds.length} total records`);

      return {
        ids: allIds,
        documents: allDocuments,
        metadatas: allMetadatas
      };
    } catch (error) {
      console.error('❌ Error in getAllRecords:', error.message);
      throw error;
    }
  }
}