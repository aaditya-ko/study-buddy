"use client";

import { useState } from "react";

type Intensity = "minimal" | "standard" | "high";

export function IntensitySlider(props: {
  value?: Intensity;
  onChange?: (value: Intensity) => void;
}) {
  const [val, setVal] = useState<Intensity>(props.value ?? "standard");

  function set(value: Intensity) {
    setVal(value);
    props.onChange?.(value);
  }

  const options: { key: Intensity; label: string; desc: string }[] = [
    { key: "minimal", label: "Minimal", desc: "Fewer nudges" },
    { key: "standard", label: "Standard", desc: "Balanced" },
    { key: "high", label: "High", desc: "More proactive" },
  ];

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-[color:var(--fg-muted)]">Check‑in intensity</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = val === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => set(opt.key)}
              className={`card px-3 py-3 text-left transition-colors ${
                active ? "ring-2 ring-[color:var(--accent)]" : "hover:ring-1 hover:ring-black/10"
              }`}
              aria-pressed={active}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-[color:var(--fg-muted)]">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { Intensity };


