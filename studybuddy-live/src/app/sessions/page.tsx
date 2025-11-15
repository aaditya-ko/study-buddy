"use client";

import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

type SessionRow = {
  id: string;
  created_at: string;
  intensity: "minimal" | "standard" | "high";
  last_emotion?: string | null;
};

export default function SessionsPage() {
  const [items, setItems] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const supa = getSupabaseClient();
      if (!supa) {
        setItems([]);
        return;
      }
      const { data } = await supa
        .from("sessions")
        .select("id,created_at,intensity,last_emotion")
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as any) ?? []);
    }
    load();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[color:var(--fg-strong)]">Past Sessions</h1>
      <div className="mt-6 grid gap-3">
        {items === null ? (
          <div className="text-[color:var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-[color:var(--fg-muted)]">No sessions yet.</div>
        ) : (
          items.map((s) => (
            <Link
              key={s.id}
              className="card flex items-center justify-between p-4 hover:ring-1 hover:ring-black/10"
              href={`/session/${s.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="chip capitalize">{s.intensity}</div>
                <div className="text-sm text-[color:var(--fg)]">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-[color:var(--fg-muted)]">Last emotion: {s.last_emotion ?? "—"}</div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}


