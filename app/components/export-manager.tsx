"use client";

import { useState, useCallback, useEffect } from "react";

type ExportFormat = "MARKDOWN" | "PDF";

interface ExportItem {
  id: string;
  format: ExportFormat;
  status?: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  created_at: string;
  error_message?: string | null;
  storage_url?: string | null;
}

interface ExportManagerProps {
  runId: string;
  variant?: "compact" | "full";
  formats?: ExportFormat[];
  onExportStart?: (format: ExportFormat) => void;
  onExportComplete?: (format: ExportFormat, exportId: string) => void;
  onExportError?: (format: ExportFormat, error: string) => void;
}

function formatExportExtension(format: ExportFormat): string {
  switch (format) {
    case "MARKDOWN":
      return "md";
    case "PDF":
      return "pdf";
    default:
      return "bin";
  }
}

function openExportLink(url: string, filename: string) {
  const opened = window.open(url, "_blank", "noopener");
  if (opened) {
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function selectLatestExport(
  exportsList: ExportItem[],
  format: ExportFormat,
  status?: "READY"
) {
  return exportsList
    .filter((exp) => exp.format === format && (!status || exp.status === status))
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
}

export default function ExportManager({
  runId,
  variant = "full",
  formats = ["MARKDOWN", "PDF"],
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportManagerProps) {
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});

  const fetchExports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report-runs/${runId}/exports`, {
        cache: "no-store",
      });
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      const exportsList = Array.isArray(data) ? data : [];
      setExports(exportsList);
      return exportsList;
    } catch (error) {
      console.error("Error fetching exports:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [runId]);

  // Fetch exports on mount
  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const requestExport = useCallback(
    async (format: ExportFormat) => {
      const statusKey = format;
      setExportingFormat(format);
      setStatusMessages((prev) => ({ ...prev, [statusKey]: "Preparing..." }));
      
      if (onExportStart) onExportStart(format);

      try {
        // Check for existing READY export
        const latestExports = await fetchExports();
        const existing = selectLatestExport(latestExports, format, "READY");
        
        if (existing) {
          // Download existing export
          openExportLink(
            `/api/report-runs/${runId}/exports/${existing.id}`,
            `${runId}.${formatExportExtension(format)}`
          );
          setStatusMessages((prev) => ({ ...prev, [statusKey]: "Downloaded" }));
          if (onExportComplete) onExportComplete(format, existing.id);
          setExportingFormat(null);
          return;
        }

        // Check for in-flight export
        const inFlight = latestExports.find(
          (exp) =>
            exp.format === format &&
            exp.status &&
            exp.status !== "READY" &&
            exp.status !== "FAILED"
        );

        let exportId = inFlight?.id;

        // Create new export if needed
        if (!exportId) {
          const res = await fetch(`/api/report-runs/${runId}/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format }),
            cache: "no-store",
          });

          if (!res.ok) throw new Error("Failed to request export");
          const data = await res.json();
          exportId = data.exportId;
          setStatusMessages((prev) => ({ ...prev, [statusKey]: "Generating..." }));
        }

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const res = await fetch(`/api/report-runs/${runId}/exports`, {
            cache: "no-store",
          });

          if (res.ok) {
            const exportsData = await res.json();
            setExports(exportsData);

            const completedExport = exportsData.find(
              (exp: ExportItem) => exp.id === exportId
            );

            if (completedExport?.status === "FAILED") {
              const errorMsg = completedExport.error_message || "Export failed";
              setStatusMessages((prev) => ({ ...prev, [statusKey]: errorMsg }));
              if (onExportError) onExportError(format, errorMsg);
              setExportingFormat(null);
              return;
            }

            if (completedExport?.status === "READY") {
              try {
                openExportLink(
                  `/api/report-runs/${runId}/exports/${completedExport.id}`,
                  `${runId}.${formatExportExtension(format)}`
                );
                setStatusMessages((prev) => ({ ...prev, [statusKey]: "Downloaded" }));
                if (onExportComplete) onExportComplete(format, completedExport.id);
              } catch {
                setStatusMessages((prev) => ({ ...prev, [statusKey]: "Download failed" }));
              }
              setExportingFormat(null);
              return;
            }
          }

          attempts++;
        }

        setStatusMessages((prev) => ({
          ...prev,
          [statusKey]: "Taking longer than expected...",
        }));
        await fetchExports();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Export failed";
        setStatusMessages((prev) => ({ ...prev, [statusKey]: errorMsg }));
        if (onExportError) onExportError(format, errorMsg);
      } finally {
        setExportingFormat(null);
      }
    },
    [runId, fetchExports, onExportStart, onExportComplete, onExportError]
  );

  const formatButtonLabel = (format: ExportFormat) => {
    if (variant === "compact") {
      switch (format) {
        case "MARKDOWN":
          return "Download .md";
        case "PDF":
          return "Download .pdf";
      }
    } else {
      if (exportingFormat === format) {
        return "Exporting...";
      }
      switch (format) {
        case "MARKDOWN":
          return "Export Markdown";
        case "PDF":
          return "Export PDF";
      }
    }
  };

  return (
    <div className="export-manager">
      {/* Export Actions */}
      <div className="exports-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {formats.map((format) => (
          <button
            key={format}
            type="button"
            className="button secondary"
            onClick={() => requestExport(format)}
            disabled={exportingFormat !== null}
          >
            {formatButtonLabel(format)}
          </button>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={fetchExports}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh exports"}
        </button>
      </div>

      {/* Status Messages */}
      {variant === "full" && exportingFormat && (
        <div className="muted" style={{ marginBottom: "1rem" }}>
          ⏳ Generating {exportingFormat} export... This may take a few seconds.
        </div>
      )}

      {variant === "compact" && (
        <div className="export-status" style={{ marginBottom: "0.5rem" }}>
          {formats.map((format) => {
            const msg = statusMessages[format];
            return msg ? (
              <span key={format} className="muted" style={{ display: "block", fontSize: "0.875rem" }}>
                .{formatExportExtension(format)}: {msg}
              </span>
            ) : null;
          })}
        </div>
      )}

      {variant === "full" && exports.length > 0 && (
        <div className="exports-list">
          {formats.map((format) => {
            const latestReady = selectLatestExport(exports, format, "READY");
            if (!latestReady) return null;
            return (
              <div key={format} className="export-item">
                <div className="export-item-meta">
                  <span className="badge">{format}</span>
                  <span className="muted">Ready</span>
                </div>
                <button
                  type="button"
                  className="export-link"
                  onClick={() =>
                    openExportLink(
                      `/api/report-runs/${runId}/exports/${latestReady.id}`,
                      `${runId}.${formatExportExtension(format)}`
                    )
                  }
                >
                  Open latest
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
