"use client";

import type { ImageAttachment } from "../../types";

interface ImagePreviewProps {
  images: ImageAttachment[];
  onRemove: (index: number) => void;
  /** Size of the preview thumbnails */
  size?: "small" | "medium";
}

export function ImagePreview({
  images,
  onRemove,
  size = "small",
}: ImagePreviewProps) {
  if (images.length === 0) return null;

  const sizeClasses = size === "small" ? "h-12 w-12" : "h-16 w-16";
  const buttonSize = size === "small" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative group">
          <img
            src={img.data}
            alt={`Attachment ${i + 1}`}
            className={`${sizeClasses} object-cover rounded-lg border border-border`}
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className={`absolute -top-1 -right-1 ${buttonSize} text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent`}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
