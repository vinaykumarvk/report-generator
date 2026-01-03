"use client";

import { useState, useCallback, useEffect } from "react";

type ExportFormat = "MARKDOWN" | "PDF";

interface ExportItem {
  id: string;
  format: ExportFormat;
  status?: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  created_at: string;
  error_message?: string | null;
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

async function triggerDownload(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
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
      if (res.ok) {
        const data = await res.json();
        setExports(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching exports:", error);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  // Fetch exports on mount
  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const getLatestExport = useCallback(
    (format: ExportFormat, status?: "READY") => {
      return exports
        .filter((exp) => exp.format === format && (!status || exp.status === status))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
    },
    [exports]
  );

  const requestExport = useCallback(
    async (format: ExportFormat) => {
      const statusKey = format;
      setExportingFormat(format);
      setStatusMessages((prev) => ({ ...prev, [statusKey]: "Preparing..." }));
      
      if (onExportStart) onExportStart(format);

      try {
        // Check for existing READY export
        await fetchExports();
        const existing = getLatestExport(format, "READY");
        
        if (existing) {
          // Download existing export
          try {
            await triggerDownload(
              `/api/report-runs/${runId}/exports/${existing.id}`,
              `${runId}.${formatExportExtension(format)}`
            );
            setStatusMessages((prev) => ({ ...prev, [statusKey]: "Downloaded" }));
            if (onExportComplete) onExportComplete(format, existing.id);
            setExportingFormat(null);
            return;
          } catch {
            // Fall through to create new export
          }
        }

        // Check for in-flight export
        const inFlight = exports.find(
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
                await triggerDownload(
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
    [runId, exports, getLatestExport, fetchExports, onExportStart, onExportComplete, onExportError]
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
    </div>
  );
}

