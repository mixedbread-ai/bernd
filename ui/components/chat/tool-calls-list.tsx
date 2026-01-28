"use client";

import type { ToolCall } from "../../types";
import { ToolCallItem } from "./tool-call-item";

interface ToolCallsListProps {
  toolCalls: ToolCall[];
}

export function ToolCallsList({ toolCalls }: ToolCallsListProps) {
  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, j) => (
        <ToolCallItem key={tc.call_id || j} toolCall={tc} />
      ))}
    </div>
  );
}
