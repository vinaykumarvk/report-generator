"use client";

import { useEffect, useState } from "react";
import "./vector-store-selector.css";

type VectorStore = {
  id: string;
  name: string;
};

type VectorFile = {
  id: string;
  filename: string;
};

type VectorStoreSelectionProps = {
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
}: VectorStoreSelectionProps) {
  const [availableVectorStores, setAvailableVectorStores] = useState<VectorStore[]>([]);
  const [loadingVectorStores, setLoadingVectorStores] = useState(false);
  const [expandedVectorStore, setExpandedVectorStore] = useState<string | null>(null);
  const [vectorStoreFiles, setVectorStoreFiles] = useState<Record<string, VectorFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [vectorStoreSearchTerm, setVectorStoreSearchTerm] = useState("");
  const [fileSearchTerms, setFileSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    console.log("VectorStoreSelector mounted, auto-loading stores...");
    loadVectorStores();
  }, []);

  async function loadVectorStores() {
    console.log("[VectorStoreSelector] loadVectorStores called");
    setLoadingVectorStores(true);
    try {
      const res = await fetch("/api/openai/vector-stores");
      console.log("[VectorStoreSelector] Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[VectorStoreSelector] Raw data:", data);
        
        // API returns array directly, not {data: [...]}
        const stores = Array.isArray(data) ? data : (data.data || []);
        console.log("[VectorStoreSelector] Vector stores loaded:", stores.length);
        setAvailableVectorStores(stores);
      } else {
        console.error("[VectorStoreSelector] Failed to load, status:", res.status);
      }
    } catch (error) {
      console.error("[VectorStoreSelector] Error loading vector stores:", error);
    } finally {
      setLoadingVectorStores(false);
    }
  }

  async function loadVectorStoreFiles(vectorStoreId: string) {
    setLoadingFiles((prev) => ({ ...prev, [vectorStoreId]: true }));
    try {
      const res = await fetch(`/api/openai/vector-stores/${vectorStoreId}/files`);
      if (res.ok) {
        const data = await res.json();
        setVectorStoreFiles((prev) => ({ ...prev, [vectorStoreId]: data }));
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoadingFiles((prev) => ({ ...prev, [vectorStoreId]: false }));
    }
  }

  function handleVectorStoreToggle(id: string) {
    if (selectedVectorStores.includes(id)) {
      onVectorStoreChange(selectedVectorStores.filter((vsId) => vsId !== id));
    } else {
      if (selectedVectorStores.length >= maxStores) {
        alert(`You can select up to ${maxStores} vector stores only`);
        return;
      }
      onVectorStoreChange([...selectedVectorStores, id]);
    }
  }

  function handleFileToggle(vectorStoreId: string, fileId: string) {
    const currentFiles = selectedFiles[vectorStoreId] || [];
    if (currentFiles.includes(fileId)) {
      onFileChange(
        vectorStoreId,
        currentFiles.filter((fId) => fId !== fileId)
      );
    } else {
      onFileChange(vectorStoreId, [...currentFiles, fileId]);
    }
  }

  function toggleSpecificFiles(vectorStoreId: string) {
    if (expandedVectorStore === vectorStoreId) {
      setExpandedVectorStore(null);
    } else {
      setExpandedVectorStore(vectorStoreId);
      if (!vectorStoreFiles[vectorStoreId]) {
        loadVectorStoreFiles(vectorStoreId);
      }
    }
  }

  const sortedVectorStores = [...availableVectorStores]
    .filter((vs) =>
      vs.name.toLowerCase().includes(vectorStoreSearchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log("[VectorStoreSelector] Render - availableVectorStores:", availableVectorStores.length);
  console.log("[VectorStoreSelector] Render - sortedVectorStores:", sortedVectorStores.length);

  return (
    <div className="vector-store-selector">
      {availableVectorStores.length > 0 && (
        <input
          type="text"
          className="search-input"
          placeholder="Search vector stores..."
          value={vectorStoreSearchTerm}
          onChange={(e) => setVectorStoreSearchTerm(e.target.value)}
        />
      )}

      {loadingVectorStores && (
        <p className="info-message">Loading vector stores...</p>
      )}

      {selectedVectorStores.length >= maxStores && (
        <p className="warning-message">
          Maximum {maxStores} vector stores can be selected
        </p>
      )}

      {sortedVectorStores.length === 0 && availableVectorStores.length > 0 && (
        <p className="info-message">No vector stores match your search.</p>
      )}

      {sortedVectorStores.length === 0 && availableVectorStores.length === 0 && !loadingVectorStores && (
        <p className="info-message">No vector stores found. Click &quot;Sync Stores&quot; to load.</p>
      )}

      <div className="vector-store-grid">
        {sortedVectorStores.map((vs) => {
          console.log("[VectorStoreSelector] Rendering store:", vs.name, vs.id);
          return (
          <div
            key={vs.id}
            className={`vector-store-card ${
              selectedVectorStores.includes(vs.id) ? "selected" : ""
            }`}
          >
            <label className="vector-store-label">
              <input
                type="checkbox"
                checked={selectedVectorStores.includes(vs.id)}
                onChange={() => handleVectorStoreToggle(vs.id)}
              />
              <span className="vector-store-name">
                {vs.name} - {vs.id}
              </span>
            </label>

            {selectedVectorStores.includes(vs.id) && (
              <div className="vector-store-actions">
                <button
                  className="btn-text"
                  onClick={() => toggleSpecificFiles(vs.id)}
                >
                  {expandedVectorStore === vs.id
                    ? "▼ Hide Files"
                    : "▶ Select Specific Files"}
                </button>
              </div>
            )}

            {expandedVectorStore === vs.id && (
              <div className="vector-files-section">
                {loadingFiles[vs.id] && <p>Loading files...</p>}

                {!loadingFiles[vs.id] && vectorStoreFiles[vs.id] && (
                  <>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search files..."
                      value={fileSearchTerms[vs.id] || ""}
                      onChange={(e) =>
                        setFileSearchTerms({
                          ...fileSearchTerms,
                          [vs.id]: e.target.value,
                        })
                      }
                    />
                    <div className="file-list">
                      {vectorStoreFiles[vs.id]
                        .filter((file) =>
                          file.filename
                            .toLowerCase()
                            .includes((fileSearchTerms[vs.id] || "").toLowerCase())
                        )
                        .sort((a, b) => a.filename.localeCompare(b.filename))
                        .map((file) => (
                          <label key={file.id} className="file-item">
                            <input
                              type="checkbox"
                              checked={(selectedFiles[vs.id] || []).includes(
                                file.id
                              )}
                              onChange={() => handleFileToggle(vs.id, file.id)}
                            />
                            {file.filename}
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
        })}
      </div>
    </div>
  );
}
