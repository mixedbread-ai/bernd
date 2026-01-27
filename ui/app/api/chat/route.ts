import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { getSystemPrompt } from "@/lib/agent/prompts";
import { createTools } from "@/lib/agent/tools";
import { getApiKey, getFS, getGoogleCalendar } from "@/lib/context";
import { saveChat } from "@/lib/data/chats";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
	const body = await req.json();
	const messages = body.messages ?? [];
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
						if (
							typeof part === "object" &&
							part !== null &&
							"text" in part &&
							typeof part.text === "string"
						) {
							assistantText += part.text;
						}
					}
				}

				// Extract title from first user message in input
				let title = "New Chat";
				for (const msg of messages) {
					if (
						msg &&
						typeof msg === "object" &&
						msg.role === "user" &&
						Array.isArray(msg.parts)
					) {
						for (const part of msg.parts) {
							if (
								part &&
								typeof part === "object" &&
								part.type === "text" &&
								typeof part.text === "string"
							) {
								title = part.text.slice(0, 50);
								break;
							}
						}
						break;
					}
				}

				// Build simplified message history for storage
				const storedMessages = [
					...messages.map(
						(msg: {
							role?: string;
							parts?: Array<{ type?: string; text?: string }>;
						}) => {
							let content = "";
							if (msg.parts) {
								for (const part of msg.parts) {
									if (part.type === "text" && part.text) {
										content += part.text;
									}
								}
							}
							return {
								role: (msg.role ?? "user") as "user" | "assistant",
								content,
							};
						},
					),
					{ role: "assistant" as const, content: assistantText },
				];

				await saveChat(fs, chatId, title, storedMessages);
			}
		},
	});

	return result.toUIMessageStreamResponse();
}
