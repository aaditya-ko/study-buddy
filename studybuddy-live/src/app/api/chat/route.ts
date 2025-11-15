import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const { transcript, emotion, courseContext, focusCropUrl } = await req.json();
	const client = getAnthropic();

	if (!client) {
		// Fallback stub for local/dev without key
		const text =
			emotion === "frustrated"
				? "I can see this is getting tough. What are you trying to do with your current step?"
				: "Got it. Tell me what you're thinking right now.";
		return Response.json({ response: text });
	}

	const system = `You are a warm, Socratic tutor. Student emotion: ${emotion ?? "unknown"}.
Course context: ${courseContext ?? "N/A"}.
If a current problem crop is provided, refer to it implicitly without giving the final answer. Keep replies brief (1–3 sentences).`;

	const content: any[] = [{ type: "text", text: transcript ?? "" }];
	if (focusCropUrl) {
		// Send the crop URL as an image. If it's a data URL, pass it directly.
    content.unshift({
      type: "image",
      source: focusCropUrl.startsWith("data:")
        ? { type: "base64" as const, media_type: "image/webp" as const, data: focusCropUrl.split(",")[1] }
        : { type: "url" as const, url: focusCropUrl },
    });
	}

	const message = await client.messages.create({
		model: "claude-3-5-sonnet-20240620",
		max_tokens: 400,
		temperature: 0.5,
		system,
		messages: [{ role: "user", content }],
	});

	try {
		return Response.json({ response: (message.content as any)[0]?.text ?? "" });
	} catch (e) {
		console.warn("Chat error:", e);
		const text =
			emotion === "frustrated"
				? "I can see this is getting tough. What are you trying to do with your current step?"
				: "Got it. Tell me what you're thinking right now.";
		return Response.json({ response: text });
	}
}


