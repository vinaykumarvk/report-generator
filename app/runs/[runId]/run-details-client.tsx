"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";
import { AlertTriangle, BarChart, Check, Clipboard } from "lucide-react";
import ExportManager from "../../components/export-manager";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  final_report_json?: {
    content: string;
    sections: Array<{ id: string; title: string; content: string }>;
  } | null;
  template_version_snapshot_json?: { name?: string };
  blueprint_json?: {
    technical?: unknown;
    cohesion?: {
      narrativeArc?: string;
      keyTerminology?: string[];
      tone?: {
        formality?: number;
        perspective?: string;
        sentenceStructure?: string;
      };
      keyClaims?: Record<string, string[]>;
      crossReferences?: Record<string, string[]>;
      factualAnchors?: Array<{
        id: string;
        value: string;
        usedIn: string[];
      }>;
      prohibitions?: string[];
    };
  };
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

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatShortTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [loadingRun, setLoadingRun] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryInstructions, setRetryInstructions] = useState<Record<string, string>>({});
  const [retryingSection, setRetryingSection] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    finalReport: true,
    sections: true,
    exports: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      
      setRetryInstructions((prev) => ({ ...prev, [sectionRunId]: "" }));
      
      // Immediately reload to show QUEUED status
      await loadRun();
      
      alert("Section queued for regeneration! Status will auto-refresh.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to retry section");
    } finally {
      setRetryingSection(null);
    }
  }

  async function refreshStatus() {
    setIsRefreshing(true);
    await loadRun();
    setIsRefreshing(false);
  }

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (!selectedSectionId) return;
    loadArtifacts(selectedSectionId);
  }, [loadArtifacts, selectedSectionId]);

  // Auto-refresh when sections are QUEUED or RUNNING
  useEffect(() => {
    const hasActiveSections = sections.some(
      (s) => s.status === "QUEUED" || s.status === "RUNNING"
    );
    
    if (!hasActiveSections) return;
    
    const interval = setInterval(() => {
      loadRun();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [sections, loadRun]);

  const finalArtifact = useMemo(() => {
    return artifacts.find((item) => item.type === "FINAL");
  }, [artifacts]);

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
              <div className="empty-state-icon"><AlertTriangle size={48} /></div>
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

        {/* Blueprint Details */}
        {run?.blueprint_json?.cohesion && (
          <div className="card">
            <h2><Clipboard className="inline-icon" size={20} /> Report Blueprint</h2>
            <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
              Cohesion guidelines that ensure consistency across all sections
            </p>
            
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {/* Narrative Arc */}
              {run.blueprint_json.cohesion.narrativeArc && (
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-accent)" }}>
                    📖 Narrative Arc
                  </h3>
                  <p style={{ margin: 0, lineHeight: "1.6" }}>
                    {run.blueprint_json.cohesion.narrativeArc}
                  </p>
                </div>
              )}

              {/* Key Terminology */}
              {run.blueprint_json.cohesion.keyTerminology && run.blueprint_json.cohesion.keyTerminology.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-accent)" }}>
                    🔤 Key Terminology
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {run.blueprint_json.cohesion.keyTerminology.map((term, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: "var(--color-accent-light)",
                          borderRadius: "1rem",
                          fontSize: "0.875rem"
                        }}
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tone & Style */}
              {run.blueprint_json.cohesion.tone && (
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-accent)" }}>
                    🎨 Tone & Style
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
                    {run.blueprint_json.cohesion.tone.formality && (
                      <div>
                        <div className="muted" style={{ fontSize: "0.875rem" }}>Formality</div>
                        <div style={{ fontWeight: 600 }}>
                          {run.blueprint_json.cohesion.tone.formality}/5
                        </div>
                      </div>
                    )}
                    {run.blueprint_json.cohesion.tone.perspective && (
                      <div>
                        <div className="muted" style={{ fontSize: "0.875rem" }}>Perspective</div>
                        <div style={{ fontWeight: 600 }}>
                          {run.blueprint_json.cohesion.tone.perspective}
                        </div>
                      </div>
                    )}
                    {run.blueprint_json.cohesion.tone.sentenceStructure && (
                      <div>
                        <div className="muted" style={{ fontSize: "0.875rem" }}>Structure</div>
                        <div style={{ fontWeight: 600 }}>
                          {run.blueprint_json.cohesion.tone.sentenceStructure}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Factual Anchors */}
              {run.blueprint_json.cohesion.factualAnchors && run.blueprint_json.cohesion.factualAnchors.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-accent)" }}>
                    <BarChart className="inline-icon" size={18} /> Factual Anchors
                  </h3>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {run.blueprint_json.cohesion.factualAnchors.map((anchor, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "0.75rem",
                          background: "var(--color-background-secondary)",
                          borderRadius: "0.5rem",
                          borderLeft: "3px solid var(--color-accent)"
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                          {anchor.id}: {anchor.value}
                        </div>
                        <div className="muted" style={{ fontSize: "0.875rem" }}>
                          Used in: {anchor.usedIn.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prohibitions */}
              {run.blueprint_json.cohesion.prohibitions && run.blueprint_json.cohesion.prohibitions.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-accent)" }}>
                    🚫 Prohibitions
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: "1.8" }}>
                    {run.blueprint_json.cohesion.prohibitions.map((prohibition, i) => (
                      <li key={i}>{prohibition}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Phase 1 Progress Indicator */}
        {run && (run.status === "RUNNING" || run.status === "COMPLETED") && (
          <div className="card">
            <h2>⚙️ Generation Progress</h2>
            <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
              {/* Blueprint */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "50%",
                  background: run.blueprint_json ? "var(--color-success)" : "var(--color-accent-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: run.blueprint_json ? "white" : "var(--color-accent)"
                }}>
                  {run.blueprint_json ? <Check size={16} /> : "1"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Blueprint Generation</div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {run.blueprint_json ? <><Check size={14} className="inline-icon" /> Complete</> : "In progress..."}
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "50%",
                  background: sections.every(s => s.title?.toLowerCase().includes("executive summary") || s.status === "COMPLETED") 
                    ? "var(--color-success)" 
                    : sections.some(s => !s.title?.toLowerCase().includes("executive summary") && (s.status === "QUEUED" || s.status === "RUNNING"))
                    ? "var(--color-accent)"
                    : "var(--color-accent-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: sections.every(s => s.title?.toLowerCase().includes("executive summary") || s.status === "COMPLETED") ? "white" : "var(--color-accent)"
                }}>
                  {sections.every(s => s.title?.toLowerCase().includes("executive summary") || s.status === "COMPLETED") ? <Check size={16} /> : "2"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Section Generation</div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {sections.filter(s => !s.title?.toLowerCase().includes("executive summary") && s.status === "COMPLETED").length} / {sections.filter(s => !s.title?.toLowerCase().includes("executive summary")).length} sections complete
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "50%",
                  background: sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "COMPLETED"
                    ? "var(--color-success)"
                    : sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "RUNNING"
                    ? "var(--color-accent)"
                    : "var(--color-accent-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "COMPLETED" ? "white" : "var(--color-accent)"
                }}>
                  {sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "COMPLETED" ? <Check size={16} /> : "4"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Executive Summary Generation</div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "COMPLETED"
                      ? <><Check size={14} className="inline-icon" /> Complete</>
                      : sections.find(s => s.title?.toLowerCase().includes("executive summary"))?.status === "RUNNING"
                      ? "In progress..."
                      : sections.every(s => s.title?.toLowerCase().includes("executive summary") || s.status === "COMPLETED")
                      ? "In progress..."
                      : "Waiting for sections..."}
                  </div>
                </div>
              </div>

              {/* Assembly */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "50%",
                  background: run.final_report_json ? "var(--color-success)" : "var(--color-accent-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: run.final_report_json ? "white" : "var(--color-accent)"
                }}>
                  {run.final_report_json ? <Check size={16} /> : "5"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Final Assembly</div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {run.final_report_json 
                      ? <><Check size={14} className="inline-icon" /> Complete</>
                      : sections.every(s => s.status === "COMPLETED")
                      ? "In progress..."
                      : "Waiting for all sections..."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Final Report */}
        <div className="card">
          <div 
            onClick={() => toggleSection('finalReport')}
            style={{ 
              display: "flex", 
              justifyContent: "flex-start", 
              alignItems: "center",
              gap: "0.75rem",
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
              {expandedSections.finalReport ? "−" : "+"}
            </span>
            <h2 style={{ margin: 0 }}>Final Report</h2>
          </div>
          {expandedSections.finalReport && (
            <div style={{ marginTop: "1rem" }}>
              {run?.final_report_json?.content ? (
                <div 
                  className="markdown-output"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(run.final_report_json.content) }}
                />
              ) : (
                <div className="muted">No final report available yet. Report is still being generated or has not started.</div>
              )}
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expandedSections.sections ? "1rem" : 0 }}>
            <div 
              onClick={() => toggleSection('sections')}
              style={{ 
                flex: 1,
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
                  {expandedSections.sections ? "−" : "+"}
                </span>
                <h2 style={{ margin: 0 }}>Sections</h2>
              </div>
              {expandedSections.sections && (
                <p className="muted" style={{ margin: "0.25rem 0 0 0" }}>
                  Click a section to view its output and regenerate if needed.
                  {sections.some((s) => s.status === "QUEUED" || s.status === "RUNNING") && (
                    <span style={{ marginLeft: "0.5rem", color: "var(--color-accent)" }}>
                      • Auto-refreshing every 5s
                    </span>
                  )}
                </p>
              )}
            </div>
            {expandedSections.sections && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshStatus();
                }}
                disabled={isRefreshing}
                className="secondary"
                style={{ minWidth: "120px" }}
              >
                {isRefreshing ? "Refreshing..." : "🔄 Refresh Status"}
              </button>
            )}
          </div>
          {expandedSections.sections && (
            <>
              {loadingRun ? (
                <div className="section-list" aria-busy="true">
                  {[0, 1, 2].map((row) => (
                    <div className="section-card" key={`section-skeleton-${row}`}>
                      <div>
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                      </div>
                      <div className="skeleton-line" />
                    </div>
                  ))}
                </div>
              ) : (
            <div className="section-list">
              {sections.map((section) => {
                const isSelected = selectedSectionId === section.id;
                const instructions = retryInstructions[section.id] || "";
                const shortSectionId = section.id.slice(0, 8);
                const shortTemplateId = section.template_section_id?.slice(0, 8);
                
                return (
                  <div key={section.id} className={`section-card ${isSelected ? "selected" : ""}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSectionId((current) => (current === section.id ? null : section.id))
                      }
                      className="section-card-header"
                    >
                      <div>
                        <div className="section-card-title">
                          {section.title || "Untitled Section"}
                        </div>
                        <div className="section-card-meta">
                          <span className="section-card-meta-item" title={section.id}>
                            ID {shortSectionId}
                          </span>
                          {shortTemplateId && (
                            <span className="section-card-meta-item" title={section.template_section_id}>
                              Template {shortTemplateId}
                            </span>
                          )}
                          {section.created_at && (
                            <span className="section-card-meta-item">
                              Created {formatShortTimestamp(section.created_at)}
                            </span>
                          )}
                          {section.timings_json?.durationSeconds && (
                            <span className="section-card-meta-item">
                              Duration {formatDuration(section.timings_json.durationSeconds)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={statusClass(section.status)}>
                        {section.status || "UNKNOWN"}
                      </span>
                    </button>

                    {isSelected && (
                      <div className="section-card-body">
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
            </>
          )}
        </div>

        {/* Exports */}
        <div className="card">
          <div 
            onClick={() => toggleSection('exports')}
            style={{ 
              display: "flex", 
              justifyContent: "flex-start", 
              alignItems: "center",
              gap: "0.75rem",
              cursor: "pointer",
              userSelect: "none",
              marginBottom: expandedSections.exports ? "1rem" : 0
            }}
          >
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
              {expandedSections.exports ? "−" : "+"}
            </span>
            <h2 style={{ margin: 0 }}>Exports</h2>
          </div>
          {expandedSections.exports && (
            <ExportManager
              runId={runId}
              variant="full"
              formats={["MARKDOWN", "PDF"]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
