"use client";

import { useState, useEffect } from "react";
import "./source-inheritance.css";

interface Source {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface SourceInheritanceProps {
  templateId: string;
  sectionId: string;
  defaultSourceIds: string[];
  currentPolicy: {
    mode?: "INHERIT" | "OVERRIDE";
    connectorIds?: string[];
  } | null;
  onSave: (policy: { mode: "INHERIT" | "OVERRIDE"; connectorIds?: string[] }) => Promise<void>;
}

export default function SourceInheritance({
  templateId,
  sectionId,
  defaultSourceIds,
  currentPolicy,
  onSave,
}: SourceInheritanceProps) {
  const [mode, setMode] = useState<"INHERIT" | "OVERRIDE">(
    currentPolicy?.mode || "INHERIT"
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    currentPolicy?.connectorIds || []
  );
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const response = await fetch("/api/connectors");
      const data = await response.json();
      setAvailableSources(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load sources:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const policy = {
        mode,
        connectorIds: mode === "OVERRIDE" ? selectedSourceIds : undefined,
      };
      await onSave(policy);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleSourceSelection(sourceId: string) {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  }

  const defaultSources = availableSources.filter((s) =>
    defaultSourceIds.includes(s.id)
  );
  const hasChanges =
    mode !== (currentPolicy?.mode || "INHERIT") ||
    (mode === "OVERRIDE" &&
      JSON.stringify(selectedSourceIds.sort()) !==
        JSON.stringify((currentPolicy?.connectorIds || []).sort()));

  return (
    <div className="source-inheritance-container">
      <h4>Source Configuration</h4>
      <p className="muted">
        Choose how this section accesses data sources
      </p>

      {/* Mode Selection */}
      <div className="mode-selection">
        <label className="mode-option">
          <input
            type="radio"
            name="source-mode"
            value="INHERIT"
            checked={mode === "INHERIT"}
            onChange={() => setMode("INHERIT")}
          />
          <div className="mode-details">
            <strong>Inherit from Template</strong>
            <p>Use the template&apos;s default sources ({defaultSourceIds.length})</p>
          </div>
        </label>

        <label className="mode-option">
          <input
            type="radio"
            name="source-mode"
            value="OVERRIDE"
            checked={mode === "OVERRIDE"}
            onChange={() => setMode("OVERRIDE")}
          />
          <div className="mode-details">
            <strong>Override with Custom Sources</strong>
            <p>Select specific sources for this section only</p>
          </div>
        </label>
      </div>

      {/* Show inherited sources */}
      {mode === "INHERIT" && defaultSources.length > 0 && (
        <div className="inherited-sources">
          <h5>Inherited Sources:</h5>
          <div className="source-list">
            {defaultSources.map((source) => (
              <div key={source.id} className="source-chip inherited">
                <span className="source-icon">🔌</span>
                <span className="source-name">{source.name}</span>
                <span className="source-type">{source.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show custom source selection */}
      {mode === "OVERRIDE" && (
        <div className="custom-sources">
          <h5>Select Custom Sources:</h5>
          {loading ? (
            <p className="muted">Loading sources...</p>
          ) : availableSources.length === 0 ? (
            <p className="muted">
              No sources available. Create sources in the Sources page.
            </p>
          ) : (
            <div className="source-grid">
              {availableSources.map((source) => {
                const isSelected = selectedSourceIds.includes(source.id);
                return (
                  <label
                    key={source.id}
                    className={`source-card ${isSelected ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSourceSelection(source.id)}
                    />
                    <div className="source-card-content">
                      <strong>{source.name}</strong>
                      <span className="source-type-badge">{source.type}</span>
                      {source.description && (
                        <p className="source-description">{source.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {selectedSourceIds.length > 0 && (
            <p className="selection-count">
              {selectedSourceIds.length} source(s) selected
            </p>
          )}
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="save-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || (mode === "OVERRIDE" && selectedSourceIds.length === 0)}
          >
            {saving ? "Saving..." : "Save Source Configuration"}
          </button>
        </div>
      )}
    </div>
  );
}
