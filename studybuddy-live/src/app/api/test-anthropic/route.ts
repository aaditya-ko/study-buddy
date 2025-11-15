import { NextRequest } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

/**
 * Test endpoint to verify Anthropic API connectivity.
 * Visit /api/test-anthropic in browser or POST to it.
 */
export async function GET(req: NextRequest) {
	console.log("[TEST] Checking Anthropic connection…");
	
	const client = getAnthropic();
	
	if (!client) {
		const msg = "❌ ANTHROPIC_API_KEY not found in environment";
		console.error("[TEST]", msg);
		return Response.json({ 
			success: false, 
			error: msg,
			hint: "Create .env.local with ANTHROPIC_API_KEY=sk-ant-... and restart dev server"
		});
	}
	
	console.log("[TEST] Client created, attempting text completion with creative prompt…");
	
	try {
		const message = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 150,
			temperature: 0.7,
			messages: [
				{
					role: "user",
					content: "Compose a short 4-line poem about Claude the AI assistant. Make it rhyme and be playful."
				}
			]
		});
		
		const text = (message.content as any)[0]?.text || "";
		console.log("[TEST] ✅ Success! Claude responded with a poem:");
		console.log(text);
		
		return Response.json({
			success: true,
			model: "claude-sonnet-4-20250514",
			poem: text,
			message: "🎉 Anthropic API is connected and working! Check the poem above.",
			timestamp: new Date().toISOString()
		});
		
	} catch (e: any) {
		const errMsg = e?.message || String(e);
		console.error("[TEST] ❌ API call failed:", errMsg);
		console.error("[TEST] Full error:", e);
		
		return Response.json({
			success: false,
			error: errMsg,
			hint: "Check that your API key is valid and has access to claude-sonnet-4-20250514"
		}, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	return GET(req);
}

