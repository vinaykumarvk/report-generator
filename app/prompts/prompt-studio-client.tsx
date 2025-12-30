"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Template = {
  id: string;
  name: string;
};

type PromptSet = {
  id: string;
  name: string;
  state: string;
  version: number;
  template_id?: string | null;
  global_prompts?: { system?: string; developer?: string };
  sections_json?: unknown[];
  history_json?: Array<{ version: number; action: string; timestamp: string }>;
};

type PromptForm = {
  name: string;
  globalSystem: string;
  globalDeveloper: string;
  sectionsJson: string;
  note: string;
  state: string;
};

const DEFAULT_FORM: PromptForm = {
  name: "",
  globalSystem: "",
  globalDeveloper: "",
  sectionsJson: "[]",
  note: "",
  state: "DRAFT",
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PromptStudioClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PromptForm>({ ...DEFAULT_FORM });
  const [diffFrom, setDiffFrom] = useState<string>("");
  const [diffTo, setDiffTo] = useState<string>("");
  const [diffResult, setDiffResult] = useState<string>("");
  const [rollbackVersion, setRollbackVersion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ sectionsJson?: string }>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingPromptSets, setLoadingPromptSets] = useState(true);
  const errorId = "prompt-error";
  const statusId = "prompt-status";
  const skeletonRows = [0, 1, 2];

  const selectedSet = useMemo(
    () => promptSets.find((item) => item.id === selectedId) || null,
    [promptSets, selectedId]
  );

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const res = await fetch("/api/templates", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      if (!templateId && list[0]) {
        setTemplateId(list[0].id);
      }
    }
    setLoadingTemplates(false);
  }, [templateId]);

  const loadPromptSets = useCallback(async (activeTemplateId: string) => {
    if (!activeTemplateId) return;
    setLoadingPromptSets(true);
    const res = await fetch(`/api/templates/${activeTemplateId}/prompts`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setPromptSets([]);
      setLoadingPromptSets(false);
      return;
    }
    const data = await res.json();
    setPromptSets(Array.isArray(data) ? data : []);
    setLoadingPromptSets(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (templateId) {
      loadPromptSets(templateId);
    }
  }, [loadPromptSets, templateId]);

  useEffect(() => {
    if (!selectedSet) {
      setForm({ ...DEFAULT_FORM });
      return;
    }
    setForm({
      name: selectedSet.name || "",
      globalSystem: selectedSet.global_prompts?.system || "",
      globalDeveloper: selectedSet.global_prompts?.developer || "",
      sectionsJson: JSON.stringify(selectedSet.sections_json || [], null, 2),
      note: "",
      state: selectedSet.state || "DRAFT",
    });
  }, [selectedSet]);

  function updateForm(key: keyof PromptForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createPromptSet() {
    if (!templateId) {
      setError("Select a template first.");
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/templates/${templateId}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || "Untitled Prompt Set",
        globalPrompts: { system: form.globalSystem, developer: form.globalDeveloper },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create prompt set");
      return;
    }
    setStatus("Prompt set created.");
    await loadPromptSets(templateId);
  }

  async function savePromptSet() {
    if (!selectedId) return;
    setError(null);
    setStatus(null);
    setFieldErrors({});
    let sections: unknown[] = [];
    try {
      sections = form.sectionsJson ? JSON.parse(form.sectionsJson) : [];
    } catch {
      setFieldErrors({ sectionsJson: "Sections JSON must be valid." });
      return;
    }
    const res = await fetch(`/api/prompts/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        globalPrompts: { system: form.globalSystem, developer: form.globalDeveloper },
        sections,
        note: form.note,
        state: form.state,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save prompt set");
      return;
    }
    setStatus("Prompt set updated.");
    await loadPromptSets(templateId);
  }

  async function publishPromptSet() {
    if (!selectedId) return;
    if (!window.confirm("Publish this prompt set?")) {
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/prompts/${selectedId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: form.note }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to publish prompt set");
      return;
    }
    setStatus("Prompt set published.");
    await loadPromptSets(templateId);
  }

  async function rollbackPromptSet() {
    if (!selectedId) return;
    if (
      !window.confirm(
        "Rollback this prompt set to the selected version? This creates a new draft."
      )
    ) {
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/prompts/${selectedId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: Number(rollbackVersion), note: form.note }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to rollback prompt set");
      return;
    }
    setStatus("Prompt set rolled back.");
    await loadPromptSets(templateId);
  }

  async function diffPromptSet() {
    if (!selectedId) return;
    setError(null);
    setStatus(null);
    if (!diffFrom || !diffTo) {
      setError("Select both diff versions.");
      return;
    }
    const res = await fetch(
      `/api/prompts/${selectedId}/diff?from=${diffFrom}&to=${diffTo}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load diff");
      return;
    }
    const data = await res.json();
    setDiffResult(JSON.stringify(data.diffs || [], null, 2));
  }

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Prompt Studio</h1>
          <p className="page-description">Create and manage prompt sets.</p>
        </div>
      </div>
      <main className="grid-2">
        <section className="card">
          <h2>Prompt Sets</h2>
          <label htmlFor="template-select">Objective</label>
          <select
            id="template-select"
            value={templateId}
            onChange={(event) => {
              setTemplateId(event.target.value);
              setSelectedId(null);
            }}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error) && !templateId}
          >
            {loadingTemplates ? (
              <option value="">Loading templates...</option>
            ) : (
              templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))
            )}
          </select>
          <div className="list" aria-busy={loadingPromptSets}>
            {loadingPromptSets
              ? skeletonRows.map((row) => (
                  <div className="list-item" key={`prompt-skeleton-${row}`}>
                    <div>
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                    <div className="skeleton-line" />
                  </div>
                ))
              : promptSets.map((set) => (
                  <button
                    type="button"
                    key={set.id}
                    className={`list-item ${selectedId === set.id ? "active" : ""}`}
                    onClick={() => setSelectedId(set.id)}
                  >
                    <div>
                      <strong>{set.name}</strong>
                      <div className="muted">State: {set.state}</div>
                      <div className="muted">Version: {set.version}</div>
                    </div>
                    <div className="muted">{set.id}</div>
                  </button>
                ))}
            {!loadingPromptSets && !promptSets.length && (
              <div className="muted">No prompt sets for this template.</div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>{selectedId ? "Edit Prompt Set" : "New Prompt Set"}</h2>
          <label htmlFor="prompt-name">Name</label>
          <input
            id="prompt-name"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error) && !form.name.trim()}
          />
          <label htmlFor="prompt-state">State</label>
          <select
            id="prompt-state"
            value={form.state}
            onChange={(event) => updateForm("state", event.target.value)}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
          </select>
          <label htmlFor="prompt-system">Global System Prompt</label>
          <textarea
            id="prompt-system"
            value={form.globalSystem}
            onChange={(event) => updateForm("globalSystem", event.target.value)}
          />
          <label htmlFor="prompt-developer">Global Developer Prompt</label>
          <textarea
            id="prompt-developer"
            value={form.globalDeveloper}
            onChange={(event) => updateForm("globalDeveloper", event.target.value)}
          />
          <label htmlFor="prompt-sections">Sections JSON</label>
          <textarea
            id="prompt-sections"
            value={form.sectionsJson}
            onChange={(event) => updateForm("sectionsJson", event.target.value)}
            aria-describedby={
              fieldErrors.sectionsJson ? "prompt-sections-error" : error ? errorId : undefined
            }
            aria-invalid={Boolean(fieldErrors.sectionsJson || error)}
          />
          {fieldErrors.sectionsJson && (
            <div className="muted" id="prompt-sections-error" role="alert">
              {fieldErrors.sectionsJson}
            </div>
          )}
          <label htmlFor="prompt-note">Note</label>
          <input
            id="prompt-note"
            value={form.note}
            onChange={(event) => updateForm("note", event.target.value)}
            placeholder="Optional change note"
          />
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
            <button type="button" onClick={selectedId ? savePromptSet : createPromptSet}>
              {selectedId ? "Save Prompt Set" : "Create Prompt Set"}
            </button>
            {selectedId && (
              <button type="button" className="secondary" onClick={publishPromptSet}>
                Publish
              </button>
            )}
          </div>

          {selectedSet?.history_json?.length ? (
            <>
              <h3>Version Tools</h3>
              <label htmlFor="rollback-version">Rollback to Version</label>
              <input
                id="rollback-version"
                value={rollbackVersion}
                onChange={(event) => setRollbackVersion(event.target.value)}
              />
              <button type="button" className="secondary" onClick={rollbackPromptSet}>
                Rollback
              </button>

              <label htmlFor="diff-from">Diff From</label>
              <input
                id="diff-from"
                value={diffFrom}
                onChange={(event) => setDiffFrom(event.target.value)}
              />
              <label htmlFor="diff-to">Diff To</label>
              <input
                id="diff-to"
                value={diffTo}
                onChange={(event) => setDiffTo(event.target.value)}
              />
              <button type="button" className="secondary" onClick={diffPromptSet}>
                Show Diff
              </button>
              {diffResult && <div className="code-block">{diffResult}</div>}

              <h4>History</h4>
              <div className="list">
                {(selectedSet.history_json || []).map((entry: any) => (
                  <div className="list-item" key={`${entry.version}-${entry.timestamp}`}>
                    <div>
                      <strong>v{entry.version}</strong>
                      <div className="muted">{entry.action}</div>
                    </div>
                    <div className="muted">{formatTimestamp(entry.timestamp)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
