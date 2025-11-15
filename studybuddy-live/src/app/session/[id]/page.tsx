"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
);
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { pdfjs } from "react-pdf";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { getSupabaseClient } from "@/lib/supabase";
import confetti from "canvas-confetti";

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
  const [hasLoggedSummary, setHasLoggedSummary] = useState(false);

  useEffect(() => {
    const url = sessionStorage.getItem(`pdf:${sessionId}`);
    setPdfUrl(url);
  }, [sessionId]);

  function onDocumentLoad({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  // Analyze multiple pages (up to 3) with Claude Vision and log to console (connectivity check)
  useEffect(() => {
    if (!pdfUrl || hasLoggedSummary) return;
    const t = setTimeout(async () => {
      try {
        console.log("[StudyBuddy] Starting PDF analysis…");
        // Ensure worker set for direct pdfjs usage here as well
        try {
          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        } catch {}
        console.log("[StudyBuddy] Loading PDF document…");
        const doc = await pdfjs.getDocument(pdfUrl).promise;
        const total = doc.numPages || 1;
        const maxPages = Math.min(total, 3);
        console.log(
          `[StudyBuddy] PDF has ${total} page(s), analyzing first ${maxPages}…`
        );
        const images: string[] = [];
        for (let i = 1; i <= maxPages; i++) {
          console.log(`[StudyBuddy] Rendering page ${i}/${maxPages}…`);
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.warn(
              `[StudyBuddy] Failed to get canvas context for page ${i}`
            );
            continue;
          }
          await (page as any).render({ canvasContext: ctx as any, viewport })
            .promise;
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          console.log(
            `[StudyBuddy] Page ${i} rendered, size: ${Math.round(
              dataUrl.length / 1024
            )}KB`
          );
          images.push(dataUrl);
        }
        if (images.length > 0) {
          console.log(
            `[StudyBuddy] Sending ${images.length} page(s) to /api/pdf/analyze…`
          );
          const resp = await fetch("/api/pdf/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagesBase64: images }),
          });
          console.log(
            "[StudyBuddy] API response status:",
            resp.status,
            resp.statusText
          );
          const data = await resp.json();
          console.log("[StudyBuddy] API response data:", data);
          if (data?.summary) {
            console.log("[StudyBuddy] ✅ Course context:", data.summary);
            try {
              sessionStorage.setItem(
                `courseSummary:${sessionId}`,
                data.summary
              );
            } catch {}
            setHasLoggedSummary(true);
          } else {
            console.warn("[StudyBuddy] ⚠️ No summary in response");
          }
        } else {
          console.warn("[StudyBuddy] ⚠️ No images rendered from PDF");
        }
      } catch (e) {
        console.error("[StudyBuddy] ❌ PDF analysis failed:", e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [pdfUrl, sessionId, hasLoggedSummary]);

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
    const w = Math.abs(e.clientX - rect.left - startPoint.current.x);
    const h = Math.abs(e.clientY - rect.top - startPoint.current.y);
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
        <div className="text-[color:var(--fg-muted)]">
          No PDF found for this session.
        </div>
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
              <button
                className="btn btn-accent"
                onClick={confirmCurrentProblem}
              >
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
            <PdfViewer
              file={pdfUrl}
              pageNumber={pageNumber}
              width={760}
              onLoadSuccess={onDocumentLoad}
            />
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
  const [countdown, setCountdown] = useState<number | null>(null);

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
    const base = intensity === "minimal" ? 15 : intensity === "high" ? 6 : 10; // seconds

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
    if (!videoRef.current) {
      console.warn("[Camera] Video not ready");
      return;
    }

    console.log(`[Camera] Capturing ${kind} image…`);

    const canvas = document.createElement("canvas");
    const target =
      kind === "ambient" ? { w: 512, h: 384 } : { w: 1024, h: 768 };
    canvas.width = target.w;
    canvas.height = target.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[Camera] Failed to get canvas context");
      return;
    }

    // Draw current video frame to canvas
    ctx.drawImage(videoRef.current, 0, 0, target.w, target.h);
    const b64 = canvas.toDataURL("image/webp", 0.85);

    console.log(
      `[Camera] Image captured, size: ${Math.round(b64.length / 1024)}KB`
    );

    const focus = sessionStorage.getItem(`focus:${sessionId}`);

    const route =
      kind === "ambient" ? "/api/vision/ambient" : "/api/vision/showwork";
    const payload =
      kind === "ambient"
        ? { imageBase64: b64 }
        : { imageBase64: b64, focusCropUrl: focus ?? undefined, lastTurns: [] };

    console.log(`[Camera] Sending to ${route}…`);

    const resp = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log(`[Camera] Response status: ${resp.status}`);

    let data: any = {};
    try {
      data = await resp.json();
      console.log(`[Camera] Response data:`, data);
    } catch (err) {
      console.error("[Camera] Failed to parse response:", err);
      return;
    }

    if (kind === "ambient") {
      const emotion = data.emotion || "neutral";
      const reasoning = data.reasoning || "No reasoning provided";

      console.log(`[Camera] 🎭 EMOTION: ${emotion.toUpperCase()}`);
      console.log(`[Camera] 💭 REASONING: ${reasoning}`);

      setLastResult(`${emotion} — ${reasoning}`);

      try {
        sessionStorage.setItem(`emotion:${sessionId}`, emotion);
      } catch {}

      if (emotion === "breakthrough") {
        console.log("[Camera] 🎉 Breakthrough detected! Triggering confetti…");
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      // Show Work analysis
      console.log("[Camera] 📝 Show Work Analysis:", data);
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

  function startShowWorkCountdown() {
    if (!ready) return;
    let n = 3;
    setCountdown(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setCountdown(null);
        captureAndAnalyze("showwork");
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-[color:var(--fg-muted)]">Live camera</div>
        <div className="chip text-xs">
          {ambientOn ? "Auto: ON" : "Auto: OFF"}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg bg-black/5">
        <video
          ref={videoRef}
          className="h-56 w-full object-cover"
          muted
          playsInline
        />
        {countdown !== null ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-black/60 text-4xl font-semibold text-white">
              {countdown}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="btn btn-accent text-sm"
          onClick={() => {
            console.log("[Camera] 🔍 Manual emotion check triggered");
            captureAndAnalyze("ambient");
          }}
          disabled={!ready}
          title="Analyze emotion now"
        >
          Analyze Emotion
        </button>
        <button
          className="btn btn-accent text-sm"
          onClick={startShowWorkCountdown}
          disabled={!ready}
          title="Show your work for feedback"
        >
          Show Work
        </button>
        <button
          className="chip text-sm col-span-2"
          onClick={() => setAmbientOn((v) => !v)}
          aria-pressed={ambientOn}
          title="Toggle automatic emotion checks"
        >
          {ambientOn ? "⏸ Pause Auto-Check" : "▶ Resume Auto-Check"}
        </button>
      </div>
      {lastResult ? (
        <div className="mt-3 rounded-lg bg-[color:var(--bg-muted)] px-3 py-2 text-sm">
          <div className="font-medium text-[color:var(--fg-strong)]">
            Last Analysis:
          </div>
          <div className="mt-1 text-[color:var(--fg-muted)]">{lastResult}</div>
        </div>
      ) : null}
    </div>
  );
}

function VoiceConsole({ sessionId }: { sessionId: string }) {
  const [isListening, setIsListening] = useState(false);
  const [emotion, setEmotion] = useState<string>("neutral");
  const [log, setLog] = useState<Array<{ role: "user" | "ai"; text: string }>>(
    []
  );
  // Conversation history for API (separate from display log)
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      focusCropUrl?: string;
    }>
  >([]);
  const recogRef = useRef<any>(null);
  const activityAtRef = useRef<number>(Date.now());
  const hasGreetedRef = useRef(false);

  // Initial AI greeting when PDF analysis completes
  useEffect(() => {
    if (hasGreetedRef.current) return;

    const checkForSummary = setInterval(async () => {
      const summary = sessionStorage.getItem(`courseSummary:${sessionId}`);
      if (
        summary &&
        summary.startsWith("[STUB") === false &&
        summary.startsWith("[ERROR") === false
      ) {
        hasGreetedRef.current = true;
        clearInterval(checkForSummary);

        console.log("[Voice] Generating initial AI greeting…");

        try {
          const resp = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: `I just uploaded this document: "${summary}". Greet me warmly in 2 sentences and ask what I'd like to focus on or if I have any questions to start.`,
                },
              ],
              emotion: "neutral",
              courseContext: summary,
            }),
          });

          const data = await resp.json();
          const greeting = data.response as string;

          console.log("[Voice] ✅ Initial greeting:", greeting);

          // Add to conversation history
          setConversationHistory([
            { role: "user", content: "Starting session" },
            { role: "assistant", content: greeting },
          ]);

          // Add to display log
          setLog([{ role: "ai", text: greeting }]);

          // Speak it
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(greeting);
            u.rate = 0.95;
            u.pitch = 1.1;
            u.volume = 1;
            window.speechSynthesis.speak(u);
          } catch {}

          // Persist to Supabase
          try {
            const supa = getSupabaseClient();
            if (supa) {
              await supa.from("messages").insert([
                {
                  session_id: sessionId,
                  role: "ai",
                  text: greeting,
                  emotion_at_time: "neutral",
                },
              ]);
            }
          } catch {}
        } catch (e) {
          console.error("[Voice] Failed to generate greeting:", e);
        }
      }
    }, 500);

    return () => clearInterval(checkForSummary);
  }, [sessionId]);

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
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
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
        console.log("[Voice] User said:", transcript);

        setLog((l) => [...l, { role: "user", text: transcript }]);
        activityAtRef.current = Date.now();

        const focus = sessionStorage.getItem(`focus:${sessionId}`);
        const courseContext =
          sessionStorage.getItem(`courseSummary:${sessionId}`) || "N/A";

        // Build new conversation history with this user message
        const newUserMessage = {
          role: "user" as const,
          content: transcript,
          focusCropUrl: focus || undefined,
        };

        const updatedHistory = [...conversationHistory, newUserMessage];

        console.log(
          "[Voice] Sending conversation with",
          updatedHistory.length,
          "messages"
        );

        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedHistory,
            emotion,
            courseContext,
          }),
        });

        const data = await resp.json();
        const reply = data.response as string;

        console.log("[Voice] AI replied:", reply);

        // Update conversation history with AI response
        const newAssistantMessage = {
          role: "assistant" as const,
          content: reply,
        };

        setConversationHistory([...updatedHistory, newAssistantMessage]);
        setLog((l) => [...l, { role: "ai", text: reply }]);

        // Persist (best-effort)
        try {
          const supa = getSupabaseClient();
          if (supa) {
            await supa.from("messages").insert([
              {
                session_id: sessionId,
                role: "user",
                text: transcript,
                emotion_at_time: emotion,
              },
              {
                session_id: sessionId,
                role: "ai",
                text: reply,
                emotion_at_time: emotion,
              },
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
  }, [emotion, sessionId, conversationHistory]);

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
              m.role === "user"
                ? "bg-[color:var(--bg-muted)]"
                : "bg-[color:var(--accent-ink)]"
            }`}
          >
            <span className="font-medium">
              {m.role === "user" ? "You" : "AI"}:{" "}
            </span>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
