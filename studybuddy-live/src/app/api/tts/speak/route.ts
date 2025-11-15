import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Deepgram Text-to-Speech proxy endpoint
 * Converts text to natural-sounding speech using Deepgram Aura-2 model
 */
export async function POST(req: NextRequest) {
	const { text, voice, speed: customSpeed } = await req.json();
	
	const apiKey = process.env.DEEPGRAM_API_KEY;
	
	if (!apiKey) {
		console.warn("[TTS] ⚠️ No DEEPGRAM_API_KEY - falling back to browser TTS");
		return Response.json({ 
			error: "DEEPGRAM_API_KEY not configured",
			fallback: true 
		}, { status: 503 });
	}
	
	if (!text || typeof text !== "string") {
		console.error("[TTS] ❌ No text provided");
		return Response.json({ error: "No text provided" }, { status: 400 });
	}
	
	console.log("[TTS] 🔊 Generating speech:", text.substring(0, 50) + "...");
	
	// Choose voice: aura-asteria-en (warm, clear, friendly)
	// Other options: aura-luna-en, aura-stella-en, aura-athena-en, aura-hera-en, aura-orion-en
	const selectedVoice = voice || "aura-asteria-en";
	
	try {
		// Speed range: 0.5 (slower) to 2.0 (faster). Default: 1.0
		// Recommended for natural tutoring: 1.1 - 1.3
		// Use custom speed from request, or default to 1.2
		const speed = customSpeed ?? 1.2; // Adjust this default value to change speaking speed
		
		const response = await fetch(
			`https://api.deepgram.com/v1/speak?model=${selectedVoice}&encoding=linear16&sample_rate=24000&speed=${speed}`,
			{
				method: "POST",
				headers: {
					"Authorization": `Token ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ text }),
			}
		);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error("[TTS] ❌ Deepgram API error:", response.status, errorText);
			return Response.json({ 
				error: "TTS generation failed",
				details: errorText,
				fallback: true 
			}, { status: response.status });
		}
		
		const audioBuffer = await response.arrayBuffer();
		console.log("[TTS] ✅ Audio generated, size:", Math.round(audioBuffer.byteLength / 1024), "KB");
		
		// Return audio as WAV with proper headers
		return new Response(audioBuffer, {
			headers: {
				"Content-Type": "audio/wav",
				"Content-Length": audioBuffer.byteLength.toString(),
			},
		});
		
	} catch (e: any) {
		console.error("[TTS] ❌ Request failed:", e?.message || e);
		return Response.json({ 
			error: "TTS request failed",
			details: e?.message || String(e),
			fallback: true 
		}, { status: 500 });
	}
}

