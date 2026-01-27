"use client";

import { ChevronRightIcon, ImageIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

const markdownComponents: Components = {
	a: ({ href, children }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
};

import {
	fileToImageAttachment,
	handleChatKeyDown,
	handlePasteWithImages,
	useChat,
} from "../hooks/useChat";
import type { ImageAttachment, Message, ToolCall } from "../types";

function ImagePreview({
	images,
	onRemove,
}: {
	images: ImageAttachment[];
	onRemove: (index: number) => void;
}) {
	if (images.length === 0) return null;

	return (
		<div className="flex gap-2 mb-2 flex-wrap">
			{images.map((img, i) => (
				<div key={i} className="relative group">
					<img
						src={img.data}
						alt={`Attachment ${i + 1}`}
						className="h-12 w-12 object-cover rounded-lg border border-border"
					/>
					<button
						type="button"
						onClick={() => onRemove(i)}
						className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent"
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}

function MessageImages({
	images,
	onImageClick,
}: {
	images?: ImageAttachment[];
	onImageClick?: (src: string) => void;
}) {
	if (!images || images.length === 0) return null;

	return (
		<div className="flex gap-2 mb-2 flex-wrap">
			{images.map((img, i) => (
				<img
					key={i}
					src={img.data}
					alt={`Image ${i + 1}`}
					onClick={() => onImageClick?.(img.data)}
					className="max-h-32 max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-border"
				/>
			))}
		</div>
	);
}

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
			onClick={onClose}
		>
			<button
				type="button"
				onClick={onClose}
				className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
			>
				×
			</button>
			<img
				src={src}
				alt="Expanded view"
				className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
				onClick={(e) => e.stopPropagation()}
			/>
		</div>
	);
}

function MessageBubble({
	msg,
	onCopy,
	onImageClick,
}: {
	msg: Message;
	onCopy: (text: string) => void;
	onImageClick?: (src: string) => void;
}) {
	if (msg.role === "user") {
		return (
			<div className="px-3 py-2 rounded-2xl max-w-[80%] text-sm bg-user-bubble text-foreground">
				<MessageImages images={msg.images} onImageClick={onImageClick} />
				<div className="prose prose-sm max-w-none text-foreground">
					<ReactMarkdown components={markdownComponents}>
						{msg.content}
					</ReactMarkdown>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-[85%] group">
			{msg.toolCalls && msg.toolCalls.length > 0 && (
				<ToolCallsList toolCalls={msg.toolCalls} />
			)}
			<div className="prose prose-sm max-w-none text-foreground">
				<ReactMarkdown components={markdownComponents}>
					{msg.content}
				</ReactMarkdown>
			</div>
			<button
				type="button"
				onClick={() => onCopy(msg.content)}
				className="mt-1 text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted"
			>
				copy
			</button>
		</div>
	);
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
	const [isOpen, setIsOpen] = useState(false);
	const hasResult = toolCall.result !== undefined;

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1 text-xs font-mono text-muted hover:text-foreground transition-colors"
			>
				<span className="text-accent">→</span>
				<span>{toolCall.name}</span>
				{!hasResult && <Loader2Icon size={10} className="ml-1 animate-spin" />}
				<ChevronRightIcon
					size={10}
					className={`ml-0.5 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="mt-1.5 ml-3 pl-2 border-l border-border space-y-2 text-xs">
					<div>
						<div className="text-[10px] text-muted mb-0.5">input</div>
						<pre className="font-mono text-foreground/80 overflow-x-auto">
							{JSON.stringify(toolCall.args, null, 2)}
						</pre>
					</div>
					{hasResult && (
						<div>
							<div className="text-[10px] text-muted mb-0.5">output</div>
							<pre className="font-mono text-foreground/80 overflow-x-auto max-h-32 overflow-y-auto">
								{JSON.stringify(toolCall.result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ToolCallsList({ toolCalls }: { toolCalls: ToolCall[] }) {
	return (
		<div className="mb-2 space-y-1">
			{toolCalls.map((tc, j) => (
				<ToolCallItem key={tc.call_id || j} toolCall={tc} />
			))}
		</div>
	);
}

function StreamingMessage({
	toolCalls,
	content,
}: {
	toolCalls: ToolCall[];
	content: string;
}) {
	return (
		<div className="flex justify-start">
			<div className="max-w-[85%]">
				{toolCalls.length > 0 && <ToolCallsList toolCalls={toolCalls} />}
				{content ? (
					<div className="prose prose-sm max-w-none text-foreground">
						<ReactMarkdown components={markdownComponents}>
							{content}
						</ReactMarkdown>
					</div>
				) : (
					<div className="flex items-center gap-1">
						<div
							className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
							style={{ animationDelay: "0ms" }}
						/>
						<div
							className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
							style={{ animationDelay: "150ms" }}
						/>
						<div
							className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
							style={{ animationDelay: "300ms" }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

export function FloatingChat() {
	const [isOpen, setIsOpen] = useState(false);
	const [expandedImage, setExpandedImage] = useState<string | null>(null);
	const {
		messages,
		input,
		setInput,
		images,
		addImage,
		removeImage,
		loading,
		streamingToolCalls,
		streamingContent,
		sendMessage,
		clearChat,
	} = useChat();

	const inputRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Global Cmd+K listener
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setIsOpen((prev) => !prev);
			}
			if (e.key === "Escape" && isOpen && !expandedImage) {
				setIsOpen(false);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, expandedImage]);

	// Focus input when opened
	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isOpen]);

	// Scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		handleChatKeyDown(e, input, setInput, () => sendMessage());
	};

	const handlePaste = async (e: React.ClipboardEvent) => {
		await handlePasteWithImages(e, addImage);
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		for (const file of files) {
			const attachment = await fileToImageAttachment(file);
			if (attachment) {
				addImage(attachment);
			}
		}
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleCopy = useCallback(async (text: string) => {
		await navigator.clipboard.writeText(text);
	}, []);

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
				onClick={() => setIsOpen(false)}
			/>

			{/* Floating window */}
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden bg-background border border-border">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border">
					<span className="text-sm font-medium text-foreground">
						Quick Chat
					</span>
					<div className="flex items-center gap-3">
						{messages.length > 0 && (
							<button
								type="button"
								onClick={clearChat}
								className="text-xs transition-colors hover:opacity-70 text-muted"
							>
								clear
							</button>
						)}
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-xs transition-colors hover:opacity-70 text-muted"
						>
							esc
						</button>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
					{messages.length === 0 && !loading && (
						<div className="text-center text-sm py-8 text-muted">
							Ask Bernd anything...
						</div>
					)}

					{messages.map((msg, i) => (
						<div
							key={i}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<MessageBubble
								msg={msg}
								onCopy={handleCopy}
								onImageClick={setExpandedImage}
							/>
						</div>
					))}

					{loading && (
						<StreamingMessage
							toolCalls={streamingToolCalls}
							content={streamingContent}
						/>
					)}

					<div ref={messagesEndRef} />
				</div>

				{/* Input */}
				<div className="p-3 border-t border-border">
					<ImagePreview images={images} onRemove={removeImage} />
					<div className="relative">
						<textarea
							ref={inputRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDownLocal}
							onPaste={handlePaste}
							placeholder="message..."
							disabled={loading}
							rows={2}
							className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none disabled:opacity-50 transition-colors resize-none bg-surface border border-border text-foreground focus:border-accent"
						/>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							multiple
							onChange={handleFileSelect}
							className="hidden"
						/>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="absolute right-2 bottom-2 p-1 transition-colors hover:opacity-70 text-muted"
							title="Attach image"
						>
							<ImageIcon size={16} />
						</button>
					</div>
				</div>
			</div>

			{expandedImage && (
				<ImageModal
					src={expandedImage}
					onClose={() => setExpandedImage(null)}
				/>
			)}
		</>
	);
}
