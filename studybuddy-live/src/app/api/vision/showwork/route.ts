import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const { imageBase64, focusCropUrl, lastTurns } = await req.json();
	const client = getAnthropic();

	if (!client) {
		// Dev stub: return a friendly generic structure
		return Response.json({
			observations: ["Neat structure. Consider clarifying your base case."],
			questions: ["What should the function return when the node is null?"],
			praise: "Great that you drew it out first — that's solid problem solving.",
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

	const system =
		"You analyze a student's handwritten work (math/code/diagrams). Return JSON with keys observations[], questions[2], praise. Socratic tone. No final answers.";

	const message = await client.messages.create({
		model: "claude-3-5-sonnet-20241022",
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
						text:
							"Given the images above (current-problem crop optional, then the student's paper), produce: {\"observations\": string[], \"questions\": string[2], \"praise\": string} and nothing else.",
					},
				],
			},
		],
	});

	const text = (message.content as any)[0]?.text ?? "{}";
	try {
		const parsed = JSON.parse(text);
		return Response.json(parsed);
	} catch {
		return Response.json({
			observations: [],
			questions: ["Tell me the goal of your function.", "Where is your base case handled?"],
			praise: "Nice progress so far — you're thinking in the right direction.",
		});
	}
}


