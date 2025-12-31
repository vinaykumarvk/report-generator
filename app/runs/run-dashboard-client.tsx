"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import VectorStoreSelector from "../components/vector-store-selector";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
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
};

type Template = {
  id: string;
  name: string;
  description?: string;
  sections?: TemplateSection[];
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

function statusClass(status?: string) {
  if (!status) return "badge";
  return `badge status-${status}`;
}

export default function RunDashboardClient() {
  const [activeTab, setActiveTab] = useState<"create" | "view">("view");
  const [runs, setRuns] = useState<Run[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [variablesJson, setVariablesJson] = useState("{}");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, SectionOverrideState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);

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
      setTemplates(Array.isArray(data) ? data : []);
      if (!selectedTemplateId && Array.isArray(data) && data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedTemplateId]);

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
        setCreateStatus("Run started! Switching to View Runs...");
        setTimeout(() => {
          setActiveTab("view");
          loadRuns();
        }, 1500);
      } else {
        setTimeout(() => {
          setActiveTab("view");
          loadRuns();
        }, 1500);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create run");
      setCreateStatus(null);
    }
  }

  async function runAction(runId: string, action: "start" | "export") {
    setActionStatus((prev) => ({ ...prev, [runId]: "Working..." }));
    try {
      if (action === "start") {
        const res = await fetch(`/api/report-runs/${runId}/start`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to start run");
      } else if (action === "export") {
        const res = await fetch(`/api/report-runs/${runId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "MARKDOWN" }),
        });
        if (!res.ok) throw new Error("Failed to enqueue export");
        
        const data = await res.json();
        
        // Poll for export completion
        setActionStatus((prev) => ({ ...prev, [runId]: "Exporting..." }));
        
        let attempts = 0;
        const maxAttempts = 60;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const exportsRes = await fetch(`/api/report-runs/${runId}/exports`, {
            cache: "no-store",
          });
          
          if (exportsRes.ok) {
            const exports = await exportsRes.json();
            const completedExport = exports.find((exp: any) => 
              exp.status === "COMPLETED" && 
              exp.created_at && 
              new Date(exp.created_at).getTime() > Date.now() - 120000
            );
            
            if (completedExport) {
              const downloadUrl = `/api/report-runs/${runId}/exports/${completedExport.id}`;
              window.open(downloadUrl, '_blank');
              setActionStatus((prev) => ({ ...prev, [runId]: "Downloaded!" }));
              await loadRuns();
              return;
            }
          }
          
          attempts++;
        }
        
        setActionStatus((prev) => ({ ...prev, [runId]: "Export timeout" }));
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
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template?.sections) {
      setSectionOverrides({});
      return;
    }
    setSectionOverrides((prev) => {
      const next: Record<string, SectionOverrideState> = {};
      template.sections?.forEach((section) => {
        const existing = prev[section.id];
        next[section.id] = {
          enabled: existing?.enabled ?? false,
          vectorStoreIds: existing?.vectorStoreIds ?? [],
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
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Runs</h1>
          <p className="page-description">Create and manage report runs</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={loadRuns} type="button">
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "2px solid var(--color-border)", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            style={{
              padding: "1rem 2rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "create" ? "3px solid var(--color-accent)" : "3px solid transparent",
              fontWeight: activeTab === "create" ? "600" : "400",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Create New Run
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("view")}
            style={{
              padding: "1rem 2rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "view" ? "3px solid var(--color-accent)" : "3px solid transparent",
              fontWeight: activeTab === "view" ? "600" : "400",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            View Runs
          </button>
        </div>
      </div>

      <div className="content-section">
        {/* CREATE TAB */}
        {activeTab === "create" && (
          <div className="card">
            <h2>Create a New Run</h2>
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
                <div className="empty-state-icon">⚠️</div>
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
            <h2>All Runs</h2>

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
                <div className="empty-state-icon">⚠️</div>
                <h3>Error Loading Runs</h3>
                <p>{error}</p>
                <button onClick={loadRuns}>Try Again</button>
              </div>
            )}

            {!loading && !runs.length && !error && (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>No Runs Yet</h3>
                <p>Create your first run to get started</p>
                <button onClick={() => setActiveTab("create")}>
                  Create New Run
                </button>
              </div>
            )}

            {!loading && runs.length > 0 && (
              <div className="run-list">
                {runs.map((run) => (
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
                        <span className="run-meta-value">{formatTimestamp(run.created_at)}</span>
                      </div>
                      <div className="run-meta-item">
                        <span className="run-meta-label">Completed</span>
                        <span className="run-meta-value">{formatTimestamp(run.completed_at)}</span>
                      </div>
                    </div>

                    <div className="run-actions">
                      {run.status === "DRAFT" && (
                        <button type="button" onClick={() => runAction(run.id, "start")}>
                          Start
                        </button>
                      )}
                      {run.status === "COMPLETED" && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => runAction(run.id, "export")}
                        >
                          Export
                        </button>
                      )}
                      <Link className="button secondary" href={`/runs/${run.id}`}>
                        View Details
                      </Link>
                    </div>

                    {actionStatus[run.id] && (
                      <div className="action-status" aria-live="polite">
                        {actionStatus[run.id]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
