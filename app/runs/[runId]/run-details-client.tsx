"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  timings_json?: {
    startTime?: string;
    endTime?: string;
    durationMs?: number;
    durationSeconds?: number;
  };
};

type Artifact = {
  id: string;
  type: string;
  content_json?: unknown;
  content_markdown?: string | null;
  created_at?: string;
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

function formatDuration(durationSeconds?: number) {
  if (!durationSeconds) return "";
  if (durationSeconds < 60) return `${durationSeconds}s`;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function renderMarkdown(markdown: string) {
  if (!markdown) return "";
  
  marked.setOptions({
    breaks: true,
    gfm: true,
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
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [exportsList, setExportsList] = useState<RunExport[]>([]);
  const [loadingRun, setLoadingRun] = useState(true);
  const [loadingExports, setLoadingExports] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryInstructions, setRetryInstructions] = useState<Record<string, string>>({});
  const [retryingSection, setRetryingSection] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
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
  }, [runId, selectedSectionId]);

  const loadExports = useCallback(async () => {
    setLoadingExports(true);
    const res = await fetch(`/api/report-runs/${runId}/exports`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setExportsList(Array.isArray(data) ? data : []);
    }
    setLoadingExports(false);
  }, [runId]);

  const loadArtifacts = useCallback(async (sectionRunId: string) => {
    setLoadingArtifacts(true);
    const res = await fetch(`/api/section-runs/${sectionRunId}/artifacts`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setArtifacts(Array.isArray(data) ? data : []);
    }
    setLoadingArtifacts(false);
  }, []);

  async function requestExport(format: string) {
    setExportingFormat(format);
    
    try {
      const res = await fetch(`/api/report-runs/${runId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      
      if (!res.ok) {
        alert("Failed to start export");
        return;
      }
      
      // Poll for export completion
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const exportsRes = await fetch(`/api/report-runs/${runId}/exports`, {
          cache: "no-store",
        });
        
        if (exportsRes.ok) {
          const exports = await exportsRes.json();
          setExportsList(Array.isArray(exports) ? exports : []);
          
          const completedExport = exports.find((exp: any) => 
            exp.format === format &&
            exp.created_at && 
            new Date(exp.created_at).getTime() > Date.now() - 120000
          );
          
          if (completedExport) {
            const downloadUrl = `/api/report-runs/${runId}/exports/${completedExport.id}`;
            window.open(downloadUrl, '_blank');
            setExportingFormat(null);
            await loadExports();
            return;
          }
        }
        
        attempts++;
      }
      
      alert("Export is taking longer than expected. Check the Exports section below.");
      await loadExports();
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExportingFormat(null);
    }
  }

  async function retrySection(sectionRunId: string) {
    const instructions = retryInstructions[sectionRunId] || "";
    
    if (!instructions.trim()) {
      alert("Please provide instructions for regenerating this section.");
      return;
    }

    setRetryingSection(sectionRunId);
    
    try {
      const res = await fetch(`/api/section-runs/${sectionRunId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          additionalInstructions: instructions.trim() 
        }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to retry section");
      }
      
      alert("Section queued for regeneration!");
      setRetryInstructions((prev) => ({ ...prev, [sectionRunId]: "" }));
      
      // Reload run to see updated status
      setTimeout(() => {
        loadRun();
      }, 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to retry section");
    } finally {
      setRetryingSection(null);
    }
  }

  useEffect(() => {
    loadRun();
    loadExports();
  }, [loadExports, loadRun]);

  useEffect(() => {
    if (!selectedSectionId) return;
    loadArtifacts(selectedSectionId);
  }, [loadArtifacts, selectedSectionId]);

  const finalArtifact = useMemo(() => {
    return artifacts.find((item) => item.type === "FINAL");
  }, [artifacts]);

  const selectedSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId);
  }, [sections, selectedSectionId]);

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
        {error && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Run Summary */}
        <div className="card">
          <h2>Run Summary</h2>
          {loadingRun ? (
            <>
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
            </>
          ) : run ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <strong style={{ fontSize: "1.25rem" }}>{run.template_version_snapshot_json?.name || "Untitled Template"}</strong>
                <span className={statusClass(run.status)}>{run.status || "UNKNOWN"}</span>
              </div>
              <div className="run-meta">
                <div className="run-meta-item">
                  <span className="run-meta-label">Created</span>
                  <span className="run-meta-value">{formatTimestamp(run.created_at)}</span>
                </div>
                <div className="run-meta-item">
                  <span className="run-meta-label">Started</span>
                  <span className="run-meta-value">{formatTimestamp(run.started_at)}</span>
                </div>
                <div className="run-meta-item">
                  <span className="run-meta-label">Completed</span>
                  <span className="run-meta-value">{formatTimestamp(run.completed_at)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="muted">Loading run...</div>
          )}
        </div>

        {/* Final Report */}
        <div className="card">
          <h2>Final Report</h2>
          {run?.final_report_json ? (
            <div 
              className="markdown-output"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(run.final_report_json) }}
            />
          ) : (
            <div className="muted">No final report available yet. Report is still being generated or hasn't started.</div>
          )}
        </div>

        {/* Sections */}
        <div className="card">
          <h2>Sections</h2>
          <p className="muted">Click a section to view its output and regenerate if needed.</p>
          {loadingRun ? (
            <div className="list" aria-busy="true">
              {[0, 1, 2].map((row) => (
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
              {sections.map((section) => {
                const isSelected = selectedSectionId === section.id;
                const instructions = retryInstructions[section.id] || "";
                
                return (
                  <div key={section.id} className="list-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSectionId(section.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        background: isSelected ? "var(--color-accent-light)" : "transparent",
                        border: "none",
                        padding: "1rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <strong>{section.title || "Untitled Section"}</strong>
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          {section.timings_json?.durationSeconds && (
                            <span>⏱️ {formatDuration(section.timings_json.durationSeconds)} • </span>
                          )}
                          {section.id}
                        </div>
                      </div>
                      <span className={statusClass(section.status)}>
                        {section.status || "UNKNOWN"}
                      </span>
                    </button>

                    {isSelected && (
                      <div style={{ padding: "1rem", borderTop: "1px solid var(--color-border)" }}>
                        <h4>Section Output</h4>
                        {loadingArtifacts ? (
                          <div className="skeleton-block" aria-busy="true" />
                        ) : finalArtifact?.content_markdown ? (
                          <div 
                            className="markdown-output"
                            dangerouslySetInnerHTML={{ 
                              __html: renderMarkdown(finalArtifact.content_markdown) 
                            }}
                          />
                        ) : (
                          <div className="muted">
                            {section.status === "FAILED" 
                              ? "Section failed to generate. Use the regenerate option below to try again." 
                              : "No output available yet."}
                          </div>
                        )}

                        {(section.status === "COMPLETED" || section.status === "FAILED") && (
                          <>
                            <h4 style={{ marginTop: "2rem" }}>Regenerate Section</h4>
                            <p className="muted">
                              {section.status === "FAILED" 
                                ? "This section failed. Provide instructions to regenerate it (e.g., simplify requirements, use different approach)."
                                : "Provide additional instructions to regenerate this section with different guidance."}
                            </p>
                            <textarea
                              value={instructions}
                              onChange={(e) => setRetryInstructions((prev) => ({ ...prev, [section.id]: e.target.value }))}
                              placeholder="e.g., Focus more on financial metrics, add more recent data, simplify the language..."
                              rows={3}
                              style={{ width: "100%", marginTop: "0.5rem" }}
                            />
                            <button
                              type="button"
                              onClick={() => retrySection(section.id)}
                              disabled={!instructions.trim() || retryingSection === section.id}
                              style={{ marginTop: "0.5rem" }}
                            >
                              {retryingSection === section.id ? "Regenerating..." : "Regenerate Section"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!sections.length && <div className="muted">No sections found.</div>}
            </div>
          )}
        </div>

        {/* Exports */}
        <div className="card">
          <h2>Exports</h2>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button 
              type="button" 
              onClick={() => requestExport("MARKDOWN")}
              disabled={exportingFormat !== null}
            >
              {exportingFormat === "MARKDOWN" ? "Exporting..." : "Export Markdown"}
            </button>
            <button 
              type="button" 
              className="secondary" 
              onClick={() => requestExport("PDF")}
              disabled={exportingFormat !== null}
            >
              {exportingFormat === "PDF" ? "Exporting..." : "Export PDF"}
            </button>
            <button 
              type="button" 
              className="secondary" 
              onClick={() => requestExport("DOCX")}
              disabled={exportingFormat !== null}
            >
              {exportingFormat === "DOCX" ? "Exporting..." : "Export DOCX"}
            </button>
          </div>
          {exportingFormat && (
            <div className="muted" style={{ marginBottom: "1rem" }}>
              ⏳ Generating {exportingFormat} export... This may take a few seconds.
            </div>
          )}
          
          <h4>Export History</h4>
          <div className="list">
            {loadingExports ? (
              [0, 1, 2].map((row) => (
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
                    <div>
                      <a 
                        href={`/api/report-runs/${runId}/exports/${exportItem.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
                {!exportsList.length && <div className="muted">No exports yet.</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
