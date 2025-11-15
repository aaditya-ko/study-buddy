import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anon) return null;
	return createClient(url, anon);
}

export type SessionRow = {
	id: string;
	intensity: "minimal" | "standard" | "high";
	courseSummary?: string | null;
	currentProblemCropUrl?: string | null;
	lastEmotion?: string | null;
	status?: "active" | "ended";
	created_at?: string;
};

export type MessageRow = {
	id: string;
	session_id: string;
	role: "user" | "ai";
	text: string;
	emotion_at_time?: string | null;
	created_at?: string;
};


