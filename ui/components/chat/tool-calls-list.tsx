"use client";

import { ToolCallItem, type ToolPartProps } from "./tool-call-item";

interface ToolCallsListProps {
  toolParts: ToolPartProps[];
}

export function ToolCallsList({ toolParts }: ToolCallsListProps) {
  return (
    <div className="mb-2 space-y-1">
      {toolParts.map((tp) => (
        <ToolCallItem key={tp.toolCallId} {...tp} />
      ))}
    </div>
  );
}
