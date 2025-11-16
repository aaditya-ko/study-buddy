"use client";
import { useState } from "react";
import { IntensitySlider, type Intensity } from "@/components/IntensitySlider";
import { UploadCard } from "@/components/UploadCard";

export default function Home() {
  const [intensity, setIntensity] = useState<Intensity>("standard");
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16 overflow-hidden">
      {/* Decorative scattered screenshots in background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {/* Screenshot 1 - Top Left */}
        <img
          src="/images/Screenshot1.png"
          alt=""
          className="absolute rounded-2xl shadow-lg"
          style={{
            top: "8%",
            left: "5%",
            width: "180px",
            transform: "rotate(-12deg)",
          }}
        />
        {/* Screenshot 2 - Top Right */}
        <img
          src="/images/Screenshot2.png"
          alt=""
          className="absolute rounded-2xl shadow-lg"
          style={{
            top: "12%",
            right: "8%",
            width: "160px",
            transform: "rotate(8deg)",
          }}
        />
        {/* Screenshot 3 - Bottom Left */}
        <img
          src="/images/Screenshot3.png"
          alt=""
          className="absolute rounded-2xl shadow-lg"
          style={{
            bottom: "15%",
            left: "3%",
            width: "170px",
            transform: "rotate(15deg)",
          }}
        />
        {/* Screenshot 4 - Bottom Right */}
        <img
          src="/images/Screenshot4.png"
          alt=""
          className="absolute rounded-2xl shadow-lg"
          style={{
            bottom: "10%",
            right: "6%",
            width: "190px",
            transform: "rotate(-8deg)",
          }}
        />
      </div>

      {/* Main content - above decorative images */}
      <div className="relative z-10 text-center">
        <h1 className="text-3xl font-semibold text-[color:var(--fg-strong)]">
          Study Buddy
        </h1>
        <p className="mt-2 text-[color:var(--fg-muted)]">
          Like a FaceTime call with your smart friend
        </p>
      </div>
      <div className="relative z-10">
        <UploadCard intensity={intensity} />
      </div>
      <div className="relative z-10 w-full max-w-xl">
        <IntensitySlider
          value={intensity}
          onChange={(v) => {
            setIntensity(v);
            // Persist lightweight preference and surface for debugging
            try {
              localStorage.setItem("supportLevel", v);
            } catch {}
            console.log("Support level:", v);
          }}
        />
      </div>
      <div className="relative z-10 mt-6 text-xs text-[color:var(--fg-muted)]">
        Tip: You can adjust intensity later in the session settings.
      </div>
      <a
        href="/sessions"
        className="relative z-10 mt-2 text-sm underline decoration-[color:var(--accent)] underline-offset-4"
      >
        Past sessions
      </a>
    </main>
  );
}
