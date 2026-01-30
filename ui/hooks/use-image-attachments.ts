import { useRef, useState } from "react";
import {
  fileToImageAttachment,
  handlePasteWithImages,
} from "@/lib/chat-utils";
import type { ImageAttachment } from "@/types";

export function useImageAttachments() {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePaste(e: React.ClipboardEvent) {
    await handlePasteWithImages(e, (image) =>
      setImages((prev) => [...prev, image]),
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of files) {
      const attachment = await fileToImageAttachment(file);
      if (attachment) {
        setImages((prev) => [...prev, attachment]);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  return { images, setImages, fileInputRef, handlePaste, handleFileSelect, removeImage };
}
