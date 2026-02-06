"use client";

import { DownloadIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useOptimistic, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  deleteFileAction,
  deleteFolderAction,
  downloadBinaryFileAction,
  downloadFileAction,
} from "@/actions/files";
import { formatFileSize } from "@/lib/utils/format";
import type { FileItem } from "@/types";

interface PreviewData {
  item: FileItem;
  content?: string;
  blobUrl?: string;
  loading: boolean;
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

interface FilesListProps {
  items: FileItem[];
}

type FileAction = { type: "delete"; path: string };

export function FilesList({ items }: FilesListProps) {
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items,
    (state: FileItem[], action: FileAction) =>
      state.filter((file) => file.path !== action.path),
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [, startTransition] = useTransition();

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (preview?.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
      }
    };
  }, [preview?.blobUrl]);

  const closePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev?.blobUrl) {
        URL.revokeObjectURL(prev.blobUrl);
      }
      return null;
    });
  }, []);

  // Close modals with Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && preview) {
        closePreview();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preview, closePreview]);

  function handleDeleteItem(item: FileItem) {
    const message =
      item.type === "folder"
        ? `Delete folder "${item.name}" and all its contents?`
        : `Delete "${item.name}"?`;

    if (!confirm(message)) return;

    startTransition(async () => {
      setOptimisticItems({ type: "delete", path: item.path });
      try {
        if (item.type === "folder") {
          await deleteFolderAction(item.path);
        } else {
          await deleteFileAction(item.path);
        }
      } catch {
        alert("Failed to delete.");
      }
    });
  }

  async function handleDownloadFile(item: FileItem) {
    try {
      const mimeType = item.mime_type || "application/octet-stream";

      if (mimeType.startsWith("text/") || mimeType === "application/json") {
        const result = await downloadFileAction(item.path);
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const result = await downloadBinaryFileAction(item.path);
        const bytes = new Uint8Array(result.data);
        const blob = new Blob([bytes], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("Download failed.");
    }
  }

  async function openPreview(item: FileItem) {
    if (!canPreview(item.mime_type)) {
      handleDownloadFile(item);
      return;
    }

    setPreview({ item, loading: true });

    try {
      const mimeType = item.mime_type || "text/plain";

      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        const result = await downloadBinaryFileAction(item.path);
        const bytes = new Uint8Array(result.data);
        const blob = new Blob([bytes], { type: result.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        setPreview({ item, blobUrl, loading: false });
      } else {
        const result = await downloadFileAction(item.path);
        setPreview({ item, content: result.content, loading: false });
      }
    } catch (e) {
      console.error("Preview failed:", e);
      setPreview(null);
      alert("Failed to load preview.");
    }
  }

  return (
    <>
      {/* File list */}
      {optimisticItems.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="mb-2">This folder is empty</p>
          <p className="text-xs">
            Upload files or create a folder to get started
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {optimisticItems.map((item) => (
            <div
              key={item.path}
              className="group flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-opacity-50 bg-surface"
            >
              {item.type === "folder" ? (
                <Link
                  href={item.path}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <span className="text-lg">📁</span>
                  <span className="text-sm text-foreground">{item.name}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openPreview(item)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <span className="text-lg">
                    {getFileIcon(item.mime_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate text-foreground">
                      {item.name}
                    </div>
                    <div className="text-xs text-muted">
                      {formatFileSize(item.size)}
                    </div>
                  </div>
                </button>
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {item.type === "file" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadFile(item);
                    }}
                    className="p-1.5 rounded hover:bg-opacity-80 text-muted"
                  >
                    <DownloadIcon size={16} aria-hidden="true" />
                    <span className="sr-only">Download {item.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item);
                  }}
                  className="p-1.5 rounded hover:bg-opacity-80 text-accent"
                >
                  <Trash2Icon size={16} aria-hidden="true" />
                  <span className="sr-only">Delete {item.name}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80"
          onClick={closePreview}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col bg-background overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg">
                  {getFileIcon(preview.item.mime_type)}
                </span>
                <span className="text-sm truncate text-foreground">
                  {preview.item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(preview.item)}
                  className="p-2 rounded-lg hover:opacity-80 text-muted"
                >
                  <DownloadIcon size={18} aria-hidden="true" />
                  <span className="sr-only">Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-2 rounded-lg hover:opacity-80 text-muted"
                >
                  <XIcon size={18} aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {preview.loading ? (
                <div className="flex items-center justify-center h-64 text-muted">
                  Loading…
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
                <div className="prose prose-invert max-w-none text-foreground">
                  <ReactMarkdown>{preview.content || ""}</ReactMarkdown>
                </div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-mono p-4 rounded-lg overflow-auto bg-surface text-foreground">
                  {preview.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
