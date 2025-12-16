"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_ENDPOINTS } from "../config";
import { api } from "../lib/api";
import ReactMarkdown from "react-markdown";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mime_type?: string;
  created_at?: string;
}

interface PreviewData {
  item: FileItem;
  content?: string;
  blobUrl?: string;
  loading: boolean;
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

function canPreview(mimeType?: string): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType === "text/markdown" ||
    mimeType === "text/plain"
  );
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("/files");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [newFile, setNewFile] = useState<{ name: string; content: string } | null>(null);
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

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (preview?.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
      }
    };
  }, [preview?.blobUrl]);

  // Close preview with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && preview) {
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preview]);

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

      const contentType = res.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
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

  const openPreview = async (item: FileItem) => {
    if (!canPreview(item.mime_type)) {
      downloadFile(item);
      return;
    }

    setPreview({ item, loading: true });

    try {
      const url = API_ENDPOINTS.filesDownload(item.path);
      const res = await api.get(url);

      const contentType = res.headers.get("content-type");

      if (item.mime_type?.startsWith("image/") || item.mime_type === "application/pdf") {
        // Binary content - create blob URL
        let blob: Blob;
        if (contentType && !contentType.includes("application/json")) {
          blob = await res.blob();
        } else {
          // Base64 encoded in JSON
          const data = await res.json();
          const binary = atob(data.content);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: item.mime_type });
        }
        const blobUrl = URL.createObjectURL(blob);
        setPreview({ item, blobUrl, loading: false });
      } else {
        // Text content
        let content: string;
        if (contentType && !contentType.includes("application/json")) {
          content = await res.text();
        } else {
          const data = await res.json();
          content = data.content;
        }
        setPreview({ item, content, loading: false });
      }
    } catch (e) {
      console.error("Preview failed:", e);
      setPreview(null);
      alert("Failed to load preview.");
    }
  };

  const closePreview = () => {
    if (preview?.blobUrl) {
      URL.revokeObjectURL(preview.blobUrl);
    }
    setPreview(null);
  };

  const createFile = async () => {
    if (!newFile?.name.trim()) return;

    const fileName = newFile.name.endsWith(".md") ? newFile.name : `${newFile.name}.md`;

    try {
      const blob = new Blob([newFile.content], { type: "text/markdown" });
      const file = new File([blob], fileName, { type: "text/markdown" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", currentPath);

      await api.upload(API_ENDPOINTS.filesUpload, formData);
      setNewFile(null);
      fetchFiles(currentPath);
    } catch (e) {
      console.error("Failed to create file:", e);
      alert("Failed to create file.");
    }
  };

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
              onClick={() => setNewFile({ name: "", content: "" })}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              + file
            </button>
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
                  <button
                    onClick={() => openPreview(item)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <span className="text-lg">{getFileIcon(item.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                        {item.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {formatSize(item.size)}
                      </div>
                    </div>
                  </button>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {item.type === "file" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadFile(item); }}
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
                    onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
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

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ background: "rgba(0, 0, 0, 0.8)" }}
          onClick={closePreview}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
            style={{ background: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg">{getFileIcon(preview.item.mime_type)}</span>
                <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                  {preview.item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(preview.item)}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: "var(--muted)" }}
                  title="Download"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: "var(--muted)" }}
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {preview.loading ? (
                <div className="flex items-center justify-center h-64" style={{ color: "var(--muted)" }}>
                  loading...
                </div>
              ) : preview.item.mime_type?.startsWith("image/") ? (
                <div className="flex items-center justify-center">
                  <img
                    src={preview.blobUrl}
                    alt={preview.item.name}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                </div>
              ) : preview.item.mime_type === "application/pdf" ? (
                <iframe
                  src={preview.blobUrl}
                  className="w-full h-[70vh] rounded"
                  title={preview.item.name}
                />
              ) : preview.item.mime_type === "text/markdown" ? (
                <div className="prose prose-invert max-w-none" style={{ color: "var(--foreground)" }}>
                  <ReactMarkdown>{preview.content || ""}</ReactMarkdown>
                </div>
              ) : (
                <pre
                  className="text-sm whitespace-pre-wrap font-mono p-4 rounded-lg overflow-auto"
                  style={{ background: "var(--surface)", color: "var(--foreground)" }}
                >
                  {preview.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New File Editor Modal */}
      {newFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ background: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setNewFile(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
            style={{ background: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg">📝</span>
                <input
                  type="text"
                  value={newFile.name}
                  onChange={(e) => setNewFile({ ...newFile, name: e.target.value })}
                  placeholder="filename.md"
                  autoFocus
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: "var(--foreground)" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createFile}
                  disabled={!newFile.name.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  save
                </button>
                <button
                  onClick={() => setNewFile(null)}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: "var(--muted)" }}
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={newFile.content}
                onChange={(e) => setNewFile({ ...newFile, content: e.target.value })}
                placeholder="Write your markdown here..."
                className="w-full h-[60vh] text-sm font-mono bg-transparent outline-none resize-none"
                style={{ color: "var(--foreground)" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
