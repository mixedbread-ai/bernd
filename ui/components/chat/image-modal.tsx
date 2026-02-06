"use client";

import { XIcon } from "lucide-react";
import { useEffect } from "react";

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

export function ImageModal({ src, onClose }: ImageModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overscroll-contain"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl rounded"
      >
        <XIcon className="size-5" aria-hidden="true" />
        <span className="sr-only">Close image</span>
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
