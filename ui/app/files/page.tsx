"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_ENDPOINTS } from "../config";
import { api } from "../lib/api";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mime_type?: string;
  created_at?: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string): string {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.includes("word")) return "📘";
  if (mimeType === "text/markdown" || mimeType === "text/plain") return "📝";
  return "📄";
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("/files");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await api.get(`${API_ENDPOINTS.files}?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setItems(data.items || []);
      setCurrentPath(data.path || path);
    } catch (e) {
      console.error("Failed to fetch files:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
  }, []);

  const navigateTo = (path: string) => {
    fetchFiles(path);
  };

  const goUp = () => {
    if (currentPath === "/files") return;
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/files";
    navigateTo(parent);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", currentPath);

        await api.upload(API_ENDPOINTS.filesUpload, formData);
      }
      fetchFiles(currentPath);
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post(API_ENDPOINTS.filesFolder, {
        name: newFolderName.trim(),
        parent_path: currentPath,
      });
      setNewFolderName("");
      setShowNewFolder(false);
      fetchFiles(currentPath);
    } catch (e) {
      console.error("Failed to create folder:", e);
      alert("Failed to create folder.");
    }
  };

  const deleteItem = async (item: FileItem) => {
    const message = item.type === "folder"
      ? `Delete folder "${item.name}" and all its contents?`
      : `Delete "${item.name}"?`;

    if (!confirm(message)) return;

    try {
      await api.delete(API_ENDPOINTS.filesDelete(item.path));
      fetchFiles(currentPath);
    } catch (e) {
      console.error("Failed to delete:", e);
      alert("Failed to delete.");
    }
  };

  const downloadFile = async (item: FileItem) => {
    try {
      const url = API_ENDPOINTS.filesDownload(item.path);
      const res = await api.get(url);

      // Check if it's a binary response
      const contentType = res.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        // Binary download
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
        // Text content
        const data = await res.json();
        const blob = new Blob([data.content], { type: data.mime_type });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = data.name || item.name;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("Download failed.");
    }
  };

  // Breadcrumb parts
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="min-h-screen p-4 md:p-12" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl">
        {/* Header with breadcrumb */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm overflow-x-auto">
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span style={{ color: "var(--muted)" }}>/</span>}
                <button
                  onClick={() => navigateTo("/" + pathParts.slice(0, i + 1).join("/"))}
                  className="hover:underline"
                  style={{ color: i === pathParts.length - 1 ? "var(--foreground)" : "var(--muted)" }}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolder(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              + folder
            </button>
            <label
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{
                background: "var(--accent)",
                color: "white",
              }}
            >
              {uploading ? "uploading..." : "+ upload"}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.md,.txt,.docx,image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <div
            className="mb-4 p-3 rounded-lg flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: "var(--foreground)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
            />
            <button
              onClick={createFolder}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--accent)", color: "white" }}
            >
              create
            </button>
            <button
              onClick={() => setShowNewFolder(false)}
              className="text-xs px-2 py-1"
              style={{ color: "var(--muted)" }}
            >
              cancel
            </button>
          </div>
        )}

        {/* Back button */}
        {currentPath !== "/files" && (
          <button
            onClick={goUp}
            className="mb-4 text-sm flex items-center gap-2 hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            back
          </button>
        )}

        {/* File list */}
        {loading ? (
          <div style={{ color: "var(--muted)" }}>loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--muted)" }}>
            <p className="mb-2">This folder is empty</p>
            <p className="text-xs">Upload files or create a folder to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.path}
                className="group flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-opacity-50"
                style={{ background: "var(--surface)" }}
              >
                {item.type === "folder" ? (
                  <button
                    onClick={() => navigateTo(item.path)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <span className="text-lg">📁</span>
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>
                      {item.name}
                    </span>
                  </button>
                ) : (
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-lg">{getFileIcon(item.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                        {item.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {formatSize(item.size)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.type === "file" && (
                    <button
                      onClick={() => downloadFile(item)}
                      className="p-1.5 rounded hover:bg-opacity-80"
                      style={{ color: "var(--muted)" }}
                      title="Download"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteItem(item)}
                    className="p-1.5 rounded hover:bg-opacity-80"
                    style={{ color: "var(--accent)" }}
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
