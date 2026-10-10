/**
 * vectorStore.js
 * In-memory vector store with TF-IDF-based embeddings and cosine similarity.
 * No external vector DB required — fully self-contained RAG retrieval.
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory store ─────────────────────────────────────────────────────────
/** @type {Map<string, { id: string, text: string, vector: number[], metadata: object }>} */
const store = new Map();

/** Vocabulary built from all ingested chunks */
let vocabulary = [];

// ─── TF-IDF helpers ──────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function termFrequency(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const total = tokens.length || 1;
  for (const t in freq) freq[t] /= total;
  return freq;
}

function buildVocabulary() {
  const vocab = new Set();
  for (const doc of store.values()) {
    tokenize(doc.text).forEach((t) => vocab.add(t));
  }
  vocabulary = Array.from(vocab).sort();
}

function idf(term) {
  const N = store.size || 1;
  let df = 0;
  for (const doc of store.values()) {
    if (tokenize(doc.text).includes(term)) df++;
  }
  return Math.log((N + 1) / (df + 1)) + 1;
}

function tfidfVector(text) {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  return vocabulary.map((term) => (tf[term] || 0) * idf(term));
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Adds a chunk to the vector store.
 * @param {string} text
 * @param {object} metadata  - e.g. { filename, chunkIndex, source }
 * @returns {string} chunk id
 */
function addChunk(text, metadata = {}) {
  const id = uuidv4();
  store.set(id, { id, text, vector: [], metadata });
  return id;
}

/**
 * Rebuilds all TF-IDF vectors from the current vocabulary.
 * Call this after all chunks from a document are added.
 */
function rebuildVectors() {
  buildVocabulary();
  for (const doc of store.values()) {
    doc.vector = tfidfVector(doc.text);
  }
}

/**
 * Retrieves the top-k most relevant chunks for a query.
 * @param {string} query
 * @param {number} topK
 * @returns {{ text: string, metadata: object, score: number }[]}
 */
function retrieve(query, topK = 5) {
  if (store.size === 0) return [];

  const queryVec = tfidfVector(query);
  const scored = [];

  for (const doc of store.values()) {
    const score = cosineSimilarity(queryVec, doc.vector);
    scored.push({ text: doc.text, metadata: doc.metadata, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((r) => r.score > 0);
}

/**
 * Returns the total number of chunks in the store.
 */
function chunkCount() {
  return store.size;
}

/**
 * Lists unique source documents currently in the store.
 */
function listDocuments() {
  const docs = new Map();
  for (const { metadata } of store.values()) {
    if (metadata.filename && !docs.has(metadata.filename)) {
      docs.set(metadata.filename, {
        filename: metadata.filename,
        uploadedAt: metadata.uploadedAt,
        chunkCount: 0,
      });
    }
    if (metadata.filename) {
      docs.get(metadata.filename).chunkCount++;
    }
  }
  return Array.from(docs.values());
}

/**
 * Removes all chunks belonging to a specific document.
 * @param {string} filename
 */
function removeDocument(filename) {
  for (const [id, doc] of store.entries()) {
    if (doc.metadata.filename === filename) store.delete(id);
  }
  rebuildVectors();
}

module.exports = { addChunk, rebuildVectors, retrieve, chunkCount, listDocuments, removeDocument };
