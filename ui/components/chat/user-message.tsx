import {
  type FileUIPart,
  isFileUIPart,
  isTextUIPart,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "@/components/chat/markdown";
import { cn } from "@/lib/utils/ui";

export type MessageSize = "default" | "compact";

function isImagePart(
  part: UIMessage["parts"][number],
): part is FileUIPart & { mediaType: `image/${string}` } {
  return isFileUIPart(part) && part.mediaType.startsWith("image/");
}

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
  const imageParts = message.parts.filter(isImagePart);

  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "rounded-2xl max-w-[80%] text-sm bg-user-bubble text-foreground",
        isCompact ? "px-3 py-2" : "px-4 py-2.5",
      )}
    >
      {imageParts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {imageParts.map((part) => (
            <button
              key={part.url}
              type="button"
              onClick={() => onImageClick?.(part.url)}
              className="cursor-pointer rounded-lg"
            >
              <img
                src={part.url}
                alt=""
                className={cn(
                  "rounded-lg",
                  isCompact ? "max-h-24" : "max-h-32",
                )}
              />
              <span className="sr-only">View attachment</span>
            </button>
          ))}
        </div>
      )}
      <div className="prose prose-sm max-w-none text-foreground">
        {message.parts.map((part, i) =>
          isTextUIPart(part) ? (
            <ReactMarkdown
              key={`${message.id}-text-${i}`}
              components={markdownComponents}
            >
              {part.text}
            </ReactMarkdown>
          ) : null,
        )}
      </div>
    </div>
  );
}
