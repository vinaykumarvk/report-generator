const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function seedDatabase() {
  ensureDataDir();
  const now = new Date().toISOString();
  const templateId = randomUUID();
  const seed = {
    templates: [
      {
        id: templateId,
        name: "Sample BRD Template",
        description:
          "Starter template demonstrating evidence-aware sections and ordering.",
        formats: ["markdown", "docx"],
        status: "DRAFT",
        version: 1,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      },
    ],
    sections: [
      {
        id: randomUUID(),
        templateId,
        title: "Executive Summary",
        purpose: "Summarize the report goals and key recommendations.",
        order: 1,
        formats: ["markdown"],
        evidencePolicy: "SYNTHESIS_ONLY",
        retrievalMethod: "SYNTHESIS_ONLY",
        status: "DRAFT",
        prompt:
          "Draft a concise summary using only provided blueprint context. Do not add new facts.",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        templateId,
        title: "Findings",
        purpose: "Detail the core findings with evidence-backed claims.",
        order: 2,
        formats: ["markdown"],
        evidencePolicy: "EVIDENCE_REQUIRED",
        retrievalMethod: "VECTOR_AND_WEB",
        status: "DRAFT",
        prompt:
          "Use the retrieval plan to ground claims and include inline citations.",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  return seed;
}

function loadDatabase() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    return seedDatabase();
  }
  const content = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(content);
  } catch (err) {
    console.warn("Corrupt DB detected; reseeding.", err);
    return seedDatabase();
  }
}

function saveDatabase(db) {
  ensureDataDir();
  const normalized = {
    templates: db.templates || [],
    sections: db.sections || [],
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2));
}

function upsertTemplate(template) {
  const db = loadDatabase();
  const existingIndex = db.templates.findIndex((t) => t.id === template.id);
  if (existingIndex >= 0) {
    db.templates[existingIndex] = template;
  } else {
    db.templates.push(template);
  }
  saveDatabase(db);
  return template;
}

function listTemplates() {
  const db = loadDatabase();
  return db.templates.slice();
}

function getTemplateById(id) {
  const db = loadDatabase();
  return db.templates.find((t) => t.id === id) || null;
}

function listSections(templateId) {
  const db = loadDatabase();
  return db.sections
    .filter((s) => s.templateId === templateId)
    .sort((a, b) => a.order - b.order);
}

function upsertSection(section) {
  const db = loadDatabase();
  const existingIndex = db.sections.findIndex((s) => s.id === section.id);
  if (existingIndex >= 0) {
    db.sections[existingIndex] = section;
  } else {
    db.sections.push(section);
  }
  saveDatabase(db);
  return section;
}

function createTemplate({ name, description, formats }) {
  const now = new Date().toISOString();
  const template = {
    id: randomUUID(),
    name,
    description: description || "",
    formats: formats && Array.isArray(formats) ? formats : [],
    status: "DRAFT",
    version: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
  upsertTemplate(template);
  return template;
}

function createSection(templateId, payload) {
  const now = new Date().toISOString();
  const section = {
    id: randomUUID(),
    templateId,
    title: payload.title || "Untitled Section",
    purpose: payload.purpose || "",
    order:
      typeof payload.order === "number" && !Number.isNaN(payload.order)
        ? payload.order
        : 1,
    formats: payload.formats || [],
    evidencePolicy: payload.evidencePolicy || "EVIDENCE_REQUIRED",
    retrievalMethod: payload.retrievalMethod || "VECTOR_ONLY",
    status: "DRAFT",
    prompt: payload.prompt || "",
    createdAt: now,
    updatedAt: now,
  };
  const db = loadDatabase();
  db.sections.push(section);
  saveDatabase(db);
  return section;
}

function updateSection(templateId, sectionId, updates) {
  const db = loadDatabase();
  const sectionIndex = db.sections.findIndex(
    (s) => s.id === sectionId && s.templateId === templateId
  );
  if (sectionIndex === -1) {
    return null;
  }
  const existing = db.sections[sectionIndex];
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  db.sections[sectionIndex] = updated;
  saveDatabase(db);
  return updated;
}

module.exports = {
  loadDatabase,
  saveDatabase,
  listTemplates,
  getTemplateById,
  listSections,
  createTemplate,
  createSection,
  updateSection,
  upsertTemplate,
  upsertSection,
};
