"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import VectorStoreSelector from "../reports-studio/components/vector-store-selector";
import { marked } from "marked";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  completed_at?: string | null;
  template_version_snapshot_json?: { name?: string };
  template_id?: string;
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

type SectionOutput = {
  id: string;
  title: string | null;
  status: string | null;
  finalMarkdown: string;
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
  const [runs, setRuns] = useState<Run[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [variablesJson, setVariablesJson] = useState("{\n  \"audience\": \"\",\n  \"timeframe\": \"\"\n}");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, SectionOverrideState>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [combinedReport, setCombinedReport] = useState<string>("");
  const [sectionOutputs, setSectionOutputs] = useState<SectionOutput[]>([]);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const skeletonRows = [0, 1, 2];

  async function loadRuns() {
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
      if (!selectedRunId && nextRuns.length > 0) {
        setSelectedRunId(nextRuns[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      const res = await fetch("/api/templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load objectives");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
      if (!selectedTemplateId && Array.isArray(data) && data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to load objectives");
    } finally {
      setLoadingTemplates(false);
    }
  }

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
      if (data?.run?.id) {
        setSelectedRunId(data.run.id);
      }
      if (startImmediately && data?.run?.id) {
        setCreateStatus("Starting run...");
        const startRes = await fetch(`/api/report-runs/${data.run.id}/start`, {
          method: "POST",
        });
        if (!startRes.ok) throw new Error("Failed to start run");
        setCreateStatus("Run queued.");
      }
      await loadRuns();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create run");
      setCreateStatus(null);
    }
  }

  async function runAction(runId: string, action: "start" | "rerun" | "export") {
    setActionStatus((prev) => ({ ...prev, [runId]: "Working..." }));
    try {
      if (action === "start") {
        const res = await fetch(`/api/report-runs/${runId}/start`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to start run");
      } else if (action === "rerun") {
        if (
          !window.confirm(
            "Rerun this report? This will reset section outputs and queue new jobs."
          )
        ) {
          setActionStatus((prev) => ({ ...prev, [runId]: "" }));
          return;
        }
        const res = await fetch(`/api/report-runs/${runId}/rerun`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes: {} }),
        });
        if (!res.ok) throw new Error("Failed to rerun run");
        const startRes = await fetch(`/api/report-runs/${runId}/start`, {
          method: "POST",
        });
        if (!startRes.ok) throw new Error("Failed to start rerun");
      } else if (action === "export") {
        const res = await fetch(`/api/report-runs/${runId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "MARKDOWN" }),
        });
        if (!res.ok) throw new Error("Failed to enqueue export");
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
  }, []);

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

  useEffect(() => {
    if (!selectedRunId) {
      setCombinedReport("");
      setSectionOutputs([]);
      return;
    }
    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(
          `/api/report-runs/${selectedRunId}/combined-output`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load run output");
        const data = await res.json();
        setCombinedReport(data?.combinedMarkdown || "");
        setSectionOutputs(Array.isArray(data?.sections) ? data.sections : []);
        setExpandedSectionId(null);
      } catch {
        setCombinedReport("");
        setSectionOutputs([]);
      } finally {
        setLoadingPreview(false);
      }
    };
    loadPreview();
  }, [selectedRunId]);

  const summary = useMemo(() => {
    const counts = runs.reduce(
      (acc: Record<string, number>, run) => {
        const key = run.status || "UNKNOWN";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const latest = runs[0];
    return {
      counts,
      total: runs.length,
      latest,
    };
  }, [runs]);

  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);

  function statusBadge(status?: string | null) {
    if (!status) return "badge";
    return `badge status-${status}`;
  }

  function renderMarkdown(markdown: string) {
    if (!markdown) return "";
    
    // Configure marked options
    marked.setOptions({
      breaks: true,
      gfm: true, // GitHub Flavored Markdown
      headerIds: false,
      mangle: false,
    });
    
    try {
      return marked.parse(markdown) as string;
    } catch (error) {
      console.error("Error parsing markdown:", error);
      return `<pre>${markdown}</pre>`;
    }
  }

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Run Dashboard</h1>
          <p className="page-description">Track status, sections, and outputs</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={loadRuns} type="button">
            Refresh
          </button>
        </div>
      </div>

      <div className="content-section">
        <div className="card">
          <h2>Create a Run</h2>
          <p className="page-description">
            Pick an objective, set the topic, adjust sources if needed, then run.
          </p>
          <div className="grid grid-2">
            <div>
              <label htmlFor="run-template">Objective</label>
              <select
                id="run-template"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={loadingTemplates}
              >
                {loadingTemplates && <option>Loading objectives...</option>}
                {!loadingTemplates && templates.length === 0 && (
                  <option>No objectives available</option>
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
                placeholder="IBM, Reliance Industries, RFP for Vendor X"
              />
              <div className="muted mt-2">
                This is the primary subject for the report run.
              </div>
            </div>
            <div>
              <label htmlFor="run-variables">Run Variables (JSON)</label>
              <textarea
                id="run-variables"
                value={variablesJson}
                rows={5}
                onChange={(event) => setVariablesJson(event.target.value)}
                placeholder='{"topic":"IBM"}'
              />
              <div className="muted mt-2">
                Optional overrides: audience, timeframe, or other variables.
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3>Section Sources</h3>
            {!selectedTemplate?.sections?.length && (
              <div className="muted">Select an objective to configure sources.</div>
            )}
            {selectedTemplate?.sections?.map((section) => {
              const override = sectionOverrides[section.id];
              return (
                <div className="card mt-4" key={section.id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <strong>{section.title}</strong>
                      <div className="muted">
                        Evidence policy: {section.evidencePolicy || "LLM_ONLY"}
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
                      Using objective defaults for sources and evidence policy.
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
              onClick={() => createRun(false)}
              disabled={!selectedTemplateId || !topic.trim()}
            >
              Create Run
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => createRun(true)}
              disabled={!selectedTemplateId || !topic.trim()}
            >
              Create & Start
            </button>
          </div>
          <div className="muted mt-2">
            After starting, open the run output below or click “View Details” to
            see section artifacts and rerun actions.
          </div>
        </div>

        <div className="card">
          <h2>Final Output</h2>
          <label htmlFor="run-output">Run</label>
          <select
            id="run-output"
            value={selectedRunId}
            onChange={(event) => setSelectedRunId(event.target.value)}
          >
            <option value="">Select a run...</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.template_version_snapshot_json?.name || "Untitled Objective"} •{" "}
                {run.id}
              </option>
            ))}
          </select>
          {loadingPreview ? (
            <div className="skeleton-block" aria-busy="true" />
          ) : combinedReport ? (
            <div
              className="markdown-output mt-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(combinedReport) }}
            />
          ) : (
            <div className="muted mt-4">No final report available yet.</div>
          )}
          {selectedRunId && (
            <div className="mt-4">
              <Link className="button secondary" href={`/runs/${selectedRunId}`}>
                View Details
              </Link>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Section Outputs</h2>
          {!selectedRunId && <div className="muted">Select a run to view outputs.</div>}
          {selectedRunId && loadingPreview && (
            <div className="skeleton-block" aria-busy="true" />
          )}
          {selectedRunId && !loadingPreview && sectionOutputs.length === 0 && (
            <div className="muted">No section outputs available yet.</div>
          )}
          {selectedRunId && !loadingPreview && sectionOutputs.length > 0 && (
            <div className="list">
              {sectionOutputs.map((section) => (
                <div key={section.id} className="list-item">
                  <div className="flex justify-between items-center">
                    <div>
                      <strong>{section.title || "Untitled Section"}</strong>
                      <div className="muted">{section.id}</div>
                    </div>
                    <div className="flex items-center">
                      <span className={statusBadge(section.status)}>{section.status || "UNKNOWN"}</span>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setExpandedSectionId((prev) =>
                            prev === section.id ? null : section.id
                          )
                        }
                      >
                        {expandedSectionId === section.id ? "Hide" : "View"}
                      </button>
                    </div>
                  </div>
                  {expandedSectionId === section.id && (
                    <div
                      className="markdown-output mt-4"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(section.finalMarkdown || ""),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Runs</span>
            {loading ? (
              <div className="skeleton-line" />
            ) : (
              <div className="stat-value">{summary.total}</div>
            )}
          </div>
          {!loading && Object.entries(summary.counts).map(([status, count]) => (
            <div className="stat-card" key={status}>
              <span className="stat-label">{status}</span>
              <div className="stat-value">{count}</div>
            </div>
          ))}
        </div>

        {summary.latest && !loading && (
          <div className="card">
            <h3>Latest Run</h3>
            <div className="run-meta">
              <div className="run-meta-item">
                <span className="run-meta-label">Objective</span>
                <span className="run-meta-value">
                  {summary.latest.template_version_snapshot_json?.name || "Untitled Objective"}
                </span>
              </div>
              <div className="run-meta-item">
                <span className="run-meta-label">Created</span>
                <span className="run-meta-value">{formatTimestamp(summary.latest.created_at)}</span>
              </div>
              <div className="run-meta-item">
                <span className="run-meta-label">Status</span>
                <span className={statusClass(summary.latest.status)}>{summary.latest.status || "UNKNOWN"}</span>
              </div>
            </div>
            <Link className="button secondary" href={`/runs/${summary.latest.id}`}>
              View Details
            </Link>
          </div>
        )}

        <div className="card">
          <h2>All Runs</h2>

          {loading && (
            <div className="run-list">
              {skeletonRows.map((row) => (
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
              <p>Create your first run in Reports Studio to get started</p>
              <Link className="button" href="/reports-studio">
                Go to Reports Studio
              </Link>
            </div>
          )}

          {!loading && runs.length > 0 && (
            <div className="run-list">
              {runs.map((run) => (
                <div className="run-item" key={run.id}>
                  <div className="run-header">
                    <div>
                      <div className="run-title">
                        {run.template_version_snapshot_json?.name || "Untitled Objective"}
                      </div>
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
                    <button type="button" onClick={() => runAction(run.id, "start")}>
                      Start
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => runAction(run.id, "rerun")}
                    >
                      Rerun
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => runAction(run.id, "export")}
                    >
                      Export
                    </button>
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
      </div>
    </div>
  );
}
