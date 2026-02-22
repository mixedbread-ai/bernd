"use client";

import { useState } from "react";
import { resolveImageSrc } from "@/lib/utils/chat";
import { cn } from "@/lib/utils/ui";

interface ChatImageProps {
  src: string;
  alt?: string;
  onClick?: () => void;
  className?: string;
}

export function ChatImage({
  src,
  alt = "",
  onClick,
  className,
}: ChatImageProps) {
  const [loaded, setLoaded] = useState(false);
  const resolvedSrc = resolveImageSrc(src);

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-lg relative"
    >
      {!loaded && (
        <div
          className={cn(
            "bg-muted/50 animate-pulse rounded-lg w-32 h-24",
            className,
          )}
        />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(className, !loaded && "hidden")}
      />
      <span className="sr-only">View attachment</span>
    </button>
  );
}
