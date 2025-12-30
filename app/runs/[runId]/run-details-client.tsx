"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  final_report_json?: string | null;
  template_version_snapshot_json?: { name?: string };
};

type SectionRun = {
  id: string;
  title?: string;
  status?: string;
  template_section_id?: string;
  created_at?: string;
};

type Artifact = {
  id: string;
  type: string;
  content_json?: unknown;
  content_markdown?: string | null;
  created_at?: string;
};

type RunDashboard = {
  status?: string;
  sectionCount?: number;
  exportsCount?: number;
  sectionStatusCounts?: Record<string, number>;
  averageScores?: Record<string, number>;
};

type RunEvent = {
  id: string;
  type: string;
  created_at?: string;
  payload_json?: Record<string, unknown>;
};

type RunExport = {
  id: string;
  format: string;
  created_at?: string;
  file_path?: string;
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

function renderContent(content: unknown) {
  if (content === null || content === undefined) return "—";
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 2);
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

export default function RunDetailsClient({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [sections, setSections] = useState<SectionRun[]>([]);
  const [dashboard, setDashboard] = useState<RunDashboard | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactFilter, setArtifactFilter] = useState<string>("ALL");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [exportsList, setExportsList] = useState<RunExport[]>([]);
  const [loadingRun, setLoadingRun] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingExports, setLoadingExports] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skeletonRows = [0, 1, 2];

  async function loadRun() {
    try {
      setLoadingRun(true);
      setError(null);
      const res = await fetch(`/api/report-runs/${runId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load run");
      const data = await res.json();
      setRun(data.run);
      setSections(data.sectionRuns || []);
      if (!selectedSectionId && data.sectionRuns?.length) {
        setSelectedSectionId(data.sectionRuns[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setLoadingRun(false);
    }
  }

  async function loadDashboard() {
    setLoadingDashboard(true);
    const res = await fetch(`/api/report-runs/${runId}/dashboard`, {
      cache: "no-store",
    });
    if (res.ok) {
      setDashboard(await res.json());
    }
    setLoadingDashboard(false);
  }

  async function loadExports() {
    setLoadingExports(true);
    const res = await fetch(`/api/report-runs/${runId}/exports`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setExportsList(Array.isArray(data) ? data : []);
    }
    setLoadingExports(false);
  }

  async function loadArtifacts(sectionRunId: string) {
    setLoadingArtifacts(true);
    const res = await fetch(`/api/section-runs/${sectionRunId}/artifacts`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setArtifacts(Array.isArray(data) ? data : []);
    }
    setLoadingArtifacts(false);
  }

  async function requestExport(format: string) {
    await fetch(`/api/report-runs/${runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    await loadExports();
  }

  useEffect(() => {
    loadRun();
    loadDashboard();
    loadExports();
  }, [runId]);

  useEffect(() => {
    if (!selectedSectionId) return;
    loadArtifacts(selectedSectionId);
  }, [selectedSectionId]);

  useEffect(() => {
    const source = new EventSource(`/api/report-runs/${runId}/events`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setEvents((prev) => {
          const next = [...prev, payload];
          return next.slice(-200);
        });
      } catch {
        // ignore malformed events
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
    };
  }, [runId]);

  const evidenceItems = useMemo(() => {
    const evidence = artifacts.find((item) => item.type === "EVIDENCE");
    if (!evidence?.content_json) return [];
    if (Array.isArray(evidence.content_json)) return evidence.content_json;
    return [];
  }, [artifacts]);

  const filteredArtifacts = useMemo(() => {
    if (artifactFilter === "ALL") return artifacts;
    return artifacts.filter((artifact) => artifact.type === artifactFilter);
  }, [artifacts, artifactFilter]);

  const filterOptions = [
    "ALL",
    "FINAL",
    "DRAFT",
    "EVIDENCE",
    "VERIFICATION",
    "PLAN",
    "CLAIMS",
    "PROVENANCE",
    "SCORES",
    "REVIEW",
    "PROMPTS_USED",
  ];

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Run Details</h1>
          <p className="page-description">{runId}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button secondary" href="/runs">
            Back to Runs
          </Link>
        </div>
      </div>
      
      <div className="content-section">
        {error && <div className="card">{error}</div>}
        <section className="details-grid">
          <div className="card">
            <h3>Run Summary</h3>
            {loadingRun ? (
              <>
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </>
            ) : run ? (
              <>
                <div className="split">
                  <strong>{run.template_version_snapshot_json?.name || "Untitled Objective"}</strong>
                  <span className={statusClass(run.status)}>{run.status || "UNKNOWN"}</span>
                </div>
                <div className="muted">Created: {formatTimestamp(run.created_at)}</div>
                <div className="muted">Started: {formatTimestamp(run.started_at)}</div>
                <div className="muted">Completed: {formatTimestamp(run.completed_at)}</div>
              </>
            ) : (
              <div className="muted">Loading run...</div>
            )}

            <h4>Sections</h4>
            {loadingRun ? (
              <div className="list" aria-busy="true">
                {skeletonRows.map((row) => (
                  <div className="list-item" key={`section-skeleton-${row}`}>
                    <div>
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                    <div className="skeleton-line" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="list">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`list-item ${selectedSectionId === section.id ? "active" : ""}`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <div>
                      <strong>{section.title || "Untitled Section"}</strong>
                      <div className="muted">{section.id}</div>
                    </div>
                    <span className={statusClass(section.status)}>
                      {section.status || "UNKNOWN"}
                    </span>
                  </button>
                ))}
                {!sections.length && <div className="muted">No sections found.</div>}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Run Activity</h3>
            {loadingDashboard ? (
              <div className="skeleton-block" aria-busy="true" />
            ) : (
              dashboard && (
              <div className="pill-row">
                <span className="badge">Sections: {dashboard.sectionCount ?? 0}</span>
                <span className="badge">Exports: {dashboard.exportsCount ?? 0}</span>
                {dashboard.sectionStatusCounts &&
                  Object.entries(dashboard.sectionStatusCounts).map(([status, count]) => (
                    <span key={status} className={statusClass(status)}>
                      {status}: {count}
                    </span>
                  ))}
              </div>
            ))}

            <h4>Final Report</h4>
            {run?.final_report_json ? (
              <div className="code-block">{run.final_report_json}</div>
            ) : (
              <div className="muted">No final report yet.</div>
            )}

            <h4>Exports</h4>
            <div className="pill-row">
              <button type="button" onClick={() => requestExport("MARKDOWN")}>
                Export Markdown
              </button>
              <button type="button" className="secondary" onClick={() => requestExport("PDF")}>
                Export PDF
              </button>
              <button type="button" className="secondary" onClick={() => requestExport("DOCX")}>
                Export DOCX
              </button>
            </div>
            <div className="list">
              {loadingExports ? (
                skeletonRows.map((row) => (
                  <div className="list-item" key={`export-skeleton-${row}`}>
                    <div>
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                    <div className="skeleton-line" />
                  </div>
                ))
              ) : (
                <>
                  {exportsList.map((exportItem) => (
                    <div className="list-item" key={exportItem.id}>
                      <div>
                        <strong>{exportItem.format}</strong>
                        <div className="muted">{formatTimestamp(exportItem.created_at)}</div>
                      </div>
                      <div className="muted">{exportItem.file_path || "Pending..."}</div>
                    </div>
                  ))}
                  {!exportsList.length && <div className="muted">No exports yet.</div>}
                </>
              )}
            </div>

            <h4>Events</h4>
            <div className="list">
              {events
                .slice()
                .reverse()
                .map((event) => (
                  <div className="list-item" key={event.id}>
                    <div>
                      <strong>{event.type}</strong>
                      <div className="muted">{formatTimestamp(event.created_at)}</div>
                    </div>
                    <div className="muted">{renderContent(event.payload_json)}</div>
                  </div>
                ))}
              {!events.length && <div className="muted">Awaiting run events...</div>}
            </div>
          </div>

          <div className="card">
            <div className="split">
              <h3>Artifacts</h3>
              <Link className="link" href="/runs">
                Back to runs
              </Link>
            </div>
            {!selectedSectionId && <div className="muted">Select a section to view artifacts.</div>}
            {selectedSectionId && (
              <>
                <h4>Artifact Filters</h4>
                <div className="pill-row">
                  {filterOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={option === artifactFilter ? "" : "secondary"}
                      onClick={() => setArtifactFilter(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <h4>Evidence</h4>
                <div className="artifact-list">
                  {loadingArtifacts ? (
                    skeletonRows.map((row) => (
                      <div className="artifact-item" key={`evidence-skeleton-${row}`}>
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                      </div>
                    ))
                  ) : evidenceItems.length ? (
                    evidenceItems.map((item: any, index: number) => (
                      <div className="artifact-item" key={`${item.id || index}`}>
                        <div className="split">
                          <strong>{item.kind || "source"}</strong>
                          <span className="muted">{item.id}</span>
                        </div>
                        {item.metadata?.url && (
                          <div className="muted">URL: {item.metadata.url}</div>
                        )}
                        <div className="muted">{item.content || ""}</div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No evidence attached.</div>
                  )}
                </div>

                <h4>Artifacts List</h4>
                <div className="artifact-list">
                  {loadingArtifacts ? (
                    skeletonRows.map((row) => (
                      <div className="artifact-item" key={`artifact-skeleton-${row}`}>
                        <div className="skeleton-line" />
                        <div className="skeleton-block" />
                      </div>
                    ))
                  ) : (
                    <>
                      {filteredArtifacts.map((artifact) => (
                        <div className="artifact-item" key={artifact.id}>
                          <div className="split">
                            <strong>{artifact.type}</strong>
                            <span className="muted">{formatTimestamp(artifact.created_at)}</span>
                          </div>
                          {artifact.content_markdown && typeof artifact.content_markdown === "string" ? (
                            <div 
                              className="markdown-output"
                              dangerouslySetInnerHTML={{ 
                                __html: renderMarkdown(artifact.content_markdown) 
                              }}
                            />
                          ) : (
                            <div className="code-block">
                              {renderContent(artifact.content_markdown || artifact.content_json)}
                            </div>
                          )}
                        </div>
                      ))}
                      {!filteredArtifacts.length && (
                        <div className="muted">No artifacts captured yet.</div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
