"use client";

import type { ImageAttachment } from "@/types";

interface MessageImagesProps {
  images?: ImageAttachment[];
  onImageClick?: (src: string) => void;
  /** Maximum height for images */
  maxHeight?: "small" | "medium";
}

export function MessageImages({
  images,
  onImageClick,
  maxHeight = "medium",
}: MessageImagesProps) {
  if (!images || images.length === 0) return null;

  const heightClass = maxHeight === "small" ? "max-h-32" : "max-h-48";

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <img
          key={img.data.slice(0, 100)}
          src={img.data}
          alt={`Image ${i + 1}`}
          onClick={() => onImageClick?.(img.data)}
          className={`${heightClass} max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-border`}
        />
      ))}
    </div>
  );
}
