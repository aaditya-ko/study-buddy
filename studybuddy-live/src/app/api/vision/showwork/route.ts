import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const { imageBase64, focusCropUrl, lastTurns } = await req.json();
	const client = getAnthropic();

	console.log("[SHOWWORK] Analyzing student's written work...");
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

	const content: any[] = [
		{
			type: "image",
			source: {
				type: "base64" as const,
				media_type: "image/webp" as const,
				data: imageBase64.split(",")[1],
			},
		},
	];

	if (focusCropUrl) {
		content.unshift(
			focusCropUrl.startsWith("data:")
				? {
						type: "image",
						source: {
							type: "base64" as const,
							media_type: "image/webp" as const,
							data: focusCropUrl.split(",")[1],
						},
				  }
				: { type: "image", source: { type: "url" as const, url: focusCropUrl } }
		);
	}

	const system = focusCropUrl
		? `You are analyzing a student's handwritten work on a SPECIFIC PROBLEM they highlighted.

IMAGE 1: The highlighted problem from their assignment (what they're supposed to solve)
IMAGE 2: Their written work/attempt on paper

Your job:
1. Compare their written work to what the problem asks
2. Identify what they're doing well (praise)
3. Notice patterns in their approach (observations)
4. Ask 2 Socratic questions to guide them forward (questions)

Return JSON ONLY: {"praise": "string", "observations": ["string", "string"], "questions": ["string", "string"]}

Tone: Warm, encouraging, specific. Reference their actual written work. Never give away the answer—guide them to discover it.`
		: "You analyze a student's handwritten work (math/code/diagrams). Return JSON with keys observations[], questions[2], praise. Socratic tone. No final answers.";

	try {
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 500,
			temperature: 0.4,
			system,
			messages: [
					{
						role: "user",
						content: [
							...content,
							{
								type: "text",
								text: focusCropUrl
									? "Analyze the student's written work (Image 2) in the context of the problem they're solving (Image 1). Return ONLY valid JSON: {\"praise\": \"what they did well\", \"observations\": [\"pattern 1\", \"pattern 2\"], \"questions\": [\"guiding question 1?\", \"guiding question 2?\"]}"
									: "Given the images above (current-problem crop optional, then the student's paper), produce: {\"observations\": string[], \"questions\": string[2], \"praise\": string} and nothing else.",
							},
						],
					},
			],
		});

		const text = (message.content as any)[0]?.text ?? "{}";
		try {
			const parsed = JSON.parse(text);
			console.log("[SHOWWORK] ✅ Analysis complete:");
			console.log("[SHOWWORK] 💬 Observations:", parsed.observations);
			console.log("[SHOWWORK] ❓ Questions:", parsed.questions);
			console.log("[SHOWWORK] 🎉 Praise:", parsed.praise);
			return Response.json(parsed);
		} catch (parseErr) {
			console.error("[SHOWWORK] ❌ Failed to parse Claude response:", parseErr);
			console.error("[SHOWWORK] Raw response:", text);
			return Response.json({
				observations: [],
				questions: [],
				praise: "I had trouble analyzing your work. Please try again or ensure your work is clearly visible.",
			});
		}
	} catch (e) {
		console.error("[SHOWWORK] ❌ Vision API error:", e);
		return Response.json({
			observations: [],
			questions: [],
			praise: "I encountered an error analyzing your work. Please try again.",
		});
	}
}
