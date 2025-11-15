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
			className={`card w-full max-w-xl mx-auto p-10 text-center select-none transition-colors ${
				dragOver ? "ring-2 ring-[color:var(--accent)]" : ""
			}`}
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
				className="group mx-auto mb-6 grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-black/20 bg-[color:var(--bg-muted)] transition-colors hover:border-[color:var(--accent)]"
			>
				<PlusIcon className="h-10 w-10 text-black/60 group-hover:text-[color:var(--accent)]" />
			</button>
			<div className="text-lg font-medium text-[color:var(--fg-strong)]">
				Upload a PDF to get started
			</div>
			<div className="mt-2 text-sm text-[color:var(--fg-muted)]">
				Drag & drop or click the plus
			</div>
			<div className="mt-6">
				<button onClick={onPick} className="btn btn-accent">Choose PDF</button>
			</div>
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


