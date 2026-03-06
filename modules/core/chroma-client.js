// Full-featured ChromaDB v2 client with all CRUD operations

export class ChromaClient {
  constructor(baseURL = 'http://localhost:8000', tenant = 'default_tenant', database = 'default_database') {
    this.baseURL = baseURL;
    this.tenant = tenant;
    this.database = database;
    this.apiBase = `${baseURL}/api/v2`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    console.log(`🔧 Making request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChromaDB API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text();
  }

  // System Operations
  async heartbeat() {
    return this.request('/heartbeat');
  }

  async version() {
    return this.request('/version');
  }

  async healthcheck() {
    return this.request('/healthcheck');
  }

  // Collection Operations
  async listCollections(tenant = this.tenant, database = this.database, limit = 10, offset = 0) {
    return this.request(`/tenants/${tenant}/databases/${database}/collections?limit=${limit}&offset=${offset}`);
  }

  async createCollection(name, metadata = {}, tenant = this.tenant, database = this.database) {
    const body = {
      name: name,
      metadata: metadata,
      configuration: {
        hnsw: {
          space: metadata.space || "cosine"
        }
      },
      get_or_create: false
    };
    
    return this.request(`/tenants/${tenant}/databases/${database}/collections`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getOrCreateCollection(name, metadata = {}, tenant = this.tenant, database = this.database) {
    const body = {
      name: name,
      metadata: metadata,
      configuration: {
        hnsw: {
          space: metadata.space || "cosine"
        }
      },
      get_or_create: true
    };
    
    return this.request(`/tenants/${tenant}/databases/${database}/collections`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getCollection(collectionId, tenant = this.tenant, database = this.database) {
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}`);
  }

  async deleteCollection(collectionId, tenant = this.tenant, database = this.database) {
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}`, {
      method: 'DELETE',
    });
  }

  // Record Operations
  async addRecords(collectionId, records, tenant = this.tenant, database = this.database) {
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}/add`, {
      method: 'POST',
      body: JSON.stringify(records),
    });
  }

  async addDocuments(collectionId, documents, ids, embeddings = null, metadatas = []) {
    const embeds = embeddings || documents.map(() => [0.1, 0.2, 0.3, 0.4]);
    
    const records = {
      ids: ids,
      documents: documents,
      embeddings: embeds,
      metadatas: metadatas.length ? metadatas : documents.map(() => ({}))
    };
    
    return this.addRecords(collectionId, records);
  }

  async query(collectionId, queryEmbeddings, nResults = 5, where = {}, tenant = this.tenant, database = this.database) {
    const embeddingsArray = Array.isArray(queryEmbeddings[0]) 
      ? queryEmbeddings 
      : [queryEmbeddings];
    
    const body = {
      query_embeddings: embeddingsArray,
      n_results: nResults,
      include: ["documents", "metadatas", "distances"]
    };
    
    if (Object.keys(where).length > 0) {
      body.where = where;
    }
    
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getRecords(collectionId, options = {}, tenant = this.tenant, database = this.database) {
    const body = {
      ids: options.ids || null,
      where: options.where || null,
      where_document: options.where_document || null,
      include: options.include || ["documents", "metadatas"],
      limit: options.limit || null,
      offset: options.offset || 0
    };
    
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}/get`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteRecords(collectionId, options = {}, tenant = this.tenant, database = this.database) {
    const body = {
      ids: options.ids || null,
      where: options.where || null,
      where_document: options.where_document || null
    };
    
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}/delete`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async countRecords(collectionId, tenant = this.tenant, database = this.database) {
    return this.request(`/tenants/${tenant}/databases/${database}/collections/${collectionId}/count`);
  }
}