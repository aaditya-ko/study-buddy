"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/24/outline";
import type { Intensity } from "./IntensitySlider";
import { getSupabaseClient } from "@/lib/supabase";

export function UploadCard({ intensity }: { intensity: Intensity }) {
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const [dragOver, setDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function onPick() {
		inputRef.current?.click();
	}

	function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		const file = files[0];
		if (file.type !== "application/pdf") {
			setError("Please upload a PDF file.");
			return;
		}
		const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
		const url = URL.createObjectURL(file);

		// Persist lightweight session bootstrap in sessionStorage for the demo.
		try {
			sessionStorage.setItem(`pdf:${id}`, url);
			sessionStorage.setItem(`intensity:${id}`, intensity);
		} catch {
			// no-op
		}

		// Best-effort: create a session row if supabase configured
		try {
			const supa = getSupabaseClient();
			if (supa) {
				supa.from("sessions").insert([{ id, intensity }]).then(() => {});
			}
		} catch {}
		router.push(`/session/${id}`);
	}

	return (
		<div
			className={`w-full max-w-xl mx-auto text-center select-none`}
			onDragOver={(e) => {
				e.preventDefault();
				setDragOver(true);
			}}
			onDragLeave={() => setDragOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setDragOver(false);
				handleFiles(e.dataTransfer.files);
			}}
		>
			<button
				type="button"
				onClick={onPick}
				className={`group mx-auto grid h-40 w-40 place-items-center rounded-full border-2 border-dashed bg-[color:var(--bg-muted)] transition-colors ${
					dragOver ? "border-[color:var(--accent)]" : "border-black/20 hover:border-[color:var(--accent)]"
				}`}
				aria-label="Upload PDF"
			>
				<PlusIcon className="h-12 w-12 text-black/60 group-hover:text-[color:var(--accent)]" />
			</button>
			<div className="mt-4 text-lg font-medium text-[color:var(--fg-strong)]">Upload PDF</div>
			{error ? (
				<div className="mt-4 text-sm text-[color:var(--warning)]">{error}</div>
			) : null}
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				onChange={(e) => handleFiles(e.target.files)}
			/>
		</div>
	);
}


