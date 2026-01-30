import {
  type ChatStatus,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import { CopyButton } from "./copy-button";
import { markdownComponents } from "./markdown";
import type { ToolPartProps } from "./tool-call-item";
import { ToolCallsList } from "./tool-calls-list";

interface AssistantMessageProps {
  message: UIMessage;
  status: ChatStatus;
}

export function AssistantMessage({ message, status }: AssistantMessageProps) {
  const toolParts: ToolPartProps[] = [];
  const textParts: string[] = [];

  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      textParts.push(part.text);
    } else if (isToolUIPart(part)) {
      toolParts.push({
        name: getToolName(part),
        toolCallId: part.toolCallId,
        state: part.state,
        input: part.input,
        output: part.output,
      });
    }
  }

  const textContent = textParts.join("");

  return (
    <div className="max-w-[85%] group/message">
      {toolParts.length > 0 && <ToolCallsList toolParts={toolParts} />}
      {textContent && (
        <>
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown components={markdownComponents}>
              {textContent}
            </ReactMarkdown>
          </div>
          {status === "ready" && (
            <div className="mt-1 opacity-100 md:opacity-0 md:group-hover/message:opacity-100 transition-opacity">
              <CopyButton text={textContent} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
