"use client";

import { useEffect, useMemo, useState } from "react";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  template_version_snapshot_json?: { name?: string };
};

type SectionRun = {
  id: string;
  title?: string;
  status?: string;
};

type Artifact = {
  id: string;
  type: string;
  content_json?: unknown;
  content_markdown?: string | null;
  created_at?: string;
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderContent(content: unknown) {
  if (content === null || content === undefined) return "—";
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 2);
}

export default function EvidenceViewerClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<string>("");
  const [sections, setSections] = useState<SectionRun[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const skeletonRows = [0, 1, 2];

  async function loadRuns() {
    setLoadingRuns(true);
    const res = await fetch("/api/report-runs", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRuns(list);
      if (!runId && list[0]) {
        setRunId(list[0].id);
      }
    }
    setLoadingRuns(false);
  }

  async function loadSections(activeRunId: string) {
    if (!activeRunId) return;
    setLoadingSections(true);
    const res = await fetch(`/api/report-runs/${activeRunId}/sections`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setSections(Array.isArray(data) ? data : []);
      if (!sectionId && Array.isArray(data) && data[0]) {
        setSectionId(data[0].id);
      }
    }
    setLoadingSections(false);
  }

  async function loadArtifacts(activeSectionId: string) {
    if (!activeSectionId) return;
    setLoadingArtifacts(true);
    const res = await fetch(`/api/section-runs/${activeSectionId}/artifacts`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setArtifacts([]);
      setLoadingArtifacts(false);
      return;
    }
    const data = await res.json();
    setArtifacts(Array.isArray(data) ? data : []);
    setLoadingArtifacts(false);
  }

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (runId) {
      loadSections(runId);
    }
  }, [runId]);

  useEffect(() => {
    if (sectionId) {
      loadArtifacts(sectionId);
    }
  }, [sectionId]);

  const evidenceItems = useMemo(() => {
    const evidence = artifacts.find((item) => item.type === "EVIDENCE");
    if (!evidence?.content_json) return [];
    return Array.isArray(evidence.content_json) ? evidence.content_json : [];
  }, [artifacts]);

  const provenanceItems = useMemo(() => {
    const provenance = artifacts.find((item) => item.type === "PROVENANCE");
    if (!provenance?.content_json) return [];
    return Array.isArray(provenance.content_json) ? provenance.content_json : [];
  }, [artifacts]);

  const claimsItems = useMemo(() => {
    const claims = artifacts.find((item) => item.type === "CLAIMS");
    if (!claims?.content_json) return [];
    return Array.isArray(claims.content_json) ? claims.content_json : [];
  }, [artifacts]);

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Evidence Viewer</h1>
          <p className="page-description">Inspect evidence, claims, and provenance.</p>
        </div>
      </div>
      <main className="grid-2">
        <section className="card">
          <h2>Select Run</h2>
          <label htmlFor="run-select">Run</label>
          <select
            id="run-select"
            value={runId}
            onChange={(event) => {
              setRunId(event.target.value);
              setSectionId("");
              setArtifacts([]);
            }}
          >
            {loadingRuns ? (
              <option value="">Loading runs...</option>
            ) : (
              runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.template_version_snapshot_json?.name || "Run"} · {run.status}
                </option>
              ))
            )}
          </select>
          <label htmlFor="section-select">Section</label>
          <select
            id="section-select"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            {loadingSections ? (
              <option value="">Loading sections...</option>
            ) : (
              sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title || "Section"} · {section.status}
                </option>
              ))
            )}
          </select>
          {error && <div className="muted">{error}</div>}
          <div className="list">
            {loadingSections
              ? skeletonRows.map((row) => (
                  <div className="list-item" key={`section-skeleton-${row}`}>
                    <div>
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                    <div className="skeleton-line" />
                  </div>
                ))
              : sections.map((section) => (
                  <div className="list-item" key={section.id}>
                    <div>
                      <strong>{section.title || "Untitled"}</strong>
                      <div className="muted">{section.status}</div>
                    </div>
                    <div className="muted">{section.id}</div>
                  </div>
                ))}
          </div>
        </section>

        <section className="card">
          <h2>Evidence Bundle</h2>
          {!sectionId ? (
            <div className="muted">Select a section to view evidence.</div>
          ) : (
            <>
              <h3>Evidence Items</h3>
              <div className="list">
                {loadingArtifacts ? (
                  skeletonRows.map((row) => (
                    <div className="list-item" key={`evidence-skeleton-${row}`}>
                      <div>
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                      </div>
                      <div className="skeleton-line" />
                    </div>
                  ))
                ) : evidenceItems.length ? (
                  evidenceItems.map((item: any, index: number) => (
                    <div className="list-item" key={`${item.id || index}`}>
                      <div>
                        <strong>{item.kind || "source"}</strong>
                        <div className="muted">{item.metadata?.url || "local"}</div>
                      </div>
                      <div className="muted">{item.id || index}</div>
                    </div>
                  ))
                ) : (
                  <div className="muted">No evidence items.</div>
                )}
              </div>

              <h3>Claims</h3>
              <div className="code-block">{renderContent(claimsItems)}</div>

              <h3>Provenance</h3>
              <div className="code-block">{renderContent(provenanceItems)}</div>

              <h3>All Artifacts</h3>
              <div className="list">
                {loadingArtifacts ? (
                  skeletonRows.map((row) => (
                    <div className="list-item" key={`artifact-skeleton-${row}`}>
                      <div>
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                      </div>
                      <div className="skeleton-line" />
                    </div>
                  ))
                ) : (
                  <>
                    {artifacts.map((artifact) => (
                      <div className="list-item" key={artifact.id}>
                        <div>
                          <strong>{artifact.type}</strong>
                          <div className="muted">
                            {formatTimestamp(artifact.created_at)}
                          </div>
                        </div>
                        <div className="muted">{artifact.id}</div>
                      </div>
                    ))}
                    {!artifacts.length && (
                      <div className="muted">No artifacts for this section yet.</div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
