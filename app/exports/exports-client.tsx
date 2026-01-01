"use client";

import { useCallback, useEffect, useState } from "react";

type Run = {
  id: string;
  status?: string;
  created_at?: string;
  template_version_snapshot_json?: { name?: string };
};

type RunExport = {
  id: string;
  report_run_id: string;
  format: string;
  file_path: string;
  created_at: string;
};

type ExportItem = {
  id: string;
  runId: string;
  format: string;
  createdAt: string;
  runName: string;
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ExportsClient() {
  const [items, setItems] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const runsRes = await fetch("/api/report-runs", { cache: "no-store" });
      if (!runsRes.ok) throw new Error("Failed to load runs");
      const runs = (await runsRes.json()) as Run[];
      const runList = Array.isArray(runs) ? runs : [];

      const exportsLists = await Promise.all(
        runList.map(async (run) => {
          const res = await fetch(`/api/report-runs/${run.id}/exports`, {
            cache: "no-store",
          });
          if (!res.ok) return [];
          const data = (await res.json()) as RunExport[];
          const list = Array.isArray(data) ? data : [];
          return list.map((exportItem) => ({
            id: String(exportItem.id),
            runId: String(run.id),
            format: String(exportItem.format || "MARKDOWN"),
            createdAt: String(exportItem.created_at || ""),
            runName: run.template_version_snapshot_json?.name || "Report Run",
          }));
        })
      );

      const merged = exportsLists.flat();
      merged.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      setItems(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExports();
  }, [loadExports]);

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Download Reports</h1>
          <p className="page-description">
            Access completed report exports and download past runs.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" type="button" onClick={loadExports}>
            Refresh
          </button>
        </div>
      </div>

      <div className="content-section">
        {loading && (
          <div className="card">
            <p>Loading exports...</p>
          </div>
        )}

        {error && (
          <div className="card error-card">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="card empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No exports yet</h3>
            <p>Generate a report run to see downloadable exports here.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="exports-grid">
            {items.map((item) => (
              <div key={item.id} className="card export-card">
                <div className="export-meta">
                  <span className="export-format">{item.format}</span>
                  <span className="export-date">{formatTimestamp(item.createdAt)}</span>
                </div>
                <h3>{item.runName}</h3>
                <div className="export-actions">
                  <a
                    className="button secondary"
                    href={`/api/report-runs/${item.runId}/exports/${item.id}`}
                  >
                    Download
                  </a>
                  <a className="button ghost" href={`/runs/${item.runId}`}>
                    View Run
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
