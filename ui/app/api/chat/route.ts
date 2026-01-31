import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getSystemPrompt } from "@/lib/agent/prompts";
import { createTools } from "@/lib/agent/tools";
import { getApiKey, getFS, getGoogleCalendar } from "@/lib/context";
import { saveChat } from "@/lib/data/chats";
import type { ImageAttachment, Message } from "@/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages }: { messages: UIMessage[] } = body;
  const chatId = body.chatId as string | undefined;

  const fs = await getFS();
  const gcal = await getGoogleCalendar();
  const apiKey = await getApiKey();

  const tools = createTools(fs, () => gcal, apiKey);
  const systemPrompt = await getSystemPrompt(fs);

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(15),
    experimental_transform: smoothStream({
      chunking: "word",
      delayInMs: 40,
    }),
    onFinish: async ({ response }) => {
      // Auto-save chat after completion
      if (chatId) {
        // Extract text from the response
        const assistantMessages = response.messages.filter(
          (m) => m.role === "assistant",
        );
        const lastAssistantMessage =
          assistantMessages[assistantMessages.length - 1];

        let assistantText = "";
        if (
          lastAssistantMessage &&
          Array.isArray(lastAssistantMessage.content)
        ) {
          for (const part of lastAssistantMessage.content) {
            if (part.type === "text" && part.text) {
              assistantText += part.text;
            }
          }
        }

        // Extract title from first user message in input
        let title = "New Chat";
        for (const msg of messages) {
          if (msg.role !== "user") continue;
          for (const part of msg.parts) {
            if (part.type === "text" && part.text) {
              title = part.text.slice(0, 50);
              break;
            }
          }
          if (title !== "New Chat") break;
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

        await saveChat(fs, chatId, title, storedMessages);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
