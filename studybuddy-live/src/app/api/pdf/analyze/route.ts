import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	console.log("[PDF-ANALYZE] Route called");
	
	const { imageBase64, imagesBase64, context } = await req.json();
	const images = imagesBase64 || (imageBase64 ? [imageBase64] : []);
	const isHighlightedProblem = context === "highlighted_problem";
	
	console.log("[PDF-ANALYZE] Received", images.length, "image(s)", isHighlightedProblem ? "(HIGHLIGHTED PROBLEM)" : "");
	
	const client = getAnthropic();

	// Dev stub or missing payload
	if (!client) {
		console.warn("[PDF-ANALYZE] ❌ No Anthropic client (ANTHROPIC_API_KEY missing)");
		return Response.json({
			summary:
				"[STUB - NO API KEY] Looks like a course assignment/problem set. Add ANTHROPIC_API_KEY to .env.local",
		});
	}
	
	if (images.length === 0) {
		console.warn("[PDF-ANALYZE] ❌ No images provided");
		return Response.json({
			summary: "[STUB - NO IMAGES] No PDF images to analyze.",
		});
	}
	
	console.log("[PDF-ANALYZE] ✅ Client ready, preparing vision request…");

	const system = isHighlightedProblem
		? "You are analyzing a SPECIFIC PROBLEM the student just highlighted from their assignment. This is their CURRENT FOCUS. Describe what the problem asks, what concepts it tests, and what approach it requires. Be specific and helpful - this is what they're actively working on RIGHT NOW."
		: "You analyze the first few pages of a course assignment/problem set. Return a 2–3 sentence summary covering: course/topic, assignment type, key concepts (e.g. recursion, dynamic programming), and any problem numbering/structure you notice. Keep it warm and helpful.";

	const buildImage = (b64: string) => ({
		type: "image" as const,
		source: {
			type: "base64" as const,
			media_type: "image/webp" as const,
			data: b64.split(",")[1],
		},
	});

	// Build content array with all images
	const content: any[] = images.slice(0, 4).map(buildImage);
	
	const promptText = isHighlightedProblem
		? "🎯 CURRENT PROBLEM: The student just highlighted this specific problem they're working on. Analyze it in detail: What is being asked? What concepts does it test? What's the expected approach? Be specific - this is their active focus right now."
		: "Provide a concise 2–3 sentence course-context summary covering the assignment topic, structure, and key problem areas.";
	
	content.push({
		type: "text",
		text: promptText,
	});

	console.log("[PDF-ANALYZE] Sending", content.length - 1, "image(s) to Claude Sonnet 4…");

	try {
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 200,
			temperature: 0.3,
			system,
			messages: [
				{
					role: "user",
					content,
				},
			],
		});
		
		const summary = (message.content as any)[0]?.text?.trim?.() || "";
		if (isHighlightedProblem) {
			console.log("[PDF-ANALYZE] ✅ Success! HIGHLIGHTED PROBLEM ANALYSIS:");
			console.log("[PDF-ANALYZE] 🎯", summary);
		} else {
			console.log("[PDF-ANALYZE] ✅ Success! Summary:", summary);
		}
		return Response.json({ summary });
		
	} catch (e: any) {
		console.error("[PDF-ANALYZE] ❌ API error:", e?.message || e);
		console.error("[PDF-ANALYZE] Full error object:", e);
		return Response.json({
			summary:
				"[ERROR] Failed to analyze PDF with Claude. Check server logs for details.",
			error: e?.message || String(e)
		});
	}
}
