import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	console.log("[EMOTION] Route called");
	
	const { imageBase64 } = await req.json();
	const client = getAnthropic();
	
	if (!imageBase64) {
		console.warn("[EMOTION] ❌ No image provided");
		return Response.json({ emotion: "neutral", reasoning: "No image provided" });
	}

	if (!client) {
		console.warn("[EMOTION] ❌ No Anthropic client (ANTHROPIC_API_KEY missing)");
		return Response.json({ emotion: "neutral", reasoning: "API key not configured" });
	}
	
	console.log("[EMOTION] ✅ Client ready, analyzing webcam image…");

	const system = `You are analyzing a student's facial expression and body language from a webcam feed to determine their emotional state while studying.

Valid emotion labels:
- "focused": Alert, engaged, looking at work, concentrating
- "frustrated": Tense, furrowed brow, hand on head, sighing posture
- "confused": Puzzled expression, tilted head, uncertain look
- "breakthrough": Excited, smiling, sitting up, energetic
- "neutral": Calm, relaxed, no strong emotion visible

	IMPORTANT: Always produce a short, warm, genuine compliment based on what you can observe (e.g., clothing color/style like "nice hoodie", "cool shirt", glasses, headphones, room lighting like "great setup", hair, or just general positivity like "looking ready to tackle this"). NEVER return an empty compliment - be creative and friendly. Keep it casual and encouraging (5-8 words max).
	
	Respond with JSON ONLY:
	{"emotion": "label", "reasoning": "brief explanation of what you observe", "compliment": "always include a short friendly phrase"} `;

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
			max_tokens: 150,
			temperature: 0.2,
			system,
			messages: [
				{
					role: "user",
					content: [
						image,
					{
						type: "text",
							text: "Analyze this student's emotional state and return JSON only: {\"emotion\": \"label\", \"reasoning\": \"what you observe\", \"compliment\": \"REQUIRED short friendly phrase (5-8 words)\"}",
					},
					],
				},
			],
		});

		try {
			const text = (message.content as any)[0]?.text ?? "{}";
			console.log("[EMOTION] Raw response:", text);
			
			const parsed = JSON.parse(text);
			const emotion = parsed.emotion ?? "neutral";
			const reasoning = parsed.reasoning ?? "Unable to determine";
			let compliment = typeof parsed.compliment === "string" ? parsed.compliment.trim() : "";
			
			// Fallback: ensure we always have a compliment
			if (!compliment || compliment.length === 0) {
				const fallbacks = [
					"love the focus",
					"great study setup",
					"looking ready to learn",
					"nice vibe",
					"ready to tackle this"
				];
				compliment = fallbacks[Math.floor(Math.random() * fallbacks.length)];
				console.log("[EMOTION] ⚠️ No compliment from Claude, using fallback");
			}
			
			console.log("[EMOTION] ✅ Detected:", emotion);
			console.log("[EMOTION] 💭 Reasoning:", reasoning);
			console.log("[EMOTION] 🤝 Compliment:", compliment);
			
			return Response.json({ emotion, reasoning, compliment });
		} catch (parseErr) {
			console.error("[EMOTION] ❌ Failed to parse JSON:", parseErr);
			return Response.json({ emotion: "neutral", reasoning: "Parse error", compliment: "looking ready to learn" });
		}
	} catch (e: any) {
		console.error("[EMOTION] ❌ API error:", e?.message || e);
		return Response.json({ emotion: "neutral", reasoning: "API call failed", compliment: "looking ready to learn" });
	}
}
