"use client";

import { useState, useEffect } from "react";
import "./templates.css";

// Types
interface Template {
  id: string;
  name: string;
  description: string;
  audience: string;
  tone: string;
  domain: string;
  jurisdiction: string;
  formats: string[];
  status: string;
  default_vector_store_ids: string[];
  sections?: Section[];
  created_at: string;
  updated_at: string;
}

interface Section {
  id: string;
  template_id: string;
  title: string;
  purpose: string;
  order: number;
  vector_policy_json: any;
  status: string;
}

interface Source {
  id: string;
  name: string;
  type: string;
  description: string;
  config_json: any;
}

export default function TemplatesClient() {
  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [loading, setLoading] = useState(true);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneName, setCloneName] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    audience: "",
    tone: "",
    domain: "",
    jurisdiction: "",
    formats: "",
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [templatesRes, sourcesRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/connectors"), // Will show as "Sources" in UI
      ]);
      
      const templatesData = await templatesRes.json();
      const sourcesData = await sourcesRes.json();
      
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter and sort templates
  const filteredTemplates = templates
    .filter((t) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.domain?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const displayedTemplates = showAllTemplates
    ? filteredTemplates
    : filteredTemplates.slice(0, 4);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Handlers
  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          audience: form.audience,
          tone: form.tone,
          domain: form.domain,
          jurisdiction: form.jurisdiction,
          formats: form.formats.split(",").map((f) => f.trim()).filter(Boolean),
        }),
      });

      if (!response.ok) throw new Error("Failed to create template");

      await loadData();
      setViewMode("list");
      resetForm();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleCloneTemplate() {
    if (!selectedTemplateId || !cloneName.trim()) return;

    try {
      const response = await fetch(`/api/templates/${selectedTemplateId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cloneName }),
      });

      if (!response.ok) throw new Error("Failed to clone template");

      const data = await response.json();
      await loadData();
      setShowCloneDialog(false);
      setCloneName("");
      setSelectedTemplateId(data.template.id);
      setViewMode("view");
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      await loadData();
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setViewMode("list");
      }
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      audience: "",
      tone: "",
      domain: "",
      jurisdiction: "",
      formats: "",
    });
  }

  function startEdit() {
    if (!selectedTemplate) return;
    setForm({
      name: selectedTemplate.name,
      description: selectedTemplate.description || "",
      audience: selectedTemplate.audience || "",
      tone: selectedTemplate.tone || "",
      domain: selectedTemplate.domain || "",
      jurisdiction: selectedTemplate.jurisdiction || "",
      formats: selectedTemplate.formats?.join(", ") || "",
    });
    setViewMode("edit");
  }

  // Render views
  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Templates</h1>
          <p className="page-description">
            Manage report templates with objectives, sections, and sources
          </p>
        </div>
      </div>

      <main className="content" style={{ marginLeft: 0, maxWidth: "100%" }}>
        {/* List View */}
        {viewMode === "list" && (
          <>
            {/* Search and New Button */}
            <div className="templates-toolbar">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search templates by name, description, or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className="btn-primary"
                onClick={() => {
                  resetForm();
                  setViewMode("create");
                }}
              >
                + New Template
              </button>
            </div>

            {/* Template Cards Grid */}
            <div className="templates-grid">
              {displayedTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${
                    selectedTemplateId === template.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTemplateId(template.id);
                    setViewMode("view");
                  }}
                >
                  <div className="template-card-header">
                    <h3>{template.name}</h3>
                    <span className={`status-badge status-${template.status.toLowerCase()}`}>
                      {template.status}
                    </span>
                  </div>
                  <p className="template-description">
                    {template.description || "No description"}
                  </p>
                  <div className="template-meta">
                    <span>{template.sections?.length || 0} sections</span>
                    <span>{template.default_vector_store_ids?.length || 0} sources</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Show More/Less */}
            {filteredTemplates.length > 4 && (
              <div className="show-more-container">
                <button
                  className="btn-secondary"
                  onClick={() => setShowAllTemplates(!showAllTemplates)}
                >
                  {showAllTemplates
                    ? "Show Less"
                    : `Show More (${filteredTemplates.length - 4} more)`}
                </button>
              </div>
            )}

            {filteredTemplates.length === 0 && (
              <div className="empty-state">
                <p>No templates found</p>
                {searchQuery && <p className="muted">Try a different search term</p>}
              </div>
            )}
          </>
        )}

        {/* Create/Edit View */}
        {(viewMode === "create" || viewMode === "edit") && (
          <div className="template-form-container">
            <div className="form-header">
              <h2>{viewMode === "create" ? "Create New Template" : "Edit Template"}</h2>
              <button className="btn-text" onClick={() => setViewMode("list")}>
                ← Back to List
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="template-form">
              <div className="form-group">
                <label htmlFor="name">Template Name *</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Q4 2024 Financial Report"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief overview of this template's purpose..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="audience">Audience</label>
                  <input
                    id="audience"
                    type="text"
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    placeholder="e.g., Board of Directors"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tone">Tone</label>
                  <input
                    id="tone"
                    type="text"
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    placeholder="e.g., Formal, Professional"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="domain">Domain</label>
                  <input
                    id="domain"
                    type="text"
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    placeholder="e.g., Finance, Healthcare"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="jurisdiction">Jurisdiction</label>
                  <input
                    id="jurisdiction"
                    type="text"
                    value={form.jurisdiction}
                    onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                    placeholder="e.g., US, EU, Global"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="formats">Output Formats (comma-separated)</label>
                <input
                  id="formats"
                  type="text"
                  value={form.formats}
                  onChange={(e) => setForm({ ...form, formats: e.target.value })}
                  placeholder="e.g., PDF, DOCX, HTML"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setViewMode("list")}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {viewMode === "create" ? "Create Template" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* View Template Details */}
        {viewMode === "view" && selectedTemplate && (
          <div className="template-details-container">
            <div className="details-header">
              <button className="btn-text" onClick={() => setViewMode("list")}>
                ← Back to List
              </button>
              <div className="details-actions">
                <button className="btn-secondary" onClick={startEdit}>
                  Edit
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCloneName(`${selectedTemplate.name} (Copy)`);
                    setShowCloneDialog(true);
                  }}
                >
                  Clone
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="template-details">
              <div className="details-section">
                <h2>{selectedTemplate.name}</h2>
                <span className={`status-badge status-${selectedTemplate.status.toLowerCase()}`}>
                  {selectedTemplate.status}
                </span>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <label>Description</label>
                  <p>{selectedTemplate.description || "—"}</p>
                </div>

                <div className="detail-item">
                  <label>Audience</label>
                  <p>{selectedTemplate.audience || "—"}</p>
                </div>

                <div className="detail-item">
                  <label>Tone</label>
                  <p>{selectedTemplate.tone || "—"}</p>
                </div>

                <div className="detail-item">
                  <label>Domain</label>
                  <p>{selectedTemplate.domain || "—"}</p>
                </div>

                <div className="detail-item">
                  <label>Jurisdiction</label>
                  <p>{selectedTemplate.jurisdiction || "—"}</p>
                </div>

                <div className="detail-item">
                  <label>Output Formats</label>
                  <p>{selectedTemplate.formats?.join(", ") || "—"}</p>
                </div>
              </div>

              {/* Sections */}
              <div className="sections-panel">
                <h3>Sections ({selectedTemplate.sections?.length || 0})</h3>
                {selectedTemplate.sections && selectedTemplate.sections.length > 0 ? (
                  <div className="sections-list">
                    {selectedTemplate.sections.map((section) => (
                      <div key={section.id} className="section-item">
                        <span className="section-order">{section.order}</span>
                        <div className="section-info">
                          <h4>{section.title}</h4>
                          <p className="muted">{section.purpose || "No purpose defined"}</p>
                        </div>
                        <span className={`status-badge status-${section.status.toLowerCase()}`}>
                          {section.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No sections added yet</p>
                )}
              </div>

              {/* Sources (Connectors) */}
              <div className="sources-panel">
                <h3>Sources ({selectedTemplate.default_vector_store_ids?.length || 0})</h3>
                <p className="muted">
                  Default sources for all sections (can be overridden per section)
                </p>
                {selectedTemplate.default_vector_store_ids && selectedTemplate.default_vector_store_ids.length > 0 ? (
                  <div className="sources-list">
                    {selectedTemplate.default_vector_store_ids.map((sourceId) => {
                      const source = sources.find((s) => s.id === sourceId);
                      return (
                        <div key={sourceId} className="source-item">
                          <span className="source-name">{source?.name || sourceId}</span>
                          <span className="source-type">{source?.type || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">No default sources configured</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clone Dialog */}
      {showCloneDialog && (
        <div className="dialog-overlay" onClick={() => setShowCloneDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Clone Template</h3>
              <button className="btn-icon" onClick={() => setShowCloneDialog(false)}>
                ×
              </button>
            </div>
            <div className="dialog-body">
              <p className="muted">Original: {selectedTemplate?.name}</p>
              <div className="form-group">
                <label htmlFor="clone-name">New Template Name</label>
                <input
                  id="clone-name"
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter name for cloned template"
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowCloneDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCloneTemplate}
                disabled={!cloneName.trim()}
              >
                Clone Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

