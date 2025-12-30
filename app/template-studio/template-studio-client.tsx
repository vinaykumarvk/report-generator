"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/top-nav";
import { templateStudioNavItems } from "@/components/nav-items";
import ObjectiveStudioAnchors from "./template-studio-anchors";

const EVIDENCE_POLICIES = [
  "LLM_ONLY",
  "VECTOR_ONLY",
  "WEB_ONLY",
  "VECTOR_LLM",
  "WEB_LLM",
  "VECTOR_WEB",
  "ALL",
  "SYNTHESIS_ONLY",
];

const OUTPUT_FORMATS = [
  "NARRATIVE",
  "BULLETS",
  "TABLE",
  "REQUIREMENTS",
  "JSON_SCHEMA",
];

type ObjectiveSection = {
  id: string;
  title: string;
  purpose?: string;
  order?: number;
  outputFormat?: string;
  evidencePolicy?: string;
  targetLengthMin?: number;
  targetLengthMax?: number;
  dependencies?: string[];
  vectorPolicyJson?: { connectorIds?: string[] } | null;
  webPolicyJson?: {
    allowlist?: string[];
    blocklist?: string[];
    minSources?: number;
    recencyDays?: number;
    citationStyle?: string;
  } | null;
  qualityGatesJson?: { noNewFacts?: boolean } | null;
  status?: string;
  prompt?: string;
};

type Objective = {
  id: string;
  name: string;
  description?: string;
  audience?: string;
  tone?: string;
  domain?: string;
  jurisdiction?: string;
  status?: string;
  formats?: string[];
  activePromptSetId?: string | null;
  defaultVectorStoreIds?: string[];
  sections?: ObjectiveSection[];
};

type Connector = {
  id: string;
  name: string;
  type: string;
  description?: string;
  tags?: string[];
  configJson?: Record<string, unknown>;
};

type PromptSet = {
  id: string;
  name: string;
  state?: string;
  version?: number;
  templateId?: string | null;
  globalPrompts?: { system?: string; developer?: string };
  sections?: unknown[];
};

type Profile = {
  id: string;
  name: string;
};

type Run = {
  id: string;
  status?: string;
  createdAt?: string;
  templateId?: string;
  profileId?: string | null;
  promptSetId?: string | null;
  inputJson?: Record<string, unknown>;
};

type SectionRun = {
  id: string;
  title?: string;
  status?: string;
  artifacts?: Array<{ type: string; content: unknown }>;
  templateSectionId?: string;
};

type RunExport = {
  id: string;
  format: string;
  createdAt?: string;
  runId: string;
};

type RunScore = {
  sectionRunId: string;
  coverage: number;
  diversity: number;
  recency: number;
  redundancy: number;
};

type DashboardSummary = {
  templatesCount: number;
  connectorsCount: number;
  runsCount: number;
  exportsCount: number;
  runStatusCounts?: Record<string, number>;
  recentRuns?: Array<{ id: string; status: string; createdAt?: string }>;
};

type RunDashboard = {
  status?: string;
  sectionCount?: number;
  exportsCount?: number;
  sectionStatusCounts?: Record<string, number>;
  averageScores?: Record<string, number>;
};

type ObjectiveEdit = {
  name: string;
  description: string;
  audience: string;
  tone: string;
  domain: string;
  jurisdiction: string;
  formats: string;
  defaultVectorStoreIds: string[];
  activePromptSetId: string | null;
};

type SectionEdit = {
  title: string;
  purpose: string;
  order: number;
  outputFormat: string;
  evidencePolicy: string;
  targetLengthMin: number;
  targetLengthMax: number;
  dependencies: string[];
  vectorSourceMode: "inherit" | "override" | "";
  vectorStoreIds: string[];
  webAllowlist: string[];
  webBlocklist: string[];
  webMinSources: number;
  webRecencyDays: number;
  webCitationStyle: string;
  noNewFacts: boolean;
  prompt: string;
};

type NewSection = {
  title: string;
  purpose: string;
  order: number;
  outputFormat: string;
  evidencePolicy: string;
  targetLengthMin: number;
  targetLengthMax: number;
  dependencies: string[];
  vectorSourceMode: "inherit" | "override" | "";
  vectorStoreIds: string[];
  webAllowlist: string;
  webBlocklist: string;
  webMinSources: number;
  webRecencyDays: number;
  webCitationStyle: string;
  noNewFacts: boolean;
  prompt: string;
};

function mapSection(raw: any): ObjectiveSection {
  if (!raw) return raw;
  return {
    id: raw.id,
    title: raw.title,
    purpose: raw.purpose ?? "",
    order: raw.order ?? 1,
    outputFormat: raw.output_format ?? raw.outputFormat ?? "NARRATIVE",
    evidencePolicy: raw.evidence_policy ?? raw.evidencePolicy ?? "LLM_ONLY",
    targetLengthMin: raw.target_length_min ?? raw.targetLengthMin ?? 0,
    targetLengthMax: raw.target_length_max ?? raw.targetLengthMax ?? 0,
    dependencies: raw.dependencies ?? [],
    vectorPolicyJson: raw.vector_policy_json ?? raw.vectorPolicyJson ?? null,
    webPolicyJson: raw.web_policy_json ?? raw.webPolicyJson ?? null,
    qualityGatesJson: raw.quality_gates_json ?? raw.qualityGatesJson ?? null,
    status: raw.status,
    prompt: raw.prompt ?? "",
  };
}

function mapObjective(raw: any): Objective {
  const sectionsRaw = raw.template_sections || raw.sections || [];
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    audience: raw.audience ?? "",
    tone: raw.tone ?? "",
    domain: raw.domain ?? "",
    jurisdiction: raw.jurisdiction ?? "",
    status: raw.status ?? "DRAFT",
    formats: raw.formats ?? [],
    activePromptSetId: raw.active_prompt_set_id ?? raw.activePromptSetId ?? null,
    defaultVectorStoreIds:
      raw.default_vector_store_ids ?? raw.defaultVectorStoreIds ?? [],
    sections: sectionsRaw.map(mapSection),
  };
}

function mapPromptSet(raw: any): PromptSet {
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state,
    version: raw.version,
    templateId: raw.template_id ?? raw.templateId ?? null,
    globalPrompts: raw.global_prompts ?? raw.globalPrompts ?? {},
    sections: raw.sections_json ?? raw.sections ?? [],
  };
}

function mapConnector(raw: any): Connector {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    description: raw.description ?? "",
    tags: raw.tags ?? [],
    configJson: raw.config_json ?? raw.configJson ?? {},
  };
}

function mapRun(raw: any): Run {
  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.created_at ?? raw.createdAt,
    templateId: raw.template_id ?? raw.templateId,
    profileId: raw.profile_id ?? raw.profileId ?? null,
    promptSetId: raw.prompt_set_id ?? raw.promptSetId ?? null,
    inputJson: raw.input_json ?? raw.inputJson ?? {},
  };
}

function mapSectionRun(raw: any): SectionRun {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    templateSectionId: raw.template_section_id ?? raw.templateSectionId,
    artifacts: raw.artifacts ?? [],
  };
}

function mapRunExport(raw: any): RunExport {
  return {
    id: raw.id,
    format: raw.format,
    createdAt: raw.created_at ?? raw.createdAt,
    runId: raw.report_run_id ?? raw.runId,
  };
}

function mapRunScore(raw: any): RunScore {
  return {
    sectionRunId: raw.section_run_id ?? raw.sectionRunId,
    coverage: raw.coverage ?? 0,
    diversity: raw.diversity ?? 0,
    recency: raw.recency ?? 0,
    redundancy: raw.redundancy ?? 0,
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ObjectiveStudioClient() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
  const [selectedPromptSetId, setSelectedPromptSetId] = useState<string | null>(null);
  
  // New UI state
  const [objectiveSearch, setObjectiveSearch] = useState("");
  const [showAllObjectives, setShowAllObjectives] = useState(false);
  const [isCreatingNewObjective, setIsCreatingNewObjective] = useState(false);
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [showSourcesSection, setShowSourcesSection] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [objectiveErrors, setObjectiveErrors] = useState<{ name?: string }>({});
  const [promptErrors, setPromptErrors] = useState<{ name?: string; sectionsJson?: string }>({});
  const [runErrors, setRunErrors] = useState<{ templateId?: string; inputJson?: string }>({});

  const [objectiveEdit, setObjectiveEdit] = useState<ObjectiveEdit | null>(null);
  const [sectionEdits, setSectionEdits] = useState<Record<string, SectionEdit>>({});

  const [objectiveForm, setObjectiveForm] = useState({
    name: "",
    description: "",
    audience: "",
    tone: "",
    domain: "",
    jurisdiction: "",
    formats: "",
  });

  const [connectorForm, setConnectorForm] = useState({
    name: "",
    type: "VECTOR",
    description: "",
    tags: "",
    selectedVectorStores: [] as Array<{ id: string; name: string }>,
  });
  
  const [availableVectorStores, setAvailableVectorStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVectorStores, setLoadingVectorStores] = useState(false);
  
  // File selection state
  const [expandedVectorStore, setExpandedVectorStore] = useState<string | null>(null);
  const [vectorStoreFiles, setVectorStoreFiles] = useState<Record<string, Array<{ id: string; filename: string; bytes: number }>>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string[]>>({});
  
  // Search state
  const [vectorStoreSearch, setVectorStoreSearch] = useState("");
  const [fileSearch, setFileSearch] = useState<Record<string, string>>({});

  const [webConfigForm, setWebConfigForm] = useState({
    connectorId: "",
    provider: "mock",
    apiKeyEnv: "",
    apiUrl: "",
  });

  const [webSearch, setWebSearch] = useState({ query: "", output: "" });

  const [promptForm, setPromptForm] = useState({
    name: "",
    templateId: "",
  });

  const [promptEditor, setPromptEditor] = useState({
    globalSystem: "",
    globalDeveloper: "",
    sectionsJson: "[]",
    rollbackVersion: "",
    diffFrom: "",
    diffTo: "",
    diffOutput: "",
  });
  const [objectiveHistory, setObjectiveHistory] = useState({
    from: "",
    to: "",
    output: "",
  });

  const [runForm, setRunForm] = useState({
    templateId: "",
    profileId: "",
    promptSetId: "",
    inputJson: "",
  });

  const [runSections, setRunSections] = useState<SectionRun[]>([]);
  const [runScores, setRunScores] = useState<RunScore[]>([]);
  const [runExports, setRunExports] = useState<RunExport[]>([]);
  const [runDashboard, setRunDashboard] = useState<RunDashboard | null>(null);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});

  const [newSection, setNewSection] = useState<NewSection>({
    title: "",
    purpose: "",
    order: 1,
    outputFormat: "",
    evidencePolicy: "LLM_ONLY",
    targetLengthMin: 0,
    targetLengthMax: 0,
    dependencies: [],
    vectorSourceMode: "",
    vectorStoreIds: [],
    webAllowlist: "",
    webBlocklist: "",
    webMinSources: 0,
    webRecencyDays: 0,
    webCitationStyle: "",
    noNewFacts: false,
    prompt: "",
  });

  const selectedObjective = useMemo(
    () => objectives.find((item) => item.id === selectedObjectiveId) || null,
    [objectives, selectedObjectiveId]
  );
  const selectedPromptSet = useMemo(
    () => promptSets.find((item) => item.id === selectedPromptSetId) || null,
    [promptSets, selectedPromptSetId]
  );
  const selectedRun = useMemo(
    () => runs.find((item) => item.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  async function fetchJson(url: string, options?: RequestInit) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const message = payload?.error || "Request failed";
      throw new Error(message);
    }
    return res.json();
  }

  async function loadObjectives() {
    const data = await fetchJson("/api/templates");
    const mapped = Array.isArray(data) ? data.map(mapObjective) : [];
    setObjectives(mapped);
    if (!selectedObjectiveId && mapped[0]) {
      setSelectedObjectiveId(mapped[0].id);
    }
    if (!runForm.templateId && mapped[0]) {
      setRunForm((prev) => ({ ...prev, templateId: mapped[0].id }));
    }
    if (!promptForm.templateId && mapped[0]) {
      setPromptForm((prev) => ({ ...prev, templateId: mapped[0].id }));
    }
  }

  async function loadConnectors() {
    const data = await fetchJson("/api/connectors");
    setConnectors(Array.isArray(data) ? data.map(mapConnector) : []);
  }

  async function loadPromptSets() {
    const data = await fetchJson("/api/prompts");
    const mapped = Array.isArray(data) ? data.map(mapPromptSet) : [];
    setPromptSets(mapped);
    if (!selectedPromptSetId && mapped[0]) {
      setSelectedPromptSetId(mapped[0].id);
    }
  }

  async function loadProfiles() {
    const data = await fetchJson("/api/generation-profiles");
    const list = Array.isArray(data?.data) ? data.data : [];
    setProfiles(list);
    if (!runForm.profileId && list[0]) {
      setRunForm((prev) => ({ ...prev, profileId: list[0].id }));
    }
  }

  async function loadRuns() {
    const data = await fetchJson("/api/report-runs");
    const mapped = Array.isArray(data) ? data.map(mapRun) : [];
    setRuns(mapped);
    if (!selectedRunId && mapped[0]) {
      setSelectedRunId(mapped[0].id);
    }
  }

  async function loadDashboard() {
    try {
      const data = await fetchJson("/api/dashboard");
      setDashboard(data);
    } catch (err) {
      setDashboard(null);
    }
  }

  useEffect(() => {
    void loadObjectives();
    void loadConnectors();
    void loadPromptSets();
    void loadProfiles();
    void loadRuns();
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connectorForm.type === "VECTOR" || connectorForm.type === "BOTH") {
      void loadAvailableVectorStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectorForm.type]);

  useEffect(() => {
    if (!selectedObjective) {
      setObjectiveEdit(null);
      setSectionEdits({});
      setObjectiveHistory({ from: "", to: "", output: "" });
      return;
    }
    setObjectiveEdit({
      name: selectedObjective.name || "",
      description: selectedObjective.description || "",
      audience: selectedObjective.audience || "",
      tone: selectedObjective.tone || "",
      domain: selectedObjective.domain || "",
      jurisdiction: selectedObjective.jurisdiction || "",
      formats: (selectedObjective.formats || []).join(", "),
      defaultVectorStoreIds: selectedObjective.defaultVectorStoreIds || [],
      activePromptSetId: selectedObjective.activePromptSetId || null,
    });
    const nextEdits: Record<string, SectionEdit> = {};
    (selectedObjective.sections || []).forEach((section) => {
      nextEdits[section.id] = {
        title: section.title || "",
        purpose: section.purpose || "",
        order: section.order || 1,
        outputFormat: section.outputFormat || "NARRATIVE",
        evidencePolicy: section.evidencePolicy || "LLM_ONLY",
        targetLengthMin: section.targetLengthMin || 0,
        targetLengthMax: section.targetLengthMax || 0,
        dependencies: section.dependencies || [],
        vectorSourceMode: section.vectorPolicyJson ? "override" : "inherit",
        vectorStoreIds: section.vectorPolicyJson?.connectorIds || [],
        webAllowlist: section.webPolicyJson?.allowlist || [],
        webBlocklist: section.webPolicyJson?.blocklist || [],
        webMinSources: section.webPolicyJson?.minSources || 0,
        webRecencyDays: section.webPolicyJson?.recencyDays || 0,
        webCitationStyle: section.webPolicyJson?.citationStyle || "",
        noNewFacts: Boolean(section.qualityGatesJson?.noNewFacts),
        prompt: section.prompt || "",
      };
    });
    setSectionEdits(nextEdits);
    setNewSection((prev) => ({
      ...prev,
      order: (selectedObjective.sections || []).length + 1,
      dependencies: [],
      vectorSourceMode: "",
      vectorStoreIds: [],
      webAllowlist: "",
      webBlocklist: "",
      webMinSources: 0,
      webRecencyDays: 0,
      webCitationStyle: "",
      noNewFacts: false,
      prompt: "",
    }));
  }, [selectedObjective]);

  useEffect(() => {
    if (!selectedPromptSet) {
      setPromptEditor((prev) => ({
        ...prev,
        globalSystem: "",
        globalDeveloper: "",
        sectionsJson: "[]",
        diffOutput: "",
      }));
      return;
    }
    setPromptEditor((prev) => ({
      ...prev,
      globalSystem: selectedPromptSet.globalPrompts?.system || "",
      globalDeveloper: selectedPromptSet.globalPrompts?.developer || "",
      sectionsJson: JSON.stringify(selectedPromptSet.sections || [], null, 2),
      diffOutput: "",
    }));
  }, [selectedPromptSet]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunSections([]);
      setRunScores([]);
      setRunExports([]);
      setRunDashboard(null);
      return;
    }
    async function loadRunDetails() {
      const [scores, dashboardData, sections, exportsList] = await Promise.all([
        fetchJson(`/api/report-runs/${selectedRunId}/scores`).catch(() => []),
        fetchJson(`/api/report-runs/${selectedRunId}/dashboard`).catch(() => null),
        fetchJson(`/api/report-runs/${selectedRunId}/sections`).catch(() => []),
        fetchJson(`/api/report-runs/${selectedRunId}/exports`).catch(() => []),
      ]);
      setRunScores(Array.isArray(scores) ? scores.map(mapRunScore) : []);
      setRunDashboard(dashboardData || null);
      setRunSections(Array.isArray(sections) ? sections.map(mapSectionRun) : []);
      setRunExports(Array.isArray(exportsList) ? exportsList.map(mapRunExport) : []);
    }
    void loadRunDetails();
    setExpandedArtifacts({});
  }, [selectedRunId]);

  useEffect(() => {
    if (!webConfigForm.connectorId) {
      const webConnector = connectors.find((item) => item.type === "WEB_SEARCH");
      if (webConnector) {
        setWebConfigForm((prev) => ({ ...prev, connectorId: webConnector.id }));
      }
    }
  }, [connectors, webConfigForm.connectorId]);

  useEffect(() => {
    if (!runForm.templateId) return;
    const template = objectives.find((item) => item.id === runForm.templateId);
    const defaultPromptSetId = template?.activePromptSetId || "";
    setRunForm((prev) => ({
      ...prev,
      promptSetId: defaultPromptSetId,
    }));
  }, [runForm.templateId, objectives]);

  async function handleCreateObjective(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setObjectiveErrors({});
    if (!objectiveForm.name.trim()) {
      setObjectiveErrors({ name: "Objective name is required." });
      return;
    }
    try {
      const payload = {
        name: objectiveForm.name.trim(),
        description: objectiveForm.description.trim(),
        audience: objectiveForm.audience.trim(),
        tone: objectiveForm.tone.trim(),
        domain: objectiveForm.domain.trim(),
        jurisdiction: objectiveForm.jurisdiction.trim(),
        formats: parseList(objectiveForm.formats),
      };
      const template = await fetchJson("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setObjectiveForm({
        name: "",
        description: "",
        audience: "",
        tone: "",
        domain: "",
        jurisdiction: "",
        formats: "",
      });
      setSelectedObjectiveId(template.id);
      await loadObjectives();
    } catch (err: any) {
      window.alert(err.message || "Failed to create template");
    }
  }

  async function handleDeleteObjective(templateId: string, templateName: string) {
    if (!window.confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await fetchJson(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (selectedObjectiveId === templateId) {
        setSelectedObjectiveId(null);
      }
      await loadObjectives();
    } catch (err: any) {
      window.alert(err.message || "Failed to delete template");
    }
  }

  async function handleCreateConnector(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const configJson: Record<string, any> = {};
      
      // Add vector store IDs and selected files if VECTOR type is selected
      if ((connectorForm.type === "VECTOR" || connectorForm.type === "BOTH") && connectorForm.selectedVectorStores.length > 0) {
        configJson.vectorStores = connectorForm.selectedVectorStores.map((store) => {
          const storeConfig: any = {
            id: store.id,
            name: store.name,
          };
          
          // Add selected files if any
          const selectedFileIds = selectedFiles[store.id];
          if (selectedFileIds && selectedFileIds.length > 0) {
            storeConfig.fileIds = selectedFileIds;
            
            // Also include filenames for reference
            const files = vectorStoreFiles[store.id] || [];
            storeConfig.files = selectedFileIds.map((fileId) => {
              const file = files.find((f) => f.id === fileId);
              return {
                id: fileId,
                filename: file?.filename || fileId,
              };
            });
          }
          
          return storeConfig;
        });
      }
      
      const payload = {
        name: connectorForm.name.trim(),
        type: connectorForm.type,
        description: connectorForm.description.trim(),
        tags: parseList(connectorForm.tags),
        configJson: Object.keys(configJson).length > 0 ? configJson : undefined,
      };
      await fetchJson("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      // Reset form
      setConnectorForm({ 
        name: "", 
        type: "VECTOR", 
        description: "", 
        tags: "",
        selectedVectorStores: [],
      });
      setSelectedFiles({});
      setExpandedVectorStore(null);
      
      await loadConnectors();
    } catch (err: any) {
      window.alert(err.message || "Unable to create source");
    }
  }

  async function handleSyncOpenAIStores() {
    try {
      await fetchJson("/api/openai/vector-stores/sync", { method: "POST" });
      await loadConnectors();
      window.alert("OpenAI vector stores synced.");
    } catch (err: any) {
      window.alert(err.message || "Unable to sync OpenAI vector stores.");
    }
  }

  async function loadAvailableVectorStores() {
    setLoadingVectorStores(true);
    try {
      const response = await fetchJson("/api/openai/vector-stores");
      if (Array.isArray(response)) {
        // Sort alphabetically by name
        const sortedStores = response
          .map((store: any) => ({
            id: store.id,
            name: store.name || store.id,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setAvailableVectorStores(sortedStores);
      }
    } catch (err: any) {
      console.error("Failed to load vector stores:", err);
    } finally {
      setLoadingVectorStores(false);
    }
  }

  function toggleVectorStoreSelection(store: { id: string; name: string }) {
    setConnectorForm((prev) => {
      const isSelected = prev.selectedVectorStores.some((s) => s.id === store.id);
      if (isSelected) {
        // Deselect - also clear file selections for this store
        setSelectedFiles((prevFiles) => {
          const newFiles = { ...prevFiles };
          delete newFiles[store.id];
          return newFiles;
        });
        return {
          ...prev,
          selectedVectorStores: prev.selectedVectorStores.filter((s) => s.id !== store.id),
        };
      } else if (prev.selectedVectorStores.length < 2) {
        // Select (under limit)
        return {
          ...prev,
          selectedVectorStores: [...prev.selectedVectorStores, store],
        };
      } else {
        // Already at limit
        window.alert("⚠️ Maximum Selection Reached\n\nYou can select up to 2 vector stores only.\nPlease deselect one before selecting another.");
        return prev;
      }
    });
  }

  async function loadVectorStoreFiles(vectorStoreId: string) {
    if (vectorStoreFiles[vectorStoreId]) {
      // Already loaded
      return;
    }
    
    setLoadingFiles((prev) => ({ ...prev, [vectorStoreId]: true }));
    try {
      const files = await fetchJson(`/api/openai/vector-stores/${vectorStoreId}/files`);
      // Sort files alphabetically by filename
      const sortedFiles = Array.isArray(files) 
        ? files.sort((a, b) => a.filename.localeCompare(b.filename))
        : [];
      
      setVectorStoreFiles((prev) => ({
        ...prev,
        [vectorStoreId]: sortedFiles,
      }));
    } catch (err: any) {
      console.error(`Failed to load files for vector store ${vectorStoreId}:`, err);
      window.alert(`Failed to load files: ${err.message}`);
    } finally {
      setLoadingFiles((prev) => ({ ...prev, [vectorStoreId]: false }));
    }
  }

  function toggleFileSelection(vectorStoreId: string, fileId: string) {
    setSelectedFiles((prev) => {
      const currentFiles = prev[vectorStoreId] || [];
      const isSelected = currentFiles.includes(fileId);
      
      if (isSelected) {
        // Deselect
        return {
          ...prev,
          [vectorStoreId]: currentFiles.filter((id) => id !== fileId),
        };
      } else {
        // Select
        return {
          ...prev,
          [vectorStoreId]: [...currentFiles, fileId],
        };
      }
    });
  }

  function toggleSpecificFiles(vectorStoreId: string) {
    if (expandedVectorStore === vectorStoreId) {
      // Collapse
      setExpandedVectorStore(null);
    } else {
      // Expand and load files
      setExpandedVectorStore(vectorStoreId);
      void loadVectorStoreFiles(vectorStoreId);
    }
  }

  async function handleSaveWebConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!webConfigForm.connectorId) return;
    try {
      const payload = {
        configJson: {
          provider: webConfigForm.provider,
          apiKeyEnv: webConfigForm.apiKeyEnv,
          apiUrl: webConfigForm.apiUrl,
        },
      };
      await fetchJson(`/api/connectors/${webConfigForm.connectorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadConnectors();
    } catch (err: any) {
      window.alert(err.message || "Unable to save web config");
    }
  }

  async function handleTestWebSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!webConfigForm.connectorId) return;
    try {
      const data = await fetchJson("/api/web/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: webConfigForm.connectorId,
          query: webSearch.query,
        }),
      });
      setWebSearch((prev) => ({ ...prev, output: JSON.stringify(data, null, 2) }));
    } catch (err: any) {
      window.alert(err.message || "Web search failed");
    }
  }

  async function handleCreatePromptSet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromptErrors({});
    if (!promptForm.templateId) return;
    if (!promptForm.name.trim()) {
      setPromptErrors({ name: "Prompt set name is required." });
      return;
    }
    try {
      const payload = { name: promptForm.name.trim() };
      await fetchJson(`/api/templates/${promptForm.templateId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPromptForm((prev) => ({ ...prev, name: "" }));
      await loadPromptSets();
    } catch (err: any) {
      window.alert(err.message || "Unable to create prompt set");
    }
  }

  async function handleSavePromptSet() {
    if (!selectedPromptSet) return;
    setPromptErrors((prev) => ({ ...prev, sectionsJson: undefined }));
    let sections: unknown[] = [];
    try {
      sections = JSON.parse(promptEditor.sectionsJson || "[]");
    } catch (err) {
      setPromptErrors((prev) => ({
        ...prev,
        sectionsJson: "Sections JSON is invalid.",
      }));
      return;
    }
    try {
      await fetchJson(`/api/prompts/${selectedPromptSet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalPrompts: {
            system: promptEditor.globalSystem,
            developer: promptEditor.globalDeveloper,
          },
          sections,
        }),
      });
      await loadPromptSets();
    } catch (err: any) {
      window.alert(err.message || "Unable to save prompt set");
    }
  }

  async function handlePublishPromptSet() {
    if (!selectedPromptSet) return;
    if (!window.confirm("Publish this prompt set?")) {
      return;
    }
    try {
      await fetchJson(`/api/prompts/${selectedPromptSet.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Published from UI" }),
      });
      await loadPromptSets();
    } catch (err: any) {
      window.alert(err.message || "Unable to publish prompt set");
    }
  }

  async function handleRollbackPromptSet() {
    if (!selectedPromptSet) return;
    const version = Number(promptEditor.rollbackVersion);
    if (!version) {
      window.alert("Enter a version to rollback.");
      return;
    }
    if (
      !window.confirm(
        "Rollback this prompt set to the selected version? This creates a new draft."
      )
    ) {
      return;
    }
    try {
      await fetchJson(`/api/prompts/${selectedPromptSet.id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      await loadPromptSets();
    } catch (err: any) {
      window.alert(err.message || "Unable to rollback prompt set");
    }
  }

  async function handleDiffPromptSet() {
    if (!selectedPromptSet) return;
    if (!promptEditor.diffFrom || !promptEditor.diffTo) {
      window.alert("Enter from/to versions.");
      return;
    }
    try {
      const data = await fetchJson(
        `/api/prompts/${selectedPromptSet.id}/diff?from=${promptEditor.diffFrom}&to=${promptEditor.diffTo}`
      );
      setPromptEditor((prev) => ({
        ...prev,
        diffOutput: JSON.stringify(data.diffs, null, 2),
      }));
    } catch (err: any) {
      window.alert(err.message || "Unable to diff prompt set");
    }
  }

  async function handleCreateRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunErrors({});
    if (!runForm.templateId) {
      setRunErrors({ templateId: "Select a template to start a run." });
      return;
    }
    let inputJson: Record<string, unknown> = {};
    if (runForm.inputJson.trim()) {
      try {
        inputJson = JSON.parse(runForm.inputJson);
      } catch (err) {
        setRunErrors({ inputJson: "Run input JSON is invalid." });
        return;
      }
    }
    try {
      const payload = {
        templateId: runForm.templateId,
        profileId: runForm.profileId || null,
        promptSetId: runForm.promptSetId || null,
        inputJson,
      };
      await fetchJson("/api/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRunForm((prev) => ({ ...prev, inputJson: "" }));
      await loadRuns();
    } catch (err: any) {
      window.alert(err.message || "Unable to create run");
    }
  }

  async function handleStartRun(runId: string) {
    try {
      await fetchJson(`/api/report-runs/${runId}/start`, { method: "POST" });
      await loadRuns();
    } catch (err: any) {
      window.alert(err.message || "Unable to start run");
    }
  }

  async function handleExportRun(runId: string, format: string) {
    try {
      await fetchJson(`/api/report-runs/${runId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      await loadRuns();
    } catch (err: any) {
      window.alert(err.message || "Unable to export run");
    }
  }

  async function handleRerunRun(runId: string) {
    if (
      !window.confirm(
        "Rerun this report? This will recalculate impacted sections."
      )
    ) {
      return;
    }
    try {
      const data = await fetchJson(`/api/report-runs/${runId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: { blueprintAssumptions: ["Updated assumption A"] },
        }),
      });
      window.alert(`Impacted sections: ${data.impactedSections.join(", ") || "none"}`);
      await loadRuns();
    } catch (err: any) {
      window.alert(err.message || "Unable to plan delta rerun");
    }
  }

  async function handleRetrySection(sectionRunId: string) {
    if (!window.confirm("Retry this section?")) {
      return;
    }
    try {
      await fetchJson(`/api/section-runs/${sectionRunId}/retry`, {
        method: "POST",
      });
      await loadRuns();
      if (selectedRunId) {
        const sections = await fetchJson(`/api/report-runs/${selectedRunId}/sections`);
        setRunSections(Array.isArray(sections) ? sections.map(mapSectionRun) : []);
      }
    } catch (err: any) {
      window.alert(err.message || "Unable to retry section.");
    }
  }

  async function handleAddSection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObjectiveId) return;
    const webAllowlist = parseList(newSection.webAllowlist);
    const webBlocklist = parseList(newSection.webBlocklist);
    try {
      const payload = {
        title: newSection.title.trim(),
        order: Number(newSection.order) || 1,
        purpose: newSection.purpose.trim(),
        outputFormat: newSection.outputFormat || "NARRATIVE",
        targetLengthMin: Number(newSection.targetLengthMin) || 0,
        targetLengthMax: Number(newSection.targetLengthMax) || 0,
        dependencies: newSection.dependencies,
        evidencePolicy: newSection.evidencePolicy,
        vectorPolicyJson:
          newSection.vectorSourceMode === "override"
            ? { connectorIds: newSection.vectorStoreIds }
            : null,
        webPolicyJson:
          webAllowlist.length ||
          webBlocklist.length ||
          newSection.webMinSources ||
          newSection.webRecencyDays ||
          newSection.webCitationStyle
            ? {
                allowlist: webAllowlist,
                blocklist: webBlocklist,
                minSources: newSection.webMinSources,
                recencyDays: newSection.webRecencyDays,
                citationStyle: newSection.webCitationStyle,
              }
            : null,
        qualityGatesJson: newSection.noNewFacts ? { noNewFacts: true } : null,
        prompt: newSection.prompt.trim(),
      };
      await fetchJson(`/api/templates/${selectedObjectiveId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNewSection((prev) => ({
        ...prev,
        title: "",
        purpose: "",
        targetLengthMin: 0,
        targetLengthMax: 0,
        dependencies: [],
        vectorSourceMode: "",
        vectorStoreIds: [],
        webAllowlist: "",
        webBlocklist: "",
        webMinSources: 0,
        webRecencyDays: 0,
        webCitationStyle: "",
        noNewFacts: false,
        prompt: "",
      }));
      await loadObjectives();
    } catch (err: any) {
      window.alert(err.message || "Unable to add section");
    }
  }

  async function handleUpdateSection(sectionId: string) {
    if (!selectedObjectiveId) return;
    const edit = sectionEdits[sectionId];
    if (!edit) return;
    try {
      const payload = {
        title: edit.title,
        order: edit.order,
        purpose: edit.purpose,
        outputFormat: edit.outputFormat,
        evidencePolicy: edit.evidencePolicy,
        targetLengthMin: edit.targetLengthMin,
        targetLengthMax: edit.targetLengthMax,
        dependencies: edit.dependencies,
        vectorPolicyJson:
          edit.vectorSourceMode === "override"
            ? { connectorIds: edit.vectorStoreIds }
            : null,
        webPolicyJson:
          edit.webAllowlist.length ||
          edit.webBlocklist.length ||
          edit.webMinSources ||
          edit.webRecencyDays ||
          edit.webCitationStyle
            ? {
                allowlist: edit.webAllowlist,
                blocklist: edit.webBlocklist,
                minSources: edit.webMinSources,
                recencyDays: edit.webRecencyDays,
                citationStyle: edit.webCitationStyle,
              }
            : null,
        qualityGatesJson: edit.noNewFacts ? { noNewFacts: true } : null,
        prompt: edit.prompt,
      };
      await fetchJson(
        `/api/templates/${selectedObjectiveId}/sections/${sectionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      await loadObjectives();
    } catch (err: any) {
      window.alert(err.message || "Unable to update section");
    }
  }

  async function handleSaveObjective() {
    if (!selectedObjectiveId || !objectiveEdit) return;
    try {
      const payload = {
        name: objectiveEdit.name.trim(),
        audience: objectiveEdit.audience.trim(),
        tone: objectiveEdit.tone.trim(),
        domain: objectiveEdit.domain.trim(),
        jurisdiction: objectiveEdit.jurisdiction.trim(),
        description: objectiveEdit.description.trim(),
        defaultVectorStoreIds: objectiveEdit.defaultVectorStoreIds,
        activePromptSetId: objectiveEdit.activePromptSetId,
        formats: parseList(objectiveEdit.formats),
      };
      await fetchJson(`/api/templates/${selectedObjectiveId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadObjectives();
    } catch (err: any) {
      window.alert(err.message || "Unable to save template defaults.");
    }
  }

  async function handleDiffObjectiveHistory() {
    if (!selectedObjectiveId) return;
    const fromVersion = Number(objectiveHistory.from);
    const toVersion = Number(objectiveHistory.to);
    if (!fromVersion || !toVersion) {
      window.alert("Enter from/to versions.");
      return;
    }
    try {
      const data = await fetchJson(
        `/api/templates/${selectedObjectiveId}/diff?from=${fromVersion}&to=${toVersion}`
      );
      setObjectiveHistory((prev) => ({
        ...prev,
        output: JSON.stringify(data.diffs, null, 2),
      }));
    } catch (err: any) {
      window.alert(err.message || "Unable to diff template history.");
    }
  }

  async function handleRunValidation() {
    if (!selectedObjectiveId) return;
    try {
      const data = await fetchJson(`/api/templates/${selectedObjectiveId}/validate`, {
        method: "POST",
      });
      setValidation(data);
    } catch (err: any) {
      window.alert(err.message || "Unable to validate template");
    }
  }

  async function handlePublishObjective() {
    if (!selectedObjectiveId) return;
    if (!window.confirm("Publish this template?")) {
      return;
    }
    try {
      const payload = await fetchJson(`/api/templates/${selectedObjectiveId}/publish`, {
        method: "POST",
      });
      setPublishMessage(payload.message || "");
      await loadObjectives();
      setValidation(null);
    } catch (err: any) {
      setPublishMessage("");
      setValidation({ error: err.message });
    }
  }

  function toggleArtifact(sectionRunId: string) {
    setExpandedArtifacts((prev) => ({
      ...prev,
      [sectionRunId]: !prev[sectionRunId],
    }));
  }

  function renderValidation() {
    if (!validation && !publishMessage) return null;
    if (publishMessage) {
      return (
        <div className="success" aria-live="polite">
          {publishMessage}
        </div>
      );
    }
    if (!validation) return null;
    if (validation.valid && (!validation.cycles || validation.cycles.length === 0)) {
      return (
        <div className="success" aria-live="polite">
          Validation passed (no P0 issues).
        </div>
      );
    }
    return (
      <>
        <div className="issues" role="alert">
          <strong>Validation failed:</strong>
          <ul>
            {(validation.issues || []).map((issue: any, index: number) => (
              <li key={`${issue.message}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
        {validation.cycles && validation.cycles.length > 0 ? (
          <div className="issues" role="alert">
            <strong>Dependency cycles detected:</strong>
            <ul>
              {validation.cycles.map((cycle: string[], index: number) => (
                <li key={`${cycle.join(" -> ")}-${index}`}>
                  {cycle.join(" -> ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    );
  }

  const runPromptSetOptions = useMemo(() => {
    const template = objectives.find((item) => item.id === runForm.templateId);
    return promptSets.filter((set) => set.templateId === template?.id);
  }, [promptSets, runForm.templateId, objectives]);

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Objective Studio</h1>
          <p className="page-description">Evidence-aware report objectives with validation</p>
        </div>
      </div>
      <main>
        <div className="content" style={{ marginLeft: 0, maxWidth: '100%' }}>
        <section id="objectives">
          <h2>Objectives</h2>
          <form onSubmit={handleCreateObjective}>
            <div className="form-group">
            <label htmlFor="template-name">Name</label>
            <input
              id="template-name"
              name="name"
              required
              value={objectiveForm.name}
              onChange={(event) =>
                setObjectiveForm((prev) => ({ ...prev, name: event.target.value }))
              }
              aria-describedby={
                objectiveErrors.name ? "template-name-error" : undefined
              }
              aria-invalid={Boolean(objectiveErrors.name)}
            />
            {objectiveErrors.name && (
              <div className="muted" id="template-name-error" role="alert">
                {objectiveErrors.name}
              </div>
            )}
            </div>
            <div className="form-group">
            <label htmlFor="template-description">Description</label>
            <textarea
              id="template-description"
              name="description"
              value={objectiveForm.description}
              onChange={(event) =>
                setObjectiveForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
            </div>
            <div className="inline">
              <div className="form-group">
                <label htmlFor="template-audience">Audience</label>
                <input
                  id="template-audience"
                  name="audience"
                  value={objectiveForm.audience}
                  onChange={(event) =>
                    setObjectiveForm((prev) => ({
                      ...prev,
                      audience: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="template-tone">Tone</label>
                <input
                  id="template-tone"
                  name="tone"
                  value={objectiveForm.tone}
                  onChange={(event) =>
                    setObjectiveForm((prev) => ({
                      ...prev,
                      tone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="inline">
              <div className="form-group">
                <label htmlFor="template-domain">Domain</label>
                <input
                  id="template-domain"
                  name="domain"
                  value={objectiveForm.domain}
                  onChange={(event) =>
                    setObjectiveForm((prev) => ({
                      ...prev,
                      domain: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="template-jurisdiction">Jurisdiction</label>
                <input
                  id="template-jurisdiction"
                  name="jurisdiction"
                  value={objectiveForm.jurisdiction}
                  onChange={(event) =>
                    setObjectiveForm((prev) => ({
                      ...prev,
                      jurisdiction: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="form-group">
            <label htmlFor="template-formats">Formats (comma separated)</label>
            <input
              id="template-formats"
              name="formats"
              placeholder="markdown, docx"
              value={objectiveForm.formats}
              onChange={(event) =>
                setObjectiveForm((prev) => ({
                  ...prev,
                  formats: event.target.value,
                }))
              }
            />
            </div>
            <button type="submit">Create objective</button>
          </form>
          <h2 className="mt-4">Objectives</h2>
          <div className="template-list">
            {objectives.map((template) => (
              <div
                key={template.id}
                className={
                  "template-item" +
                  (template.id === selectedObjectiveId ? " active" : "")
                }
                onClick={() => {
                  setSelectedObjectiveId(template.id);
                  setValidation(null);
                  setPublishMessage("");
                }}
              >
                <div className="flex space-between items-center">
                  <div className="flex-1">
                    <strong>{template.name}</strong>
                    <div className="muted">
                      {template.description || "No description"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteObjective(template.id, template.name);
                    }}
                    aria-label={`Delete objective ${template.name}`}
                    title="Delete objective"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          <h2 className="mt-4" id="sources">
            Sources
          </h2>
          <form onSubmit={handleCreateConnector}>
            <label htmlFor="connector-name">Name</label>
            <input
              id="connector-name"
              name="name"
              required
              value={connectorForm.name}
              onChange={(event) =>
                setConnectorForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <label>Type (select one or both)</label>
            <div className="checkbox-group-inline" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '0.75rem 0' }}>
              <label className="checkbox-label-inline" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                  checked={connectorForm.type === "VECTOR" || connectorForm.type === "BOTH"}
                  onChange={(event) => {
                    const otherChecked = connectorForm.type === "WEB_SEARCH" || connectorForm.type === "BOTH";
                    
                    if (event.target.checked && otherChecked) {
                      setConnectorForm((prev) => ({ ...prev, type: "BOTH" }));
                    } else if (event.target.checked) {
                      setConnectorForm((prev) => ({ ...prev, type: "VECTOR" }));
                    } else if (otherChecked) {
                      setConnectorForm((prev) => ({ ...prev, type: "WEB_SEARCH" }));
                    } else {
                      setConnectorForm((prev) => ({ ...prev, type: "VECTOR" }));
                    }
                  }}
                />
                <span style={{ fontWeight: 500 }}>VECTOR</span>
              </label>
              <label className="checkbox-label-inline" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                  checked={connectorForm.type === "WEB_SEARCH" || connectorForm.type === "BOTH"}
                  onChange={(event) => {
                    const otherChecked = connectorForm.type === "VECTOR" || connectorForm.type === "BOTH";
                    
                    if (event.target.checked && otherChecked) {
                      setConnectorForm((prev) => ({ ...prev, type: "BOTH" }));
                    } else if (event.target.checked) {
                      setConnectorForm((prev) => ({ ...prev, type: "WEB_SEARCH" }));
                    } else if (otherChecked) {
                      setConnectorForm((prev) => ({ ...prev, type: "VECTOR" }));
                    } else {
                      setConnectorForm((prev) => ({ ...prev, type: "WEB_SEARCH" }));
                    }
                  }}
                />
                <span style={{ fontWeight: 500 }}>WEB_SEARCH</span>
              </label>
            </div>
            
            {(connectorForm.type === "VECTOR" || connectorForm.type === "BOTH") && (
              <>
                <label>Select Vector Stores (up to 2)</label>
                {loadingVectorStores ? (
                  <div className="muted">Loading vector stores...</div>
                ) : availableVectorStores.length === 0 ? (
                  <div className="muted">
                    No vector stores available. Click "Sync OpenAI Vector Stores" below to load them.
                  </div>
                ) : (
                  <>
                    {/* Search input for vector stores */}
                    <input
                      type="text"
                      placeholder="🔍 Search vector stores by name..."
                      value={vectorStoreSearch}
                      onChange={(e) => setVectorStoreSearch(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '0.375rem',
                        background: 'var(--color-bg-input)',
                        color: 'var(--color-text-primary)',
                        marginBottom: '0.5rem',
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0' }}>
                    {availableVectorStores
                      .filter((store) => {
                        // Filter by search term
                        if (!vectorStoreSearch) return true;
                        return store.name.toLowerCase().includes(vectorStoreSearch.toLowerCase()) ||
                               store.id.toLowerCase().includes(vectorStoreSearch.toLowerCase());
                      })
                      .map((store) => {
                      const isSelected = connectorForm.selectedVectorStores.some((s) => s.id === store.id);
                      const isExpanded = expandedVectorStore === store.id;
                      const files = vectorStoreFiles[store.id] || [];
                      const isLoadingFiles = loadingFiles[store.id] || false;
                      const selectedFileIds = selectedFiles[store.id] || [];
                      
                      return (
                        <div
                          key={store.id}
                          style={{
                            border: isSelected ? '2px solid #6366f1' : '1px solid rgba(99, 102, 241, 0.15)',
                            borderRadius: '0.5rem',
                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Main vector store row */}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleVectorStoreSelection(store)}
                              style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span 
                              style={{ fontWeight: 600, fontSize: '0.9375rem', flex: 1, cursor: 'pointer' }}
                              onClick={() => toggleVectorStoreSelection(store)}
                            >
                              {store.name} - <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', opacity: 0.7 }}>{store.id}</span>
                            </span>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => toggleSpecificFiles(store.id)}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.8125rem',
                                  background: isExpanded ? '#6366f1' : 'transparent',
                                  color: isExpanded ? '#fff' : '#6366f1',
                                  border: '1px solid #6366f1',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide Files' : 'Select Specific Files'}
                              </button>
                            )}
                          </div>
                          
                          {/* Expanded file list */}
                          {isSelected && isExpanded && (
                            <div
                              style={{
                                borderTop: '1px solid rgba(99, 102, 241, 0.2)',
                                padding: '0.75rem',
                                background: 'rgba(0, 0, 0, 0.2)',
                              }}
                            >
                              {isLoadingFiles ? (
                                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Loading files...</div>
                              ) : files.length === 0 ? (
                                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>No files found in this vector store.</div>
                              ) : (
                                <>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.9 }}>
                                    Select Files ({selectedFileIds.length} selected):
                                  </div>
                                  
                                  {/* Search input for files */}
                                  <input
                                    type="text"
                                    placeholder="🔍 Search files by name..."
                                    value={fileSearch[store.id] || ""}
                                    onChange={(e) => setFileSearch((prev) => ({ ...prev, [store.id]: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem 0.75rem',
                                      fontSize: '0.8125rem',
                                      border: '1px solid rgba(99, 102, 241, 0.3)',
                                      borderRadius: '0.375rem',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      color: 'var(--color-text-primary)',
                                      marginBottom: '0.5rem',
                                    }}
                                  />
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '300px', overflowY: 'auto' }}>
                                    {files
                                      .filter((file) => {
                                        // Filter by search term
                                        const searchTerm = fileSearch[store.id];
                                        if (!searchTerm) return true;
                                        return file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                               file.id.toLowerCase().includes(searchTerm.toLowerCase());
                                      })
                                      .map((file) => {
                                      const isFileSelected = selectedFileIds.includes(file.id);
                                      return (
                                        <label
                                          key={file.id}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem',
                                            background: isFileSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: '0.375rem',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            transition: 'background 0.2s ease',
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isFileSelected) {
                                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isFileSelected) {
                                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                            }
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isFileSelected}
                                            onChange={() => toggleFileSelection(store.id, file.id)}
                                            style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                                          />
                                          <span style={{ flex: 1 }}>{file.filename}</span>
                                          <span style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                                            {(file.bytes / 1024).toFixed(1)} KB
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  
                                  {files.filter((file) => {
                                    const searchTerm = fileSearch[store.id];
                                    if (!searchTerm) return false;
                                    return file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                           file.id.toLowerCase().includes(searchTerm.toLowerCase());
                                  }).length === 0 && fileSearch[store.id] && (
                                    <div style={{ fontSize: '0.8125rem', opacity: 0.6, marginTop: '0.5rem', textAlign: 'center' }}>
                                      No files match your search
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </>
                )}
                {connectorForm.selectedVectorStores.length > 0 && (
                  <div className="muted" style={{ marginTop: 8 }}>
                    Selected ({connectorForm.selectedVectorStores.length}/2): {connectorForm.selectedVectorStores.map((s) => s.name).join(", ")}
                  </div>
                )}
              </>
            )}
            
            <label htmlFor="connector-description">Description</label>
            <textarea
              id="connector-description"
              name="description"
              value={connectorForm.description}
              onChange={(event) =>
                setConnectorForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
            <label htmlFor="connector-tags">Tags (comma separated)</label>
            <input
              id="connector-tags"
              name="tags"
              value={connectorForm.tags}
              onChange={(event) =>
                setConnectorForm((prev) => ({ ...prev, tags: event.target.value }))
              }
            />
            <button type="submit">Create source</button>
          </form>
          <div className="flex mt-3">
            <button onClick={handleSyncOpenAIStores} type="button" className="secondary">
              Sync OpenAI Vector Stores
            </button>
          </div>
          <h3 className="mt-4">Web Search Config</h3>
          <form onSubmit={handleSaveWebConfig}>
            <label htmlFor="web-connector">Source</label>
            <select
              id="web-connector"
              name="connectorId"
              value={webConfigForm.connectorId}
              onChange={(event) =>
                setWebConfigForm((prev) => ({
                  ...prev,
                  connectorId: event.target.value,
                }))
              }
            >
              {connectors
                .filter((connector) => connector.type === "WEB_SEARCH")
                .map((connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.name}
                  </option>
                ))}
            </select>
            <label htmlFor="web-provider">Provider</label>
            <select
              id="web-provider"
              name="provider"
              value={webConfigForm.provider}
              onChange={(event) =>
                setWebConfigForm((prev) => ({
                  ...prev,
                  provider: event.target.value,
                }))
              }
            >
              <option value="mock">mock</option>
              <option value="tavily">tavily</option>
              <option value="serpapi">serpapi</option>
              <option value="custom">custom</option>
            </select>
            <label htmlFor="web-api-env">API Key Env Var</label>
            <input
              id="web-api-env"
              name="apiKeyEnv"
              placeholder="TAVILY_API_KEY"
              value={webConfigForm.apiKeyEnv}
              onChange={(event) =>
                setWebConfigForm((prev) => ({
                  ...prev,
                  apiKeyEnv: event.target.value,
                }))
              }
            />
            <label htmlFor="web-api-url">Custom API URL (optional)</label>
            <input
              id="web-api-url"
              name="apiUrl"
              placeholder="https://api.example.com/search"
              value={webConfigForm.apiUrl}
              onChange={(event) =>
                setWebConfigForm((prev) => ({
                  ...prev,
                  apiUrl: event.target.value,
                }))
              }
            />
            <button type="submit">Save Web Config</button>
          </form>
          <form onSubmit={handleTestWebSearch} className="mt-3">
            <label htmlFor="web-query">Test Query</label>
            <input
              id="web-query"
              name="query"
              value={webSearch.query}
              onChange={(event) =>
                setWebSearch((prev) => ({ ...prev, query: event.target.value }))
              }
            />
            <button type="submit" className="secondary">
              Test Search
            </button>
            <pre>{webSearch.output}</pre>
          </form>
          <div className="template-list">
            {connectors.map((connector) => (
              <div key={connector.id} className="template-item">
                <strong>{connector.name}</strong>{" "}
                <span className="badge">{connector.type}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card" id="editor">
          {!selectedObjective ? (
            <div>
              <h2>Objective Editor</h2>
              <p>Select a template to edit sections, validate, and publish.</p>
            </div>
          ) : (
            <div>
              <div className="flex" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2>{selectedObjective.name}</h2>
                  <p style={{ margin: "4px 0" }}>{selectedObjective.description || ""}</p>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Formats: {(selectedObjective.formats || []).join(", ") || "n/a"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Audience: {selectedObjective.audience || "n/a"} · Tone:{" "}
                    {selectedObjective.tone || "n/a"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Domain: {selectedObjective.domain || "n/a"} · Jurisdiction:{" "}
                    {selectedObjective.jurisdiction || "n/a"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Default Vector Stores:{" "}
                    {(selectedObjective.defaultVectorStoreIds || []).join(", ") ||
                      "n/a"}
                  </div>
                </div>
                <div className="flex">
                  <button
                    className="secondary"
                    type="button"
                    onClick={handleRunValidation}
                  >
                    Validate
                  </button>
                  <button type="button" onClick={handlePublishObjective}>
                    Publish
                  </button>
                </div>
              </div>
              <h3 style={{ marginTop: 16 }}>Objective Details</h3>
              {!objectiveEdit ? null : (
                <>
                  <div className="inline">
                    <div>
                      <label>Name</label>
                      <input
                        value={objectiveEdit.name}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? { ...prev, name: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div>
                      <label>Audience</label>
                      <input
                        value={objectiveEdit.audience}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? { ...prev, audience: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="inline">
                    <div>
                      <label>Tone</label>
                      <input
                        value={objectiveEdit.tone}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev ? { ...prev, tone: event.target.value } : prev
                          )
                        }
                      />
                    </div>
                    <div>
                      <label>Domain</label>
                      <input
                        value={objectiveEdit.domain}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? { ...prev, domain: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="inline">
                    <div>
                      <label>Jurisdiction</label>
                      <input
                        value={objectiveEdit.jurisdiction}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? { ...prev, jurisdiction: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div>
                      <label>Description</label>
                      <textarea
                        value={objectiveEdit.description}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? { ...prev, description: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>
                  <label>Formats (comma separated)</label>
                  <input
                    value={objectiveEdit.formats}
                    onChange={(event) =>
                      setObjectiveEdit((prev) =>
                        prev ? { ...prev, formats: event.target.value } : prev
                      )
                    }
                  />
                  <div className="inline" style={{ marginTop: 8 }}>
                    <div>
                      <label>Active Prompt Set</label>
                      <select
                        value={objectiveEdit.activePromptSetId || ""}
                        onChange={(event) =>
                          setObjectiveEdit((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  activePromptSetId: event.target.value || null,
                                }
                              : prev
                          )
                        }
                      >
                        <option value="">Latest published</option>
                        {promptSets
                          .filter((set) => set.templateId === selectedObjective.id)
                          .map((set) => (
                            <option key={set.id} value={set.id}>
                              {set.name} ({set.state})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <h3 style={{ marginTop: 16 }}>Default Vector Store Mapping</h3>
                  <div className="inline">
                    {connectors
                      .filter((connector) => connector.type === "VECTOR")
                      .map((connector) => (
                        <label key={connector.id} className="flex">
                          <input
                            type="checkbox"
                            checked={objectiveEdit.defaultVectorStoreIds.includes(
                              connector.id
                            )}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setObjectiveEdit((prev) => {
                                if (!prev) return prev;
                                const next = new Set(prev.defaultVectorStoreIds);
                                if (checked) {
                                  next.add(connector.id);
                                } else {
                                  next.delete(connector.id);
                                }
                                return {
                                  ...prev,
                                  defaultVectorStoreIds: Array.from(next),
                                };
                              });
                            }}
                          />
                          <span>{connector.name}</span>
                        </label>
                      ))}
                  </div>
                  <div className="flex" style={{ justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={handleSaveObjective}>
                      Save Objective
                    </button>
                  </div>
                </>
              )}
              <h3 style={{ marginTop: 16 }}>Objective History</h3>
              <div className="inline">
                <input
                  id="template-history-from"
                  type="number"
                  min="1"
                  placeholder="from version"
                  value={objectiveHistory.from}
                  onChange={(event) =>
                    setObjectiveHistory((prev) => ({
                      ...prev,
                      from: event.target.value,
                    }))
                  }
                />
                <input
                  id="template-history-to"
                  type="number"
                  min="1"
                  placeholder="to version"
                  value={objectiveHistory.to}
                  onChange={(event) =>
                    setObjectiveHistory((prev) => ({
                      ...prev,
                      to: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={handleDiffObjectiveHistory}
                >
                  Diff
                </button>
              </div>
              <pre>{objectiveHistory.output}</pre>
              {renderValidation()}
              <div className="sections-header">
                <h3>Sections</h3>
                <a className="secondary add-section-button" href="#add-section">
                  + Add Section
                </a>
              </div>
              <div className="sections-list">
                {(selectedObjective.sections || []).map((section) => {
                  const edit = sectionEdits[section.id];
                  if (!edit) return null;
                  const dependencies = selectedObjective.sections?.filter(
                    (candidate) => candidate.id !== section.id
                  );
                  return (
                    <div key={section.id} className="section-row">
                      <div className="inline">
                        <div>
                          <label>Title</label>
                          <input
                            value={edit.title}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: { ...edit, title: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label>Order</label>
                          <input
                            type="number"
                            min="1"
                            value={edit.order}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  order: Number(event.target.value) || 1,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <label>Purpose</label>
                      <textarea
                        value={edit.purpose}
                        onChange={(event) =>
                          setSectionEdits((prev) => ({
                            ...prev,
                            [section.id]: { ...edit, purpose: event.target.value },
                          }))
                        }
                      />
                      <div className="inline">
                        <div>
                          <label>Output Format</label>
                          <select
                            value={edit.outputFormat}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  outputFormat: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Style</option>
                            {OUTPUT_FORMATS.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label>Evidence Policy</label>
                          <select
                            value={edit.evidencePolicy}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  evidencePolicy: event.target.value,
                                },
                              }))
                            }
                          >
                            {EVIDENCE_POLICIES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label>Sources</label>
                          <select
                            value={edit.vectorSourceMode}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  vectorSourceMode: event.target.value as SectionEdit["vectorSourceMode"],
                                },
                              }))
                            }
                          >
                            <option value="">Sources</option>
                            <option value="inherit">Inherit objective sources</option>
                            <option value="override">Override sources</option>
                          </select>
                        </div>
                      </div>
                      <div className="inline">
                        <div>
                          <label>Target Length Min (words)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Min words"
                            value={edit.targetLengthMin || ""}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  targetLengthMin: Number(event.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label>Target Length Max (words)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Max words"
                            value={edit.targetLengthMax || ""}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  targetLengthMax: Number(event.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <label>Dependencies</label>
                      <div className="inline">
                        {dependencies?.map((candidate) => (
                          <label key={candidate.id} className="flex">
                            <input
                              type="checkbox"
                              checked={edit.dependencies.includes(candidate.id)}
                              onChange={(event) => {
                                const next = new Set(edit.dependencies);
                                if (event.target.checked) {
                                  next.add(candidate.id);
                                } else {
                                  next.delete(candidate.id);
                                }
                                setSectionEdits((prev) => ({
                                  ...prev,
                                  [section.id]: {
                                    ...edit,
                                    dependencies: Array.from(next),
                                  },
                                }));
                              }}
                            />
                            <span>{candidate.title}</span>
                          </label>
                        ))}
                      </div>
                      {edit.vectorSourceMode !== "override" ? (
                        <div className="muted">
                          Using objective sources:{" "}
                          {(objectiveEdit?.defaultVectorStoreIds || [])
                            .map(
                              (id) =>
                                connectors.find(
                                  (connector) =>
                                    connector.type === "VECTOR" && connector.id === id
                                )?.name || id
                            )
                            .join(", ") || "None selected"}
                        </div>
                      ) : (
                        <>
                          <label>Vector Store Attachments</label>
                          <div className="inline">
                            {connectors
                              .filter((connector) => connector.type === "VECTOR")
                              .map((connector) => (
                                <label key={connector.id} className="flex">
                                  <input
                                    type="checkbox"
                                    checked={edit.vectorStoreIds.includes(connector.id)}
                                    onChange={(event) => {
                                      const next = new Set(edit.vectorStoreIds);
                                      if (event.target.checked) {
                                        next.add(connector.id);
                                      } else {
                                        next.delete(connector.id);
                                      }
                                      setSectionEdits((prev) => ({
                                        ...prev,
                                        [section.id]: {
                                          ...edit,
                                          vectorStoreIds: Array.from(next),
                                        },
                                      }));
                                    }}
                                  />
                                  <span>{connector.name}</span>
                                </label>
                              ))}
                          </div>
                        </>
                      )}
                      <div className="inline">
                        <div>
                          <label>Web Allowlist (comma separated)</label>
                          <input
                            value={edit.webAllowlist.join(", ")}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  webAllowlist: parseList(event.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label>Web Min Sources</label>
                          <input
                            type="number"
                            min="0"
                            value={edit.webMinSources}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  webMinSources: Number(event.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="inline">
                        <div>
                          <label>Web Blocklist (comma separated)</label>
                          <input
                            value={edit.webBlocklist.join(", ")}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  webBlocklist: parseList(event.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label>Web Recency (days)</label>
                          <input
                            type="number"
                            min="0"
                            value={edit.webRecencyDays}
                            onChange={(event) =>
                              setSectionEdits((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...edit,
                                  webRecencyDays: Number(event.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <label>Citation Style</label>
                      <input
                        value={edit.webCitationStyle}
                        onChange={(event) =>
                          setSectionEdits((prev) => ({
                            ...prev,
                            [section.id]: {
                              ...edit,
                              webCitationStyle: event.target.value,
                            },
                          }))
                        }
                      />
                      <div className="flex">
                        <input
                          type="checkbox"
                          checked={edit.noNewFacts}
                          onChange={(event) =>
                            setSectionEdits((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...edit,
                                noNewFacts: event.target.checked,
                              },
                            }))
                          }
                        />
                        <label>No new facts (quality gate)</label>
                      </div>
                      <label>Prompt</label>
                      <textarea
                        value={edit.prompt}
                        onChange={(event) =>
                          setSectionEdits((prev) => ({
                            ...prev,
                            [section.id]: { ...edit, prompt: event.target.value },
                          }))
                        }
                      />
                      <div className="flex" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateSection(section.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form id="add-section" onSubmit={handleAddSection}>
                <div className="inline">
                  <div>
                    <label htmlFor="section-title">Title</label>
                    <input
                      id="section-title"
                      name="title"
                      required
                      value={newSection.title}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="section-order">Order</label>
                    <input
                      id="section-order"
                      name="order"
                      type="number"
                      min="1"
                      value={newSection.order}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          order: Number(event.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>
                <label htmlFor="section-purpose">Purpose</label>
                <textarea
                  id="section-purpose"
                  name="purpose"
                  value={newSection.purpose}
                  onChange={(event) =>
                    setNewSection((prev) => ({
                      ...prev,
                      purpose: event.target.value,
                    }))
                  }
                />
                <div className="inline">
                  <div>
                    <label htmlFor="section-output-format">Output Format</label>
                    <select
                      id="section-output-format"
                      name="outputFormat"
                      value={newSection.outputFormat}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          outputFormat: event.target.value,
                        }))
                      }
                    >
                      <option value="">Style</option>
                      {OUTPUT_FORMATS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="section-evidence">Evidence Policy</label>
                    <select
                      id="section-evidence"
                      name="evidencePolicy"
                      value={newSection.evidencePolicy}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          evidencePolicy: event.target.value,
                        }))
                      }
                    >
                      {EVIDENCE_POLICIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="section-sources-mode">Sources</label>
                    <select
                      id="section-sources-mode"
                      name="vectorSourceMode"
                      value={newSection.vectorSourceMode}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          vectorSourceMode: event.target.value as NewSection["vectorSourceMode"],
                        }))
                      }
                    >
                      <option value="">Sources</option>
                      <option value="inherit">Inherit objective sources</option>
                      <option value="override">Override sources</option>
                    </select>
                  </div>
                </div>
                <div className="inline">
                  <div>
                    <label htmlFor="section-length-min">
                      Target Length Min (words)
                    </label>
                    <input
                      id="section-length-min"
                      name="targetLengthMin"
                      type="number"
                      min="0"
                      placeholder="Min words"
                      value={newSection.targetLengthMin || ""}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          targetLengthMin: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="section-length-max">
                      Target Length Max (words)
                    </label>
                    <input
                      id="section-length-max"
                      name="targetLengthMax"
                      type="number"
                      min="0"
                      placeholder="Max words"
                      value={newSection.targetLengthMax || ""}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          targetLengthMax: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <label>Dependencies</label>
                <div className="inline">
                  {(selectedObjective.sections || []).map((section) => (
                    <label key={section.id} className="flex">
                      <input
                        type="checkbox"
                        checked={newSection.dependencies.includes(section.id)}
                        onChange={(event) => {
                          const next = new Set(newSection.dependencies);
                          if (event.target.checked) {
                            next.add(section.id);
                          } else {
                            next.delete(section.id);
                          }
                          setNewSection((prev) => ({
                            ...prev,
                            dependencies: Array.from(next),
                          }));
                        }}
                      />
                      <span>{section.title}</span>
                    </label>
                  ))}
                </div>
                {newSection.vectorSourceMode !== "override" ? (
                  <div className="muted">
                    Using objective sources:{" "}
                    {(objectiveEdit?.defaultVectorStoreIds || [])
                      .map(
                        (id) =>
                          connectors.find(
                            (connector) => connector.type === "VECTOR" && connector.id === id
                          )?.name || id
                      )
                      .join(", ") || "None selected"}
                  </div>
                ) : (
                  <>
                    <label>Vector Store Attachments</label>
                    <div className="inline">
                      {connectors
                        .filter((connector) => connector.type === "VECTOR")
                        .map((connector) => (
                          <label key={connector.id} className="flex">
                            <input
                              type="checkbox"
                              checked={newSection.vectorStoreIds.includes(connector.id)}
                              onChange={(event) => {
                                const next = new Set(newSection.vectorStoreIds);
                                if (event.target.checked) {
                                  next.add(connector.id);
                                } else {
                                  next.delete(connector.id);
                                }
                                setNewSection((prev) => ({
                                  ...prev,
                                  vectorStoreIds: Array.from(next),
                                }));
                              }}
                            />
                            <span>{connector.name}</span>
                          </label>
                        ))}
                    </div>
                  </>
                )}
                <div className="inline">
                  <div>
                    <label htmlFor="section-web-allowlist">
                      Web Allowlist (comma separated)
                    </label>
                    <input
                      id="section-web-allowlist"
                      name="webAllowlist"
                      value={newSection.webAllowlist}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          webAllowlist: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="section-web-min">Web Min Sources</label>
                    <input
                      id="section-web-min"
                      name="webMinSources"
                      type="number"
                      min="0"
                      value={newSection.webMinSources}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          webMinSources: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="inline">
                  <div>
                    <label htmlFor="section-web-blocklist">
                      Web Blocklist (comma separated)
                    </label>
                    <input
                      id="section-web-blocklist"
                      name="webBlocklist"
                      value={newSection.webBlocklist}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          webBlocklist: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="section-web-recency">Web Recency (days)</label>
                    <input
                      id="section-web-recency"
                      name="webRecencyDays"
                      type="number"
                      min="0"
                      value={newSection.webRecencyDays}
                      onChange={(event) =>
                        setNewSection((prev) => ({
                          ...prev,
                          webRecencyDays: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <label htmlFor="section-web-citation">Citation Style</label>
                <input
                  id="section-web-citation"
                  name="webCitationStyle"
                  placeholder="inline footnotes/endnotes"
                  value={newSection.webCitationStyle}
                  onChange={(event) =>
                    setNewSection((prev) => ({
                      ...prev,
                      webCitationStyle: event.target.value,
                    }))
                  }
                />
                <div className="flex">
                  <input
                    id="section-no-new-facts"
                    name="noNewFacts"
                    type="checkbox"
                    checked={newSection.noNewFacts}
                    onChange={(event) =>
                      setNewSection((prev) => ({
                        ...prev,
                        noNewFacts: event.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="section-no-new-facts">
                    No new facts (quality gate)
                  </label>
                </div>
                <label htmlFor="section-prompt">Prompt</label>
                <textarea
                  id="section-prompt"
                  name="prompt"
                  value={newSection.prompt}
                  onChange={(event) =>
                    setNewSection((prev) => ({
                      ...prev,
                      prompt: event.target.value,
                    }))
                  }
                />
                <button type="submit">Add section</button>
              </form>
            </div>
          )}
        </section>
        <section className="card" id="prompts">
          <h2>Prompt Studio</h2>
          <ObjectiveStudioAnchors className="flex" linkClassName="badge" />
          <form onSubmit={handleCreatePromptSet}>
            <label htmlFor="prompt-set-name">Prompt Set Name</label>
            <input
              id="prompt-set-name"
              name="name"
              required
              value={promptForm.name}
              onChange={(event) =>
                setPromptForm((prev) => ({ ...prev, name: event.target.value }))
              }
              aria-describedby={
                promptErrors.name ? "prompt-set-name-error" : undefined
              }
              aria-invalid={Boolean(promptErrors.name)}
            />
            {promptErrors.name && (
              <div className="muted" id="prompt-set-name-error" role="alert">
                {promptErrors.name}
              </div>
            )}
            <label htmlFor="prompt-set-template">Objective</label>
            <select
              id="prompt-set-template"
              name="templateId"
              value={promptForm.templateId}
              onChange={(event) =>
                setPromptForm((prev) => ({
                  ...prev,
                  templateId: event.target.value,
                }))
              }
            >
              {objectives.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button type="submit">Create prompt set</button>
          </form>
          <div className="template-list">
            {promptSets.map((set) => (
              <div
                key={set.id}
                className="template-item"
                onClick={() => setSelectedPromptSetId(set.id)}
              >
                <strong>{set.name}</strong>{" "}
                <span className="badge">{set.state}</span>
                <br />
                <small>v{set.version}</small>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            {!selectedPromptSet ? (
              <p>Select a prompt set to edit.</p>
            ) : (
              <>
                <h3>{selectedPromptSet.name}</h3>
                <label>Global System Prompt</label>
                <textarea
                  value={promptEditor.globalSystem}
                  onChange={(event) =>
                    setPromptEditor((prev) => ({
                      ...prev,
                      globalSystem: event.target.value,
                    }))
                  }
                />
                <label>Global Developer Prompt</label>
                <textarea
                  value={promptEditor.globalDeveloper}
                  onChange={(event) =>
                    setPromptEditor((prev) => ({
                      ...prev,
                      globalDeveloper: event.target.value,
                    }))
                  }
                />
                <label>Sections JSON</label>
                <textarea
                  style={{ minHeight: 200 }}
                  value={promptEditor.sectionsJson}
                  onChange={(event) =>
                    setPromptEditor((prev) => ({
                      ...prev,
                      sectionsJson: event.target.value,
                    }))
                  }
                  aria-describedby={
                    promptErrors.sectionsJson ? "prompt-editor-sections-error" : undefined
                  }
                  aria-invalid={Boolean(promptErrors.sectionsJson)}
                />
                {promptErrors.sectionsJson && (
                  <div className="muted" id="prompt-editor-sections-error" role="alert">
                    {promptErrors.sectionsJson}
                  </div>
                )}
                <div className="flex" style={{ justifyContent: "flex-end" }}>
                  <button type="button" onClick={handleSavePromptSet}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handlePublishPromptSet}
                  >
                    Publish
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label>Rollback to version</label>
                  <input
                    type="number"
                    min="1"
                    value={promptEditor.rollbackVersion}
                    onChange={(event) =>
                      setPromptEditor((prev) => ({
                        ...prev,
                        rollbackVersion: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleRollbackPromptSet}
                  >
                    Rollback
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label>Diff (from - to)</label>
                  <div className="inline">
                    <input
                      type="number"
                      min="1"
                      value={promptEditor.diffFrom}
                      onChange={(event) =>
                        setPromptEditor((prev) => ({
                          ...prev,
                          diffFrom: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      value={promptEditor.diffTo}
                      onChange={(event) =>
                        setPromptEditor((prev) => ({
                          ...prev,
                          diffTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleDiffPromptSet}
                  >
                    Show Diff
                  </button>
                  <pre>{promptEditor.diffOutput}</pre>
                </div>
              </>
            )}
          </div>
        </section>
        <section className="card" id="runs">
          <h2>Report Runs</h2>
          <ObjectiveStudioAnchors className="flex" linkClassName="badge" />
          <form onSubmit={handleCreateRun}>
            <label htmlFor="run-template">Objective</label>
            <select
              id="run-template"
              name="templateId"
              value={runForm.templateId}
              onChange={(event) =>
                setRunForm((prev) => ({
                  ...prev,
                  templateId: event.target.value,
                }))
              }
              aria-describedby={
                runErrors.templateId ? "run-template-error" : undefined
              }
              aria-invalid={Boolean(runErrors.templateId)}
            >
              {objectives.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {runErrors.templateId && (
              <div className="muted" id="run-template-error" role="alert">
                {runErrors.templateId}
              </div>
            )}
            <label htmlFor="run-profile">Generation Profile</label>
            <select
              id="run-profile"
              name="profileId"
              value={runForm.profileId}
              onChange={(event) =>
                setRunForm((prev) => ({
                  ...prev,
                  profileId: event.target.value,
                }))
              }
            >
              <option value="">None</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <label htmlFor="run-prompt-set">Prompt Set</label>
            <select
              id="run-prompt-set"
              name="promptSetId"
              value={runForm.promptSetId}
              onChange={(event) =>
                setRunForm((prev) => ({
                  ...prev,
                  promptSetId: event.target.value,
                }))
              }
            >
              <option value="">
                {objectives.find((item) => item.id === runForm.templateId)
                  ?.activePromptSetId
                  ? "Use template default"
                  : "Latest published"}
              </option>
              {runPromptSetOptions.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} ({set.state})
                </option>
              ))}
            </select>
            <label htmlFor="run-input">Run Input JSON</label>
            <textarea
              id="run-input"
              name="inputJson"
              placeholder='{"vectorStoreOverrides":{"SECTION_ID":["VECTOR_ID"]}}'
              value={runForm.inputJson}
              onChange={(event) =>
                setRunForm((prev) => ({
                  ...prev,
                  inputJson: event.target.value,
                }))
              }
              aria-describedby={
                runErrors.inputJson ? "run-input-error" : undefined
              }
              aria-invalid={Boolean(runErrors.inputJson)}
            />
            {runErrors.inputJson && (
              <div className="muted" id="run-input-error" role="alert">
                {runErrors.inputJson}
              </div>
            )}
            <small style={{ color: "#475569", display: "block", marginTop: 6 }}>
              Tip: use vectorStoreOverrides to override section-level vector store mappings
              per run.
            </small>
            <button type="submit">Create Run</button>
          </form>
          <div className="template-list">
            {runs.map((run) => (
              <div
                key={run.id}
                className="template-item"
                onClick={() => setSelectedRunId(run.id)}
              >
                <strong>{run.id}</strong>{" "}
                <span className="badge">{run.status}</span>
                <br />
                <small>{run.createdAt || ""}</small>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            {!selectedRun ? (
              <p>Select a run to view details.</p>
            ) : (
              <>
                <h3>Run {selectedRun.id}</h3>
                <p>Status: {selectedRun.status}</p>
                <div className="flex">
                  <button type="button" onClick={() => handleStartRun(selectedRun.id)}>
                    Start Run
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleExportRun(selectedRun.id, "MARKDOWN")}
                  >
                    Export Markdown
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleExportRun(selectedRun.id, "DOCX")}
                  >
                    Export DOCX
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleExportRun(selectedRun.id, "PDF")}
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRerunRun(selectedRun.id)}
                  >
                    Delta Rerun
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  {runSections.length === 0 ? (
                    <p>No sections available.</p>
                  ) : (
                    <>
                      <h3>Section Runs</h3>
                      <ul>
                        {runSections.map((section) => (
                          <li key={section.id}>
                            <strong>{section.title}</strong> · {section.status} ·
                            artifacts={(section.artifacts || []).length}
                            <button
                              type="button"
                              onClick={() => handleRetrySection(section.id)}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => toggleArtifact(section.id)}
                            >
                              Artifacts
                            </button>
                            {expandedArtifacts[section.id] ? (
                              <div className="card" style={{ marginTop: 8 }}>
                                <h4>Evidence</h4>
                                <pre>
                                  {JSON.stringify(
                                    section.artifacts?.find(
                                      (item) => item.type === "EVIDENCE"
                                    )?.content || [],
                                    null,
                                    2
                                  )}
                                </pre>
                                <h4>Claim Provenance</h4>
                                <pre>
                                  {JSON.stringify(
                                    section.artifacts?.find(
                                      (item) => item.type === "PROVENANCE"
                                    )?.content || [],
                                    null,
                                    2
                                  )}
                                </pre>
                                <h4>Reviewer Feedback</h4>
                                <pre>
                                  {JSON.stringify(
                                    section.artifacts?.find(
                                      (item) => item.type === "REVIEW"
                                    )?.content || {},
                                    null,
                                    2
                                  )}
                                </pre>
                                <h4>Final Output</h4>
                                <pre>
                                  {JSON.stringify(
                                    section.artifacts?.find(
                                      (item) => item.type === "FINAL"
                                    )?.content || "",
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  {runExports.length === 0 ? (
                    <p>No exports generated yet.</p>
                  ) : (
                    <>
                      <h3>Exports</h3>
                      <ul>
                        {runExports.map((item) => (
                          <li key={item.id}>
                            {item.format} · {item.createdAt} ·{" "}
                            <a
                              href={`/api/report-runs/${item.runId}/exports/${item.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  {runScores.length === 0 ? (
                    <p>No scores available.</p>
                  ) : (
                    <>
                      <h3>Evidence Scores</h3>
                      <ul>
                        {runScores.map((score) => (
                          <li key={score.sectionRunId}>
                            {score.sectionRunId}: coverage={score.coverage}, diversity=
                            {score.diversity}, recency={score.recency}, redundancy=
                            {score.redundancy}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  {!runDashboard ? (
                    <p>No dashboard data available.</p>
                  ) : (
                    <>
                      <h3>Run Dashboard</h3>
                      <div className="inline">
                        <div className="card">
                          <strong>Status</strong>
                          <p>{runDashboard.status}</p>
                        </div>
                        <div className="card">
                          <strong>Sections</strong>
                          <p>{runDashboard.sectionCount}</p>
                        </div>
                        <div className="card">
                          <strong>Exports</strong>
                          <p>{runDashboard.exportsCount}</p>
                        </div>
                      </div>
                      <div className="card" style={{ marginTop: 12 }}>
                        <strong>Section Statuses</strong>
                        <pre>
                          {JSON.stringify(
                            runDashboard.sectionStatusCounts || {},
                            null,
                            2
                          )}
                        </pre>
                      </div>
                      <div className="card" style={{ marginTop: 12 }}>
                        <strong>Average Evidence Scores</strong>
                        <pre>
                          {JSON.stringify(runDashboard.averageScores || {}, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
                <pre>{JSON.stringify(selectedRun, null, 2)}</pre>
              </>
            )}
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
