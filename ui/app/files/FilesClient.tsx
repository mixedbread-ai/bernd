"use client";

import { ArrowLeftIcon, DownloadIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
	createFolder,
	deleteFile,
	deleteFolder,
	downloadBinaryFileAction,
	downloadFileAction,
	listFilesAction,
	uploadBinaryFile,
	uploadFile,
} from "../../actions/files";
import type { FileItem } from "./page";

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

interface FilesClientProps {
	initialItems: FileItem[];
	initialPath: string;
}

export default function FilesClient({
	initialItems,
	initialPath,
}: FilesClientProps) {
	const [currentPath, setCurrentPath] = useState(initialPath);
	const [items, setItems] = useState<FileItem[]>(initialItems);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [showNewFolder, setShowNewFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [preview, setPreview] = useState<PreviewData | null>(null);
	const [newFile, setNewFile] = useState<{
		name: string;
		content: string;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isPending, startTransition] = useTransition();

	const fetchFiles = useCallback(async (path: string) => {
		setLoading(true);
		try {
			const data = await listFilesAction(path);
			setItems(data);
			setCurrentPath(path);
		} catch (e) {
			console.error("Failed to fetch files:", e);
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, []);

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

	// Close preview with Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && preview) {
				closePreview();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [preview, closePreview]);

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
				const fullPath = `${currentPath}/${file.name}`;
				const mimeType = file.type || "application/octet-stream";

				if (
					mimeType.startsWith("text/") ||
					mimeType === "application/json" ||
					mimeType === "application/javascript"
				) {
					const content = await file.text();
					await uploadFile(fullPath, content, {
						mime_type: mimeType,
						size: file.size,
						filename: file.name,
					});
				} else {
					const buffer = await file.arrayBuffer();
					await uploadBinaryFile(fullPath, buffer, mimeType, {
						size: file.size,
						filename: file.name,
					});
				}
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

	const handleCreateFolder = async () => {
		if (!newFolderName.trim()) return;

		startTransition(async () => {
			try {
				await createFolder(`${currentPath}/${newFolderName.trim()}`);
				setNewFolderName("");
				setShowNewFolder(false);
				fetchFiles(currentPath);
			} catch (e) {
				console.error("Failed to create folder:", e);
				alert("Failed to create folder.");
			}
		});
	};

	const handleDeleteItem = async (item: FileItem) => {
		const message =
			item.type === "folder"
				? `Delete folder "${item.name}" and all its contents?`
				: `Delete "${item.name}"?`;

		if (!confirm(message)) return;

		startTransition(async () => {
			try {
				if (item.type === "folder") {
					await deleteFolder(item.path);
				} else {
					await deleteFile(item.path);
				}
				fetchFiles(currentPath);
			} catch (e) {
				console.error("Failed to delete:", e);
				alert("Failed to delete.");
			}
		});
	};

	const handleDownloadFile = async (item: FileItem) => {
		try {
			const mimeType = item.mime_type || "application/octet-stream";

			if (mimeType.startsWith("text/") || mimeType === "application/json") {
				const result = await downloadFileAction(item.path);
				if ("error" in result) {
					alert("Download failed.");
					return;
				}
				const blob = new Blob([result.content], { type: result.mimeType });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = item.name;
				a.click();
				URL.revokeObjectURL(url);
			} else {
				const result = await downloadBinaryFileAction(item.path);
				if ("error" in result) {
					alert("Download failed.");
					return;
				}
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
	};

	const openPreview = async (item: FileItem) => {
		if (!canPreview(item.mime_type)) {
			handleDownloadFile(item);
			return;
		}

		setPreview({ item, loading: true });

		try {
			const mimeType = item.mime_type || "text/plain";

			if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
				const result = await downloadBinaryFileAction(item.path);
				if ("error" in result) {
					setPreview(null);
					alert("Failed to load preview.");
					return;
				}
				const bytes = new Uint8Array(result.data);
				const blob = new Blob([bytes], { type: result.mimeType });
				const blobUrl = URL.createObjectURL(blob);
				setPreview({ item, blobUrl, loading: false });
			} else {
				const result = await downloadFileAction(item.path);
				if ("error" in result) {
					setPreview(null);
					alert("Failed to load preview.");
					return;
				}
				setPreview({ item, content: result.content, loading: false });
			}
		} catch (e) {
			console.error("Preview failed:", e);
			setPreview(null);
			alert("Failed to load preview.");
		}
	};

	const handleCreateFile = async () => {
		if (!newFile?.name.trim()) return;

		const fileName = newFile.name.endsWith(".md")
			? newFile.name
			: `${newFile.name}.md`;

		startTransition(async () => {
			try {
				await uploadFile(`${currentPath}/${fileName}`, newFile.content, {
					mime_type: "text/markdown",
					filename: fileName,
				});
				setNewFile(null);
				fetchFiles(currentPath);
			} catch (e) {
				console.error("Failed to create file:", e);
				alert("Failed to create file.");
			}
		});
	};

	const pathParts = currentPath.split("/").filter(Boolean);

	return (
		<div className="min-h-screen p-4 md:p-12 bg-background">
			<div className="mx-auto max-w-3xl">
				{/* Header with breadcrumb */}
				<div className="mb-6 flex items-center justify-between gap-4">
					<div className="flex items-center gap-2 text-sm overflow-x-auto">
						{pathParts.map((part, i) => (
							<span key={i} className="flex items-center gap-2">
								{i > 0 && <span className="text-muted">/</span>}
								<button
									type="button"
									onClick={() =>
										navigateTo(`/${pathParts.slice(0, i + 1).join("/")}`)
									}
									className={`hover:underline ${i === pathParts.length - 1 ? "text-foreground" : "text-muted"}`}
								>
									{part}
								</button>
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
						<label className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer bg-accent text-white">
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
							type="text"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							placeholder="Folder name..."
							className="flex-1 text-sm bg-transparent outline-none text-foreground"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateFolder();
								if (e.key === "Escape") setShowNewFolder(false);
							}}
						/>
						<button
							type="button"
							onClick={handleCreateFolder}
							disabled={isPending}
							className="text-xs px-2 py-1 rounded bg-accent text-white disabled:opacity-50"
						>
							create
						</button>
						<button
							type="button"
							onClick={() => setShowNewFolder(false)}
							className="text-xs px-2 py-1 text-muted"
						>
							cancel
						</button>
					</div>
				)}

				{/* Back button */}
				{currentPath !== "/files" && (
					<button
						type="button"
						onClick={goUp}
						className="mb-4 text-sm flex items-center gap-2 hover:opacity-80 text-muted"
					>
						<ArrowLeftIcon size={16} />
						back
					</button>
				)}

				{/* File list */}
				{loading ? (
					<div className="text-muted">loading...</div>
				) : items.length === 0 ? (
					<div className="text-center py-12 text-muted">
						<p className="mb-2">This folder is empty</p>
						<p className="text-xs">
							Upload files or create a folder to get started
						</p>
					</div>
				) : (
					<div className="space-y-1">
						{items.map((item) => (
							<div
								key={item.path}
								className="group flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-opacity-50 bg-surface"
							>
								{item.type === "folder" ? (
									<button
										type="button"
										onClick={() => navigateTo(item.path)}
										className="flex-1 flex items-center gap-3 text-left"
									>
										<span className="text-lg">📁</span>
										<span className="text-sm text-foreground">{item.name}</span>
									</button>
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
												{formatSize(item.size)}
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
											title="Download"
										>
											<DownloadIcon size={16} />
										</button>
									)}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleDeleteItem(item);
										}}
										className="p-1.5 rounded hover:bg-opacity-80 text-accent"
										title="Delete"
									>
										<Trash2Icon size={16} />
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
					className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80"
					onClick={closePreview}
				>
					<div
						className="relative w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col bg-background"
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
									title="Download"
								>
									<DownloadIcon size={18} />
								</button>
								<button
									type="button"
									onClick={closePreview}
									className="p-2 rounded-lg hover:opacity-80 text-muted"
									title="Close"
								>
									<XIcon size={18} />
								</button>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-auto p-4">
							{preview.loading ? (
								<div className="flex items-center justify-center h-64 text-muted">
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

			{/* New File Editor Modal */}
			{newFile && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80"
					onClick={() => setNewFile(null)}
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
									type="text"
									value={newFile.name}
									onChange={(e) =>
										setNewFile({ ...newFile, name: e.target.value })
									}
									placeholder="filename.md"
									className="flex-1 text-sm bg-transparent outline-none text-foreground"
								/>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleCreateFile}
									disabled={!newFile.name.trim() || isPending}
									className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50 bg-accent text-white"
								>
									save
								</button>
								<button
									type="button"
									onClick={() => setNewFile(null)}
									className="p-2 rounded-lg hover:opacity-80 text-muted"
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
								className="w-full h-[60vh] text-sm font-mono bg-transparent outline-none resize-none text-foreground"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
