"use client";

import { useEffect, useMemo, useState } from "react";

type Intensity = "minimal" | "standard" | "high";

export function IntensitySlider(props: {
  value?: Intensity;
  onChange?: (value: Intensity) => void;
}) {
  const [val, setVal] = useState<Intensity>(props.value ?? "standard");
  useEffect(() => {
    if (props.value && props.value !== val) setVal(props.value);
  }, [props.value]);

  function set(value: Intensity) {
    setVal(value);
    props.onChange?.(value);
  }

  const options: { key: Intensity; label: string; desc: string }[] = useMemo(
    () => [
      { key: "minimal", label: "Minimal", desc: "Fewer nudges" },
      { key: "standard", label: "Standard", desc: "" },
      { key: "high", label: "High", desc: "More proactive" },
    ],
    []
  );
  const index = useMemo(() => options.findIndex((o) => o.key === val), [val, options]);

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-[color:var(--fg-muted)]">Support Slider</div>
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={index}
          onChange={(e) => {
            const i = Number(e.target.value) || 0;
            set(options[i].key);
          }}
          list="support-ticks"
          aria-label="Support level"
          aria-valuetext={val}
          className="w-full"
          style={{
            // @ts-ignore - CSS custom property for gradient
            "--range-progress": `${(index / 2) * 100}%`
          }}
        />
        <datalist id="support-ticks">
          <option value={0}></option>
          <option value={1}></option>
          <option value={2}></option>
        </datalist>
        <div className="mt-3 flex items-center justify-between text-sm">
          {options.map((o, i) => (
            <div key={o.key} className={i === index ? "font-medium text-[color:var(--fg-strong)]" : "text-[color:var(--fg-muted)]"}>
              {o.label}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--fg-muted)]">
          {options.map((o) => (
            <div key={o.key}>{o.desc}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { Intensity };


