"use client";

import { useEffect, useState } from "react";

type VectorStore = {
  id: string;
  name: string;
};

type VectorStoreFile = {
  id: string;
  filename: string;
  bytes?: number;
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
  const [storeSearch, setStoreSearch] = useState("");
  const [fileSearch, setFileSearch] = useState<Record<string, string>>({});

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

  const filteredStores = availableStores.filter((store) => {
    if (!storeSearch) return true;
    return (
      store.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      store.id.toLowerCase().includes(storeSearch.toLowerCase())
    );
  });

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
      {/* Search input for vector stores */}
      <input
        type="text"
        placeholder="🔍 Search vector stores by name..."
        value={storeSearch}
        onChange={(e) => setStoreSearch(e.target.value)}
        style={{
          padding: "0.5rem 0.75rem",
          fontSize: "0.875rem",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.375rem",
          background: "var(--color-bg-input)",
          color: "var(--color-text-primary)",
          marginBottom: "0.5rem",
          width: "100%",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem 0" }}>
        {filteredStores.map((store) => {
          const isSelected = selectedVectorStores.includes(store.id);
          const isExpanded = expandedStore === store.id;
          const files = storeFiles[store.id] || [];
          const isLoadingFiles = loadingFiles[store.id] || false;
          const selectedFileIds = selectedFiles[store.id] || [];

          return (
            <div
              key={store.id}
              style={{
                border: isSelected ? "2px solid #6366f1" : "1px solid rgba(99, 102, 241, 0.15)",
                borderRadius: "0.5rem",
                background: isSelected ? "rgba(99, 102, 241, 0.1)" : "transparent",
                overflow: "hidden",
              }}
            >
              {/* Main vector store row */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleStore(store.id)}
                  style={{ width: "18px", height: "18px", margin: 0, cursor: "pointer", flexShrink: 0 }}
                />
                <span
                  style={{ fontWeight: 600, fontSize: "0.9375rem", flex: 1, cursor: "pointer" }}
                  onClick={() => toggleStore(store.id)}
                >
                  {store.name}
                </span>
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(store.id)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.8125rem",
                      background: isExpanded ? "#6366f1" : "transparent",
                      color: isExpanded ? "#fff" : "#6366f1",
                      border: "1px solid #6366f1",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isExpanded ? "▼" : "▶"} {isExpanded ? "Hide Files" : "Select Files"}
                  </button>
                )}
              </div>

              {/* Expanded file list */}
              {isSelected && isExpanded && (
                <div
                  style={{
                    borderTop: "1px solid rgba(99, 102, 241, 0.2)",
                    padding: "0.75rem",
                    background: "rgba(0, 0, 0, 0.2)",
                  }}
                >
                  {isLoadingFiles ? (
                    <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>Loading files...</div>
                  ) : files.length === 0 ? (
                    <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>No files found in this vector store.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", opacity: 0.9 }}>
                        Select Files ({selectedFileIds.length} selected):
                      </div>

                      {/* Search input for files */}
                      <input
                        type="text"
                        placeholder="🔍 Search files by name..."
                        value={fileSearch[store.id] || ""}
                        onChange={(e) => setFileSearch((prev) => ({ ...prev, [store.id]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                          borderRadius: "0.375rem",
                          background: "rgba(255, 255, 255, 0.05)",
                          color: "var(--color-text-primary)",
                          marginBottom: "0.5rem",
                        }}
                      />

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "300px", overflowY: "auto" }}>
                        {files
                          .filter((file) => {
                            const searchTerm = fileSearch[store.id];
                            if (!searchTerm) return true;
                            return (
                              file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              file.id.toLowerCase().includes(searchTerm.toLowerCase())
                            );
                          })
                          .map((file) => {
                            const isFileSelected = selectedFileIds.includes(file.id);
                            return (
                              <label
                                key={file.id}
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  padding: "0.5rem",
                                  background: isFileSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.03)",
                                  borderRadius: "0.375rem",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                  transition: "background 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isFileSelected) {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isFileSelected) {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isFileSelected}
                                  onChange={() => toggleFile(store.id, file.id)}
                                  style={{ width: "16px", height: "16px", margin: 0, cursor: "pointer", flexShrink: 0 }}
                                />
                                <span style={{ flex: 1 }}>{file.filename}</span>
                                {file.bytes && (
                                  <span style={{ fontSize: "0.75rem", opacity: 0.6, fontFamily: "monospace" }}>
                                    {(file.bytes / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </label>
                            );
                          })}
                      </div>

                      {files.filter((file) => {
                        const searchTerm = fileSearch[store.id];
                        if (!searchTerm) return false;
                        return (
                          file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          file.id.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                      }).length === 0 &&
                        fileSearch[store.id] && (
                          <div style={{ fontSize: "0.8125rem", opacity: 0.6, marginTop: "0.5rem", textAlign: "center" }}>
                            No files match your search
                          </div>
                        )}
                    </>
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
