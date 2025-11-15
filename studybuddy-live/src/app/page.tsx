"use client";
import { useState } from "react";
import { IntensitySlider, type Intensity } from "@/components/IntensitySlider";
import { UploadCard } from "@/components/UploadCard";

export default function Home() {
  const [intensity, setIntensity] = useState<Intensity>("standard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-[color:var(--fg-strong)]">StudyBuddy Live</h1>
        <p className="mt-2 text-[color:var(--fg-muted)]">Paper‑first study sessions with a warm, proactive tutor.</p>
      </div>
      <UploadCard intensity={intensity} />
      <div className="w-full max-w-xl">
        <IntensitySlider value={intensity} onChange={setIntensity} />
      </div>
      <div className="mt-6 text-xs text-[color:var(--fg-muted)]">
        Tip: You can adjust intensity later in the session settings.
      </div>
      <a href="/sessions" className="mt-2 text-sm underline decoration-[color:var(--accent)] underline-offset-4">
        Past sessions
      </a>
    </main>
  );
}
