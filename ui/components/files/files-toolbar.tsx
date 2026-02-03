"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createFolderAction,
  uploadBinaryFileAction,
  uploadFileAction,
} from "@/actions/files";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { cn } from "@/lib/utils/ui";
import { useFilesContext } from "./files-context";

export function FilesToolbar() {
  const {
    currentPath,
    showNewFolder,
    setShowNewFolder,
    newFile,
    setNewFile,
    uploading,
    setUploading,
    fileInputRef,
  } = useFilesContext();

  const [newFolderName, setNewFolderName] = useState("");
  const [isFolderPending, startFolderTransition] = useTransition();
  const [isFilePending, startFileTransition] = useTransition();
  const newFolderInputRef = useAutoFocus<HTMLInputElement>(showNewFolder);
  const newFileInputRef = useAutoFocus<HTMLInputElement>(!!newFile);

  const pathParts = currentPath.split("/").filter(Boolean);
  const parentPath =
    currentPath === "/files"
      ? null
      : currentPath.split("/").slice(0, -1).join("/") || "/files";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fullPath = `${currentPath}/${file.name}`;
        const mimeType = file.type || "application/octet-stream";

        if (
          mimeType.startsWith("text/") ||
          mimeType === "application/json" ||
          mimeType === "application/javascript"
        ) {
          const content = await file.text();
          await uploadFileAction(fullPath, content, {
            mime_type: mimeType,
            size: file.size,
            original_name: file.name,
          });
        } else {
          const buffer = await file.arrayBuffer();
          await uploadBinaryFileAction(fullPath, buffer, mimeType, {
            size: file.size,
            original_name: file.name,
          });
        }
      }
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) return;

    startFolderTransition(async () => {
      try {
        await createFolderAction(`${currentPath}/${newFolderName.trim()}`);
        setNewFolderName("");
        setShowNewFolder(false);
      } catch {
        alert("Failed to create folder.");
      }
    });
  }

  function handleCreateFile() {
    if (!newFile?.name.trim()) return;

    const fileName = newFile.name.endsWith(".md")
      ? newFile.name
      : `${newFile.name}.md`;

    startFileTransition(async () => {
      try {
        await uploadFileAction(`${currentPath}/${fileName}`, newFile.content, {
          mime_type: "text/markdown",
          original_name: fileName,
        });
        setNewFile(null);
      } catch (e) {
        console.error("Failed to create file:", e);
        alert("Failed to create file.");
      }
    });
  }

  return (
    <>
      {/* Header with breadcrumb */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted">/</span>}
              <Link
                href={`/${pathParts.slice(0, i + 1).join("/")}`}
                className={cn(
                  "hover:underline",
                  i === pathParts.length - 1 ? "text-foreground" : "text-muted",
                )}
              >
                {part}
              </Link>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewFile({ name: "", content: "" })}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 bg-surface border border-border text-muted"
          >
            + file
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 bg-surface border border-border text-muted"
          >
            + folder
          </button>
          <label
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg transition-colors bg-accent text-white",
              uploading
                ? "opacity-50 cursor-default"
                : "hover:opacity-80 cursor-pointer",
            )}
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
        <div className="mb-4 p-3 rounded-lg flex items-center gap-2 bg-surface border border-border">
          <input
            ref={newFolderInputRef}
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            disabled={isFolderPending}
            className="flex-1 text-sm bg-transparent outline-none text-foreground disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape" && !isFolderPending) {
                setShowNewFolder(false);
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={isFolderPending}
            className="text-xs px-2 py-1 rounded bg-accent text-white disabled:opacity-50"
          >
            create
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(false)}
            disabled={isFolderPending}
            className="text-xs px-2 py-1 text-muted disabled:opacity-50"
          >
            cancel
          </button>
        </div>
      )}

      {/* Back button */}
      {parentPath && (
        <Link
          href={parentPath}
          className="mb-4 text-sm flex items-center gap-2 hover:opacity-80 text-muted"
        >
          <ArrowLeftIcon size={16} />
          back
        </Link>
      )}

      {/* New File Editor Modal */}
      {newFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80"
          onClick={() => {
            if (!isFilePending) setNewFile(null);
          }}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg">📝</span>
                <input
                  ref={newFileInputRef}
                  type="text"
                  value={newFile.name}
                  onChange={(e) =>
                    setNewFile({ ...newFile, name: e.target.value })
                  }
                  placeholder="filename.md"
                  disabled={isFilePending}
                  className="flex-1 text-sm bg-transparent outline-none disabled:opacity-50 text-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateFile}
                  disabled={!newFile.name.trim() || isFilePending}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50 bg-accent text-white"
                >
                  save
                </button>
                <button
                  type="button"
                  onClick={() => setNewFile(null)}
                  disabled={isFilePending}
                  className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50 text-muted"
                  title="Close"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={newFile.content}
                onChange={(e) =>
                  setNewFile({ ...newFile, content: e.target.value })
                }
                placeholder="Write your markdown here..."
                disabled={isFilePending}
                className="w-full h-[60vh] text-sm font-mono bg-transparent outline-none resize-none disabled:opacity-50 text-foreground"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
