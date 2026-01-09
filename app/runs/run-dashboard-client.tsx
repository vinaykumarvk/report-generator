"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart, Search } from "lucide-react";
import VectorStoreSelector from "../components/vector-store-selector";
import ExportManager from "../components/export-manager";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  template_version_snapshot_json?: { name?: string };
  template_id?: string;
  input_json?: { topic?: string };
};

type TemplateSection = {
  id: string;
  title: string;
  purpose?: string;
  outputFormat?: string;
  evidencePolicy?: string;
  sourceMode?: "inherit" | "custom";
  customConnectorIds?: string[];
};

type TemplateConnector = {
  type: string;
  name: string;
  metadata?: {
    vectorStoreId?: string;
    fileIds?: string[];
  };
};

type VectorStore = {
  id: string;
  name: string;
};

type Template = {
  id: string;
  name: string;
  description?: string;
  sections?: TemplateSection[];
  connectors?: TemplateConnector[];
};

type SectionOverrideState = {
  enabled: boolean;
  vectorStoreIds: string[];
  vectorFileIds: Record<string, string[]>;
  webSearchEnabled: boolean;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

function statusClass(status?: string) {
  if (!status) return "badge";
  return `badge status-${status}`;
}

function formatTemplateSources(template?: Template) {
  // Defensive: check both connectors and sources_json
  const connectors = template?.connectors || [];
  const sourcesJson = (template as any)?.sources_json;
  
  // If connectors is empty but sources_json exists, use that
  let effectiveConnectors = connectors;
  if (connectors.length === 0 && Array.isArray(sourcesJson) && sourcesJson.length > 0) {
    effectiveConnectors = sourcesJson;
  }
  
  if (effectiveConnectors.length === 0) return "None";
  const vectorNames = effectiveConnectors
    .filter((connector) => connector.type === "VECTOR")
    .map((connector) => connector.name)
    .filter(Boolean);
  const hasWeb = effectiveConnectors.some((connector) => connector.type === "WEB_SEARCH");
  const parts = [];
  if (vectorNames.length > 0) {
    parts.push(`Vector: ${vectorNames.join(", ")}`);
  }
  if (hasWeb) {
    parts.push("Web Search");
  }
  return parts.join(" • ");
}

function resolveVectorStoreName(id: string, vectorStores: VectorStore[], template?: Template) {
  const known = vectorStores.find((store) => store.id === id);
  if (known) return known.name;
  if (!template?.connectors?.length) return id;
  const match = template.connectors.find(
    (connector) =>
      connector.type === "VECTOR" && connector.metadata?.vectorStoreId === id
  );
  return match?.name || id;
}

function formatSectionSources(
  section: TemplateSection,
  vectorStores: VectorStore[],
  template?: Template
) {
  if (!template) {
    return "Template not loaded";
  }
  
  if (section.sourceMode === "custom") {
    const ids = section.customConnectorIds || [];
    if (ids.length === 0) return "Custom: None";
    return `Custom: ${ids.map((id) => resolveVectorStoreName(id, vectorStores, template)).join(", ")}`;
  }
  
  const inherited = formatTemplateSources(template);
  return `Inherited: ${inherited}`;
}

export default function RunDashboardClient({ initialTab }: { initialTab?: "create" | "view" }) {
  const router = useRouter();
  const [activeTab] = useState<"create" | "view">(initialTab || "view");
  const [runs, setRuns] = useState<Run[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [variablesJson, setVariablesJson] = useState("{}");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, SectionOverrideState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [availableVectorStores, setAvailableVectorStores] = useState<VectorStore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"created" | "completed" | "template" | "topic">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/report-runs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load runs");
      }
      const data = await res.json();
      const nextRuns = Array.isArray(data) ? data : [];
      setRuns(nextRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch("/api/templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      const templatesArray = Array.isArray(data) ? data : [];
      
      // Debug: Log template data to verify connectors are present
      const solutionsTemplate = templatesArray.find(t => 
        t.name && t.name.toLowerCase().includes('solutions')
      );
      if (solutionsTemplate) {
        console.log('[Debug] Solutions template connectors:', solutionsTemplate.connectors?.length || 0);
        console.log('[Debug] Solutions template sources_json:', solutionsTemplate.sources_json?.length || 0);
      }
      
      setTemplates(templatesArray);
      if (!selectedTemplateId && templatesArray.length > 0) {
        setSelectedTemplateId(templatesArray[0].id);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedTemplateId]);

  async function refreshStatus() {
    setIsRefreshing(true);
    await loadRuns();
    setIsRefreshing(false);
  }

  // Filter, search, and sort runs
  const filteredAndSortedRuns = useCallback(() => {
    let result = [...runs];

    // 1. Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((run) => {
        const templateName = run.template_version_snapshot_json?.name?.toLowerCase() || "";
        const topic = run.input_json?.topic?.toLowerCase() || "";
        const runId = run.id.toLowerCase();
        return templateName.includes(query) || topic.includes(query) || runId.includes(query);
      });
    }

    // 2. Apply status filter
    if (statusFilter !== "ALL") {
      result = result.filter((run) => run.status === statusFilter);
    }

    // 3. Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "created":
          comparison = (a.created_at || "").localeCompare(b.created_at || "");
          break;
        case "completed":
          comparison = (a.completed_at || "").localeCompare(b.completed_at || "");
          break;
        case "template":
          comparison = (a.template_version_snapshot_json?.name || "").localeCompare(
            b.template_version_snapshot_json?.name || ""
          );
          break;
        case "topic":
          comparison = (a.input_json?.topic || "").localeCompare(b.input_json?.topic || "");
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [runs, searchQuery, statusFilter, sortBy, sortOrder]);

  async function createRun(startImmediately: boolean) {
    setCreateStatus("Creating run...");
    setCreateError(null);
    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = variablesJson.trim() ? JSON.parse(variablesJson) : {};
    } catch (err) {
      setCreateStatus(null);
      setCreateError("Input JSON is invalid. Please fix it and try again.");
      return;
    }
    const overridesPayload = Object.entries(sectionOverrides)
      .filter(([, value]) => value.enabled)
      .reduce<Record<string, { vectorStoreIds: string[]; fileIds: string[]; webSearchEnabled: boolean }>>(
        (acc, [sectionId, value]) => {
          const fileIds = Object.values(value.vectorFileIds || {}).flat();
          acc[sectionId] = {
            vectorStoreIds: value.vectorStoreIds,
            fileIds,
            webSearchEnabled: value.webSearchEnabled,
          };
          return acc;
        },
        {}
      );
    const payload = {
      templateId: selectedTemplateId,
      inputJson: {
        topic: topic.trim(),
        ...parsedInput,
        sourceOverrides: overridesPayload,
      },
    };
    try {
      const res = await fetch("/api/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create run");
      }
      const data = await res.json();
      setCreateStatus("Run created.");
      if (startImmediately && data?.run?.id) {
        setCreateStatus("Starting run...");
        const startRes = await fetch(`/api/report-runs/${data.run.id}/start`, {
          method: "POST",
        });
        if (!startRes.ok) throw new Error("Failed to start run");
        setCreateStatus("Run started! Switching to Reports Library...");
        setTimeout(() => {
          router.push("/library");
          loadRuns();
        }, 1500);
      } else {
        setTimeout(() => {
          router.push("/library");
          loadRuns();
        }, 1500);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create run");
      setCreateStatus(null);
    }
  }

  async function runAction(runId: string, action: "start") {
    setActionStatus((prev) => ({ ...prev, [runId]: "Working..." }));
    try {
      if (action === "start") {
        const res = await fetch(`/api/report-runs/${runId}/start`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to start run");
      }
      setActionStatus((prev) => ({ ...prev, [runId]: "Done." }));
      await loadRuns();
    } catch (err) {
      setActionStatus((prev) => ({
        ...prev,
        [runId]: err instanceof Error ? err.message : "Action failed",
      }));
    }
  }

  useEffect(() => {
    loadRuns();
    loadTemplates();
  }, [loadRuns, loadTemplates]);

  useEffect(() => {
    if (activeTab !== "create") return;
    const loadVectorStores = async () => {
      try {
        const res = await fetch("/api/openai/vector-stores");
        if (!res.ok) return;
        const data = await res.json();
        const stores = Array.isArray(data) ? data : (data.data || []);
        setAvailableVectorStores(stores);
      } catch (err) {
        console.warn("Failed to load vector stores for display", err);
      }
    };
    loadVectorStores();
  }, [activeTab]);

  // Auto-refresh when runs are QUEUED or RUNNING
  function formatElapsed(run: Run) {
    const start = run.started_at || run.created_at;
    if (!start) return "—";
    const elapsedMs = Date.now() - new Date(start).getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  }

  useEffect(() => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template?.sections) {
      setSectionOverrides({});
      return;
    }
    setSectionOverrides((prev) => {
      const next: Record<string, SectionOverrideState> = {};
      template.sections?.forEach((section) => {
        const existing = prev[section.id];
        const defaultVectorStoreIds =
          section.sourceMode === "custom" ? section.customConnectorIds || [] : [];
        next[section.id] = {
          enabled: existing?.enabled ?? false,
          vectorStoreIds: existing?.vectorStoreIds ?? defaultVectorStoreIds,
          vectorFileIds: existing?.vectorFileIds ?? {},
          webSearchEnabled:
            existing?.webSearchEnabled ??
            Boolean(section.evidencePolicy?.includes("WEB")),
        };
      });
      return next;
    });
  }, [selectedTemplateId, templates]);

  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);

  return (
    <div className="page-container">
      <div className="content-section">
        {/* CREATE TAB */}
        {activeTab === "create" && (
          <div className="card">
            <h2>New Report</h2>
            <p className="page-description">
              Select a template, set the topic, and optionally override section sources.
            </p>
            <div className="grid grid-2">
              <div>
                <label htmlFor="run-template">Template</label>
                <select
                  id="run-template"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={loadingTemplates}
                >
                  {loadingTemplates && <option>Loading templates...</option>}
                  {!loadingTemplates && templates.length === 0 && (
                    <option>No templates available</option>
                  )}
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="run-topic">Topic</label>
                <input
                  id="run-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g., IBM, Tesla, Market Analysis"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="run-variables">Additional Variables (JSON)</label>
                <textarea
                  id="run-variables"
                  value={variablesJson}
                  rows={3}
                  onChange={(event) => setVariablesJson(event.target.value)}
                  placeholder='{"audience": "executives", "timeframe": "Q4 2024"}'
                />
                <div className="muted mt-2">
                  Optional: Add custom variables for the template.
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3>Section Source Overrides (Optional)</h3>
              <p className="muted">Override default sources for specific sections if needed.</p>
              {selectedTemplate && (
                <div className="muted mt-2">
                  Template sources: {formatTemplateSources(selectedTemplate)}
                </div>
              )}
              {!selectedTemplate?.sections?.length && (
                <div className="muted">Select a template to configure sources.</div>
              )}
              {selectedTemplate?.sections?.map((section) => {
                const override = sectionOverrides[section.id];
                return (
                  <div className="card mt-4" key={section.id}>
                    <div className="flex justify-between items-center">
                      <div>
                        <strong>{section.title}</strong>
                        <div className="muted">
                          Default policy: {section.evidencePolicy || "LLM_ONLY"}
                        </div>
                        <div className="muted">
                          {selectedTemplate 
                            ? (() => {
                                const sources = formatSectionSources(section, availableVectorStores, selectedTemplate);
                                // Debug in console if sources show "None"
                                if (sources.includes("None") && process.env.NODE_ENV === 'development') {
                                  console.warn('[Debug] Sources showing None:', {
                                    templateId: selectedTemplate.id,
                                    connectors: selectedTemplate.connectors?.length || 0,
                                    sources_json: (selectedTemplate as any).sources_json?.length || 0,
                                    sectionSourceMode: section.sourceMode
                                  });
                                }
                                return sources;
                              })()
                            : "Loading template..."}
                        </div>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={override?.enabled ?? false}
                          onChange={(event) =>
                            setSectionOverrides((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...(prev[section.id] || {
                                  vectorStoreIds: [],
                                  vectorFileIds: {},
                                  webSearchEnabled: false,
                                }),
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Override sources</span>
                      </label>
                    </div>

                    {override?.enabled ? (
                      <div className="mt-4">
                        <label>Vector Stores</label>
                        <VectorStoreSelector
                          selectedVectorStores={override.vectorStoreIds}
                          onVectorStoreChange={(stores) =>
                            setSectionOverrides((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...(prev[section.id] || {
                                  enabled: true,
                                  vectorFileIds: {},
                                  webSearchEnabled: false,
                                }),
                                vectorStoreIds: stores,
                              },
                            }))
                          }
                          selectedFiles={override.vectorFileIds}
                          onFileChange={(storeId, fileIds) =>
                            setSectionOverrides((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...(prev[section.id] || {
                                  enabled: true,
                                  vectorStoreIds: [],
                                  webSearchEnabled: false,
                                }),
                                vectorFileIds: {
                                  ...(prev[section.id]?.vectorFileIds || {}),
                                  [storeId]: fileIds,
                                },
                              },
                            }))
                          }
                          maxStores={4}
                        />

                        <label className="flex items-center mt-4">
                          <input
                            type="checkbox"
                            checked={override.webSearchEnabled}
                            onChange={(event) =>
                              setSectionOverrides((prev) => ({
                                ...prev,
                                [section.id]: {
                                  ...(prev[section.id] || {
                                    enabled: true,
                                    vectorStoreIds: [],
                                    vectorFileIds: {},
                                  }),
                                  webSearchEnabled: event.target.checked,
                                },
                              }))
                            }
                          />
                          <span>Enable web search for this section</span>
                        </label>
                      </div>
                    ) : (
                      <div className="muted mt-2">
                        Using template defaults for sources and evidence policy.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {createError && (
              <div className="empty-state mt-4">
                <div className="empty-state-icon"><AlertTriangle size={48} /></div>
                <p>{createError}</p>
              </div>
            )}
            {createStatus && (
              <div className="muted mt-2" aria-live="polite">
                {createStatus}
              </div>
            )}

            <div className="flex mt-6">
              <button
                type="button"
                onClick={() => createRun(true)}
                disabled={!selectedTemplateId || !topic.trim()}
              >
                Create & Start
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => createRun(false)}
                disabled={!selectedTemplateId || !topic.trim()}
              >
                Create Only
              </button>
            </div>
          </div>
        )}

        {/* VIEW TAB */}
        {activeTab === "view" && (
          <div className="card">
            <div className="runs-header">
              <div>
                <h2>Generated Reports</h2>
                <p className="muted">Check live status for long-running jobs.</p>
              </div>
            </div>

            {/* Search, Filter, Sort Controls */}
            {!loading && runs.length > 0 && (
              <div className="filters-section">
                {/* Search */}
                <div className="filter-field">
                  <label htmlFor="search-runs" className="filter-label">
                    Search
                  </label>
                  <input
                    id="search-runs"
                    type="text"
                    placeholder="Search by template, topic, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="filter-input"
                  />
                </div>

                {/* Status Filter */}
                <div className="filter-field">
                  <label htmlFor="filter-status" className="filter-label">
                    Status
                  </label>
                  <select
                    id="filter-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All</option>
                    <option value="DRAFT">Draft</option>
                    <option value="QUEUED">Queued</option>
                    <option value="RUNNING">Running</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="filter-field">
                  <label htmlFor="sort-by" className="filter-label">
                    Sort By
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="created">Created Date</option>
                    <option value="completed">Completed Date</option>
                    <option value="template">Template Name</option>
                    <option value="topic">Topic</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div className="filter-field">
                  <label htmlFor="sort-order" className="filter-label">
                    Order
                  </label>
                  <select
                    id="sort-order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
            )}

            {loading && (
              <div className="run-list">
                {[0, 1, 2].map((row) => (
                  <div className="run-item" key={`skeleton-${row}`}>
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="empty-state">
                <div className="empty-state-icon"><AlertTriangle size={48} /></div>
                <h3>Error Loading Runs</h3>
                <p>{error}</p>
                <button onClick={loadRuns}>Try Again</button>
              </div>
            )}

            {!loading && !runs.length && !error && (
              <div className="empty-state">
                <div className="empty-state-icon"><BarChart size={48} /></div>
                <h3>No Reports Yet</h3>
                <p>Get started by creating your first report. Reports are generated using templates and can include multiple sections with AI-powered content.</p>
                <div className="empty-state-cta">
                  <Link href="/generate" className="button">
                    Create Your First Report
                  </Link>
                </div>
              </div>
            )}

            {!loading && runs.length > 0 && (
              <>
                {filteredAndSortedRuns().length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Search size={48} /></div>
                    <h3>No Matching Reports</h3>
                    <p>No reports match your current search or filter criteria. Try adjusting your filters or search terms to find what you&apos;re looking for.</p>
                    <div className="empty-state-cta">
                      <button onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                      }}>
                        Clear Filters
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="muted" style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
                      Showing {filteredAndSortedRuns().length} of {runs.length} runs
                    </div>
                    <div className="run-list">
                      {filteredAndSortedRuns().map((run) => (
                        <div className="run-item" key={run.id}>
                          <div className="run-header">
                            <div>
                              <div className="run-title">
                                {run.template_version_snapshot_json?.name || "Untitled Template"}
                              </div>
                              {run.input_json?.topic && (
                                <div className="muted">Topic: {run.input_json.topic}</div>
                              )}
                              <div className="run-id">{run.id}</div>
                            </div>
                            <span className={statusClass(run.status)}>{run.status || "UNKNOWN"}</span>
                          </div>

                          <div className="run-meta">
                            <div className="run-meta-item">
                              <span className="run-meta-label">Created</span>
                              <span className="run-meta-value">
                                {run.created_at ? formatRelativeTime(run.created_at) : "—"}
                                {run.created_at && (
                                  <span className="run-timestamp-full" title={formatTimestamp(run.created_at)}>
                                    {" "}({formatTimestamp(run.created_at)})
                                  </span>
                                )}
                              </span>
                            </div>
                            {run.completed_at && (
                              <div className="run-meta-item">
                                <span className="run-meta-label">Completed</span>
                                <span className="run-meta-value">
                                  {formatRelativeTime(run.completed_at)}
                                  <span className="run-timestamp-full" title={formatTimestamp(run.completed_at)}>
                                    {" "}({formatTimestamp(run.completed_at)})
                                  </span>
                                </span>
                              </div>
                            )}
                            {run.status === "RUNNING" && (
                              <div className="run-meta-item">
                                <span className="run-meta-label">Elapsed</span>
                                <span className="run-meta-value">{formatElapsed(run)}</span>
                              </div>
                            )}
                          </div>

                          <div className="run-actions">
                            {run.status === "DRAFT" && (
                              <button type="button" onClick={() => runAction(run.id, "start")}>
                                Start
                              </button>
                            )}
                            {run.status === "RUNNING" && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={refreshStatus}
                                disabled={isRefreshing}
                              >
                                {isRefreshing ? "Refreshing..." : "Refresh Status"}
                              </button>
                            )}
                            {run.status === "COMPLETED" && (
                              <>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={async () => {
                                    const res = await fetch(`/api/report-runs/${run.id}/exports`, { cache: "no-store" });
                                    if (res.ok) {
                                      const exports = await res.json();
                                      const mdExport = exports.find((e: any) => e.format === "MARKDOWN" && e.status === "READY");
                                      if (mdExport) {
                                        // Use fetch + blob for proper download
                                        try {
                                          const downloadRes = await fetch(`/api/report-runs/${run.id}/exports/${mdExport.id}`);
                                          if (downloadRes.ok || downloadRes.redirected) {
                                            const finalUrl = downloadRes.redirected ? downloadRes.url : downloadRes.url;
                                            const blob = await fetch(finalUrl).then(r => r.blob());
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            const link = document.createElement("a");
                                            link.href = blobUrl;
                                            link.download = `${run.id}.md`;
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                            window.URL.revokeObjectURL(blobUrl);
                                          }
                                        } catch (err) {
                                          console.error('Download error:', err);
                                          window.open(`/api/report-runs/${run.id}/exports/${mdExport.id}`, '_blank');
                                        }
                                      } else {
                                        // Create new export
                                        const createRes = await fetch(`/api/report-runs/${run.id}/export`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ format: 'MARKDOWN' })
                                        });
                                        if (createRes.ok) {
                                          alert('Export started. Please wait a moment and try again.');
                                        }
                                      }
                                    }
                                  }}
                                >
                                  Download .md
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={async () => {
                                    const res = await fetch(`/api/report-runs/${run.id}/exports`, { cache: "no-store" });
                                    if (res.ok) {
                                      const exports = await res.json();
                                      const pdfExport = exports.find((e: any) => e.format === "PDF" && e.status === "READY");
                                      if (pdfExport) {
                                        // Use fetch + blob for proper download
                                        try {
                                          const downloadRes = await fetch(`/api/report-runs/${run.id}/exports/${pdfExport.id}`);
                                          if (downloadRes.ok || downloadRes.redirected) {
                                            const finalUrl = downloadRes.redirected ? downloadRes.url : downloadRes.url;
                                            const blob = await fetch(finalUrl).then(r => r.blob());
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            const link = document.createElement("a");
                                            link.href = blobUrl;
                                            link.download = `${run.id}.pdf`;
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                            window.URL.revokeObjectURL(blobUrl);
                                          }
                                        } catch (err) {
                                          console.error('Download error:', err);
                                          window.open(`/api/report-runs/${run.id}/exports/${pdfExport.id}`, '_blank');
                                        }
                                      } else {
                                        // Create new export
                                        const createRes = await fetch(`/api/report-runs/${run.id}/export`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ format: 'PDF' })
                                        });
                                        if (createRes.ok) {
                                          alert('Export started. Please wait a moment and try again.');
                                        }
                                      }
                                    }
                                  }}
                                >
                                  Download .pdf
                                </button>
                              </>
                            )}
                            <Link className="button secondary" href={`/runs/${run.id}`}>
                              View Details
                            </Link>
                          </div>

                          {run.status === "RUNNING" && (
                            <div className="run-status-note">
                              This report usually completes in about 5–15 minutes. You can come back later and refresh the page.
                            </div>
                          )}

                          {actionStatus[run.id] && (
                            <div className="action-status" aria-live="polite">
                              {actionStatus[run.id]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
