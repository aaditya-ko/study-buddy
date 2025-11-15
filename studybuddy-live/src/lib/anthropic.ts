import Anthropic from "@anthropic-ai/sdk";

export function getAnthropic() {
	const key = process.env.ANTHROPIC_API_KEY;
	if (!key) return null;
	return new Anthropic({ apiKey: key });
}


