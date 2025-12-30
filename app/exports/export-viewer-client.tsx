"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  template_version_snapshot_json?: { name?: string };
};

type ExportRecord = {
  id: string;
  format: string;
  file_path?: string;
  created_at?: string;
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ExportViewerClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<string>("");
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingExports, setLoadingExports] = useState(true);
  const errorId = "export-error";
  const statusId = "export-status";
  const skeletonRows = [0, 1, 2];

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    const res = await fetch("/api/report-runs", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRuns(list);
      if (!runId && list[0]) setRunId(list[0].id);
    }
    setLoadingRuns(false);
  }, [runId]);

  const loadExports = useCallback(async (activeRunId: string) => {
    if (!activeRunId) return;
    setLoadingExports(true);
    const res = await fetch(`/api/report-runs/${activeRunId}/exports`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setExportsList(Array.isArray(data) ? data : []);
    }
    setLoadingExports(false);
  }, []);

  async function requestExport(format: string) {
    if (!runId) return;
    setStatus(null);
    setError(null);
    const res = await fetch(`/api/report-runs/${runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to enqueue export");
      return;
    }
    setStatus(`${format} export queued.`);
    await loadExports(runId);
  }

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (runId) {
      loadExports(runId);
    }
  }, [loadExports, runId]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === runId) || null,
    [runs, runId]
  );

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Export Viewer</h1>
          <p className="page-description">Queue and download run exports.</p>
        </div>
      </div>
      <main className="grid-2">
        <section className="card">
          <h2>Select Run</h2>
          <label htmlFor="export-run">Run</label>
          <select
            id="export-run"
            value={runId}
            onChange={(event) => {
              setRunId(event.target.value);
              setExportsList([]);
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
          {selectedRun && (
            <div className="muted">
              Run created: {formatTimestamp(selectedRun.created_at)}
            </div>
          )}
          <div className="actions">
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
          {status && (
            <div className="muted" id={statusId} aria-live="polite">
              {status}
            </div>
          )}
          {error && (
            <div className="muted" id={errorId} role="alert">
              {error}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Exports</h2>
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
                    <div className="actions">
                      <a
                        className="badge"
                        href={`/api/report-runs/${runId}/exports/${exportItem.id}`}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
                {!exportsList.length && (
                  <div className="muted">No exports found for this run.</div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
