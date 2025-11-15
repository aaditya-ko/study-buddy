import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const { imageBase64 } = await req.json();
	const client = getAnthropic();
	if (!imageBase64) {
		return Response.json({ emotion: "neutral" });
	}

	if (!client) {
		// No API key: return a deterministic "neutral" stub
		return Response.json({ emotion: "neutral" });
	}

	const system =
		"Classify student emotion from a webcam still. Valid labels: focused, frustrated, confused, breakthrough, neutral. Respond with a single JSON object {\"emotion\":\"label\"}.";

	const image = {
		type: "image" as const,
		source: {
			type: "base64" as const,
			media_type: "image/webp" as const,
			data: imageBase64.split(",")[1],
		},
	};

	try {
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 100,
			temperature: 0,
			system,
			messages: [{ role: "user", content: [image, { type: "text", text: "Return JSON only." }] }],
		});

		try {
			const text = (message.content as any)[0]?.text ?? "{}";
			const parsed = JSON.parse(text);
			return Response.json({ emotion: parsed.emotion ?? "neutral" });
		} catch {
			return Response.json({ emotion: "neutral" });
		}
	} catch (e) {
		console.warn("Ambient vision error:", e);
		return Response.json({ emotion: "neutral" });
	}
}


