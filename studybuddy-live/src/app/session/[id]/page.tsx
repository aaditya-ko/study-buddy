"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ArrowLeftIcon, ArrowRightIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { getSupabaseClient } from "@/lib/supabase";
import confetti from "canvas-confetti";

// Use CDN worker to avoid bundling issues in demo builds
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type FocusRect = { x: number; y: number; w: number; h: number } | null;

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [focus, setFocus] = useState<FocusRect>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = sessionStorage.getItem(`pdf:${sessionId}`);
    setPdfUrl(url);
  }, [sessionId]);

  function onDocumentLoad({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  // Selection overlay handlers
  function onMouseDown(e: React.MouseEvent) {
    if (!isSelecting || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    startPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setFocus({ x: startPoint.current.x, y: startPoint.current.y, w: 0, h: 0 });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isSelecting || !pageRef.current || !startPoint.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = Math.min(startPoint.current.x, e.clientX - rect.left);
    const y = Math.min(startPoint.current.y, e.clientY - rect.top);
    const w = Math.abs((e.clientX - rect.left) - startPoint.current.x);
    const h = Math.abs((e.clientY - rect.top) - startPoint.current.y);
    setFocus({ x, y, w, h });
  }
  function onMouseUp() {
    startPoint.current = null;
    setIsSelecting(false);
  }

  async function confirmCurrentProblem() {
    if (!pageRef.current || !focus) return;
    const canvas = pageRef.current.querySelector("canvas");
    if (!canvas) return;
    const pageBounds = pageRef.current.getBoundingClientRect();
    const scaleX = canvas.width / pageBounds.width;
    const scaleY = canvas.height / pageBounds.height;

    const sx = Math.round(focus.x * scaleX);
    const sy = Math.round(focus.y * scaleY);
    const sw = Math.round(focus.w * scaleX);
    const sh = Math.round(focus.h * scaleY);

    const out = document.createElement("canvas");
    out.width = Math.max(1, sw);
    out.height = Math.max(1, sh);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = out.toDataURL("image/webp", 0.9);
    try {
      sessionStorage.setItem(`focus:${sessionId}`, dataUrl);
    } catch {}
  }

  const selectionOverlay = useMemo(() => {
    if (!focus) return null;
    return (
      <div
        className="pointer-events-none absolute border-2 border-dashed border-[color:var(--accent)]"
        style={{ left: focus.x, top: focus.y, width: focus.w, height: focus.h }}
      />
    );
  }, [focus]);

  if (!pdfUrl) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-5xl items-center justify-center px-6">
        <div className="text-[color:var(--fg-muted)]">No PDF found for this session.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl grid-cols-12 gap-6 px-6 py-8">
      {/* Left: PDF + tools */}
      <section className="col-span-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="chip"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              <ArrowLeftIcon className="mr-1 inline-block h-4 w-4" />
              Prev
            </button>
            <div className="text-sm text-[color:var(--fg-muted)]">
              Page {pageNumber} / {numPages}
            </div>
            <button
              className="chip"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            >
              Next
              <ArrowRightIcon className="ml-1 inline-block h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="chip"
              onClick={() => {
                setIsSelecting(true);
                setFocus(null);
              }}
              title="Highlight current problem"
            >
              <PencilSquareIcon className="mr-1 inline-block h-4 w-4" />
              Highlight
            </button>
            {focus ? (
              <button className="btn btn-accent" onClick={confirmCurrentProblem}>
                Set current problem
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl border border-black/5 bg-white"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <div ref={pageRef} className="relative">
            <Document file={pdfUrl} onLoadSuccess={onDocumentLoad}>
              <Page pageNumber={pageNumber} width={760} renderTextLayer renderAnnotationLayer />
            </Document>
            {selectionOverlay}
          </div>
        </div>
      </section>

      {/* Right: Camera + chat log stub */}
      <section className="col-span-4">
        <CameraPane sessionId={sessionId} />
        <div className="h-4" />
        <VoiceConsole sessionId={sessionId} />
      </section>
    </main>
  );
}

function CameraPane({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");
  const [ambientOn, setAmbientOn] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
    init();
  }, []);

  // Ambient watcher
  useEffect(() => {
    if (!ambientOn) return;
    let timer: any;
    let stopped = false;
    const intensity = (sessionStorage.getItem(`intensity:${sessionId}`) ??
      "standard") as "minimal" | "standard" | "high";
    const base =
      intensity === "minimal" ? 15 : intensity === "high" ? 6 : 10; // seconds

    const schedule = () => {
      if (stopped) return;
      const jitter = base * (0.85 + Math.random() * 0.3);
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await captureAndAnalyze("ambient");
        }
        schedule();
      }, jitter * 1000);
    };
    schedule();
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ambientOn, sessionId]);

  async function captureAndAnalyze(kind: "showwork" | "ambient") {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    const target =
      kind === "ambient" ? { w: 512, h: 384 } : { w: 1024, h: 768 };
    canvas.width = target.w;
    canvas.height = target.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, target.w, target.h);
    const b64 = canvas.toDataURL("image/webp", 0.85);
    const focus = sessionStorage.getItem(`focus:${sessionId}`);

    const route =
      kind === "ambient" ? "/api/vision/ambient" : "/api/vision/showwork";
    const payload =
      kind === "ambient"
        ? { imageBase64: b64 }
        : { imageBase64: b64, focusCropUrl: focus ?? undefined, lastTurns: [] };
    const resp = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (kind === "ambient") {
      setLastResult(`Emotion: ${data.emotion}`);
      try {
        sessionStorage.setItem(`emotion:${sessionId}`, data.emotion);
      } catch {}
      if (data.emotion === "breakthrough") {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      setLastResult(
        [data.praise, ...(data.observations || []), ...(data.questions || [])]
          .filter(Boolean)
          .join(" • ")
      );
      try {
        sessionStorage.setItem(`activity:${sessionId}`, String(Date.now()));
      } catch {}
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 text-sm text-[color:var(--fg-muted)]">Live camera</div>
      <div className="overflow-hidden rounded-lg bg-black/5">
        <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="chip" onClick={() => captureAndAnalyze("ambient")} disabled={!ready}>
          Ambient check
        </button>
        <button className="btn btn-accent" onClick={() => captureAndAnalyze("showwork")} disabled={!ready}>
          Show Work
        </button>
        <button
          className="chip"
          onClick={() => setAmbientOn((v) => !v)}
          aria-pressed={ambientOn}
          title="Toggle ambient checks"
        >
          {ambientOn ? "Pause ambient" : "Resume ambient"}
        </button>
      </div>
      {lastResult ? (
        <div className="mt-3 text-sm text-[color:var(--fg-muted)]">{lastResult}</div>
      ) : null}
    </div>
  );
}

function VoiceConsole({ sessionId }: { sessionId: string }) {
  const [isListening, setIsListening] = useState(false);
  const [emotion, setEmotion] = useState<string>("neutral");
  const [log, setLog] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const recogRef = useRef<any>(null);
  const activityAtRef = useRef<number>(Date.now());

  useEffect(() => {
    // Simple bridge: reuse latest ambient result shown in CameraPane through sessionStorage
    const id = setInterval(() => {
      const e = sessionStorage.getItem(`emotion:${sessionId}`);
      if (e) setEmotion(e);
      const a = Number(sessionStorage.getItem(`activity:${sessionId}`) || "0");
      if (a && a > activityAtRef.current) {
        activityAtRef.current = a;
      }
    }, 2000);
    return () => clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = async (event: any) => {
      const idx = event.resultIndex;
      const isFinal = event.results[idx].isFinal;
      const transcript = event.results[idx][0].transcript;
      if (isFinal) {
        setLog((l) => [...l, { role: "user", text: transcript }]);
        activityAtRef.current = Date.now();
        const focus = sessionStorage.getItem(`focus:${sessionId}`);
        const courseContext = "Course PDF context available"; // placeholder until summary
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, emotion, courseContext, focusCropUrl: focus }),
        });
        const data = await resp.json();
        const reply = data.response as string;
        setLog((l) => [...l, { role: "ai", text: reply }]);
        // Persist (best-effort)
        try {
          const supa = getSupabaseClient();
          if (supa) {
            await supa.from("messages").insert([
              { session_id: sessionId, role: "user", text: transcript, emotion_at_time: emotion },
              { session_id: sessionId, role: "ai", text: reply, emotion_at_time: emotion },
            ]);
          }
        } catch {}
        // TTS
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(reply);
          u.rate = 0.95;
          u.pitch = 1.1;
          u.volume = 1;
          window.speechSynthesis.speak(u);
        } catch {}
      }
    };
    recogRef.current = rec;
  }, [emotion, sessionId]);

  // Proactive check-ins on silence
  useEffect(() => {
    const intensity = (sessionStorage.getItem(`intensity:${sessionId}`) ??
      "standard") as "minimal" | "standard" | "high";
    const minutes = intensity === "minimal" ? 4 : intensity === "high" ? 2 : 3;
    let timer: any;
    const schedule = () => {
      clearTimeout(timer);
      const ms = minutes * 60 * 1000;
      const jitter = 0.85 + Math.random() * 0.3;
      timer = setTimeout(() => {
        const since = Date.now() - activityAtRef.current;
        if (since >= ms * 0.9) {
          const line =
            emotion === "frustrated"
              ? "Hey, this can get tough. Want to talk through what you're trying?"
              : "What are you thinking right now?";
          setLog((l) => [...l, { role: "ai", text: line }]);
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(line);
            u.rate = 0.95;
            u.pitch = 1.1;
            u.volume = 1;
            window.speechSynthesis.speak(u);
          } catch {}
        }
        schedule();
      }, ms * jitter);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [emotion, sessionId]);

  function toggle() {
    const rec = recogRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      rec.start();
      setIsListening(true);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-[color:var(--fg-muted)]">Voice</div>
        <div className="chip">Emotion: {emotion}</div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-accent" onClick={toggle}>
          {isListening ? "Stop listening" : "Start listening"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {log.slice(-6).map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "bg-[color:var(--bg-muted)]" : "bg-[color:var(--accent-ink)]"
            }`}
          >
            <span className="font-medium">{m.role === "user" ? "You" : "AI"}: </span>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}


