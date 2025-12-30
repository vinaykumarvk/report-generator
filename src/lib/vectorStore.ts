import crypto from "crypto";
import fs from "fs";
import path from "path";

type VectorDocument = {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
};

type VectorChunk = {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

type VectorStoreState = {
  connectorId: string;
  documents: VectorDocument[];
  chunks: VectorChunk[];
  updatedAt: string;
};

const STORE_DIR = path.join(process.cwd(), "data", "vector-store");

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function storePath(connectorId: string) {
  return path.join(STORE_DIR, `${connectorId}.json`);
}

function hashToVector(text: string, length = 8) {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vector = [];
  for (let idx = 0; idx < length; idx += 1) {
    vector.push(hash[idx] / 255);
  }
  return vector;
}

function chunkText(text: string, size = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size;
  }
  return chunks;
}

function loadStore(connectorId: string): VectorStoreState {
  ensureStoreDir();
  const file = storePath(connectorId);
  if (!fs.existsSync(file)) {
    return {
      connectorId,
      documents: [],
      chunks: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as VectorStoreState;
}

function saveStore(state: VectorStoreState) {
  ensureStoreDir();
  fs.writeFileSync(storePath(state.connectorId), JSON.stringify(state, null, 2));
}

export function ingestDocuments(connectorId: string, docs: VectorDocument[]) {
  const state = loadStore(connectorId);
  const now = new Date().toISOString();
  const newDocs: VectorDocument[] = [];
  const newChunks: VectorChunk[] = [];

  docs.forEach((doc) => {
    const docId = doc.id || crypto.randomUUID();
    const normalizedDoc = {
      id: docId,
      title: doc.title || "Untitled",
      content: doc.content || "",
      metadata: doc.metadata || {},
    };
    newDocs.push(normalizedDoc);

    const chunks = chunkText(normalizedDoc.content);
    chunks.forEach((chunk, index) => {
      newChunks.push({
        id: `${docId}-${index}`,
        documentId: docId,
        content: chunk,
        embedding: hashToVector(chunk),
        metadata: normalizedDoc.metadata || {},
      });
    });
  });

  state.documents = state.documents.concat(newDocs);
  state.chunks = state.chunks.concat(newChunks);
  state.updatedAt = now;
  saveStore(state);

  return {
    documentCount: state.documents.length,
    chunkCount: state.chunks.length,
    ingested: newDocs.length,
  };
}

export function rebuildIndex(connectorId: string) {
  const state = loadStore(connectorId);
  const rebuiltChunks: VectorChunk[] = [];

  state.documents.forEach((doc) => {
    const chunks = chunkText(doc.content);
    chunks.forEach((chunk, index) => {
      rebuiltChunks.push({
        id: `${doc.id}-${index}`,
        documentId: doc.id,
        content: chunk,
        embedding: hashToVector(chunk),
        metadata: doc.metadata || {},
      });
    });
  });

  state.chunks = rebuiltChunks;
  state.updatedAt = new Date().toISOString();
  saveStore(state);

  return {
    documentCount: state.documents.length,
    chunkCount: state.chunks.length,
  };
}

export function getStoreStats(connectorId: string) {
  const state = loadStore(connectorId);
  return {
    documentCount: state.documents.length,
    chunkCount: state.chunks.length,
    updatedAt: state.updatedAt,
  };
}
