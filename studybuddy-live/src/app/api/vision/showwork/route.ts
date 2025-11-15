import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const { imageBase64, focusCropUrl, lastTurns } = await req.json();
	const client = getAnthropic();

	console.log("[SHOWWORK] Analyzing student's written work...");
	
	// Validate image data
	if (!imageBase64 || typeof imageBase64 !== "string") {
		console.error("[SHOWWORK] ❌ No valid imageBase64 provided");
		return Response.json({
			observations: [],
			questions: [],
			praise: "No image data received. Please try showing your work again.",
		});
	}
	
	console.log("[SHOWWORK] 📸 Image received, size:", Math.round(imageBase64.length / 1024), "KB");
	
	if (focusCropUrl) {
		console.log("[SHOWWORK] 🎯 Highlighted problem crop INCLUDED - AI knows what problem student is working on");
	} else {
		console.log("[SHOWWORK] ⚠️ No highlighted problem - analyzing work without problem context");
	}

	if (!client) {
		console.warn("[SHOWWORK] ⚠️ No Anthropic client - API key not configured");
		return Response.json({
			observations: [],
			questions: [],
			praise: "API key not configured. Please add ANTHROPIC_API_KEY to analyze your work.",
		});
	}

	// Extract base64 data (remove data:image/webp;base64, prefix if present)
	const imageData = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
	
	if (!imageData || imageData.length === 0) {
		console.error("[SHOWWORK] ❌ Invalid image data after extraction");
		return Response.json({
			observations: [],
			questions: [],
			praise: "Invalid image format. Please try again.",
		});
	}

	const content: any[] = [
		{
			type: "image",
			source: {
				type: "base64" as const,
				media_type: "image/webp" as const,
				data: imageData,
			},
		},
	];

	if (focusCropUrl) {
		console.log("[SHOWWORK] 📋 Focus crop size:", Math.round(focusCropUrl.length / 1024), "KB");
		const focusData = focusCropUrl.startsWith("data:") ? focusCropUrl.split(",")[1] : focusCropUrl;
		
		content.unshift({
			type: "image",
			source: {
				type: "base64" as const,
				media_type: "image/webp" as const,
				data: focusData,
			},
		});
	}

	const system = focusCropUrl
		? `You are a warm, Socratic tutor analyzing a student's written work.

IMAGE 1: The problem they're solving (from their assignment)
IMAGE 2: Their handwritten work/attempt

Analyze what you can see and return ONLY valid JSON (no markdown, no extra text):
{
  "praise": "One encouraging thing they did well",
  "observations": ["Pattern or approach you notice", "Another observation"],
  "questions": ["Guiding question to help them think?", "Another Socratic question?"]
}

Be specific about what you see in their writing. If the image is unclear or you can't see written work, still provide helpful generic guidance based on the problem.`
		: `You are analyzing a student's handwritten work (math, code, or diagrams).

Return ONLY valid JSON (no markdown):
{
  "praise": "Something positive about their effort",
  "observations": ["What you notice in their approach"],
  "questions": ["Guiding question to help them progress?"]
}

If the image is unclear, provide encouraging generic feedback.`;

	try {
		console.log("[SHOWWORK] 📤 Sending request to Claude with", content.length, "image(s)");
		
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 600,
			temperature: 0.5,
			system,
			messages: [
				{
					role: "user",
					content: [
						...content,
						{
							type: "text",
							text: focusCropUrl
								? "Analyze the student's written work shown in Image 2, in the context of the problem from Image 1. Return ONLY valid JSON with praise, observations, and questions. No markdown, no code blocks."
								: "Analyze the student's written work shown in the image. Return ONLY valid JSON with praise, observations array, and questions array. No markdown.",
						},
					],
				},
			],
		});

		console.log("[SHOWWORK] ✅ Received response from Claude");
		let text = (message.content as any)[0]?.text ?? "{}";
		console.log("[SHOWWORK] Raw response text:", text);
		
		// Clean up response - remove markdown code blocks if present
		text = text.trim();
		if (text.startsWith("```json")) {
			text = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
		} else if (text.startsWith("```")) {
			text = text.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
		}
		
		try {
			const parsed = JSON.parse(text);
			
			// Validate structure and provide defaults
			const result = {
				praise: typeof parsed.praise === "string" ? parsed.praise : "Great effort on working through this!",
				observations: Array.isArray(parsed.observations) ? parsed.observations : ["I can see you're working on this problem"],
				questions: Array.isArray(parsed.questions) ? parsed.questions : ["What approach are you taking?", "What step are you working on right now?"]
			};
			
			console.log("[SHOWWORK] ✅ Analysis complete:");
			console.log("[SHOWWORK] 💬 Observations:", result.observations);
			console.log("[SHOWWORK] ❓ Questions:", result.questions);
			console.log("[SHOWWORK] 🎉 Praise:", result.praise);
			return Response.json(result);
		} catch (parseErr) {
			console.error("[SHOWWORK] ❌ Failed to parse Claude response:", parseErr);
			console.error("[SHOWWORK] Cleaned text:", text);
			return Response.json({
				observations: ["I can see your work on the problem"],
				questions: ["What approach are you considering?", "What's your next step?"],
				praise: "Keep working through it - you're making progress!",
			});
		}
	} catch (e: any) {
		console.error("[SHOWWORK] ❌ Vision API error:");
		console.error("[SHOWWORK] Error message:", e?.message || "Unknown error");
		console.error("[SHOWWORK] Error type:", e?.type || "Unknown type");
		console.error("[SHOWWORK] Full error:", JSON.stringify(e, null, 2));
		return Response.json({
			observations: [],
			questions: [],
			praise: "I encountered an error analyzing your work. Please try again.",
		});
	}
}
