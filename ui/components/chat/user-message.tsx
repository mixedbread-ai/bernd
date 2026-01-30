import { isTextUIPart, type UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";

export type MessageSize = "default" | "compact";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface UserMessageProps {
  message: UIMessage;
  onImageClick?: (src: string) => void;
  size?: MessageSize;
}

export function UserMessage({
  message,
  onImageClick,
  size = "default",
}: UserMessageProps) {
  const imageParts = message.parts.filter(
    (p) => p.type === "file" && p.mediaType.startsWith("image/"),
  );

  const isCompact = size === "compact";

  return (
    <div
      className={`rounded-2xl max-w-[80%] text-sm bg-user-bubble text-foreground ${
        isCompact ? "px-3 py-2" : "px-4 py-2.5"
      }`}
    >
      {imageParts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {imageParts.map((part, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                onImageClick?.(part.type === "file" ? part.url : "")
              }
              className="cursor-pointer"
            >
              <img
                src={part.type === "file" ? part.url : ""}
                alt="attachment"
                className={`rounded-lg ${isCompact ? "max-h-24" : "max-h-32"}`}
              />
            </button>
          ))}
        </div>
      )}
      <div className="prose prose-sm max-w-none text-foreground">
        {message.parts.map((part, i) =>
          isTextUIPart(part) ? (
            <ReactMarkdown key={i} components={markdownComponents}>
              {part.text}
            </ReactMarkdown>
          ) : null,
        )}
      </div>
    </div>
  );
}
