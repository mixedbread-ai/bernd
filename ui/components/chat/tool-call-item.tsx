"use client";

import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

export interface ToolPartProps {
  name: string;
  toolCallId: string;
  state: string;
  input: unknown;
  output?: unknown;
}

export function ToolCallItem({ name, state, input, output }: ToolPartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasResult = state === "output-available";

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs font-mono text-muted hover:text-foreground transition-colors"
      >
        <span className="text-accent">→</span>
        <span>{name}</span>
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
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {hasResult && (
            <div>
              <div className="text-[10px] text-muted mb-0.5">output</div>
              <pre className="font-mono text-foreground/80 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
