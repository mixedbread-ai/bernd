import type { MessageSize } from "@/components/chat/user-message";
import { cn } from "@/lib/utils/ui";

interface StreamingIndicatorProps {
  size?: MessageSize;
}

export function StreamingIndicator({
  size = "default",
}: StreamingIndicatorProps) {
  const dotSize = size === "compact" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(dotSize, "rounded-full animate-bounce bg-accent")}
        style={{ animationDelay: "0ms" }}
      />
      <div
        className={cn(dotSize, "rounded-full animate-bounce bg-accent")}
        style={{ animationDelay: "150ms" }}
      />
      <div
        className={cn(dotSize, "rounded-full animate-bounce bg-accent")}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
