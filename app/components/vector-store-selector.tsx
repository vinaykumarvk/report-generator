"use client";

import { useEffect, useState } from "react";

type VectorStore = {
  id: string;
  name: string;
};

type VectorStoreFile = {
  id: string;
  filename: string;
};

type VectorStoreSelectorProps = {
  selectedVectorStores: string[];
  onVectorStoreChange: (storeIds: string[]) => void;
  selectedFiles: Record<string, string[]>;
  onFileChange: (storeId: string, fileIds: string[]) => void;
  maxStores?: number;
};

export default function VectorStoreSelector({
  selectedVectorStores,
  onVectorStoreChange,
  selectedFiles,
  onFileChange,
  maxStores = 2,
}: VectorStoreSelectorProps) {
  const [availableStores, setAvailableStores] = useState<VectorStore[]>([]);
  const [storeFiles, setStoreFiles] = useState<Record<string, VectorStoreFile[]>>({});
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadVectorStores();
  }, []);

  async function loadVectorStores() {
    setLoading(true);
    try {
      const res = await fetch("/api/openai/vector-stores", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAvailableStores(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load vector stores:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(storeId: string) {
    if (storeFiles[storeId]) return;

    setLoadingFiles((prev) => ({ ...prev, [storeId]: true }));
    try {
      const res = await fetch(`/api/openai/vector-stores/${storeId}/files`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = Array.isArray(data)
          ? data.sort((a, b) => a.filename.localeCompare(b.filename))
          : [];
        setStoreFiles((prev) => ({ ...prev, [storeId]: sorted }));
      }
    } catch (err) {
      console.error(`Failed to load files for ${storeId}:`, err);
    } finally {
      setLoadingFiles((prev) => ({ ...prev, [storeId]: false }));
    }
  }

  function toggleStore(storeId: string) {
    const isSelected = selectedVectorStores.includes(storeId);
    if (isSelected) {
      onVectorStoreChange(selectedVectorStores.filter((id) => id !== storeId));
      onFileChange(storeId, []);
    } else if (selectedVectorStores.length < maxStores) {
      onVectorStoreChange([...selectedVectorStores, storeId]);
    } else {
      alert(`You can select up to ${maxStores} vector stores only.`);
    }
  }

  function toggleFile(storeId: string, fileId: string) {
    const currentFiles = selectedFiles[storeId] || [];
    const isSelected = currentFiles.includes(fileId);
    if (isSelected) {
      onFileChange(
        storeId,
        currentFiles.filter((id) => id !== fileId)
      );
    } else {
      onFileChange(storeId, [...currentFiles, fileId]);
    }
  }

  function toggleExpanded(storeId: string) {
    if (expandedStore === storeId) {
      setExpandedStore(null);
    } else {
      setExpandedStore(storeId);
      loadFiles(storeId);
    }
  }

  const filteredStores = availableStores.filter((store) =>
    store.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="muted">Loading vector stores...</div>;
  }

  if (availableStores.length === 0) {
    return (
      <div className="muted">
        No vector stores available. Sync from OpenAI first.
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        placeholder="🔍 Search vector stores..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "0.5rem" }}
      />

      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "0.375rem", padding: "0.5rem" }}>
        {filteredStores.map((store) => {
          const isSelected = selectedVectorStores.includes(store.id);
          const isExpanded = expandedStore === store.id;
          const files = storeFiles[store.id] || [];
          const selectedFileIds = selectedFiles[store.id] || [];

          return (
            <div key={store.id} style={{ marginBottom: "0.5rem", border: "1px solid var(--color-border)", borderRadius: "0.375rem", padding: "0.75rem", background: isSelected ? "var(--color-accent-light)" : "var(--color-bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleStore(store.id)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  <strong>{store.name}</strong>
                </label>
                {isSelected && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleExpanded(store.id)}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  >
                    {isExpanded ? "Hide Files" : "Select Files"}
                  </button>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                  {loadingFiles[store.id] ? (
                    <div className="muted">Loading files...</div>
                  ) : files.length === 0 ? (
                    <div className="muted">No files in this store</div>
                  ) : (
                    <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                      {files.map((file) => (
                        <label
                          key={file.id}
                          style={{ display: "block", cursor: "pointer", padding: "0.25rem 0" }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(file.id)}
                            onChange={() => toggleFile(store.id, file.id)}
                            style={{ marginRight: "0.5rem" }}
                          />
                          <span style={{ fontSize: "0.875rem" }}>{file.filename}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="muted" style={{ marginTop: "0.5rem" }}>
        Selected: {selectedVectorStores.length} / {maxStores} vector stores
      </div>
    </div>
  );
}

