"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import VectorStoreSelector from "./components/vector-store-selector";
import ConfirmationDialog from "../components/confirmation-dialog";
import "../components/confirmation-dialog.css";
import "./reports-studio.css";

type Template = {
  id: string;
  name: string;
  description?: string;
  audience?: string;
  tone?: string;
  domain?: string;
  jurisdiction?: string;
  status?: string;
  formats?: string[];
  sections?: Section[];
  connectors?: Connector[];
  isMaster?: boolean;
};

type Section = {
  id: string;
  title: string;
  purpose?: string;
  order?: number;
  outputFormat?: string;
  evidencePolicy?: string;
  writingStyle?: string;
  targetLengthMin?: number;
  targetLengthMax?: number;
  sourceMode?: "inherit" | "custom";
  customConnectorIds?: string[];
  vectorPolicyJson?: { connectorIds?: string[] } | null;
  isCollapsed?: boolean;
};

type WritingStyle = {
  id: string;
  name: string;
  description: string;
  llm_instruction: string;
  enforced_rules: string[];
};

type Connector = {
  id: string;
  name: string;
  type: string;
  description?: string;
  metadata?: {
    vectorStoreId?: string;
    fileIds?: string[];
  };
};

type VectorStore = {
  id: string;
  name: string;
};

export default function ReportsStudioClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"master" | "regular">("master");
  // Progressive disclosure: Collapse advanced options by default
  const [createPanelsOpen, setCreatePanelsOpen] = useState({
    objectives: true,  // Keep objectives open (primary)
    sources: false,    // Collapse sources (advanced)
    sections: false,   // Collapse sections (advanced)
  });
  const [editPanelsOpen, setEditPanelsOpen] = useState({
    objectives: true,  // Keep objectives open (primary)
    sources: false,    // Collapse sources (advanced)
    sections: false,   // Collapse sections (advanced)
  });
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Template>>({});
  const [availableVectorStores, setAvailableVectorStores] = useState<VectorStore[]>([]);
  const [writingStyles, setWritingStyles] = useState<WritingStyle[]>([]);
  const [createErrors, setCreateErrors] = useState<{ name?: string }>({});
  const [editErrors, setEditErrors] = useState<{ name?: string }>({});
  const [createSectionErrors, setCreateSectionErrors] = useState<Record<string, { title?: string; length?: string }>>({});
  const [editSectionErrors, setEditSectionErrors] = useState<Record<string, { title?: string; length?: string }>>({});
  
  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Form states - Objectives
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [domain, setDomain] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [formats, setFormats] = useState<string[]>(["markdown"]);
  const [isMaster, setIsMaster] = useState(false);

  // Form states - Sections
  const [sections, setSections] = useState<Section[]>([]);

  // Form states - Sources
  const [selectedConnectorTypes, setSelectedConnectorTypes] = useState<string[]>([]);
  const [selectedVectorStores, setSelectedVectorStores] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string[]>>({});

  // Form state persistence
  const FORM_STORAGE_KEY = "reports-studio-form-draft";
  
  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadTemplates();
    loadWritingStyles();
  }, []);

  // Restore form state from localStorage when form is opened
  useEffect(() => {
    if (showForm) {
      const saved = localStorage.getItem(FORM_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.name) setName(parsed.name);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.audience) setAudience(parsed.audience);
          if (parsed.tone) setTone(parsed.tone);
          if (parsed.domain) setDomain(parsed.domain);
          if (parsed.jurisdiction) setJurisdiction(parsed.jurisdiction);
          if (parsed.formats) setFormats(parsed.formats);
          if (parsed.isMaster !== undefined) setIsMaster(parsed.isMaster);
          if (parsed.sections) setSections(parsed.sections);
          if (parsed.selectedConnectorTypes) setSelectedConnectorTypes(parsed.selectedConnectorTypes);
          if (parsed.selectedVectorStores) setSelectedVectorStores(parsed.selectedVectorStores);
          if (parsed.selectedFiles) setSelectedFiles(parsed.selectedFiles);
        } catch (e) {
          console.error("Failed to restore form state:", e);
        }
      }
    }
  }, [showForm]);

  // Auto-save form state
  useEffect(() => {
    if (showForm && (name || description || sections.length > 0)) {
      const formState = {
        name,
        description,
        audience,
        tone,
        domain,
        jurisdiction,
        formats,
        isMaster,
        sections,
        selectedConnectorTypes,
        selectedVectorStores,
        selectedFiles,
      };
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
    }
  }, [showForm, name, description, audience, tone, domain, jurisdiction, formats, isMaster, sections, selectedConnectorTypes, selectedVectorStores, selectedFiles]);

  // Keyboard navigation handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close form or cancel editing
      if (e.key === "Escape") {
        if (confirmationDialog.isOpen) {
          setConfirmationDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        } else if (showForm) {
          resetForm();
        } else if (editingTemplateId) {
          cancelEditingTemplate();
        } else if (expandedTemplateId) {
          setExpandedTemplateId(null);
        }
      }
      
      // Enter on buttons (handled by default, but ensure it works)
      if (e.key === "Enter" && e.target instanceof HTMLElement) {
        if (e.target.tagName === "BUTTON" && !e.target.disabled) {
          e.target.click();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showForm, editingTemplateId, expandedTemplateId, confirmationDialog.isOpen]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplateDetails(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (error) {
      console.error("Failed to load template details:", error);
    }
    return null;
  }

  async function toggleTemplateExpansion(templateId: string) {
    if (expandedTemplateId === templateId) {
      setExpandedTemplateId(null);
      setEditingTemplateId(null);
    } else {
      // Load full template details including sections
      const fullTemplate = await loadTemplateDetails(templateId);
      if (fullTemplate) {
        // Update the template in the list with full details
        setTemplates(prev => prev.map(t => t.id === templateId ? fullTemplate : t));
      }
      setExpandedTemplateId(templateId);
      setEditingTemplateId(null);
    }
  }

  async function startEditingTemplate(templateId: string) {
    // Load full template details if not already loaded
    let template = templates.find((t) => t.id === templateId);
    if (template && (!template.sections || template.sections.length === 0)) {
      const fullTemplate = await loadTemplateDetails(templateId);
      if (fullTemplate) {
        template = fullTemplate;
        setTemplates(prev => prev.map(t => t.id === templateId ? fullTemplate : t));
      }
    }
    
    if (template) {
      setEditingTemplateId(templateId);
      // Sort sections by order when loading for editing
      const sortedSections = [...(template.sections || [])].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        return orderA - orderB;
      });
      setEditFormData({
        ...template,
        sections: sortedSections
      });
      setIsMaster(template.isMaster || false);

      // Load existing sources (connectors) into state for editing
      const existingConnectors = template.connectors || [];
      const connectorTypes: ("VECTOR" | "WEB_SEARCH")[] = [];
      
      existingConnectors.forEach((conn) => {
        if (conn.type === "VECTOR" && !connectorTypes.includes("VECTOR")) {
          connectorTypes.push("VECTOR");
        } else if (conn.type === "WEB_SEARCH" && !connectorTypes.includes("WEB_SEARCH")) {
          connectorTypes.push("WEB_SEARCH");
        }
      });
      
      setSelectedConnectorTypes(connectorTypes);

      // Load vector stores if VECTOR type exists
      if (connectorTypes.includes("VECTOR")) {
        await loadVectorStores();
        
        // Populate selected vector stores
        const vectorConnectors = existingConnectors.filter(c => c.type === "VECTOR");
        const vectorStoreIds = vectorConnectors
          .map(c => c.metadata?.vectorStoreId)
          .filter((id): id is string => !!id);
        
        setSelectedVectorStores(vectorStoreIds);

        // Populate selected files for each vector store
        const filesMap: Record<string, string[]> = {};
        vectorConnectors.forEach((conn) => {
          const storeId = conn.metadata?.vectorStoreId;
          const fileIds = conn.metadata?.fileIds || [];
          if (storeId && fileIds.length > 0) {
            filesMap[storeId] = fileIds;
          }
        });
        setSelectedFiles(filesMap);
      }
      setEditPanelsOpen({ objectives: true, sources: true, sections: true });
    }
  }

  function cancelEditingTemplate() {
    setEditingTemplateId(null);
    setEditFormData({});
    setEditErrors({});
    setEditSectionErrors({});
    setIsMaster(false);
    // Clear source-related state
    setSelectedConnectorTypes([]);
    setSelectedVectorStores([]);
    setSelectedFiles({});
    setEditPanelsOpen({ objectives: true, sources: true, sections: true });
  }

  async function saveTemplateEdits() {
    if (!editingTemplateId) return;
    if (!editFormData.name || !editFormData.name.trim()) {
      setEditErrors({ name: "Report name is required." });
      return;
    }
    const sectionErrors = validateSections((editFormData.sections || []) as Section[]);
    setEditSectionErrors(sectionErrors);
    if (Object.keys(sectionErrors).length > 0) {
      return;
    }

    try {
      // Build connectors array from selected sources
      const updatedConnectors: any[] = [];

      // Add vector store connectors
      if (selectedConnectorTypes.includes("VECTOR")) {
        for (const storeId of selectedVectorStores) {
          const store = availableVectorStores.find(s => s.id === storeId);
          if (store) {
            const fileIds = selectedFiles[storeId] || [];
            updatedConnectors.push({
              type: "VECTOR",
              name: store.name,
              metadata: {
                vectorStoreId: store.id,
                fileIds: fileIds,
              },
            });
          }
        }
      }

      // Add web search connector
      if (selectedConnectorTypes.includes("WEB_SEARCH")) {
        updatedConnectors.push({
          type: "WEB_SEARCH",
          name: "Web Search",
          metadata: {},
        });
      }

      // Merge connectors into editFormData
      // IMPORTANT: Sort sections by order before saving to preserve user-defined sequence
      const sortedSections = [...(editFormData.sections || [])].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        return orderA - orderB;
      });
      const orderedSections = sortedSections.map((section, idx) => ({
        ...section,
        order: idx + 1,
        vectorPolicyJson:
          section.sourceMode === "custom" && section.customConnectorIds?.length
            ? { connectorIds: section.customConnectorIds }
            : null,
      }));
      const dataToSave = {
        ...editFormData,
        sections: orderedSections,
        connectors: updatedConnectors,
        isMaster,
      };

      const res = await fetch(`/api/templates/${editingTemplateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to update template");
      }

      const newSections = orderedSections.filter(
        (section) => !section.id || section.id.startsWith("temp-")
      );
      for (const section of newSections) {
        const createRes = await fetch(`/api/templates/${editingTemplateId}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: section.title,
            purpose: section.purpose,
            order: section.order,
            outputFormat: section.outputFormat,
            evidencePolicy: section.evidencePolicy,
            targetLengthMin: section.targetLengthMin,
            targetLengthMax: section.targetLengthMax,
            sourceMode: section.sourceMode,
            writingStyle: section.writingStyle,
            vectorPolicyJson: section.vectorPolicyJson,
            customConnectorIds: section.customConnectorIds,
            status: "ACTIVE",
          }),
        });
        if (!createRes.ok) {
          throw new Error("Failed to create section");
        }
      }

      if (res.ok) {
        alert("Template updated successfully!");
        setEditingTemplateId(null);
        setEditFormData({});
        setEditErrors({});
        setEditSectionErrors({});
        setSelectedConnectorTypes([]);
        setSelectedVectorStores([]);
        setSelectedFiles({});
        loadTemplates();
      }
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function saveTemplateAs() {
    if (!editFormData) return;

    const baseName = (editFormData.name || "").trim();
    const suggested = baseName ? `${baseName} (Copy)` : "";
    const newName = prompt("Enter name for new template:", suggested);
    if (!newName) return;

    try {
      // Build connectors array from selected sources
      const updatedConnectors: any[] = [];

      if (selectedConnectorTypes.includes("VECTOR")) {
        for (const storeId of selectedVectorStores) {
          const store = availableVectorStores.find(s => s.id === storeId);
          if (store) {
            const fileIds = selectedFiles[storeId] || [];
            updatedConnectors.push({
              type: "VECTOR",
              name: store.name,
              metadata: {
                vectorStoreId: store.id,
                fileIds: fileIds,
              },
            });
          }
        }
      }

      if (selectedConnectorTypes.includes("WEB_SEARCH")) {
        updatedConnectors.push({
          type: "WEB_SEARCH",
          name: "Web Search",
          metadata: {},
        });
      }

      // Step 1: Create template
      const templateRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: editFormData.description || "",
          audience: editFormData.audience || "",
          tone: editFormData.tone || "",
          domain: editFormData.domain || "",
          jurisdiction: editFormData.jurisdiction || "",
          formats: editFormData.formats || ["markdown"],
          status: editFormData.status || "ACTIVE",
          connectors: updatedConnectors,
        }),
      });

      if (!templateRes.ok) throw new Error("Failed to create template");
      const template = await templateRes.json();

      // Step 2: Create sections
      const orderedSections = (editFormData.sections || []).map((section, idx) => ({
        ...section,
        order: idx + 1,
        vectorPolicyJson:
          section.sourceMode === "custom" && section.customConnectorIds?.length
            ? { connectorIds: section.customConnectorIds }
            : null,
      }));
      for (const section of orderedSections) {
        await fetch(`/api/templates/${template.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: section.title,
            purpose: section.purpose,
            order: section.order,
            outputFormat: section.outputFormat,
            evidencePolicy: section.evidencePolicy,
            targetLengthMin: section.targetLengthMin,
            targetLengthMax: section.targetLengthMax,
            sourceMode: section.sourceMode,
            writingStyle: section.writingStyle,
            vectorPolicyJson: section.vectorPolicyJson,
            customConnectorIds: section.customConnectorIds,
            status: "ACTIVE",
          }),
        });
      }

      // Step 3: Create connectors if needed
      if (updatedConnectors.length > 0) {
        for (const conn of updatedConnectors) {
          await fetch("/api/connectors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: conn.name,
              type: conn.type,
              configJson: conn.type === "VECTOR"
                ? {
                    vectorStoreId: conn.metadata.vectorStoreId,
                    vectorStoreName: conn.name,
                    selectedFiles: conn.metadata.fileIds || [],
                  }
                : {},
            }),
          });
        }
      }

      alert("Template saved as new copy!");
      loadTemplates();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function cloneTemplate(templateId: string) {
    const newName = prompt("Enter name for cloned template:");
    if (!newName) return;

    try {
      const res = await fetch(`/api/templates/${templateId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        alert("Template cloned successfully!");
        loadTemplates();
      }
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function deleteTemplate(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    const templateName = template?.name || "this template";
    
    setConfirmationDialog({
      isOpen: true,
      title: "Delete Template",
      message: `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmationDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        try {
          const res = await fetch(`/api/templates/${templateId}`, {
            method: "DELETE",
          });

          if (res.ok) {
            setExpandedTemplateId(null);
            loadTemplates();
            // Show success message (could be enhanced with toast)
          } else {
            const error = await res.json().catch(() => ({ error: "Failed to delete template" }));
            alert(error.error || "Failed to delete template");
          }
        } catch (error: any) {
          alert(error.message || "Failed to delete template");
        }
      },
    });
  }
  
  function confirmDeleteSection(sectionIndex: number, isEdit: boolean = false) {
    setConfirmationDialog({
      isOpen: true,
      title: "Delete Section",
      message: "Are you sure you want to delete this section? This action cannot be undone.",
      variant: "danger",
      onConfirm: () => {
        setConfirmationDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        if (isEdit) {
          deleteEditSection(sectionIndex);
        } else {
          deleteSection(sectionIndex);
        }
      },
    });
  }

  async function loadWritingStyles() {
    try {
      console.log("Loading writing styles...");
      const res = await fetch("/api/writing-styles");
      console.log("Writing styles API response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Writing styles API response data:", data);
        const styles = Array.isArray(data)
          ? data
          : Array.isArray(data.writing_styles)
          ? data.writing_styles
          : Array.isArray(data.writingStyles)
          ? data.writingStyles
          : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.data?.writing_styles)
          ? data.data.writing_styles
          : [];
        console.log("Extracted writing styles:", styles.length, "styles");
        if (styles.length > 0) {
          console.log("First style:", styles[0]);
        }
        setWritingStyles(styles);
      } else {
        const errorText = await res.text();
        console.error("Writing styles API error:", res.status, errorText);
      }
    } catch (error) {
      console.error("Failed to load writing styles:", error);
    }
  }

  async function loadVectorStores() {
    console.log("loadVectorStores called");
    try {
      const res = await fetch("/api/openai/vector-stores");
      console.log("Vector stores response:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Vector stores data:", data);
        
        // API returns array directly, not {data: [...]}
        const stores = Array.isArray(data) ? data : (data.data || []);
        console.log("Parsed stores:", stores.length);
        setAvailableVectorStores(stores);
      }
    } catch (error) {
      console.error("Failed to load vector stores:", error);
    }
  }

  function formatCustomSources(ids?: string[]) {
    if (!ids || ids.length === 0) return "None";
    return ids
      .map((id) => {
        const store = availableVectorStores.find((vs) => vs.id === id);
        return store ? store.name : id;
      })
      .join(", ");
  }

  function handleConnectorTypeToggle(type: string) {
    setSelectedConnectorTypes((prev) => {
      const newTypes = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      
      // Auto-load vector stores when VECTOR is selected
      if (type === "VECTOR" && !prev.includes("VECTOR")) {
        console.log("VECTOR selected, auto-loading stores...");
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
          loadVectorStores();
        }, 0);
      }
      
      return newTypes;
    });
  }

  function addSection() {
    const newSection: Section = {
      id: `temp-${Date.now()}`,
      title: "",
      purpose: "",
      order: sections.length + 1,
      outputFormat: "",
      targetLengthMin: undefined,
      targetLengthMax: undefined,
      sourceMode: "inherit",
      customConnectorIds: [],
      isCollapsed: false,
    };
    setSections([...sections, newSection]);
  }

  function toggleSectionCollapse(index: number) {
    const updated = [...sections];
    updated[index] = { ...updated[index], isCollapsed: !updated[index].isCollapsed };
    setSections(updated);
  }

  function updateSection(index: number, field: keyof Section, value: any) {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  }

  function deleteSection(index: number) {
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated.map((section, idx) => ({ ...section, order: idx + 1 })));
  }

  function moveSection(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    setSections(updated.map((section, idx) => ({ ...section, order: idx + 1 })));
  }

  function addEditSection() {
    const newSection: Section = {
      id: `temp-${Date.now()}`,
      title: "",
      purpose: "",
      order: (editFormData.sections || []).length + 1,
      outputFormat: "",
      targetLengthMin: undefined,
      targetLengthMax: undefined,
      sourceMode: "inherit",
      customConnectorIds: [],
      isCollapsed: false,
    };
    const updatedSections = [...(editFormData.sections || []), newSection].map(
      (section, idx) => ({ ...section, order: idx + 1 })
    );
    setEditFormData({ ...editFormData, sections: updatedSections });
  }

  function deleteEditSection(index: number) {
    const updatedSections = (editFormData.sections || [])
      .filter((_, i) => i !== index)
      .map((section, idx) => ({ ...section, order: idx + 1 }));
    setEditFormData({ ...editFormData, sections: updatedSections });
  }

  function moveEditSection(index: number, direction: "up" | "down") {
    const current = editFormData.sections || [];
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const updated = [...current];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    setEditFormData({
      ...editFormData,
      sections: updated.map((section, idx) => ({ ...section, order: idx + 1 })),
    });
  }

  function validateSections(items: Section[] = []) {
    const errors: Record<string, { title?: string; length?: string }> = {};
    items.forEach((section, idx) => {
      const key = section.id || `index-${idx}`;
      const title = section.title?.trim() || "";
      if (!title) {
        errors[key] = { ...errors[key], title: "Section title is required." };
      }
      const min = section.targetLengthMin;
      const max = section.targetLengthMax;
      if (typeof min === "number" && typeof max === "number" && min > max) {
        errors[key] = { ...errors[key], length: "Min words must be less than or equal to max words." };
      }
    });
    return errors;
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setCreateErrors({ name: "Report name is required." });
      return;
    }
    const sectionErrors = validateSections(sections);
    setCreateSectionErrors(sectionErrors);
    if (Object.keys(sectionErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      // Build connectors array from selected sources
      const updatedConnectors: any[] = [];

      if (selectedConnectorTypes.includes("VECTOR")) {
        for (const storeId of selectedVectorStores) {
          const store = availableVectorStores.find(s => s.id === storeId);
          if (store) {
            const fileIds = selectedFiles[storeId] || [];
            updatedConnectors.push({
              type: "VECTOR",
              name: store.name,
              metadata: {
                vectorStoreId: store.id,
                fileIds: fileIds,
              },
            });
          }
        }
      }

      if (selectedConnectorTypes.includes("WEB_SEARCH")) {
        updatedConnectors.push({
          type: "WEB_SEARCH",
          name: "Web Search",
          metadata: {},
        });
      }

      // Step 1: Create template
      const templateRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          audience,
          tone,
          domain,
          jurisdiction,
          formats,
          status: "ACTIVE",
          connectors: updatedConnectors,
          isMaster,
        }),
      });

      if (!templateRes.ok) throw new Error("Failed to create template");
      const template = await templateRes.json();

      // Step 2: Create sections
      const orderedSections = sections.map((section, idx) => ({
        ...section,
        order: idx + 1,
        vectorPolicyJson:
          section.sourceMode === "custom" && section.customConnectorIds?.length
            ? { connectorIds: section.customConnectorIds }
            : null,
      }));
      setSections(orderedSections);
      for (const section of orderedSections) {
        await fetch(`/api/templates/${template.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: section.title,
            purpose: section.purpose,
            order: section.order,
            outputFormat: section.outputFormat,
            evidencePolicy: section.evidencePolicy,
            targetLengthMin: section.targetLengthMin,
            targetLengthMax: section.targetLengthMax,
            sourceMode: section.sourceMode,
            writingStyle: section.writingStyle,
            vectorPolicyJson: section.vectorPolicyJson,
            status: "ACTIVE",
          }),
        });
      }

      // Step 3: Create connectors if needed
      const connectorTypes = selectedConnectorTypes;
      if (connectorTypes.includes("VECTOR") && selectedVectorStores.length > 0) {
        for (const vsId of selectedVectorStores) {
          const vs = availableVectorStores.find((v) => v.id === vsId);
          const files = selectedFiles[vsId] || [];
          await fetch("/api/connectors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: vs?.name || vsId,
              type: "VECTOR",
              configJson: {
                vectorStoreId: vsId,
                vectorStoreName: vs?.name,
                selectedFiles: files,
              },
            }),
          });
        }
      }

      if (connectorTypes.includes("WEB_SEARCH")) {
        await fetch("/api/connectors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Web Search",
            type: "WEB_SEARCH",
            configJson: {},
          }),
        });
      }

      alert("Report template created successfully!");
      resetForm();
      loadTemplates();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setShowForm(false);
    setName("");
    setDescription("");
    setAudience("");
    setTone("");
    setDomain("");
    setJurisdiction("");
    setFormats(["markdown"]);
    setSections([]);
    setSelectedConnectorTypes([]);
    setSelectedVectorStores([]);
    setSelectedFiles({});
    setIsMaster(false);
    setCreateErrors({});
    setCreateSectionErrors({});
    setCreatePanelsOpen({ objectives: true, sources: true, sections: true });
    // Clear saved form state
    localStorage.removeItem(FORM_STORAGE_KEY);
  }

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group templates by master status
  const masterTemplates = filteredTemplates.filter(t => t.isMaster);
  const regularTemplates = filteredTemplates.filter(t => !t.isMaster);

  return (
    <main className="page-container" role="main" aria-label="Reports Studio">
      {/* ARIA live region for status updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements"></div>
      
      {/* Offline Indicator */}
      {isOffline && (
        <div role="alert" className="offline-indicator" aria-live="assertive">
          <span>⚠️ You are currently offline. Some features may be limited.</span>
          <span className="offline-timestamp">Data may be cached.</span>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        title={confirmationDialog.title}
        message={confirmationDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmationDialog.onConfirm}
        onCancel={() => setConfirmationDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
        variant={confirmationDialog.variant || "danger"}
      />
      <div className="page-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        {/* Tabs Navigation */}
        <div className="templates-tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            className={`tab-button ${activeTab === "master" ? "active" : ""}`}
            onClick={() => setActiveTab("master")}
          >
            ⭐ Master Templates ({masterTemplates.length})
          </button>
          <button
            className={`tab-button ${activeTab === "regular" ? "active" : ""}`}
            onClick={() => setActiveTab("regular")}
          >
            📋 Regular Templates ({regularTemplates.length})
          </button>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕ Cancel" : "+ New Report"}
        </button>
      </div>

      {/* CREATE/EDIT FORM */}
      {showForm && (
        <div className="report-form-container" role="region" aria-label="Create Report Template Form">
          <div className="report-form-card" aria-busy={loading} aria-live="polite">
            {/* SECTION 1: OBJECTIVES */}
            <div className="form-section panel-card">
              <div className="panel-header">
                <h2 className="form-section-title">1. Objectives</h2>
                <button
                  className="btn-icon"
                  type="button"
                  onClick={() =>
                    setCreatePanelsOpen((prev) => ({
                      ...prev,
                      objectives: !prev.objectives,
                    }))
                  }
                  aria-label={createPanelsOpen.objectives ? "Collapse objectives" : "Expand objectives"}
                  title={createPanelsOpen.objectives ? "Collapse" : "Expand"}
                >
                  {createPanelsOpen.objectives ? "▲" : "▼"}
                </button>
              </div>
              {createPanelsOpen.objectives && (
                <div className="panel-body">
              
              {/* Row 1: Name */}
              <div className="form-group-compact">
                <input
                  type="text"
                  inputMode="text"
                  value={name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setName(value);
                    // Real-time validation
                    if (createErrors.name && value.trim()) {
                      setCreateErrors((prev) => ({ ...prev, name: undefined }));
                    } else if (!value.trim()) {
                      setCreateErrors((prev) => ({ ...prev, name: "Report name is required." }));
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur
                    if (!e.target.value.trim()) {
                      setCreateErrors((prev) => ({ ...prev, name: "Report name is required." }));
                    }
                  }}
                  placeholder="Report Name *"
                  aria-label="Report name"
                  aria-invalid={Boolean(createErrors.name)}
                  aria-describedby={createErrors.name ? "create-template-name-error" : undefined}
                />
                {createErrors.name && (
                  <div id="create-template-name-error" className="field-error" role="alert">
                    {createErrors.name}
                  </div>
                )}
              </div>

              {/* Row 2: Description */}
              <div className="form-group-compact">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  aria-label="Report description"
                />
              </div>

              {/* Row 3: Audience + Tone */}
              <div className="form-group-compact">
                <div className="two-column-row">
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Audience"
                    aria-label="Audience"
                  />
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Tone"
                    aria-label="Tone"
                  />
                </div>
              </div>

              {/* Row 4: Domain + Jurisdiction */}
              <div className="form-group-compact">
                <div className="two-column-row">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="Domain"
                    aria-label="Domain"
                  />
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="Jurisdiction"
                    aria-label="Jurisdiction"
                  />
                </div>
              </div>

              {/* Row 5: Output Formats */}
              <div className="form-group-compact">
                <div className="checkbox-group-inline-compact">
                  {["markdown", "docx", "pdf"].map((fmt) => (
                    <label key={fmt} className="checkbox-label-inline-compact">
                      <input
                        type="checkbox"
                        checked={formats.includes(fmt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormats([...formats, fmt]);
                          } else {
                            setFormats(formats.filter((f) => f !== fmt));
                          }
                        }}
                      />
                      {fmt.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 6: Master Template */}
              <div className="form-group-compact">
                <label className="checkbox-label-inline-compact">
                  <input
                    type="checkbox"
                    checked={isMaster}
                    onChange={(e) => setIsMaster(e.target.checked)}
                  />
                  Master Template
                </label>
              </div>
                </div>
              )}
            </div>

            {/* SECTION 2: SOURCES */}
            <div className="form-section panel-card">
              <div className="panel-header">
                <h2 className="form-section-title">2. Sources</h2>
                <button
                  className="btn-icon"
                  type="button"
                  onClick={() =>
                    setCreatePanelsOpen((prev) => ({
                      ...prev,
                      sources: !prev.sources,
                    }))
                  }
                  aria-label={createPanelsOpen.sources ? "Collapse sources" : "Expand sources"}
                  title={createPanelsOpen.sources ? "Collapse" : "Expand"}
                >
                  {createPanelsOpen.sources ? "▲" : "▼"}
                </button>
              </div>
              {createPanelsOpen.sources && (
                <div className="panel-body">

              {/* Source Types - Compact Inline */}
              <div className="form-group-compact">
                <div className="source-types-row">
                  <span className="source-types-label">Source Types:</span>
                  <label className="checkbox-label-inline-compact">
                    <input
                      type="checkbox"
                      checked={selectedConnectorTypes.includes("VECTOR")}
                      onChange={() => handleConnectorTypeToggle("VECTOR")}
                    />
                    Vector Stores
                  </label>
                  <label className="checkbox-label-inline-compact">
                    <input
                      type="checkbox"
                      checked={selectedConnectorTypes.includes("WEB_SEARCH")}
                      onChange={() => handleConnectorTypeToggle("WEB_SEARCH")}
                    />
                    Web Search
                  </label>
                </div>
              </div>

              {/* VECTOR STORES */}
              {selectedConnectorTypes.includes("VECTOR") && (
                <div className="form-group-compact">
                  <VectorStoreSelector
                    selectedVectorStores={selectedVectorStores}
                    onVectorStoreChange={setSelectedVectorStores}
                    selectedFiles={selectedFiles}
                    onFileChange={(storeId, fileIds) => {
                      setSelectedFiles((prev) => ({ ...prev, [storeId]: fileIds }));
                    }}
                    maxStores={2}
                  />
                </div>
              )}

              {/* WEB SEARCH */}
              {selectedConnectorTypes.includes("WEB_SEARCH") && (
                <div className="form-group-compact">
                  <p className="info-message">
                    ✓ Web search will be enabled for this report
                  </p>
                </div>
              )}
                </div>
              )}
            </div>

            {/* SECTION 3: SECTIONS */}
            <div className="form-section panel-card">
              <div className="form-section-header-compact panel-header">
                <h2 className="form-section-title">3. Sections</h2>
                <div className="panel-header-actions">
                  <button className="btn-secondary" type="button" onClick={addSection}>
                    + Add Section
                  </button>
                  <button
                    className="btn-icon"
                    type="button"
                    onClick={() =>
                      setCreatePanelsOpen((prev) => ({
                        ...prev,
                        sections: !prev.sections,
                      }))
                    }
                    aria-label={createPanelsOpen.sections ? "Collapse sections" : "Expand sections"}
                    title={createPanelsOpen.sections ? "Collapse" : "Expand"}
                  >
                    {createPanelsOpen.sections ? "▲" : "▼"}
                  </button>
                </div>
              </div>
              {createPanelsOpen.sections && (
                <div className="panel-body">

              {sections.length === 0 && (
                <p className="empty-message">No sections added yet. Click &quot;+ Add Section&quot; to begin.</p>
              )}

              {sections.map((section, index) => (
                <div key={section.id} className={`section-card-v2 ${section.isCollapsed ? 'collapsed' : ''}`}>
                  {/* COLLAPSED VIEW */}
                  {section.isCollapsed ? (
                    <div className="section-collapsed-view" onClick={() => toggleSectionCollapse(index)}>
                      <div className="section-collapsed-header">
                        <span className="section-icon">📄</span>
                        <div className="section-collapsed-info">
                          <h4>{section.title || `Section ${index + 1}`}</h4>
                          <p className="section-collapsed-meta">
                            Length: {section.targetLengthMin}-{section.targetLengthMax} words
                            {section.writingStyle && (
                              <span> • Style: {writingStyles.find(s => s.id === section.writingStyle)?.name || section.writingStyle}</span>
                            )}
                            {section.sourceMode === "custom" && (
                              <span> • Custom Sources: {formatCustomSources(section.customConnectorIds)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="section-collapsed-actions">
                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSection(index, "up");
                          }}
                          aria-label="Move section up"
                          title="Move Up"
                          disabled={index === 0}
                        >
                          ⬆️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSection(index, "down");
                          }}
                          aria-label="Move section down"
                          title="Move Down"
                          disabled={index === sections.length - 1}
                        >
                          ⬇️
                        </button>
                        <button 
                          className="btn-icon-expand" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSectionCollapse(index);
                          }}
                          aria-label="Expand section"
                          title="Expand"
                        >
                          ▼
                        </button>
                        <button
                          className="btn-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteSection(index, false);
                          }}
                          aria-label="Delete section"
                          title="Delete Section"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* EXPANDED VIEW */
                    <>
                      <div className="section-card-header">
                        <h3>Section {index + 1}</h3>
                      <div className="section-header-actions">
                        <button
                          className="btn-icon"
                          onClick={() => moveSection(index, "up")}
                          aria-label="Move section up"
                          title="Move Up"
                          disabled={index === 0}
                        >
                          ⬆️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => moveSection(index, "down")}
                          aria-label="Move section down"
                          title="Move Down"
                          disabled={index === sections.length - 1}
                        >
                          ⬇️
                        </button>
                        <button 
                          className="btn-icon-collapse" 
                          onClick={() => toggleSectionCollapse(index)}
                          aria-label="Collapse section"
                          title="Collapse"
                          >
                            ▲
                          </button>
                          <button
                            className="btn-icon-danger"
                            onClick={() => confirmDeleteSection(index, false)}
                            aria-label="Delete section"
                            title="Delete Section"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="form-group-compact">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const key = section.id || `index-${index}`;
                            if (createSectionErrors[key]?.title) {
                              setCreateSectionErrors((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], title: undefined },
                              }));
                            }
                            updateSection(index, "title", e.target.value);
                          }}
                          placeholder="Title *"
                          aria-label={`Section ${index + 1} title`}
                          aria-invalid={Boolean(createSectionErrors[section.id || `index-${index}`]?.title)}
                          aria-describedby={
                            createSectionErrors[section.id || `index-${index}`]?.title
                              ? `create-section-${section.id || `index-${index}`}-title-error`
                              : undefined
                          }
                        />
                        {createSectionErrors[section.id || `index-${index}`]?.title && (
                          <div
                            id={`create-section-${section.id || `index-${index}`}-title-error`}
                            className="field-error"
                            role="alert"
                          >
                            {createSectionErrors[section.id || `index-${index}`]?.title}
                          </div>
                        )}
                      </div>

                      {/* Length & Source - All in One Line */}
                      <div className="form-group-compact">
                        <div className="format-length-source-row">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={section.targetLengthMin !== undefined && section.targetLengthMin !== null ? section.targetLengthMin : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = val === "" ? undefined : parseInt(val) || 0;
                              updateSection(index, "targetLengthMin", numVal);
                              const key = section.id || `index-${index}`;
                              // Real-time validation
                              const max = section.targetLengthMax;
                              if (numVal !== undefined && max !== undefined && numVal > max) {
                                setCreateSectionErrors((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], length: "Min words must be less than or equal to max words." },
                                }));
                              } else if (createSectionErrors[key]?.length) {
                                setCreateSectionErrors((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], length: undefined },
                                }));
                              }
                            }}
                            placeholder="Min words"
                            aria-label={`Section ${index + 1} minimum word count`}
                            aria-describedby={
                              createSectionErrors[section.id || `index-${index}`]?.length
                                ? `create-section-${section.id || `index-${index}`}-length-error`
                                : undefined
                            }
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={section.targetLengthMax !== undefined && section.targetLengthMax !== null ? section.targetLengthMax : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = val === "" ? undefined : parseInt(val) || 0;
                              updateSection(index, "targetLengthMax", numVal);
                              const key = section.id || `index-${index}`;
                              // Real-time validation
                              const min = section.targetLengthMin;
                              if (numVal !== undefined && min !== undefined && min > numVal) {
                                setCreateSectionErrors((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], length: "Min words must be less than or equal to max words." },
                                }));
                              } else if (createSectionErrors[key]?.length) {
                                setCreateSectionErrors((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], length: undefined },
                                }));
                              }
                            }}
                            placeholder="Max words"
                            aria-label={`Section ${index + 1} maximum word count`}
                            aria-describedby={
                              createSectionErrors[section.id || `index-${index}`]?.length
                                ? `create-section-${section.id || `index-${index}`}-length-error`
                                : undefined
                            }
                          />
                          <select
                            value={section.sourceMode || ""}
                            onChange={(e) => updateSection(index, "sourceMode", e.target.value as "inherit" | "custom")}
                            className={!section.sourceMode ? "placeholder-select" : ""}
                            aria-label={`Section ${index + 1} source mode`}
                          >
                            <option value="" disabled>Source</option>
                            <option value="inherit">Same as Report</option>
                            <option value="custom">Custom Source</option>
                          </select>
                        </div>
                        {createSectionErrors[section.id || `index-${index}`]?.length && (
                          <div
                            id={`create-section-${section.id || `index-${index}`}-length-error`}
                            className="field-error"
                            role="alert"
                          >
                            {createSectionErrors[section.id || `index-${index}`]?.length}
                          </div>
                        )}
                      </div>

                      {/* Writing Style Dropdown */}
                      <div className="form-group-compact">
                        <select
                          value={section.writingStyle || ""}
                          onChange={(e) => updateSection(index, "writingStyle", e.target.value)}
                          className={`writing-style-select ${!section.writingStyle ? "placeholder-select" : ""}`}
                          aria-label={`Section ${index + 1} writing style`}
                        >
                          <option value="" disabled>Writing Style</option>
                          {writingStyles.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))}
                        </select>
                        {section.writingStyle && (
                          <div className="writing-style-description">
                            {writingStyles.find(s => s.id === section.writingStyle)?.description}
                          </div>
                        )}
                      </div>

                      {/* Purpose */}
                      <div className="form-group-compact">
                        <textarea
                          value={section.purpose || ""}
                          onChange={(e) => updateSection(index, "purpose", e.target.value)}
                          placeholder="Purpose"
                          rows={3}
                          aria-label={`Section ${index + 1} purpose`}
                        />
                      </div>

                      {/* Custom Source Details (if custom selected) */}
                      {section.sourceMode === "custom" && (
                        <div className="form-group-compact">
                          <div className="custom-source-selector-wrapper">
                            <h4 className="custom-source-title">Custom Sources for this Section</h4>
                            <p className="custom-source-summary">
                              Selected: {formatCustomSources(section.customConnectorIds)}
                            </p>
                            <VectorStoreSelector
                              selectedVectorStores={section.customConnectorIds || []}
                              onVectorStoreChange={(storeIds) => updateSection(index, "customConnectorIds", storeIds)}
                              selectedFiles={{}}
                              onFileChange={() => {}}
                              maxStores={2}
                            />
                          </div>
                        </div>
                      )}

                      {/* Collapse Button */}
                      <div className="section-card-footer">
                        <button 
                          className="btn-secondary" 
                          onClick={() => toggleSectionCollapse(index)}
                        >
                          ✓ Save & Collapse
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
                </div>
              )}
            </div>

            {/* SUBMIT BUTTON */}
            <div className="form-actions">
              <button className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Report Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVED TEMPLATES LIST */}
      {!showForm && (
        <div role="region" aria-label="Templates List">
          <div className="search-section" role="search" aria-label="Search templates">
            <input
              type="text"
              className="search-input"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search report templates"
            />
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="saved-templates-list" aria-busy="true" aria-live="polite">
              <div className="sr-only">Loading templates...</div>
              {[0, 1, 2].map((row) => (
                <div key={`skeleton-${row}`} className="saved-template-card">
                  <div className="saved-template-header">
                    <div className="saved-template-info">
                      <div className="skeleton-line" style={{ width: '60%', height: '1.5rem', marginBottom: '0.5rem' }} />
                      <div className="skeleton-line" style={{ width: '80%', height: '1rem', marginBottom: '0.5rem' }} />
                      <div className="skeleton-line" style={{ width: '40%', height: '1rem' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Master Templates Tab */}
          {!loading && activeTab === "master" && masterTemplates.length > 0 && (
            <div className="templates-section">
              <div className="saved-templates-list">
                {masterTemplates.map((template) => {
              const isExpanded = expandedTemplateId === template.id;
              const isEditing = editingTemplateId === template.id;
              
              return (
                <div key={template.id} className={`saved-template-card ${isExpanded ? 'expanded' : ''}`}>
                  {/* COLLAPSED HEADER */}
                  <div 
                    className="saved-template-header"
                    onClick={() => !isEditing && toggleTemplateExpansion(template.id)}
                  >
                    <div className="saved-template-info">
                      <h3 className="saved-template-title">
                        📊 {template.name}
                      </h3>
                      {template.description && (
                        <p className="saved-template-description">{template.description}</p>
                      )}
                      {template.audience && (
                        <div className="saved-template-meta">
                          <span>👥 {template.audience}</span>
                        </div>
                      )}
                      <div className="saved-template-meta">
                        <span>📄 {template.sections?.length || 0} Sections</span>
                        <span>🔌 {template.connectors?.length || 0} Sources</span>
                      </div>
                    </div>
                    
                    <div className="saved-template-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTemplateExpansion(template.id);
                        }}
                        aria-label={isExpanded ? "Collapse template" : "Expand template"}
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingTemplate(template.id);
                          if (!isExpanded) setExpandedTemplateId(template.id);
                        }}
                        aria-label="Edit template"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          cloneTemplate(template.id);
                        }}
                        aria-label="Clone template"
                        title="Clone"
                      >
                        📋
                      </button>
                      <button
                        className="btn-icon-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(template.id);
                        }}
                        aria-label="Delete template"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED CONTENT */}
                  {isExpanded && (
                    <div className="saved-template-expanded">
                      {/* 1. OBJECTIVES */}
                      <div className="expanded-section panel-card">
                        <div className="panel-header">
                          <h4 className="expanded-section-title">1. Objectives {isEditing ? "(Editing)" : "(Read-only)"}</h4>
                          {isEditing && (
                            <button
                              className="btn-icon"
                              type="button"
                              onClick={() =>
                                setEditPanelsOpen((prev) => ({
                                  ...prev,
                                  objectives: !prev.objectives,
                                }))
                              }
                              aria-label={editPanelsOpen.objectives ? "Collapse objectives" : "Expand objectives"}
                              title={editPanelsOpen.objectives ? "Collapse" : "Expand"}
                            >
                              {editPanelsOpen.objectives ? "▲" : "▼"}
                            </button>
                          )}
                        </div>
                        {(!isEditing || editPanelsOpen.objectives) && (
                          <div className="expanded-section-content panel-body">
                          {isEditing ? (
                            <>
                              <div className="form-group-compact">
                                <input
                                  type="text"
                                  value={editFormData.name || ""}
                                  onChange={(e) => {
                                    if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: undefined }));
                                    setEditFormData({...editFormData, name: e.target.value});
                                  }}
                                  placeholder="Report Name *"
                                  aria-label="Report name"
                                  aria-invalid={Boolean(editErrors.name)}
                                  aria-describedby={editErrors.name ? "edit-template-name-error" : undefined}
                                />
                                {editErrors.name && (
                                  <div id="edit-template-name-error" className="field-error" role="alert">
                                    {editErrors.name}
                                  </div>
                                )}
                              </div>
                              <div className="form-group-compact">
                                <textarea
                                  value={editFormData.description || ""}
                                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                                  placeholder="Description"
                                  rows={3}
                                  aria-label="Report description"
                                />
                              </div>
                              <div className="form-group-compact">
                                <div className="two-column-row">
                                  <input
                                    type="text"
                                    value={editFormData.audience || ""}
                                    onChange={(e) => setEditFormData({...editFormData, audience: e.target.value})}
                                    placeholder="Audience"
                                    aria-label="Audience"
                                  />
                                  <input
                                    type="text"
                                    value={editFormData.tone || ""}
                                    onChange={(e) => setEditFormData({...editFormData, tone: e.target.value})}
                                    placeholder="Tone"
                                    aria-label="Tone"
                                  />
                                </div>
                              </div>
                              <div className="form-group-compact">
                                <div className="two-column-row">
                                  <input
                                    type="text"
                                    value={editFormData.domain || ""}
                                    onChange={(e) => setEditFormData({...editFormData, domain: e.target.value})}
                                    placeholder="Domain"
                                    aria-label="Domain"
                                  />
                                  <input
                                    type="text"
                                    value={editFormData.jurisdiction || ""}
                                    onChange={(e) => setEditFormData({...editFormData, jurisdiction: e.target.value})}
                                    placeholder="Jurisdiction"
                                    aria-label="Jurisdiction"
                                  />
                                </div>
                              </div>
                              <div className="form-group-compact">
                                <label className="checkbox-label-inline-compact">
                                  <input
                                    type="checkbox"
                                    checked={isMaster}
                                    onChange={(e) => setIsMaster(e.target.checked)}
                                  />
                                  Master Template
                                </label>
                              </div>
                            </>
                          ) : (
                            <div className="read-only-fields">
                              <div className="read-only-row"><strong>Report Name:</strong> {template.name}</div>
                              {template.description && <div className="read-only-row"><strong>Description:</strong> {template.description}</div>}
                              <div className="read-only-row">
                                {template.audience && <span><strong>Audience:</strong> {template.audience}</span>}
                                {template.tone && <span><strong>Tone:</strong> {template.tone}</span>}
                              </div>
                              <div className="read-only-row">
                                {template.domain && <span><strong>Domain:</strong> {template.domain}</span>}
                                {template.jurisdiction && <span><strong>Jurisdiction:</strong> {template.jurisdiction}</span>}
                              </div>
                              {template.formats && template.formats.length > 0 && (
                                <div className="read-only-row">
                                  <strong>Formats:</strong> {template.formats.map(f => f.toUpperCase()).join(", ")}
                                </div>
                              )}
                              {template.isMaster && (
                                <div className="read-only-row">
                                  <strong>⭐ Master Template</strong>
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        )}
                      </div>

                      {/* 2. SOURCES */}
                      <div className="expanded-section panel-card">
                        <div className="panel-header">
                          <h4 className="expanded-section-title">2. Sources</h4>
                          {isEditing && (
                            <button
                              className="btn-icon"
                              type="button"
                              onClick={() =>
                                setEditPanelsOpen((prev) => ({
                                  ...prev,
                                  sources: !prev.sources,
                                }))
                              }
                              aria-label={editPanelsOpen.sources ? "Collapse sources" : "Expand sources"}
                              title={editPanelsOpen.sources ? "Collapse" : "Expand"}
                            >
                              {editPanelsOpen.sources ? "▲" : "▼"}
                            </button>
                          )}
                        </div>
                        {(!isEditing || editPanelsOpen.sources) && (
                          <div className="expanded-section-content panel-body">
                          {isEditing ? (
                            // EDIT MODE - Show editable sources
                            <div className="form-section-compact">
                              {/* Source Types - Compact Inline */}
                              <div className="form-group-compact">
                                <div className="source-types-row">
                                  <span className="source-types-label">Source Types:</span>
                                  <label className="checkbox-label-inline-compact">
                                    <input
                                      type="checkbox"
                                      checked={selectedConnectorTypes.includes("VECTOR")}
                                      onChange={() => handleConnectorTypeToggle("VECTOR")}
                                    />
                                    Vector Stores
                                  </label>
                                  <label className="checkbox-label-inline-compact">
                                    <input
                                      type="checkbox"
                                      checked={selectedConnectorTypes.includes("WEB_SEARCH")}
                                      onChange={() => handleConnectorTypeToggle("WEB_SEARCH")}
                                    />
                                    Web Search
                                  </label>
                                </div>
                              </div>

                              {/* VECTOR STORES */}
                              {selectedConnectorTypes.includes("VECTOR") && (
                                <div className="form-group-compact">
                                  <VectorStoreSelector
                                    selectedVectorStores={selectedVectorStores}
                                    onVectorStoreChange={setSelectedVectorStores}
                                    selectedFiles={selectedFiles}
                                    onFileChange={(storeId, fileIds) => {
                                      setSelectedFiles((prev) => ({ ...prev, [storeId]: fileIds }));
                                    }}
                                    maxStores={2}
                                  />
                                </div>
                              )}

                              {/* WEB SEARCH */}
                              {selectedConnectorTypes.includes("WEB_SEARCH") && (
                                <div className="form-group-compact">
                                  <p className="info-message">
                                    ✓ Web search will be enabled for this report
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            // READ-ONLY MODE - Show configured sources
                            template.connectors && template.connectors.length > 0 ? (
                              <div className="read-only-fields">
                                {template.connectors.map((conn) => (
                                  <div key={conn.id} className="read-only-row">
                                    ✓ {conn.type}: {conn.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="empty-message">No sources configured</p>
                            )
                          )}
                          </div>
                        )}
                      </div>

                      {/* 3. SECTIONS */}
                      <div className="expanded-section panel-card">
                        <div className="expanded-section-header panel-header">
                          <h4 className="expanded-section-title">3. Sections</h4>
                          {isEditing && (
                            <div className="panel-header-actions">
                              <button className="btn-secondary" type="button" onClick={addEditSection}>
                                + Add Section
                              </button>
                              <button
                                className="btn-icon"
                                type="button"
                                onClick={() =>
                                  setEditPanelsOpen((prev) => ({
                                    ...prev,
                                    sections: !prev.sections,
                                  }))
                                }
                                aria-label={editPanelsOpen.sections ? "Collapse sections" : "Expand sections"}
                                title={editPanelsOpen.sections ? "Collapse" : "Expand"}
                              >
                                {editPanelsOpen.sections ? "▲" : "▼"}
                              </button>
                            </div>
                          )}
                        </div>
                        {(!isEditing || editPanelsOpen.sections) && (
                          <div className="expanded-section-content panel-body">
                          {isEditing ? (
                            // EDIT MODE - Show editable sections
                            editFormData.sections && editFormData.sections.length > 0 ? (
                              <div className="sections-list-editable">
                                {editFormData.sections.map((section, idx) => (
                                  <div key={section.id || idx} className="section-edit-card">
                                    <div className="section-edit-header">
                                      <strong>Section {idx + 1}</strong>
                                      <div className="section-edit-actions">
                                        <button
                                          className="btn-icon"
                                          onClick={() => moveEditSection(idx, "up")}
                                          aria-label="Move section up"
                                          title="Move Up"
                                          disabled={idx === 0}
                                        >
                                          ⬆️
                                        </button>
                                        <button
                                          className="btn-icon"
                                          onClick={() => moveEditSection(idx, "down")}
                                          aria-label="Move section down"
                                          title="Move Down"
                                          disabled={idx === (editFormData.sections?.length || 0) - 1}
                                        >
                                          ⬇️
                                        </button>
                                        <button
                                          className="btn-icon-danger"
                                          onClick={() => confirmDeleteSection(idx, true)}
                                          aria-label="Delete section"
                                          title="Delete Section"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                    <div className="section-edit-fields">
                                      <div className="form-group-compact">
                                        <input
                                          type="text"
                                          value={section.title || ""}
                                          onChange={(e) => {
                                            const key = section.id || `index-${idx}`;
                                            if (editSectionErrors[key]?.title) {
                                              setEditSectionErrors((prev) => ({
                                                ...prev,
                                                [key]: { ...prev[key], title: undefined },
                                              }));
                                            }
                                            const updatedSections = [...(editFormData.sections || [])];
                                            updatedSections[idx] = {...updatedSections[idx], title: e.target.value};
                                            setEditFormData({...editFormData, sections: updatedSections});
                                          }}
                                          placeholder="Section Title *"
                                          aria-label={`Section ${idx + 1} title`}
                                          aria-invalid={Boolean(editSectionErrors[section.id || `index-${idx}`]?.title)}
                                          aria-describedby={
                                            editSectionErrors[section.id || `index-${idx}`]?.title
                                              ? `edit-section-${section.id || `index-${idx}`}-title-error`
                                              : undefined
                                          }
                                        />
                                        {editSectionErrors[section.id || `index-${idx}`]?.title && (
                                          <div
                                            id={`edit-section-${section.id || `index-${idx}`}-title-error`}
                                            className="field-error"
                                            role="alert"
                                          >
                                            {editSectionErrors[section.id || `index-${idx}`]?.title}
                                          </div>
                                        )}
                                      </div>
                                      <div className="form-group-compact">
                                        <textarea
                                          value={section.purpose || ""}
                                          onChange={(e) => {
                                            const updatedSections = [...(editFormData.sections || [])];
                                            updatedSections[idx] = {...updatedSections[idx], purpose: e.target.value};
                                            setEditFormData({...editFormData, sections: updatedSections});
                                          }}
                                          placeholder="Purpose"
                                          rows={2}
                                          aria-label={`Section ${idx + 1} purpose`}
                                        />
                                      </div>
                                      <div className="form-group-compact">
                                        <label className="form-label-compact">Length & Source - min/max words, source</label>
                                        <div className="form-row-inline">
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            value={section.targetLengthMin || ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const numVal = val === "" ? undefined : parseInt(val) || 0;
                                              const key = section.id || `index-${idx}`;
                                              const updatedSections = [...(editFormData.sections || [])];
                                              updatedSections[idx] = {...updatedSections[idx], targetLengthMin: numVal};
                                              setEditFormData({...editFormData, sections: updatedSections});
                                              // Real-time validation
                                              const max = updatedSections[idx].targetLengthMax;
                                              if (numVal !== undefined && max !== undefined && numVal > max) {
                                                setEditSectionErrors((prev) => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], length: "Min words must be less than or equal to max words." },
                                                }));
                                              } else if (editSectionErrors[key]?.length) {
                                                setEditSectionErrors((prev) => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], length: undefined },
                                                }));
                                              }
                                            }}
                                            placeholder="Min words"
                                            aria-label={`Section ${idx + 1} minimum word count`}
                                            aria-describedby={
                                              editSectionErrors[section.id || `index-${idx}`]?.length
                                                ? `edit-section-${section.id || `index-${idx}`}-length-error`
                                                : undefined
                                            }
                                          />
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            value={section.targetLengthMax || ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const numVal = val === "" ? undefined : parseInt(val) || 0;
                                              const key = section.id || `index-${idx}`;
                                              const updatedSections = [...(editFormData.sections || [])];
                                              updatedSections[idx] = {...updatedSections[idx], targetLengthMax: numVal};
                                              setEditFormData({...editFormData, sections: updatedSections});
                                              // Real-time validation
                                              const min = updatedSections[idx].targetLengthMin;
                                              if (numVal !== undefined && min !== undefined && min > numVal) {
                                                setEditSectionErrors((prev) => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], length: "Min words must be less than or equal to max words." },
                                                }));
                                              } else if (editSectionErrors[key]?.length) {
                                                setEditSectionErrors((prev) => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], length: undefined },
                                                }));
                                              }
                                            }}
                                            placeholder="Max words"
                                            aria-label={`Section ${idx + 1} maximum word count`}
                                            aria-describedby={
                                              editSectionErrors[section.id || `index-${idx}`]?.length
                                                ? `edit-section-${section.id || `index-${idx}`}-length-error`
                                                : undefined
                                            }
                                          />
                                          <select
                                            value={section.sourceMode || ""}
                                            onChange={(e) => {
                                              const updatedSections = [...(editFormData.sections || [])];
                                              updatedSections[idx] = {...updatedSections[idx], sourceMode: e.target.value as "inherit" | "custom"};
                                              setEditFormData({...editFormData, sections: updatedSections});
                                            }}
                                            className={!section.sourceMode ? "placeholder-select" : ""}
                                            aria-label={`Section ${idx + 1} source mode`}
                                          >
                                            <option value="" disabled>Source</option>
                                            <option value="inherit">Same as Report</option>
                                            <option value="custom">Custom Source</option>
                                          </select>
                                        </div>
                                        {editSectionErrors[section.id || `index-${idx}`]?.length && (
                                          <div
                                            id={`edit-section-${section.id || `index-${idx}`}-length-error`}
                                            className="field-error"
                                            role="alert"
                                          >
                                            {editSectionErrors[section.id || `index-${idx}`]?.length}
                                          </div>
                                        )}
                                      </div>
                                      {section.sourceMode === "custom" && (
                                        <div className="form-group-compact">
                                          <div className="custom-source-selector-wrapper">
                                            <h4 className="custom-source-title">Custom Sources for this Section</h4>
                                            <p className="custom-source-summary">
                                              Selected: {formatCustomSources(section.customConnectorIds)}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Writing Style Dropdown */}
                                      <div className="form-group-compact">
                                        <label className="form-label-compact">Writing Style</label>
                                        <select
                                          value={section.writingStyle || ""}
                                          onChange={(e) => {
                                            const updatedSections = [...(editFormData.sections || [])];
                                            updatedSections[idx] = {...updatedSections[idx], writingStyle: e.target.value};
                                            setEditFormData({...editFormData, sections: updatedSections});
                                          }}
                                          className={`writing-style-select ${!section.writingStyle ? "placeholder-select" : ""}`}
                                          aria-label={`Section ${idx + 1} writing style`}
                                        >
                                          <option value="" disabled>Writing Style</option>
                                          {writingStyles.map((style) => (
                                            <option key={style.id} value={style.id}>
                                              {style.name}
                                            </option>
                                          ))}
                                        </select>
                                        {section.writingStyle && (
                                          <div className="writing-style-description">
                                            {writingStyles.find(s => s.id === section.writingStyle)?.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="empty-message">No sections added</p>
                            )
                          ) : (
                            // READ-ONLY MODE - Show section details
                            template.sections && template.sections.length > 0 ? (
                              <div className="sections-list-compact">
                                {template.sections.map((section, idx) => (
                                  <div key={section.id || idx} className="section-item-detailed">
                                    <div className="section-detail-header">
                                      <strong>📄 {section.title}</strong>
                                      <span className="section-meta-compact">
                                        {section.targetLengthMin}-{section.targetLengthMax} words
                                      </span>
                                    </div>
                                    {section.purpose && (
                                      <div className="section-detail-purpose">{section.purpose}</div>
                                    )}
                                    <div className="section-detail-meta">
                                      <span>Source: {section.sourceMode === 'inherit' ? 'Same as Report' : section.sourceMode === 'custom' ? 'Custom Source' : 'N/A'}</span>
                                      {section.writingStyle && (
                                        <span>Writing Style: {writingStyles.find(s => s.id === section.writingStyle)?.name || section.writingStyle}</span>
                                      )}
                                    </div>
                                    {section.sourceMode === "custom" && (
                                      <div className="section-detail-meta">
                                        <span>Custom Sources: {formatCustomSources(section.customConnectorIds)}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="empty-message">No sections added</p>
                            )
                          )}
                          </div>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      {isEditing && (
                        <div className="expanded-actions">
                          <button className="btn-secondary" onClick={cancelEditingTemplate}>
                            Cancel
                          </button>
                          <button className="btn-secondary" onClick={saveTemplateAs}>
                            Save As
                          </button>
                          <button className="btn-primary" onClick={saveTemplateEdits}>
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          )}

          {!loading && activeTab === "master" && masterTemplates.length === 0 && (
            <div className="empty-state">
              <p>No master templates found.</p>
            </div>
          )}

          {/* Regular Templates Tab */}
          {!loading && activeTab === "regular" && regularTemplates.length > 0 && (
            <div className="templates-section">
              <div className="saved-templates-list">
                {regularTemplates.map((template) => {
                  const isExpanded = expandedTemplateId === template.id;
                  const isEditing = editingTemplateId === template.id;
                  
                  return (
                    <div key={template.id} className={`saved-template-card ${isExpanded ? 'expanded' : ''}`}>
                      {/* Same structure as master templates - copy from above */}
                      <div 
                        className="saved-template-header"
                        onClick={() => !isEditing && toggleTemplateExpansion(template.id)}
                      >
                        <div className="saved-template-info">
                          <h3 className="saved-template-title">
                            📊 {template.name}
                          </h3>
                          {template.description && (
                            <p className="saved-template-description">{template.description}</p>
                          )}
                          {template.audience && (
                            <div className="saved-template-meta">
                              <span>👥 {template.audience}</span>
                            </div>
                          )}
                          <div className="saved-template-meta">
                            <span>📄 {template.sections?.length || 0} Sections</span>
                            <span>🔌 {template.connectors?.length || 0} Sources</span>
                          </div>
                        </div>
                        
                        <div className="saved-template-actions">
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTemplateExpansion(template.id);
                            }}
                            aria-label={isExpanded ? "Collapse template" : "Expand template"}
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTemplate(template.id);
                              if (!isExpanded) setExpandedTemplateId(template.id);
                            }}
                            aria-label="Edit template"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              cloneTemplate(template.id);
                            }}
                            aria-label="Clone template"
                            title="Clone"
                          >
                            📋
                          </button>
                          <button
                            className="btn-icon-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(template.id);
                            }}
                            aria-label="Delete template"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="saved-template-expanded">
                          {/* 1. OBJECTIVES */}
                          <div className="expanded-section panel-card">
                            <div className="panel-header">
                              <h4 className="expanded-section-title">1. Objectives {isEditing ? "(Editing)" : "(Read-only)"}</h4>
                              {isEditing && (
                                <button
                                  className="btn-icon"
                                  type="button"
                                  onClick={() =>
                                    setEditPanelsOpen((prev) => ({
                                      ...prev,
                                      objectives: !prev.objectives,
                                    }))
                                  }
                                  aria-label={editPanelsOpen.objectives ? "Collapse objectives" : "Expand objectives"}
                                  title={editPanelsOpen.objectives ? "Collapse" : "Expand"}
                                >
                                  {editPanelsOpen.objectives ? "▲" : "▼"}
                                </button>
                              )}
                            </div>
                            {(!isEditing || editPanelsOpen.objectives) && (
                              <div className="expanded-section-content panel-body">
                              {isEditing ? (
                                <>
                                  <div className="form-group-compact">
                                    <input
                                      type="text"
                                      value={editFormData.name || ""}
                                      onChange={(e) => {
                                        if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: undefined }));
                                        setEditFormData({...editFormData, name: e.target.value});
                                      }}
                                      placeholder="Report Name *"
                                      aria-label="Report name"
                                      aria-invalid={Boolean(editErrors.name)}
                                      aria-describedby={editErrors.name ? "edit-template-name-error" : undefined}
                                    />
                                    {editErrors.name && (
                                      <div id="edit-template-name-error" className="field-error" role="alert">
                                        {editErrors.name}
                                      </div>
                                    )}
                                  </div>
                                  <div className="form-group-compact">
                                    <textarea
                                      value={editFormData.description || ""}
                                      onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                                      placeholder="Description"
                                      rows={3}
                                      aria-label="Report description"
                                    />
                                  </div>
                                  <div className="form-group-compact">
                                    <div className="two-column-row">
                                      <input
                                        type="text"
                                        value={editFormData.audience || ""}
                                        onChange={(e) => setEditFormData({...editFormData, audience: e.target.value})}
                                        placeholder="Audience"
                                        aria-label="Audience"
                                      />
                                      <input
                                        type="text"
                                        value={editFormData.tone || ""}
                                        onChange={(e) => setEditFormData({...editFormData, tone: e.target.value})}
                                        placeholder="Tone"
                                        aria-label="Tone"
                                      />
                                    </div>
                                  </div>
                                  <div className="form-group-compact">
                                    <div className="two-column-row">
                                      <input
                                        type="text"
                                        value={editFormData.domain || ""}
                                        onChange={(e) => setEditFormData({...editFormData, domain: e.target.value})}
                                        placeholder="Domain"
                                        aria-label="Domain"
                                      />
                                      <input
                                        type="text"
                                        value={editFormData.jurisdiction || ""}
                                        onChange={(e) => setEditFormData({...editFormData, jurisdiction: e.target.value})}
                                        placeholder="Jurisdiction"
                                        aria-label="Jurisdiction"
                                      />
                                    </div>
                                  </div>
                                  <div className="form-group-compact">
                                    <label className="checkbox-label-inline-compact">
                                      <input
                                        type="checkbox"
                                        checked={isMaster}
                                        onChange={(e) => setIsMaster(e.target.checked)}
                                      />
                                      Master Template
                                    </label>
                                  </div>
                                </>
                              ) : (
                                <div className="read-only-fields">
                                  <div className="read-only-row"><strong>Report Name:</strong> {template.name}</div>
                                  {template.description && <div className="read-only-row"><strong>Description:</strong> {template.description}</div>}
                                  <div className="read-only-row">
                                    {template.audience && <span><strong>Audience:</strong> {template.audience}</span>}
                                    {template.tone && <span><strong>Tone:</strong> {template.tone}</span>}
                                  </div>
                                  <div className="read-only-row">
                                    {template.domain && <span><strong>Domain:</strong> {template.domain}</span>}
                                    {template.jurisdiction && <span><strong>Jurisdiction:</strong> {template.jurisdiction}</span>}
                                  </div>
                                  {template.formats && template.formats.length > 0 && (
                                    <div className="read-only-row">
                                      <strong>Formats:</strong> {template.formats.map(f => f.toUpperCase()).join(", ")}
                                    </div>
                                  )}
                                  {template.isMaster && (
                                    <div className="read-only-row">
                                      <strong>⭐ Master Template</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                              </div>
                            )}
                          </div>

                          {/* 2. SOURCES */}
                          <div className="expanded-section panel-card">
                            <div className="panel-header">
                              <h4 className="expanded-section-title">2. Sources</h4>
                              {isEditing && (
                                <button
                                  className="btn-icon"
                                  type="button"
                                  onClick={() =>
                                    setEditPanelsOpen((prev) => ({
                                      ...prev,
                                      sources: !prev.sources,
                                    }))
                                  }
                                  aria-label={editPanelsOpen.sources ? "Collapse sources" : "Expand sources"}
                                  title={editPanelsOpen.sources ? "Collapse" : "Expand"}
                                >
                                  {editPanelsOpen.sources ? "▲" : "▼"}
                                </button>
                              )}
                            </div>
                            {(!isEditing || editPanelsOpen.sources) && (
                              <div className="expanded-section-content panel-body">
                              {isEditing ? (
                                // EDIT MODE - Show editable sources
                                <div className="form-section-compact">
                                  {/* Source Types - Compact Inline */}
                                  <div className="form-group-compact">
                                    <div className="source-types-row">
                                      <span className="source-types-label">Source Types:</span>
                                      <label className="checkbox-label-inline-compact">
                                        <input
                                          type="checkbox"
                                          checked={selectedConnectorTypes.includes("VECTOR")}
                                          onChange={() => handleConnectorTypeToggle("VECTOR")}
                                        />
                                        Vector Stores
                                      </label>
                                      <label className="checkbox-label-inline-compact">
                                        <input
                                          type="checkbox"
                                          checked={selectedConnectorTypes.includes("WEB_SEARCH")}
                                          onChange={() => handleConnectorTypeToggle("WEB_SEARCH")}
                                        />
                                        Web Search
                                      </label>
                                    </div>
                                  </div>

                                  {/* VECTOR STORES */}
                                  {selectedConnectorTypes.includes("VECTOR") && (
                                    <div className="form-group-compact">
                                      <VectorStoreSelector
                                        selectedVectorStores={selectedVectorStores}
                                        onVectorStoreChange={setSelectedVectorStores}
                                        selectedFiles={selectedFiles}
                                        onFileChange={(storeId, fileIds) => {
                                          setSelectedFiles((prev) => ({ ...prev, [storeId]: fileIds }));
                                        }}
                                        maxStores={2}
                                      />
                                    </div>
                                  )}

                                  {/* WEB SEARCH */}
                                  {selectedConnectorTypes.includes("WEB_SEARCH") && (
                                    <div className="form-group-compact">
                                      <p className="info-message">
                                        ✓ Web search will be enabled for this report
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // READ-ONLY MODE - Show configured sources
                                template.connectors && template.connectors.length > 0 ? (
                                  <div className="read-only-fields">
                                    {template.connectors.map((conn) => (
                                      <div key={conn.id} className="read-only-row">
                                        ✓ {conn.type}: {conn.name}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="empty-message">No sources configured</p>
                                )
                              )}
                              </div>
                            )}
                          </div>

                          {/* 3. SECTIONS */}
                          <div className="expanded-section panel-card">
                            <div className="expanded-section-header panel-header">
                              <h4 className="expanded-section-title">3. Sections</h4>
                              {isEditing && (
                                <div className="panel-header-actions">
                                  <button className="btn-secondary" type="button" onClick={addEditSection}>
                                    + Add Section
                                  </button>
                                  <button
                                    className="btn-icon"
                                    type="button"
                                    onClick={() =>
                                      setEditPanelsOpen((prev) => ({
                                        ...prev,
                                        sections: !prev.sections,
                                      }))
                                    }
                                    aria-label={editPanelsOpen.sections ? "Collapse sections" : "Expand sections"}
                                    title={editPanelsOpen.sections ? "Collapse" : "Expand"}
                                  >
                                    {editPanelsOpen.sections ? "▲" : "▼"}
                                  </button>
                                </div>
                              )}
                            </div>
                            {(!isEditing || editPanelsOpen.sections) && (
                              <div className="expanded-section-content panel-body">
                              {isEditing ? (
                                // EDIT MODE - Show editable sections
                                editFormData.sections && editFormData.sections.length > 0 ? (
                                  <div className="sections-list-editable">
                                    {editFormData.sections.map((section, idx) => (
                                      <div key={section.id || idx} className="section-edit-card">
                                        <div className="section-edit-header">
                                          <strong>Section {idx + 1}</strong>
                                          <div className="section-edit-actions">
                                            <button
                                              className="btn-icon"
                                              onClick={() => moveEditSection(idx, "up")}
                                              aria-label="Move section up"
                                              title="Move Up"
                                              disabled={idx === 0}
                                            >
                                              ⬆️
                                            </button>
                                            <button
                                              className="btn-icon"
                                              onClick={() => moveEditSection(idx, "down")}
                                              aria-label="Move section down"
                                              title="Move Down"
                                              disabled={idx === (editFormData.sections?.length || 0) - 1}
                                            >
                                              ⬇️
                                            </button>
                                            <button
                                              className="btn-icon-danger"
                                              onClick={() => deleteEditSection(idx)}
                                              aria-label="Delete section"
                                              title="Delete Section"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </div>
                                        <div className="section-edit-fields">
                                          <div className="form-group-compact">
                                            <input
                                              type="text"
                                              value={section.title || ""}
                                              onChange={(e) => {
                                                const key = section.id || `index-${idx}`;
                                                if (editSectionErrors[key]?.title) {
                                                  setEditSectionErrors((prev) => ({
                                                    ...prev,
                                                    [key]: { ...prev[key], title: undefined },
                                                  }));
                                                }
                                                const updatedSections = [...(editFormData.sections || [])];
                                                updatedSections[idx] = {...updatedSections[idx], title: e.target.value};
                                                setEditFormData({...editFormData, sections: updatedSections});
                                              }}
                                              placeholder="Section Title *"
                                              aria-label={`Section ${idx + 1} title`}
                                              aria-invalid={Boolean(editSectionErrors[section.id || `index-${idx}`]?.title)}
                                              aria-describedby={
                                                editSectionErrors[section.id || `index-${idx}`]?.title
                                                  ? `edit-section-${section.id || `index-${idx}`}-title-error`
                                                  : undefined
                                              }
                                            />
                                            {editSectionErrors[section.id || `index-${idx}`]?.title && (
                                              <div
                                                id={`edit-section-${section.id || `index-${idx}`}-title-error`}
                                                className="field-error"
                                                role="alert"
                                              >
                                                {editSectionErrors[section.id || `index-${idx}`]?.title}
                                              </div>
                                            )}
                                          </div>
                                          <div className="form-group-compact">
                                            <textarea
                                              value={section.purpose || ""}
                                              onChange={(e) => {
                                                const updatedSections = [...(editFormData.sections || [])];
                                                updatedSections[idx] = {...updatedSections[idx], purpose: e.target.value};
                                                setEditFormData({...editFormData, sections: updatedSections});
                                              }}
                                              placeholder="Purpose"
                                              rows={2}
                                              aria-label={`Section ${idx + 1} purpose`}
                                            />
                                          </div>
                                          <div className="form-group-compact">
                                            <label className="form-label-compact">Length & Source - min/max words, source</label>
                                            <div className="form-row-inline">
                                              <input
                                                type="number"
                                                value={section.targetLengthMin || ""}
                                                onChange={(e) => {
                                                  const key = section.id || `index-${idx}`;
                                                  if (editSectionErrors[key]?.length) {
                                                    setEditSectionErrors((prev) => ({
                                                      ...prev,
                                                      [key]: { ...prev[key], length: undefined },
                                                    }));
                                                  }
                                                  const updatedSections = [...(editFormData.sections || [])];
                                                  updatedSections[idx] = {...updatedSections[idx], targetLengthMin: parseInt(e.target.value) || 0};
                                                  setEditFormData({...editFormData, sections: updatedSections});
                                                }}
                                                placeholder="Min words"
                                                aria-label={`Section ${idx + 1} minimum word count`}
                                                aria-describedby={
                                                  editSectionErrors[section.id || `index-${idx}`]?.length
                                                    ? `edit-section-${section.id || `index-${idx}`}-length-error`
                                                    : undefined
                                                }
                                              />
                                              <input
                                                type="number"
                                                value={section.targetLengthMax || ""}
                                                onChange={(e) => {
                                                  const key = section.id || `index-${idx}`;
                                                  if (editSectionErrors[key]?.length) {
                                                    setEditSectionErrors((prev) => ({
                                                      ...prev,
                                                      [key]: { ...prev[key], length: undefined },
                                                    }));
                                                  }
                                                  const updatedSections = [...(editFormData.sections || [])];
                                                  updatedSections[idx] = {...updatedSections[idx], targetLengthMax: parseInt(e.target.value) || 0};
                                                  setEditFormData({...editFormData, sections: updatedSections});
                                                }}
                                                placeholder="Max words"
                                                aria-label={`Section ${idx + 1} maximum word count`}
                                                aria-describedby={
                                                  editSectionErrors[section.id || `index-${idx}`]?.length
                                                    ? `edit-section-${section.id || `index-${idx}`}-length-error`
                                                    : undefined
                                                }
                                              />
                                              <select
                                                value={section.sourceMode || ""}
                                                onChange={(e) => {
                                                  const updatedSections = [...(editFormData.sections || [])];
                                                  updatedSections[idx] = {...updatedSections[idx], sourceMode: e.target.value as "inherit" | "custom"};
                                                  setEditFormData({...editFormData, sections: updatedSections});
                                                }}
                                                className={!section.sourceMode ? "placeholder-select" : ""}
                                                aria-label={`Section ${idx + 1} source mode`}
                                              >
                                                <option value="" disabled>Source</option>
                                                <option value="inherit">Same as Report</option>
                                                <option value="custom">Custom Source</option>
                                              </select>
                                            </div>
                                            {editSectionErrors[section.id || `index-${idx}`]?.length && (
                                              <div
                                                id={`edit-section-${section.id || `index-${idx}`}-length-error`}
                                                className="field-error"
                                                role="alert"
                                              >
                                                {editSectionErrors[section.id || `index-${idx}`]?.length}
                                              </div>
                                            )}
                                          </div>
                                          {section.sourceMode === "custom" && (
                                            <div className="form-group-compact">
                                              <div className="custom-source-selector-wrapper">
                                                <h4 className="custom-source-title">Custom Sources for this Section</h4>
                                                <p className="custom-source-summary">
                                                  Selected: {formatCustomSources(section.customConnectorIds)}
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Writing Style Dropdown */}
                                          <div className="form-group-compact">
                                            <label className="form-label-compact">Writing Style</label>
                                            <select
                                              value={section.writingStyle || ""}
                                              onChange={(e) => {
                                                const updatedSections = [...(editFormData.sections || [])];
                                                updatedSections[idx] = {...updatedSections[idx], writingStyle: e.target.value};
                                                setEditFormData({...editFormData, sections: updatedSections});
                                              }}
                                              className={`writing-style-select ${!section.writingStyle ? "placeholder-select" : ""}`}
                                              aria-label={`Section ${idx + 1} writing style`}
                                            >
                                              <option value="" disabled>Writing Style</option>
                                              {writingStyles.map((style) => (
                                                <option key={style.id} value={style.id}>
                                                  {style.name}
                                                </option>
                                              ))}
                                            </select>
                                            {section.writingStyle && (
                                              <div className="writing-style-description">
                                                {writingStyles.find(s => s.id === section.writingStyle)?.description}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="empty-message">No sections added</p>
                                )
                              ) : (
                                // READ-ONLY MODE - Show section details
                                template.sections && template.sections.length > 0 ? (
                                  <div className="sections-list-compact">
                                    {template.sections.map((section, idx) => (
                                      <div key={section.id || idx} className="section-item-detailed">
                                        <div className="section-detail-header">
                                          <strong>📄 {section.title}</strong>
                                          <span className="section-meta-compact">
                                            {section.targetLengthMin}-{section.targetLengthMax} words
                                          </span>
                                        </div>
                                        {section.purpose && (
                                          <div className="section-detail-purpose">{section.purpose}</div>
                                        )}
                                        <div className="section-detail-meta">
                                          <span>Source: {section.sourceMode === 'inherit' ? 'Same as Report' : section.sourceMode === 'custom' ? 'Custom Source' : 'N/A'}</span>
                                          {section.writingStyle && (
                                            <span>Writing Style: {writingStyles.find(s => s.id === section.writingStyle)?.name || section.writingStyle}</span>
                                          )}
                                        </div>
                                        {section.sourceMode === "custom" && (
                                          <div className="section-detail-meta">
                                            <span>Custom Sources: {formatCustomSources(section.customConnectorIds)}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="empty-message">No sections added</p>
                                )
                              )}
                              </div>
                            )}
                          </div>

                          {/* ACTION BUTTONS */}
                          {isEditing && (
                            <div className="expanded-actions">
                              <button className="btn-secondary" onClick={cancelEditingTemplate}>
                                Cancel
                              </button>
                              <button className="btn-secondary" onClick={saveTemplateAs}>
                                Save As
                              </button>
                              <button className="btn-primary" onClick={saveTemplateEdits}>
                                Save
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && activeTab === "regular" && regularTemplates.length === 0 && (
            <div className="empty-state">
              <p>No regular templates found.</p>
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="empty-state">
              <p>No report templates found</p>
              <p>Click &quot;+ New Report&quot; to create your first template</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
