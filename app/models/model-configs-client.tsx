"use client";

import { useEffect, useMemo, useState } from "react";

type ModelProvider = {
  id: string;
  name: string;
  region?: string | null;
  models?: string[] | null;
  created_at?: string;
};

type ModelConfig = {
  id: string;
  provider_id: string;
  model: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  strictness?: string;
  verification?: Record<string, unknown>;
  stage_hints?: Record<string, unknown>;
  created_at?: string;
};

type ProviderForm = {
  name: string;
  region: string;
  models: string;
};

type ConfigForm = {
  providerId: string;
  model: string;
  temperature: string;
  maxOutputTokens: string;
  topP: string;
  strictness: string;
  verification: string;
  stageHints: string;
};

const DEFAULT_PROVIDER_FORM: ProviderForm = {
  name: "",
  region: "",
  models: "",
};

const DEFAULT_CONFIG_FORM: ConfigForm = {
  providerId: "",
  model: "",
  temperature: "0.5",
  maxOutputTokens: "1024",
  topP: "0.9",
  strictness: "medium",
  verification: "{}",
  stageHints: "{}",
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ModelConfigsClient() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null
  );
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm>({
    ...DEFAULT_PROVIDER_FORM,
  });
  const [configForm, setConfigForm] = useState<ConfigForm>({
    ...DEFAULT_CONFIG_FORM,
  });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    providerId?: string;
    model?: string;
    verification?: string;
    stageHints?: string;
  }>({});
  const errorId = "model-config-error";
  const statusId = "model-config-status";

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === selectedProviderId) || null,
    [providers, selectedProviderId]
  );
  const selectedConfig = useMemo(
    () => configs.find((item) => item.id === selectedConfigId) || null,
    [configs, selectedConfigId]
  );

  async function loadData() {
    const providerRes = await fetch("/api/model-providers", { cache: "no-store" });
    const configRes = await fetch("/api/model-configs", { cache: "no-store" });
    if (providerRes.ok) {
      const data = await providerRes.json();
      setProviders(data.data || []);
    }
    if (configRes.ok) {
      const data = await configRes.json();
      setConfigs(data.data || []);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedProvider) {
      setProviderForm({ ...DEFAULT_PROVIDER_FORM });
      return;
    }
    setProviderForm({
      name: selectedProvider.name || "",
      region: selectedProvider.region || "",
      models: (selectedProvider.models || []).join(", "),
    });
  }, [selectedProvider]);

  useEffect(() => {
    if (!selectedConfig) {
      setConfigForm({
        ...DEFAULT_CONFIG_FORM,
        providerId: providers[0]?.id || "",
      });
      return;
    }
    setConfigForm({
      providerId: selectedConfig.provider_id,
      model: selectedConfig.model || "",
      temperature: String(selectedConfig.temperature ?? 0.5),
      maxOutputTokens: String(selectedConfig.max_output_tokens ?? 1024),
      topP: String(selectedConfig.top_p ?? 0.9),
      strictness: selectedConfig.strictness || "medium",
      verification: JSON.stringify(selectedConfig.verification || {}, null, 2),
      stageHints: JSON.stringify(selectedConfig.stage_hints || {}, null, 2),
    });
  }, [selectedConfig, providers]);

  function updateProviderForm(key: keyof ProviderForm, value: string) {
    setProviderForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateConfigForm(key: keyof ConfigForm, value: string) {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProvider() {
    setError(null);
    setStatus(null);
    const payload = {
      name: providerForm.name,
      region: providerForm.region || "unknown",
      models: providerForm.models
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    const res = await fetch(
      selectedProviderId
        ? `/api/model-providers/${selectedProviderId}`
        : "/api/model-providers",
      {
        method: selectedProviderId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save provider");
      return;
    }
    setStatus(selectedProviderId ? "Provider updated." : "Provider created.");
    await loadData();
  }

  async function deleteProvider() {
    if (!selectedProviderId) return;
    if (!window.confirm("Delete this provider? This cannot be undone.")) {
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/model-providers/${selectedProviderId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete provider");
      return;
    }
    setSelectedProviderId(null);
    setStatus("Provider deleted.");
    await loadData();
  }

  async function saveConfig() {
    setError(null);
    setStatus(null);
    setFieldErrors({});
    if (!configForm.providerId) {
      setFieldErrors({ providerId: "Select a provider before saving the config." });
      return;
    }
    if (!configForm.model.trim()) {
      setFieldErrors({ model: "Model name is required." });
      return;
    }
    let verification = {};
    let stageHints = {};
    try {
      verification = configForm.verification
        ? JSON.parse(configForm.verification)
        : {};
      stageHints = configForm.stageHints ? JSON.parse(configForm.stageHints) : {};
    } catch (err) {
      setFieldErrors({
        verification: "Verification JSON must be valid.",
        stageHints: "Stage Hints JSON must be valid.",
      });
      return;
    }

    const payload = {
      providerId: configForm.providerId,
      model: configForm.model,
      temperature: Number(configForm.temperature),
      maxOutputTokens: Number(configForm.maxOutputTokens),
      topP: Number(configForm.topP),
      strictness: configForm.strictness,
      verification,
      stageHints,
    };

    const res = await fetch(
      selectedConfigId ? `/api/model-configs/${selectedConfigId}` : "/api/model-configs",
      {
        method: selectedConfigId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save config");
      return;
    }
    setStatus(selectedConfigId ? "Config updated." : "Config created.");
    await loadData();
  }

  async function deleteConfig() {
    if (!selectedConfigId) return;
    if (!window.confirm("Delete this model config? This cannot be undone.")) {
      return;
    }
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/model-configs/${selectedConfigId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete config");
      return;
    }
    setSelectedConfigId(null);
    setStatus("Config deleted.");
    await loadData();
  }

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Model Providers & Configs</h1>
          <p className="page-description">Manage model providers and execution configs.</p>
        </div>
      </div>
      <main>
        <section className="grid-2">
          <div className="card">
            <h2>Providers</h2>
            <div className="list">
              {providers.map((provider) => (
                <button
                  type="button"
                  key={provider.id}
                  className={`list-item ${selectedProviderId === provider.id ? "active" : ""}`}
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <div>
                    <strong>{provider.name}</strong>
                    <div className="muted">{provider.region}</div>
                    <div className="muted">{provider.id}</div>
                  </div>
                  <div className="muted">{formatTimestamp(provider.created_at)}</div>
                </button>
              ))}
              {!providers.length && (
                <div className="muted">No providers configured.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>{selectedProviderId ? "Edit Provider" : "New Provider"}</h2>
            <label htmlFor="provider-name">Name</label>
            <input
              id="provider-name"
              value={providerForm.name}
              onChange={(event) => updateProviderForm("name", event.target.value)}
              placeholder="OpenAI"
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
            />
            <label htmlFor="provider-region">Region</label>
            <input
              id="provider-region"
              value={providerForm.region}
              onChange={(event) => updateProviderForm("region", event.target.value)}
              placeholder="us-east-1"
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
            />
            <label htmlFor="provider-models">Models (comma separated)</label>
            <textarea
              id="provider-models"
              value={providerForm.models}
              onChange={(event) => updateProviderForm("models", event.target.value)}
              placeholder="gpt-4o-mini, gpt-4.1"
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
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
              <button type="button" onClick={saveProvider}>
                {selectedProviderId ? "Save Provider" : "Create Provider"}
              </button>
              {selectedProviderId && (
                <button type="button" className="secondary" onClick={deleteProvider}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid-2">
          <div className="card">
            <h2>Configs</h2>
            <div className="list">
              {configs.map((config) => (
                <button
                  type="button"
                  key={config.id}
                  className={`list-item ${selectedConfigId === config.id ? "active" : ""}`}
                  onClick={() => setSelectedConfigId(config.id)}
                >
                  <div>
                    <strong>{config.model}</strong>
                    <div className="muted">
                      Provider: {providers.find((p) => p.id === config.provider_id)?.name || "Unknown"}
                    </div>
                    <div className="muted">{config.id}</div>
                  </div>
                  <div className="muted">{formatTimestamp(config.created_at)}</div>
                </button>
              ))}
              {!configs.length && <div className="muted">No configs created.</div>}
            </div>
          </div>

          <div className="card">
            <h2>{selectedConfigId ? "Edit Config" : "New Config"}</h2>
            <label htmlFor="config-provider">Provider</label>
            <select
              id="config-provider"
              value={configForm.providerId}
              onChange={(event) => updateConfigForm("providerId", event.target.value)}
              aria-describedby={
                fieldErrors.providerId ? "config-provider-error" : error ? errorId : undefined
              }
              aria-invalid={Boolean(fieldErrors.providerId)}
            >
              <option value="">Select provider</option>
              {providers.map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <label htmlFor="config-model">Model</label>
            <input
              id="config-model"
              value={configForm.model}
              onChange={(event) => updateConfigForm("model", event.target.value)}
              placeholder="gpt-4o-mini"
              aria-describedby={
                fieldErrors.model ? "config-model-error" : error ? errorId : undefined
              }
              aria-invalid={Boolean(fieldErrors.model)}
            />
            {fieldErrors.model && (
              <div className="muted" id="config-model-error" role="alert">
                {fieldErrors.model}
              </div>
            )}
            {fieldErrors.providerId && (
              <div className="muted" id="config-provider-error" role="alert">
                {fieldErrors.providerId}
              </div>
            )}
            <div className="pill-row">
              <div>
                <label htmlFor="config-temp">Temperature</label>
                <input
                  id="config-temp"
                  value={configForm.temperature}
                  onChange={(event) => updateConfigForm("temperature", event.target.value)}
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label htmlFor="config-top-p">Top P</label>
                <input
                  id="config-top-p"
                  value={configForm.topP}
                  onChange={(event) => updateConfigForm("topP", event.target.value)}
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label htmlFor="config-max">Max Output Tokens</label>
                <input
                  id="config-max"
                  value={configForm.maxOutputTokens}
                  onChange={(event) => updateConfigForm("maxOutputTokens", event.target.value)}
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                />
              </div>
            </div>
            <label htmlFor="config-strictness">Strictness</label>
            <input
              id="config-strictness"
              value={configForm.strictness}
              onChange={(event) => updateConfigForm("strictness", event.target.value)}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
            />
            <label htmlFor="config-verification">Verification JSON</label>
            <textarea
              id="config-verification"
              value={configForm.verification}
              onChange={(event) => updateConfigForm("verification", event.target.value)}
              aria-describedby={
                fieldErrors.verification ? "config-verification-error" : error ? errorId : undefined
              }
              aria-invalid={Boolean(fieldErrors.verification)}
            />
            {fieldErrors.verification && (
              <div className="muted" id="config-verification-error" role="alert">
                {fieldErrors.verification}
              </div>
            )}
            <label htmlFor="config-stage-hints">Stage Hints JSON</label>
            <textarea
              id="config-stage-hints"
              value={configForm.stageHints}
              onChange={(event) => updateConfigForm("stageHints", event.target.value)}
              aria-describedby={
                fieldErrors.stageHints ? "config-stage-hints-error" : error ? errorId : undefined
              }
              aria-invalid={Boolean(fieldErrors.stageHints)}
            />
            {fieldErrors.stageHints && (
              <div className="muted" id="config-stage-hints-error" role="alert">
                {fieldErrors.stageHints}
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
            {!configForm.providerId || !configForm.model.trim() ? (
              <div className="muted">Select a provider and model to enable save.</div>
            ) : null}
            <div className="actions">
              <button
                type="button"
                onClick={saveConfig}
                disabled={!configForm.providerId || !configForm.model.trim()}
              >
                {selectedConfigId ? "Save Config" : "Create Config"}
              </button>
              {selectedConfigId && (
                <button type="button" className="secondary" onClick={deleteConfig}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
