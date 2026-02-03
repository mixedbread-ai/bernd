"use client";

import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils/ui";
import type { ImageAttachment } from "@/types";

interface ImagePreviewProps {
  images: ImageAttachment[];
  onRemove: (index: number) => void;
  /** Size of the preview thumbnails */
  size?: "small" | "medium";
  disabled?: boolean;
}

export function ImagePreview({
  images,
  onRemove,
  size = "small",
  disabled = false,
}: ImagePreviewProps) {
  if (images.length === 0) return null;

  const sizeClasses = size === "small" ? "size-12" : "size-16";
  const buttonSize = size === "small" ? "size-4" : "size-5";

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative group">
          <img
            src={img.data}
            alt={`Attachment ${i + 1}`}
            className={cn(
              sizeClasses,
              "object-cover rounded-lg border border-border",
            )}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className={cn(
                "absolute -top-1 -right-1 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent",
                buttonSize,
              )}
            >
              <XIcon className={cn(size === "small" ? "size-2.5" : "size-3")} />
              <span className="sr-only">Remove image</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
