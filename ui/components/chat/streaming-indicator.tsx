import type { MessageSize } from "./user-message";

interface StreamingIndicatorProps {
  size?: MessageSize;
}

export function StreamingIndicator({ size = "default" }: StreamingIndicatorProps) {
  const dotSize = size === "compact" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div className="flex items-center gap-1">
      <div
        className={`${dotSize} rounded-full animate-bounce bg-accent`}
        style={{ animationDelay: "0ms" }}
      />
      <div
        className={`${dotSize} rounded-full animate-bounce bg-accent`}
        style={{ animationDelay: "150ms" }}
      />
      <div
        className={`${dotSize} rounded-full animate-bounce bg-accent`}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
