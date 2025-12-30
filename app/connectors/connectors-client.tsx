"use client";

import { useEffect, useMemo, useState } from "react";

type Connector = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  tags?: string[] | null;
  config_json?: Record<string, unknown> | null;
  created_at?: string;
};

type ConnectorForm = {
  name: string;
  type: string;
  description: string;
  tags: string;
  configJson: string;
};

const DEFAULT_FORM: ConnectorForm = {
  name: "",
  type: "VECTOR",
  description: "",
  tags: "",
  configJson: "{}",
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ConnectorsClient() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectorForm>({ ...DEFAULT_FORM });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; configJson?: string }>({});
  const errorId = "connector-error";
  const statusId = "connector-status";

  const selected = useMemo(
    () => connectors.find((item) => item.id === selectedId) || null,
    [connectors, selectedId]
  );

  async function loadConnectors() {
    const res = await fetch("/api/connectors", { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load connectors");
      return;
    }
    const data = await res.json();
    setConnectors(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadConnectors();
  }, []);

  useEffect(() => {
    if (!selected) {
      setForm({ ...DEFAULT_FORM });
      return;
    }
    setForm({
      name: selected.name || "",
      type: selected.type || "VECTOR",
      description: selected.description || "",
      tags: (selected.tags || []).join(", "),
      configJson: JSON.stringify(selected.config_json || {}, null, 2),
    });
  }, [selected]);

  function updateForm(key: keyof ConnectorForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveConnector() {
    setError(null);
    setStatus(null);
    setFieldErrors({});
    let configJson: Record<string, unknown> = {};
    try {
      configJson = form.configJson ? JSON.parse(form.configJson) : {};
    } catch (err) {
      setFieldErrors({ configJson: "Config JSON must be valid JSON." });
      return;
    }
    if (!form.name.trim()) {
      setFieldErrors({ name: "Name is required." });
      return;
    }

    const payload = {
      name: form.name,
      type: form.type,
      description: form.description,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      configJson,
    };

    const res = await fetch(
      selectedId ? `/api/connectors/${selectedId}` : "/api/connectors",
      {
        method: selectedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save connector");
      return;
    }
    setStatus(selectedId ? "Source updated." : "Source created.");
    await loadConnectors();
  }

  async function deleteConnector() {
    if (!selectedId) return;
    if (!window.confirm("Delete this connector? This cannot be undone.")) {
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/connectors/${selectedId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete connector");
      return;
    }
    setSelectedId(null);
    setStatus("Source deleted.");
    await loadConnectors();
  }

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Sources</h1>
          <p className="page-description">Manage vector and web search connectors.</p>
        </div>
      </div>
      <main className="grid-2">
        <section className="card">
          <h2>Source List</h2>
          <div className="list">
            {connectors.map((connector) => (
              <button
                type="button"
                key={connector.id}
                className={`list-item ${selectedId === connector.id ? "active" : ""}`}
                onClick={() => setSelectedId(connector.id)}
              >
                <div>
                  <strong>{connector.name}</strong>
                  <div className="muted">{connector.type}</div>
                  <div className="muted">{connector.id}</div>
                </div>
                <div className="muted">{formatTimestamp(connector.created_at)}</div>
              </button>
            ))}
            {!connectors.length && (
              <div className="muted">No connectors created yet.</div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>{selectedId ? "Edit Source" : "New Source"}</h2>
          <label htmlFor="connector-name">Name</label>
          <input
            id="connector-name"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="Source name"
            aria-describedby={fieldErrors.name ? "connector-name-error" : error ? errorId : undefined}
            aria-invalid={Boolean(fieldErrors.name || error)}
          />
          {fieldErrors.name && (
            <div className="muted" id="connector-name-error" role="alert">
              {fieldErrors.name}
            </div>
          )}
          <label htmlFor="connector-type">Type</label>
          <select
            id="connector-type"
            value={form.type}
            onChange={(event) => updateForm("type", event.target.value)}
          >
            <option value="VECTOR">VECTOR</option>
            <option value="WEB_SEARCH">WEB_SEARCH</option>
          </select>
          <label htmlFor="connector-description">Description</label>
          <textarea
            id="connector-description"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
          />
          <label htmlFor="connector-tags">Tags (comma separated)</label>
          <input
            id="connector-tags"
            value={form.tags}
            onChange={(event) => updateForm("tags", event.target.value)}
            placeholder="finance, research"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
          />
          <label htmlFor="connector-config">Config JSON</label>
          <textarea
            id="connector-config"
            value={form.configJson}
            onChange={(event) => updateForm("configJson", event.target.value)}
            aria-describedby={
              fieldErrors.configJson ? "connector-config-error" : error ? errorId : undefined
            }
            aria-invalid={Boolean(fieldErrors.configJson || error)}
          />
          {fieldErrors.configJson && (
            <div className="muted" id="connector-config-error" role="alert">
              {fieldErrors.configJson}
            </div>
          )}
          {error && (
            <div className="muted" id={errorId} role="alert">
              {error}
            </div>
          )}
          {status && (
            <div className="muted" id={statusId} aria-live="polite">
              {status}
            </div>
          )}
          <div className="actions">
            <button type="button" onClick={saveConnector}>
              {selectedId ? "Save Changes" : "Create Source"}
            </button>
            {selectedId && (
              <button type="button" className="secondary" onClick={deleteConnector}>
                Delete
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
