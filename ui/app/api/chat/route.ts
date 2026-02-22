import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getSystemPrompt } from "@/lib/agent/prompts";
import { createTools } from "@/lib/agent/tools";
import { getApiKey, getFS, getGoogleCalendar } from "@/lib/context";
import { getChat, processImagesForSave, saveChat } from "@/lib/data/chats";
import type { SemanticFS } from "@/lib/services/semantic-fs";
import type { ImageAttachment, Message } from "@/types";

export const maxDuration = 60;

async function generateChatTitle(messages: Message[]): Promise<string> {
  if (messages.length === 0) return "New Chat";

  const conversationText = messages
    .slice(0, 6)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content.slice(0, 500)}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or punctuation at the end.",
      prompt: conversationText,
      maxOutputTokens: 20,
      temperature: 0.7,
    });

    const title = text
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "");
    return title.slice(0, 50);
  } catch {
    // Fallback to first user message
    for (const msg of messages) {
      if (msg.role === "user") {
        const title = msg.content.slice(0, 50);
        return msg.content.length > 50 ? `${title}...` : title;
      }
    }
    return "New Chat";
  }
}

/**
 * Resolve storage-path images in UIMessages to base64 data URLs so the model
 * can process them. The original messages (with storage paths) are kept for saving.
 */
async function resolveImagesForModel(
  fs: SemanticFS,
  messages: UIMessage[],
): Promise<UIMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      const hasStorageImages = msg.parts.some(
        (part) =>
          part.type === "file" &&
          part.url &&
          !part.url.startsWith("data:") &&
          !part.url.startsWith("http"),
      );
      if (!hasStorageImages) return msg;

      const parts = await Promise.all(
        msg.parts.map(async (part) => {
          if (
            part.type !== "file" ||
            !part.url ||
            part.url.startsWith("data:") ||
            part.url.startsWith("http")
          ) {
            return part;
          }
          try {
            const result = await fs.readBinary(part.url);
            const base64 = Buffer.from(result.data).toString("base64");
            return { ...part, url: `data:${part.mediaType};base64,${base64}` };
          } catch {
            return part;
          }
        }),
      );

      return { ...msg, parts };
    }),
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages }: { messages: UIMessage[] } = body;
  const chatId = body.chatId as string | undefined;

  const [fs, gcal, apiKey] = await Promise.all([
    getFS(),
    getGoogleCalendar(),
    getApiKey(),
  ]);

  const [tools, systemPrompt] = await Promise.all([
    Promise.resolve(createTools(fs, () => gcal, apiKey)),
    getSystemPrompt(fs),
  ]);

  // Resolve storage-path images to base64 for the model while keeping
  // the original `messages` (with storage paths) for saving in onFinish.
  const modelMessages = await resolveImagesForModel(fs, messages);

  const result = streamText({
    model: openai("gpt-5.2"),
    system: systemPrompt,
    messages: await convertToModelMessages(modelMessages),
    tools,
    providerOptions: {
      openai: { reasoningEffort: "medium" },
    },
    stopWhen: stepCountIs(15),
    experimental_transform: smoothStream({
      chunking: "word",
      delayInMs: 40,
    }),
    onFinish: async ({ response }) => {
      try {
        // Auto-save chat after completion
        if (chatId) {
          // Extract text from the response
          const assistantMessages = response.messages.filter(
            (m) => m.role === "assistant",
          );
          const lastAssistantMessage =
            assistantMessages[assistantMessages.length - 1];

          let assistantText = "";
          if (typeof lastAssistantMessage.content === "string") {
            assistantText = lastAssistantMessage.content;
          } else if (Array.isArray(lastAssistantMessage.content)) {
            for (const part of lastAssistantMessage.content) {
              if (part.type === "text" && part.text) {
                assistantText += part.text;
              }
            }
          }

          // Build simplified message history for storage
          const storedMessages: Message[] = [
            ...messages.map((msg) => {
              let content = "";
              const images: ImageAttachment[] = [];
              for (const part of msg.parts) {
                if (part.type === "text" && part.text) {
                  content += part.text;
                } else if (
                  part.type === "file" &&
                  part.mediaType?.startsWith("image/") &&
                  part.url
                ) {
                  images.push({
                    type: "image",
                    data: part.url,
                    mimeType: part.mediaType,
                  });
                }
              }
              return {
                role: msg.role as "user" | "assistant",
                content,
                ...(images.length > 0 ? { images } : {}),
              };
            }),
            { role: "assistant", content: assistantText },
          ];

          const existingChat = await getChat(fs, chatId);
          const processedMessages = await processImagesForSave(
            fs,
            chatId,
            storedMessages,
          );
          const title =
            existingChat && existingChat.title !== "New Chat"
              ? existingChat.title
              : await generateChatTitle(storedMessages);
          await saveChat(fs, chatId, title, processedMessages);
        }
      } catch (e) {
        console.error("[chat] Failed to save chat:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
