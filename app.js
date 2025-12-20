const authContext = {
  user: "Alicia Santoro",
  role: "Report Writer",
  workspaces: [
    { name: "Acme Finserv", environment: "prod", region: "us-east", policy: "Evidence aware" },
    { name: "GovCloud Pilot", environment: "staging", region: "us-gov-west", policy: "No web search" },
    { name: "R&D Sandbox", environment: "dev", region: "local", policy: "Fast iteration" },
  ],
};

const blueprintContext = [
  { label: "Audience", value: "CIO + Risk Committee" },
  { label: "Guardrails", value: "No new facts in synthesis; cite every vector-sourced claim" },
  { label: "Connectors", value: "Vector: Product KB, Web: Shielded Search" },
  { label: "Reviewer", value: "Skeptical reviewer simulation enabled (defensible mode)" },
];

const templates = [
  { name: "BRD Generator", scope: "Product / Platform", evidence: "Vector + Web search", freshness: "Updated today" },
  { name: "RFP Response", scope: "Sales / SE", evidence: "Vector only", freshness: "Updated 2 days ago" },
  { name: "Competitive Brief", scope: "Product Marketing", evidence: "Web + Synthesis", freshness: "Updated this week" },
  { name: "Risk Assessment", scope: "GRC", evidence: "Vector + Reviewer simulation", freshness: "Updated yesterday" },
];

const prompts = [
  { name: "Section Planner", stage: "Plan", model: "gpt-4o-mini", owner: "Template Author" },
  { name: "Retriever", stage: "Retrieve", model: "embedding-large", owner: "Owner/Admin" },
  { name: "Writer - Defensible", stage: "Write", model: "gpt-4.1", owner: "Template Author" },
  { name: "Verifier", stage: "Verify", model: "gpt-4.1", owner: "Reviewer" },
  { name: "Repair", stage: "Repair", model: "gpt-4.1", owner: "Reviewer" },
];

const connectors = [
  { name: "Product KB", type: "Vector Store", status: "Healthy" },
  { name: "Incident Postmortems", type: "Vector Store", status: "Healthy" },
  { name: "Shielded Search", type: "Web Search", status: "Degraded" },
  { name: "Cost Tracker", type: "Audit Log", status: "Healthy" },
];

const sectionDefinitions = [
  {
    id: "blueprint",
    title: "Blueprint & Constraints",
    evidencePolicy: "LLM + Vector synthesis (no new facts)",
    provenance: ["Template assumptions", "Vector: Product KB"],
    preferredMode: "defensible",
    artifacts: [
      { name: "Blueprint v1", content: "Purpose, scope, target audience, evidence boundaries, and shared definitions." },
      { name: "Quality gates", content: "Citations required, no cross-contamination, deterministic transitions." },
    ],
  },
  {
    id: "requirements",
    title: "Requirements",
    evidencePolicy: "Vector only + citations",
    provenance: ["Vector: Product KB", "Reviewer: compliance"],
    preferredMode: "defensible",
    artifacts: [
      { name: "Retrieval set", content: "Top 15 passages covering API limits, SLAs, and compliance requirements." },
      { name: "Draft", content: "Requirement statements with inline citations and confidence scores." },
    ],
  },
  {
    id: "market",
    title: "Market Landscape",
    evidencePolicy: "Web search + synthesis",
    provenance: ["Web: Shielded Search", "Vector: Competitive briefs"],
    preferredMode: "fast",
    artifacts: [
      { name: "SERP bundle", content: "Search evidence for top 5 competitors with URLs and freshness." },
      { name: "Narrative", content: "Competitive summary grounded in SERP bundle, no vendor claims." },
    ],
  },
  {
    id: "executive",
    title: "Executive Summary",
    evidencePolicy: "Synthesis only (no new facts)",
    provenance: ["Upstream sections", "Quality gates"],
    preferredMode: "fast",
    artifacts: [
      { name: "Transitions", content: "Cross-section transitions and TOC summary with no new claims." },
      { name: "Risks & asks", content: "Top risks, mitigations, and approvals requested." },
    ],
  },
  {
    id: "risks",
    title: "Risks & Mitigations",
    evidencePolicy: "Vector + Web search",
    provenance: ["Incident KB", "Web: Shielded Search"],
    preferredMode: "defensible",
    artifacts: [
      { name: "Risk register", content: "Top 8 risks ranked by impact/likelihood with cited evidence." },
      { name: "Mitigation plan", content: "Actionable mitigations with owners and timelines." },
    ],
  },
];

const statusOrder = ["queued", "running", "verifying", "repairing", "succeeded", "failed"];

class MockEventSource extends EventTarget {
  constructor(sections) {
    super();
    this.sections = sections;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const target = this.sections[Math.floor(Math.random() * this.sections.length)];
      const status = this.pickNextStatus();
      const detail = this.buildDetail(status, target);
      const artifact = target.artifacts[Math.floor(Math.random() * target.artifacts.length)];
      this.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ sectionId: target.id, status, detail, artifact }),
        }),
      );
    }, 2400);
  }

  pickNextStatus() {
    const roll = Math.random();
    if (roll < 0.2) return "queued";
    if (roll < 0.45) return "running";
    if (roll < 0.65) return "verifying";
    if (roll < 0.8) return "repairing";
    if (roll < 0.92) return "succeeded";
    return "failed";
  }

  buildDetail(status, section) {
    switch (status) {
      case "running":
        return `Writing ${section.title} with ${section.evidencePolicy}`;
      case "verifying":
        return `Verifying citations and no-new-facts for ${section.title}`;
      case "repairing":
        return `Repair loop active for ${section.title}`;
      case "succeeded":
        return `${section.title} locked with provenance and audit log`;
      case "failed":
        return `${section.title} failed verification, retry recommended`;
      default:
        return `${section.title} waiting for upstream dependencies`;
    }
  }

  push(sectionId, status, detail) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ sectionId, status, detail }) }));
  }
}

const state = {
  activePage: "dashboard",
  mode: "fast",
  sectionState: new Map(
    sectionDefinitions.map((section) => [
      section.id,
      {
        status: "queued",
        detail: "Awaiting start",
        artifacts: section.artifacts,
        preferredMode: section.preferredMode,
      },
    ]),
  ),
};

const sse = new MockEventSource(sectionDefinitions);

function init() {
  hydrateAuth();
  renderBlueprint();
  renderTemplates();
  renderPrompts();
  renderConnectors();
  renderStatusBoard();
  renderContext();
  renderModeDetails();
  sse.start();
  attachNav();
  attachModeSelection();
  attachArtifactModal();
  sse.addEventListener("message", handleSse);
}

function hydrateAuth() {
  document.getElementById("userName").textContent = authContext.user;
  document.getElementById("userRole").textContent = authContext.role;
  const select = document.getElementById("workspaceSelect");
  authContext.workspaces.forEach((ws) => {
    const option = document.createElement("option");
    option.value = ws.name;
    option.textContent = ws.name;
    select.appendChild(option);
  });
  select.value = authContext.workspaces[0].name;
  select.addEventListener("change", () => updateWorkspaceMeta(select.value));
  updateWorkspaceMeta(select.value);
}

function updateWorkspaceMeta(name) {
  const workspace = authContext.workspaces.find((ws) => ws.name === name);
  document.getElementById(
    "workspaceMeta",
  ).textContent = `${workspace.environment.toUpperCase()} • ${workspace.region} • ${workspace.policy}`;
}

function attachNav() {
  const buttons = document.querySelectorAll(".nav-item");
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.target;
      switchPage(target);
    }),
  );
}

function switchPage(page) {
  state.activePage = page;
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`${page}Page`).classList.remove("hidden");
}

function renderBlueprint() {
  const list = document.getElementById("blueprintList");
  list.innerHTML = "";
  blueprintContext.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="label">${item.label}</div><div>${item.value}</div>`;
    list.appendChild(li);
  });
}

function renderTemplates() {
  const grid = document.getElementById("templateGrid");
  grid.innerHTML = "";
  templates.forEach((tpl) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <div>
          <p class="eyebrow">${tpl.scope}</p>
          <h3>${tpl.name}</h3>
        </div>
        <span class="badge">${tpl.freshness}</span>
      </div>
      <p class="mode-copy">${tpl.evidence}</p>
      <div class="provenance">
        <span class="pill">Linted</span>
        <span class="pill">Versioned</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderPrompts() {
  const grid = document.getElementById("promptGrid");
  grid.innerHTML = "";
  prompts.forEach((prompt) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <div>
          <p class="eyebrow">${prompt.stage}</p>
          <h3>${prompt.name}</h3>
        </div>
        <span class="badge">${prompt.model}</span>
      </div>
      <p class="mode-copy">Owner: ${prompt.owner}</p>
    `;
    grid.appendChild(card);
  });
}

function renderConnectors() {
  const grid = document.getElementById("connectorGrid");
  grid.innerHTML = "";
  connectors.forEach((connector) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <div>
          <p class="eyebrow">${connector.type}</p>
          <h3>${connector.name}</h3>
        </div>
        <span class="badge ${connector.status === "Healthy" ? "success" : ""}">${connector.status}</span>
      </div>
      <p class="mode-copy">Evidence policy aware • Workspace scoped</p>
    `;
    grid.appendChild(card);
  });
}

function renderContext() {
  const list = document.getElementById("contextList");
  list.innerHTML = "";
  blueprintContext.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="label">${item.label}</div><div>${item.value}</div>`;
    list.appendChild(li);
  });
}

function renderModeDetails() {
  const description =
    state.mode === "fast"
      ? "Fast Draft prioritizes speed with optimistic caching and lightweight verification. Provenance is displayed but not enforced for every claim."
      : "Defensible mode enforces provenance per section, triggers verification + repair loops, and locks outputs after reviewer simulation passes.";
  document.getElementById("provenanceDescription").textContent = description;
  document.getElementById("activeModeChip").textContent =
    state.mode === "fast" ? "Fast Draft mode" : "Defensible mode";
}

function attachModeSelection() {
  document.querySelectorAll('input[name="mode"]').forEach((input) =>
    input.addEventListener("change", (event) => {
      state.mode = event.target.value;
      renderModeDetails();
      renderStatusBoard();
    }),
  );
}

function renderStatusBoard() {
  const board = document.getElementById("statusBoard");
  board.innerHTML = "";
  const header = document.createElement("div");
  header.className = "status-row header";
  header.innerHTML = `
    <div>Section</div>
    <div>Mode</div>
    <div>Evidence policy</div>
    <div>Provenance</div>
    <div>Status</div>
    <div>Actions</div>
  `;
  board.appendChild(header);

  sectionDefinitions.forEach((section) => {
    const stateEntry = state.sectionState.get(section.id);
    const row = document.createElement("div");
    row.className = "status-row";
    row.innerHTML = `
      <div>
        <div class="mode-label">${section.title}</div>
        <p class="mode-copy">${section.artifacts[0].content}</p>
      </div>
      <div>
        <span class="pill">${section.preferredMode === "defensible" ? "Defensible-first" : "Fast-friendly"}</span>
        <span class="pill">${state.mode === "fast" ? "Fast Draft" : "Defensible"}</span>
      </div>
      <div>${section.evidencePolicy}</div>
      <div class="provenance">${renderProvenanceChips(section.provenance)}</div>
      <div>
        <span class="status-chip ${stateEntry.status}">${stateEntry.status}</span>
        <p class="mode-copy">${stateEntry.detail}</p>
      </div>
      <div class="actions">
        <button class="action-button" data-section="${section.id}" data-action="artifact">Artifacts</button>
        <button class="action-button secondary" data-section="${section.id}" data-action="retry">Retry</button>
      </div>
    `;
    board.appendChild(row);
  });
  board.querySelectorAll(".action-button").forEach((button) =>
    button.addEventListener("click", (event) => {
      const sectionId = event.target.dataset.section;
      const action = event.target.dataset.action;
      if (action === "artifact") {
        openArtifact(sectionId);
      } else if (action === "retry") {
        retrySection(sectionId);
      }
    }),
  );
  updateMetrics();
}

function renderProvenanceChips(items) {
  return items.map((item) => `<span class="pill">${item}</span>`).join("");
}

function openArtifact(sectionId) {
  const stateEntry = state.sectionState.get(sectionId);
  const artifact = stateEntry.artifacts[stateEntry.artifacts.length - 1];
  document.getElementById("artifactTitle").textContent = artifact.name;
  document.getElementById("artifactBody").textContent = artifact.content;
  document.getElementById("artifactModal").classList.remove("hidden");
}

function attachArtifactModal() {
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("artifactModal").addEventListener("click", (event) => {
    if (event.target.id === "artifactModal") closeModal();
  });
}

function closeModal() {
  document.getElementById("artifactModal").classList.add("hidden");
}

function retrySection(sectionId) {
  const entry = state.sectionState.get(sectionId);
  entry.status = "queued";
  entry.detail = "Retry scheduled via SSE";
  state.sectionState.set(sectionId, entry);
  renderStatusBoard();
  sse.push(sectionId, "running", "Retry started with fresh cache");
}

function handleSse(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch (err) {
    return;
  }
  const entry = state.sectionState.get(payload.sectionId);
  if (!entry) return;
  const currentIndex = statusOrder.indexOf(entry.status);
  const incomingIndex = statusOrder.indexOf(payload.status);
  if (incomingIndex >= currentIndex) {
    entry.status = payload.status;
    entry.detail = payload.detail || entry.detail;
    if (payload.artifact) {
      entry.artifacts = [...entry.artifacts, payload.artifact];
    }
    state.sectionState.set(payload.sectionId, entry);
    renderStatusBoard();
    appendEventStream(payload);
  }
}

function appendEventStream(payload) {
  const stream = document.getElementById("runEventStream");
  const section = sectionDefinitions.find((s) => s.id === payload.sectionId);
  const item = document.createElement("div");
  item.className = "stream-item";
  item.innerHTML = `<strong>${section.title}</strong> • ${payload.status.toUpperCase()} • ${payload.detail || ""}`;
  stream.prepend(item);
  while (stream.children.length > 10) {
    stream.removeChild(stream.lastChild);
  }
}

function updateMetrics() {
  const statuses = Array.from(state.sectionState.values());
  const defensible = statuses.filter((s, idx) => sectionDefinitions[idx].preferredMode === "defensible" && s.status === "succeeded");
  const fast = statuses.filter((s, idx) => sectionDefinitions[idx].preferredMode === "fast" && s.status === "succeeded");
  const retries = statuses.filter((s) => ["failed", "repairing"].includes(s.status));
  document.getElementById("defensibleCount").textContent = defensible.length;
  document.getElementById("fastCount").textContent = fast.length;
  document.getElementById("retryCount").textContent = retries.length;
}

document.addEventListener("DOMContentLoaded", init);
