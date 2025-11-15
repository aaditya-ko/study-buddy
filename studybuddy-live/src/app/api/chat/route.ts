import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

/**
 * Chat endpoint with full conversation memory.
 * Accepts either:
 * - Old format: { transcript, emotion, courseContext, focusCropUrl }
 * - New format: { messages, emotion, courseContext, focusCropUrl }
 */
export async function POST(req: NextRequest) {
	const { transcript, messages, emotion, courseContext, focusCropUrl } = await req.json();
	const client = getAnthropic();

	if (!client) {
		// Fallback stub for local/dev without key
		const text =
			emotion === "frustrated"
				? "I can see this is getting tough. What are you trying to do with your current step?"
				: "Got it. Tell me what you're thinking right now.";
		return Response.json({ response: text });
	}

	const system = `You are a warm, Socratic tutor helping a student study. Student emotion: ${emotion ?? "neutral"}.
Course context: ${courseContext ?? "N/A"}.

Guidelines:
- Ask guiding questions rather than giving direct answers
- Be encouraging and patient
- Reference the course context naturally when relevant
- If student is frustrated, be extra gentle and break things down
- Keep responses conversational and brief (2-3 sentences usually)
- If a highlighted problem image is shown, reference it implicitly`;

	// Build conversation history
	let conversationMessages: any[];
	
	if (messages && Array.isArray(messages)) {
		// New format: full conversation history
		console.log("[CHAT] Using conversation history with", messages.length, "messages");
		conversationMessages = messages.map((msg: any) => {
			if (msg.role === "assistant") {
				return {
					role: "assistant" as const,
					content: msg.content
				};
			} else {
				// User message - might have text + optional image
				const content: any[] = [];
				
				// Add focus crop image if present in this turn
				if (msg.focusCropUrl) {
					content.push({
						type: "image",
						source: msg.focusCropUrl.startsWith("data:")
							? { type: "base64" as const, media_type: "image/webp" as const, data: msg.focusCropUrl.split(",")[1] }
							: { type: "url" as const, url: msg.focusCropUrl }
					});
				}
				
				// Add text
				content.push({
					type: "text",
					text: msg.content || ""
				});
				
				return {
					role: "user" as const,
					content
				};
			}
		});
	} else {
		// Old format: single transcript (backward compatibility)
		console.log("[CHAT] Using single transcript (legacy format)");
		const content: any[] = [];
		
		if (focusCropUrl) {
			content.push({
				type: "image",
				source: focusCropUrl.startsWith("data:")
					? { type: "base64" as const, media_type: "image/webp" as const, data: focusCropUrl.split(",")[1] }
					: { type: "url" as const, url: focusCropUrl }
			});
		}
		
		content.push({
			type: "text",
			text: transcript ?? ""
		});
		
		conversationMessages = [{ role: "user" as const, content }];
	}

	try {
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 400,
			temperature: 0.7,
			system,
			messages: conversationMessages,
		});

		const responseText = (message.content as any)[0]?.text ?? "";
		console.log("[CHAT] ✅ Response generated:", responseText.substring(0, 100) + "...");
		return Response.json({ response: responseText });
		
	} catch (e: any) {
		console.error("[CHAT] ❌ Error:", e?.message || e);
		const text =
			emotion === "frustrated"
				? "I can see this is getting tough. What are you trying to do with your current step?"
				: "Got it. Tell me what you're thinking right now.";
		return Response.json({ response: text });
	}
}
