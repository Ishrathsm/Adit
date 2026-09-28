"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mic, Square } from "lucide-react";
import { clsx } from "clsx";
import { transcribeAudio } from "@/lib/api";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib; Chrome and Safari prefix it).
interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Longest recording for the server fallback — a prompt, not a meeting.
const MAX_RECORDING_MS = 60_000;

const joinText = (base: string, added: string) => {
  const a = added.trim();
  if (!a) return base;
  return base.trim() ? `${base.replace(/\s+$/, "")} ${a}` : a;
};

// Speak instead of typing. Uses the browser's own speech recognition when it has one (words appear
// as you talk), otherwise records a short clip and transcribes it on the server (signed-in pages
// only). Spoken text is appended to whatever is already typed.
export function DictationButton({
  value,
  onChange,
  disabled,
  // The server fallback needs a signed-in user; pages for visitors pass false.
  allowServer = true,
  lang = "en-IN",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  allowServer?: boolean;
  lang?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<"live" | "record" | null>(null);
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<number | null>(null);
  // Chrome ends a recognition session by itself after a short pause, even in continuous mode, so a
  // session that ends while the user still wants to talk is restarted (text so far is kept).
  const wantLive = useRef(false);
  // Sessions in a row that ended without hearing anything — a browser that keeps dropping them
  // would otherwise flip the mic on and off; after a few, dictation switches to recording.
  const emptyEnds = useRef(0);
  const canRecord = useRef(false);
  // What has been heard in this dictation (across restarted sessions), for the listening panel.
  const heardFinal = useRef("");
  const [heard, setHeard] = useState({ final: "", interim: "" });
  // Latest value/onChange for the async callbacks, which outlive the render that started them.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);

  // Decided after mount: the capability check reads `window`, which the server render doesn't have.
  useEffect(() => {
    const live = Boolean(speechRecognition());
    const record = allowServer && typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);
    canRecord.current = record;
    // Phones and tablets end a recognition session after every phrase (and Android repeats text
    // across sessions), so they record and transcribe instead — steady, and better at Indian
    // languages. Desktop browsers keep live words.
    const touch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(record && (touch || !live) ? "record" : live ? "live" : null);
  }, [allowServer]);

  useEffect(() => {
    if (state !== "listening") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(
    () => () => {
      wantLive.current = false;
      recognition.current?.stop();
      if (recorder.current?.state === "recording") recorder.current.stop();
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
    },
    [],
  );

  function startLive() {
    const Ctor = speechRecognition();
    if (!Ctor) return;
    wantLive.current = true;
    // Safety cap on one dictation: stops after two minutes even if the user forgets.
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => {
      wantLive.current = false;
      recognition.current?.stop();
    }, MAX_RECORDING_MS * 2);
    heardFinal.current = "";
    emptyEnds.current = 0;
    setHeard({ final: "", interim: "" });
    setError(null);
    setState("listening");
    runLiveSession(Ctor);
  }

  function runLiveSession(Ctor: SpeechRecognitionCtor) {
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    // Each session appends to whatever the field holds when it starts (earlier sessions included).
    const base = latest.current.value;
    let finalText = "";
    let heardSomething = false;
    rec.onresult = (e) => {
      heardSomething = true;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = joinText(finalText, r[0].transcript);
        else interim = joinText(interim, r[0].transcript);
      }
      latest.current.onChange(joinText(base, joinText(finalText, interim)));
      setHeard({ final: joinText(heardFinal.current, finalText), interim });
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantLive.current = false;
        setError("Microphone is blocked. Allow it in your browser's site settings.");
      } else if (e.error === "audio-capture") {
        wantLive.current = false;
        setError("No microphone found.");
      }
      // "no-speech", "aborted" and "network" just end this session; onend decides what's next.
    };
    rec.onend = () => {
      // Keep only what was recognized for certain, then carry on if the user hasn't stopped.
      latest.current.onChange(joinText(base, finalText));
      heardFinal.current = joinText(heardFinal.current, finalText);
      setHeard({ final: heardFinal.current, interim: "" });
      emptyEnds.current = heardSomething ? 0 : emptyEnds.current + 1;
      if (wantLive.current && emptyEnds.current >= 3) {
        // The browser keeps dropping the session: stop the on/off loop and record instead.
        wantLive.current = false;
        recognition.current = null;
        if (stopTimer.current) window.clearTimeout(stopTimer.current);
        if (canRecord.current) {
          setMode("record");
          void startRecording();
        } else {
          setState("idle");
          setError("Voice input paused. Tap the mic to continue.");
        }
        return;
      }
      if (wantLive.current) {
        // A calm restart (not instant) — and the new session reads the updated value, which lands
        // after React re-renders.
        window.setTimeout(() => {
          if (wantLive.current) runLiveSession(Ctor);
        }, 400);
        return;
      }
      wantLive.current = false;
      recognition.current = null;
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      setState("idle");
    };
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      wantLive.current = false;
      recognition.current = null;
      setState("idle");
    }
  }

  async function startRecording() {
    setError(null);
    setHeard({ final: "", interim: "" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone is blocked. Allow it in your browser's site settings.");
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!blob.size) return setState("idle");
      setState("transcribing");
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const { text } = await transcribeAudio(base64, blob.type);
        if (text) {
          latest.current.onChange(joinText(latest.current.value, text));
          setHeard({ final: text, interim: "" });
        }
        else setError("Couldn't hear that. Try again.");
      } catch {
        setError("Couldn't transcribe that. Try again.");
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("listening");
    stopTimer.current = window.setTimeout(() => { if (rec.state === "recording") rec.stop(); }, MAX_RECORDING_MS);
  }

  function stop() {
    wantLive.current = false;
    recognition.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function toggle() {
    if (state === "transcribing") return;
    if (state === "listening") return stop();
    if (mode === "live") startLive();
    else if (mode === "record") void startRecording();
  }

  if (!mode) return null;
  const listening = state === "listening";
  return (
    <span className={clsx("relative inline-flex", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || state === "transcribing"}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Speak instead of typing"}
        title={listening ? "Stop" : "Speak instead of typing"}
        className={clsx(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40",
          listening ? "border-transparent bg-red-500 text-white" : "border-border-strong text-muted hover:bg-white/5 hover:text-foreground",
        )}
      >
        {state === "transcribing" ? <Loader2 size={15} className="animate-spin" /> : listening ? <Square size={12} className="fill-current" /> : <Mic size={15} />}
        {listening && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-red-400 motion-reduce:animate-none" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {listening ? "Listening" : state === "transcribing" ? "Transcribing" : ""}
      </span>
      {state !== "idle" && typeof document !== "undefined" && createPortal(
        <ListeningPanel
          state={state}
          live={mode === "live"}
          final={heard.final}
          interim={heard.interim}
          onDone={stop}
        />,
        document.body,
      )}
      {error && (
        <span role="alert" className="absolute right-0 bottom-full mb-2 w-60 rounded-xl border border-border-strong bg-background px-3 py-2 text-xs text-red-400 shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
}

// Google-style listening panel: a pulsing mic and the words appearing large as they're recognized
// (settled words in full ink, words still being recognized lighter). Clicking outside, Escape, or
// Done stops the dictation; the text is already in the field.
function ListeningPanel({
  state,
  live,
  final,
  interim,
  onDone,
}: {
  state: "listening" | "transcribing";
  live: boolean;
  final: string;
  interim: string;
  onDone: () => void;
}) {
  const nothingYet = !final && !interim;
  const prompt = state === "transcribing" ? "Turning your words into text…" : live ? "Listening… speak now" : "Recording… tap Done when you finish";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] backdrop-blur-sm sm:items-center sm:pb-0"
      onClick={state === "listening" ? onDone : undefined}
    >
      <div
        role="dialog"
        aria-label="Voice input"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col items-center gap-6 rounded-[1.75rem] border border-border-strong bg-background px-6 py-8 text-center shadow-2xl sm:px-10"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          {state === "listening" && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/25 motion-reduce:animate-none" aria-hidden />
              <span className="absolute inset-2 animate-pulse rounded-full bg-red-500/20 motion-reduce:animate-none" aria-hidden />
            </>
          )}
          <span className={clsx("relative flex h-14 w-14 items-center justify-center rounded-full text-white", state === "listening" ? "bg-red-500" : "bg-muted")}>
            {state === "transcribing" ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
          </span>
        </div>

        <p className="min-h-[4.5rem] max-w-full text-2xl leading-snug font-medium text-balance break-words sm:text-3xl" aria-live="polite">
          {nothingYet ? (
            <span className="text-muted">{prompt}</span>
          ) : (
            <>
              <span className="text-foreground">{final}</span>
              {interim && <span className="text-muted">{final ? " " : ""}{interim}</span>}
            </>
          )}
        </p>

        {state === "listening" && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full bg-button-bg px-6 py-2.5 text-sm font-medium text-button-fg transition-transform hover:scale-[1.03] active:scale-95"
          >
            Done
          </button>
        )}
        <p className="text-xs text-muted">{state === "listening" ? "Press Esc or tap outside to stop" : "\u00a0"}</p>
      </div>
    </div>
  );
}
