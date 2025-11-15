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
  MicrophoneIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { getSupabaseClient } from "@/lib/supabase";
import confetti from "canvas-confetti";

type FocusRect = { x: number; y: number; w: number; h: number } | null;
type ResizeHandle = "nw" | "ne" | "sw" | "se" | null;

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [focus, setFocus] = useState<FocusRect>(null);
  // "isSelecting" means the highlight tool is active (armed).
  const [isSelecting, setIsSelecting] = useState(false);
  // "isDragging" means the user is actively drawing/resizing a selection.
  const [isDragging, setIsDragging] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasLoggedSummary, setHasLoggedSummary] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [focusPage, setFocusPage] = useState<number | null>(null);
  const [savingFocus, setSavingFocus] = useState<boolean>(false);
  const [focusPreviewUrl, setFocusPreviewUrl] = useState<string | null>(null);
  const [focusSavedBadge, setFocusSavedBadge] = useState<boolean>(false);

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
    // If a handle is active, ignore generic mousedown (handle handlers manage it)
    const rect = pageRef.current.getBoundingClientRect();
    startPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setFocus({ x: startPoint.current.x, y: startPoint.current.y, w: 0, h: 0 });
    setIsDragging(true);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    // Handle resizing via handles
    if (activeHandle && focus) {
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      let { x, y, w, h } = focus;
      const minSize = 8;
      if (activeHandle === "nw") {
        const x2 = x + w;
        const y2 = y + h;
        x = Math.min(curX, x2 - minSize);
        y = Math.min(curY, y2 - minSize);
        w = x2 - x;
        h = y2 - y;
      } else if (activeHandle === "ne") {
        const y2 = y + h;
        const nx = Math.max(curX, x + minSize);
        w = nx - x;
        y = Math.min(curY, y2 - minSize);
        h = y2 - y;
      } else if (activeHandle === "sw") {
        const x2 = x + w;
        const ny = Math.max(curY, y + minSize);
        h = ny - y;
        x = Math.min(curX, x2 - minSize);
        w = x2 - x;
      } else if (activeHandle === "se") {
        const nx = Math.max(curX, x + minSize);
        const ny = Math.max(curY, y + minSize);
        w = nx - x;
        h = ny - y;
      }
      setFocus({ x, y, w, h });
      return;
    }
    if (!isSelecting || !isDragging || !startPoint.current) return;
    const x = Math.min(startPoint.current.x, e.clientX - rect.left);
    const y = Math.min(startPoint.current.y, e.clientY - rect.top);
    const w = Math.abs(e.clientX - rect.left - startPoint.current.x);
    const h = Math.abs(e.clientY - rect.top - startPoint.current.y);
    setFocus({ x, y, w, h });
  }
  function onMouseUp() {
    startPoint.current = null;
    // Keep tool armed, but stop dragging
    const wasResizing = Boolean(activeHandle);
    setIsDragging(false);
    setActiveHandle(null);
    // Automatically confirm and persist once the user finishes drawing/resizing
    if (focus && focus.w > 2 && focus.h > 2) {
      confirmCurrentProblem();
    }
  }

  // Cancel selection
  function cancelSelection() {
    setIsSelecting(false);
    setFocus(null);
    setActiveHandle(null);
    setFocusPreviewUrl(null);
    setFocusPage(null);
  }

  // Remove highlight: clear selection and stored focus (local + supabase best-effort)
  async function removeHighlight() {
    cancelSelection();
    try {
      sessionStorage.removeItem(`focus:${sessionId}`);
    } catch {}
    try {
      const supa = getSupabaseClient();
      if (supa) {
        await supa
          .from("sessions")
          .update({ current_problem_crop_url: null })
          .eq("id", sessionId);
      }
    } catch {}
  }

  // High-DPI crop + Supabase persistence
  async function confirmCurrentProblem() {
    if (!pageRef.current || !focus || !pdfUrl) return;
    if (focus.w < 3 || focus.h < 3) return;
    const canvas = pageRef.current.querySelector("canvas");
    if (!canvas) return;
    const pageBounds = pageRef.current.getBoundingClientRect();
    const scaleX = canvas.width / pageBounds.width;
    const scaleY = canvas.height / pageBounds.height;

    // Initial quick preview (from displayed canvas)
    const sx = Math.max(0, Math.round(focus.x * scaleX));
    const sy = Math.max(0, Math.round(focus.y * scaleY));
    const sw = Math.max(1, Math.round(focus.w * scaleX));
    const sh = Math.max(1, Math.round(focus.h * scaleY));
    const quick = document.createElement("canvas");
    quick.width = sw;
    quick.height = sh;
    const qctx = quick.getContext("2d");
    if (!qctx) return;
    qctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const quickUrl = quick.toDataURL("image/webp", 0.85);
    setFocusPreviewUrl(quickUrl);

    setSavingFocus(true);
    try {
      // Normalize coordinates relative to displayed canvas
      const nx = sx / canvas.width;
      const ny = sy / canvas.height;
      const nw = sw / canvas.width;
      const nh = sh / canvas.height;

      // High-DPI re-render of the page with pdfjs
      // Ensure worker set here as well (safety)
      try {
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      } catch {}
      const doc = await pdfjs.getDocument(pdfUrl).promise;
      const page = await doc.getPage(pageNumber);
      const viewport1 = page.getViewport({ scale: 1 });
      const desiredWidth = Math.min(canvas.width * 3, 4000); // cap for safety
      const hiScale = desiredWidth / viewport1.width;
      const hiViewport = page.getViewport({ scale: hiScale });
      const hiCanvas = document.createElement("canvas");
      hiCanvas.width = Math.ceil(hiViewport.width);
      hiCanvas.height = Math.ceil(hiViewport.height);
      const hiCtx = hiCanvas.getContext("2d");
      if (!hiCtx) throw new Error("No canvas context for high-DPI render");
      await (page as any).render({
        canvasContext: hiCtx as any,
        viewport: hiViewport,
      }).promise;

      // Crop using normalized rectangle
      const hsx = Math.max(0, Math.round(nx * hiCanvas.width));
      const hsy = Math.max(0, Math.round(ny * hiCanvas.height));
      const hsw = Math.max(1, Math.round(nw * hiCanvas.width));
      const hsh = Math.max(1, Math.round(nh * hiCanvas.height));
      const out = document.createElement("canvas");
      out.width = hsw;
      out.height = hsh;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("No output canvas context");
      octx.drawImage(hiCanvas, hsx, hsy, hsw, hsh, 0, 0, hsw, hsh);
      const dataUrl = out.toDataURL("image/webp", 0.95);

      // Persist locally
      try {
        sessionStorage.setItem(`focus:${sessionId}`, dataUrl);
      } catch {}

      // Best-effort: persist to Supabase Storage and update sessions row
      try {
        const supa = getSupabaseClient();
        if (supa) {
          const blob = dataUrlToBlob(dataUrl);
          const ts = Date.now();
          const path = `focus/${sessionId}/page-${pageNumber}-${ts}.webp`;
          const { error: upErr } = await supa.storage
            .from("studybuddy-frames")
            .upload(path, blob, { contentType: "image/webp", upsert: true });
          if (!upErr) {
            const { data: pub } = supa.storage
              .from("studybuddy-frames")
              .getPublicUrl(path);
            const publicUrl = (pub as any)?.publicUrl as string | undefined;
            if (publicUrl) {
              try {
                sessionStorage.setItem(`focus:${sessionId}`, publicUrl);
              } catch {}
              await supa
                .from("sessions")
                .update({ current_problem_crop_url: publicUrl })
                .eq("id", sessionId);
            }
          }
        }
      } catch (err) {
        console.warn("[Focus] Failed to persist to Supabase:", err);
      }

      setFocusSavedBadge(true);
      setFocusPage(pageNumber);
      // Hide success badge after a moment
      setTimeout(() => setFocusSavedBadge(false), 2000);

      // Immediately analyze the highlighted problem with Claude
      console.log("[Focus] 🔍 Analyzing highlighted problem with Claude...");
      try {
        const courseContext =
          sessionStorage.getItem(`courseSummary:${sessionId}`) || "N/A";
        const analyzeResp = await fetch("/api/pdf/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagesBase64: [dataUrl],
            context: "highlighted_problem",
          }),
        });
        const analyzeData = await analyzeResp.json();
        console.log("[Focus] ✅ HIGHLIGHTED PROBLEM ANALYSIS:");
        console.log("[Focus] 📋 Summary:", analyzeData.summary);
        console.log(
          "[Focus] 🎯 This is the CURRENT PROBLEM the student is working on."
        );
        console.log("[Focus] Context from full PDF:", courseContext);
      } catch (analyzeErr) {
        console.warn(
          "[Focus] ⚠️ Failed to analyze highlighted problem:",
          analyzeErr
        );
      }
    } catch (err) {
      console.error("[Focus] Failed to set current problem:", err);
    } finally {
      setSavingFocus(false);
    }
  }

  // Convert data URL to Blob
  function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, base64] = dataUrl.split(",");
    const mimeMatch = meta.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/webp";
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const selectionOverlay = useMemo(() => {
    if (!focus) return null;
    return (
      <div
        className="absolute"
        style={{ left: 0, top: 0, right: 0, bottom: 0 }}
      >
        {/* Dim-out around selection using four rectangles */}
        <div
          className="absolute bg-black/10 pointer-events-none"
          style={{ left: 0, top: 0, right: 0, height: focus.y }}
        />
        <div
          className="absolute bg-black/10 pointer-events-none"
          style={{ left: 0, top: focus.y, width: focus.x, height: focus.h }}
        />
        <div
          className="absolute bg-black/10 pointer-events-none"
          style={{
            left: focus.x + focus.w,
            top: focus.y,
            right: 0,
            height: focus.h,
          }}
        />
        <div
          className="absolute bg-black/10 pointer-events-none"
          style={{
            left: 0,
            top: focus.y + focus.h,
            right: 0,
            bottom: 0,
          }}
        />
        {/* Selection box */}
        <div
          className="absolute border-2 border-dashed border-[color:var(--accent)] pointer-events-none"
          style={{
            left: focus.x,
            top: focus.y,
            width: focus.w,
            height: focus.h,
          }}
        />
        {/* Resize handles */}
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color:var(--accent)] shadow"
          style={{ left: focus.x, top: focus.y }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveHandle("nw");
          }}
        />
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color:var(--accent)] shadow"
          style={{ left: focus.x + focus.w, top: focus.y }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveHandle("ne");
          }}
        />
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color:var(--accent)] shadow"
          style={{ left: focus.x, top: focus.y + focus.h }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveHandle("sw");
          }}
        />
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color:var(--accent)] shadow"
          style={{ left: focus.x + focus.w, top: focus.y + focus.h }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveHandle("se");
          }}
        />
      </div>
    );
  }, [focus]);

  // Keyboard: Esc to cancel selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cancelSelection();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // If page changes and there is a focus selection from another page, clear it
  useEffect(() => {
    if (focus && focusPage !== null && focusPage !== pageNumber) {
      setFocus(null);
      setFocusPreviewUrl(null);
      setFocusPage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

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
                if (focus) {
                  // Toggle off (Remove Highlight)
                  removeHighlight();
                } else {
                  // Toggle on (enter highlight mode)
                  setIsSelecting(true);
                  setFocus(null);
                  setActiveHandle(null);
                  setFocusPreviewUrl(null);
                  setFocusSavedBadge(false);
                }
              }}
              title={focus ? "Remove Highlight" : "Highlight current problem"}
            >
              <PencilSquareIcon className="mr-1 inline-block h-4 w-4" />
              {focus ? "Remove Highlight" : "Highlight"}
            </button>
            {focusSavedBadge ? (
              <div className="chip text-xs text-[color:var(--success)]">
                Focus set
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-xl border border-black/5 bg-white ${
            isSelecting ? "cursor-crosshair" : ""
          }`}
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
        {focusPreviewUrl ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="text-xs text-[color:var(--fg-muted)]">Preview</div>
            <img
              src={focusPreviewUrl}
              alt="Current problem preview"
              className="h-20 w-auto rounded-md border border-black/10"
            />
          </div>
        ) : null}
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
  const [ambientOn, setAmbientOn] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const [lastEmotion, setLastEmotion] = useState<string>("neutral");

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

    // Check for highlighted problem periodically
    const checkFocus = setInterval(() => {
      const focus = sessionStorage.getItem(`focus:${sessionId}`);
      setHasFocus(!!focus);
    }, 500);

    return () => clearInterval(checkFocus);
  }, [sessionId]);

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

    if (kind === "showwork" && focus) {
      console.log(
        `[Camera] 🎯 Including highlighted problem crop in Show Work analysis`
      );
    }
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
      const compliment = (data.compliment || "").trim();

      console.log(`[Camera] 🎭 EMOTION: ${emotion.toUpperCase()}`);
      console.log(`[Camera] 💭 REASONING: ${reasoning}`);
      console.log(`[Camera] 🤝 COMPLIMENT: ${compliment}`);

      setLastEmotion(emotion);

      // Save to sessionStorage for immediate use
      try {
        sessionStorage.setItem(`emotion:${sessionId}`, emotion);
        // Store compliment for first-greeting icebreaker (always present now)
        sessionStorage.setItem(`compliment:${sessionId}`, compliment);
      } catch {}

      // Persist to Supabase
      try {
        const supa = getSupabaseClient();
        if (supa) {
          console.log("[Camera] 💾 Saving emotion to Supabase…");

          // Update session's last_emotion
          await supa
            .from("sessions")
            .update({
              last_emotion: emotion,
            })
            .eq("id", sessionId);

          // Log to emotion_checks history table
          await supa.from("emotion_checks").insert({
            session_id: sessionId,
            emotion: emotion,
            reasoning: reasoning,
            check_type: "ambient",
          });

          console.log("[Camera] ✅ Emotion saved to database");
        }
      } catch (err) {
        console.warn("[Camera] ⚠️ Failed to save emotion to Supabase:", err);
      }

      if (emotion === "breakthrough") {
        console.log("[Camera] 🎉 Breakthrough detected! Triggering confetti…");
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      // Show Work analysis
      console.log("[Camera] 📝 SHOW WORK ANALYSIS COMPLETE:");
      console.log("[Camera] 🎉 Praise:", data.praise || "—");
      if (data.observations?.length) {
        console.log("[Camera] 👀 Observations:", data.observations);
      }
      if (data.questions?.length) {
        console.log("[Camera] ❓ Guiding Questions:", data.questions);
      }

      // Log full JSON for debugging and traceability
      try {
        console.log(
          "[Camera] 📦 Full Show Work analysis JSON:",
          JSON.stringify(data)
        );
      } catch {}

      // Store analysis + image so VoiceConsole can pipe it into AI conversation
      try {
        const payload = { ts: Date.now(), analysis: data, imageBase64: b64 };
        sessionStorage.setItem(
          `showwork:${sessionId}`,
          JSON.stringify(payload)
        );
        console.log(
          "[Camera] 💾 Stored Show Work analysis + image for conversation piping"
        );
      } catch (err) {
        console.warn("[Camera] ⚠️ Failed to store Show Work analysis:", err);
      }

      try {
        sessionStorage.setItem(`activity:${sessionId}`, String(Date.now()));
      } catch {}
    }
  }

  function startShowWorkCountdown() {
    if (!ready) return;

    // Validate that a problem is highlighted
    const focus = sessionStorage.getItem(`focus:${sessionId}`);
    if (!focus) {
      console.warn(
        "[Camera] ⚠️ No problem highlighted - Show Work requires highlighting a problem first"
      );
      alert(
        "⚠️ Please highlight a problem first using the Highlight button on the left."
      );
      return;
    }

    console.log(
      "[Camera] 📝 Show Work triggered - analyzing student's written work"
    );
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
      <div className="mt-2 flex items-center justify-center">
        <div className="chip text-xs">Emotion: {lastEmotion}</div>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          className={`btn text-sm ${
            hasFocus ? "btn-accent" : "bg-[color:var(--fg-muted)] opacity-60"
          }`}
          onClick={startShowWorkCountdown}
          disabled={!ready || !hasFocus}
          title={
            hasFocus
              ? "Show your work for feedback"
              : "Highlight a problem first"
          }
        >
          Show Work {!hasFocus && "🔒"}
        </button>
        <button
          className="chip text-sm"
          onClick={() => setAmbientOn((v) => !v)}
          aria-pressed={ambientOn}
          title="Toggle automatic emotion checks"
        >
          {ambientOn ? "⏸ Pause Auto-Check" : "▶ Resume Auto-Check"}
        </button>
      </div>
    </div>
  );
}

function VoiceConsole({ sessionId }: { sessionId: string }) {
  const [isListening, setIsListening] = useState(false);
  const [emotion, setEmotion] = useState<string>("neutral");
  const [log, setLog] = useState<
    Array<{ role: "user" | "ai"; text: string; workImage?: string }>
  >([]);
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
  const lastShowWorkAtRef = useRef<number>(0);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef<boolean>(false);

  // Speech queue function to prevent overlapping TTS
  const speakText = (text: string) => {
    speechQueueRef.current.push(text);
    console.log(
      "[Voice] 📝 Added to speech queue. Queue length:",
      speechQueueRef.current.length
    );
    processQueue();
  };

  const processQueue = () => {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) {
      return;
    }

    const nextText = speechQueueRef.current.shift();
    if (!nextText) return;

    isSpeakingRef.current = true;
    console.log(
      "[Voice] 🔊 Speaking from queue:",
      nextText.substring(0, 50) + "..."
    );

    try {
      window.speechSynthesis.cancel(); // Clear any stuck utterances
      const u = new SpeechSynthesisUtterance(nextText);
      u.rate = 1.2;
      u.pitch = 1.1;
      u.volume = 1;

      u.onend = () => {
        console.log("[Voice] ✅ Finished speaking");
        isSpeakingRef.current = false;
        // Process next item in queue
        setTimeout(() => processQueue(), 100);
      };

      u.onerror = (err) => {
        console.error("[Voice] ❌ TTS error:", err);
        isSpeakingRef.current = false;
        setTimeout(() => processQueue(), 100);
      };

      window.speechSynthesis.speak(u);
    } catch (err) {
      console.error("[Voice] ❌ Failed to speak:", err);
      isSpeakingRef.current = false;
      setTimeout(() => processQueue(), 100);
    }
  };

  // Initial AI greeting when PDF analysis completes AND first compliment is captured
  useEffect(() => {
    if (hasGreetedRef.current) return;

    const checkForSummary = setInterval(async () => {
      const summary = sessionStorage.getItem(`courseSummary:${sessionId}`);
      const compliment = sessionStorage.getItem(`compliment:${sessionId}`);

      // Wait for both PDF summary AND compliment from first ambient check
      if (
        summary &&
        summary.startsWith("[STUB") === false &&
        summary.startsWith("[ERROR") === false &&
        compliment &&
        compliment.trim().length > 0
      ) {
        hasGreetedRef.current = true;
        clearInterval(checkForSummary);

        console.log("[Voice] Generating initial AI greeting with compliment…");

        try {
          const resp = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: `I just uploaded this document: "${summary}". Start with a warm greeting that includes this compliment: "${compliment}". Then ask me what I'm working on right now. Keep it to 2-3 sentences total, friendly and natural.`,
                },
              ],
              emotion:
                sessionStorage.getItem(`emotion:${sessionId}`) || "neutral",
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

          // Speak it using queue
          speakText(greeting);

          // Mark compliment as used (prevent future re-use elsewhere)
          try {
            sessionStorage.setItem(`complimentUsed:${sessionId}`, "1");
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

      // Pull in latest Show Work analysis (if any) and append as a user note/message
      try {
        const raw = sessionStorage.getItem(`showwork:${sessionId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ts = Number(parsed?.ts || 0);
          const analysis = parsed?.analysis || {};
          const imageBase64 = parsed?.imageBase64 || "";
          if (ts && ts > lastShowWorkAtRef.current) {
            lastShowWorkAtRef.current = ts;
            const praise: string = analysis.praise || "";
            const observations: string[] = Array.isArray(analysis.observations)
              ? analysis.observations
              : [];
            const questions: string[] = Array.isArray(analysis.questions)
              ? analysis.questions
              : [];
            // Format analysis for console logging
            const shortObs = observations.slice(0, 2).join("; ");
            const shortQs = questions.slice(0, 2).join(" ");
            const summary = [
              praise ? `Praise: ${praise}` : "",
              shortObs ? `Observations: ${shortObs}` : "",
              shortQs ? `Questions: ${shortQs}` : "",
            ]
              .filter(Boolean)
              .join(" | ");

            console.log(
              "[Voice] 📎 Show Work analysis received (will use as context for AI response):",
              {
                praise,
                observations: observations.slice(0, 2),
                questions: questions.slice(0, 2),
              }
            );

            // Build structured context for AI to generate a natural response
            const analysisContext = `[SHOW WORK ANALYSIS - Use this to inform your response, but speak naturally]
Praise: ${praise}
Observations: ${observations.join("; ")}
Questions to guide student: ${questions.join(" ")}

Based on this analysis, respond naturally about what you see in their work. Don't read the analysis verbatim - synthesize it into a warm, conversational response.`;

            // Add analysis as context, then immediately trigger AI response
            const historyWithAnalysis = [
              ...conversationHistory,
              {
                role: "user" as const,
                content: analysisContext,
              },
            ];

            // Get AI's natural response based on the work analysis
            (async () => {
              try {
                const focus = sessionStorage.getItem(`focus:${sessionId}`);
                const courseContext =
                  sessionStorage.getItem(`courseSummary:${sessionId}`) || "N/A";

                const resp = await fetch("/api/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    messages: historyWithAnalysis,
                    emotion: e || "neutral",
                    courseContext,
                  }),
                });

                const data = await resp.json();
                const aiResponse = data.response as string;

                console.log("[Voice] 🤖 AI response to Show Work:", aiResponse);

                // Show AI's natural response in conversation with work thumbnail
                setLog((l) => [
                  ...l,
                  { role: "ai", text: aiResponse, workImage: imageBase64 },
                ]);

                // Update conversation history with the AI's response
                setConversationHistory([
                  ...historyWithAnalysis,
                  {
                    role: "assistant" as const,
                    content: aiResponse,
                  },
                ]);

                // Speak the AI's natural response using queue
                speakText(aiResponse);

                // Persist to Supabase
                const supa = getSupabaseClient();
                if (supa) {
                  await supa.from("messages").insert([
                    {
                      session_id: sessionId,
                      role: "ai",
                      text: aiResponse,
                      emotion_at_time: e || "neutral",
                    },
                  ]);
                }
              } catch (err) {
                console.error(
                  "[Voice] Failed to get AI response to work:",
                  err
                );
              }
            })();
          }
        }
      } catch {}
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
    // If the user starts speaking, stop TTS and clear queue
    rec.onspeechstart = () => {
      try {
        if (window.speechSynthesis.speaking || isSpeakingRef.current) {
          window.speechSynthesis.cancel();
          speechQueueRef.current = []; // Clear the queue
          isSpeakingRef.current = false;
          console.log(
            "[Voice] ⛔ Stopped AI speech and cleared queue due to user speaking"
          );
        }
      } catch {}
    };
    rec.onaudiostart = () => {
      try {
        if (window.speechSynthesis.speaking || isSpeakingRef.current) {
          window.speechSynthesis.cancel();
          speechQueueRef.current = []; // Clear the queue
          isSpeakingRef.current = false;
          console.log(
            "[Voice] ⛔ Stopped AI speech and cleared queue (audio start)"
          );
        }
      } catch {}
    };
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

        if (focus) {
          console.log(
            "[Voice] 🎯 Including highlighted problem in conversation - AI knows current focus"
          );
        }
        if (emotion && emotion !== "neutral") {
          console.log(
            `[Voice] 🎭 Student emotion: ${emotion.toUpperCase()} - AI will acknowledge this`
          );
        }
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

        // TTS using queue
        speakText(reply);
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
          speakText(line);
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
      <div className="mb-3 text-sm text-[color:var(--fg-muted)]">Voice</div>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-accent flex items-center gap-1.5"
          onClick={toggle}
        >
          {isListening ? (
            <>
              <StopIcon className="h-4 w-4" />
              Stop listening
            </>
          ) : (
            <>
              <MicrophoneIcon className="h-4 w-4" />
              Start listening
            </>
          )}
        </button>
      </div>
      <div className="mt-3 h-64 space-y-2 overflow-y-auto">
        {log.map((m, i) => (
          <div key={i}>
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[color:var(--bg-muted)]"
                  : "bg-[color:var(--accent-ink)]"
              }`}
            >
              <span className="font-medium">
                {m.role === "user" ? "You" : "Study Buddy"}:{" "}
              </span>
              {m.text}
            </div>
            {m.workImage && (
              <img
                src={m.workImage}
                alt="Work shown"
                className="mt-2 h-20 w-auto rounded border border-black/10"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
