"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------- Speech to text (browser speech recognition) ---------- */

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Live dictation. `onFinal` receives each settled phrase; `interim` is the words still being recognized.
 * Supported in Chrome, Edge and Safari (including iPhone). Not in Firefox.
 */
export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => { setSupported(!!recognitionCtor()); }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else pending += res[0].transcript;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted.current = false;
      setError(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone or speech recognition is blocked. Allow it in your browser settings."
        : e.error === "network" ? "Speech recognition needs an internet connection." : "Dictation stopped unexpectedly.");
    };
    // Browsers end recognition after a pause; restart while the person still wants to dictate.
    r.onend = () => {
      setInterim("");
      if (wanted.current) { try { r.start(); return; } catch { /* fall through */ } }
      setListening(false);
    };
    rec.current = r;
    wanted.current = true;
    try { r.start(); setListening(true); } catch { setError("Dictation couldn't start."); }
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => { wanted.current = false; rec.current?.abort(); }, []);

  return { supported, listening, interim, error, start, stop };
}

/* ---------- Audio recording ---------- */

const MAX_SECONDS = 5 * 60;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

export type Recording = { blob: Blob; url: string; seconds: number; ext: string };

/** Records a voice note with the microphone, up to five minutes. */
export function useRecorder() {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => { setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"); }, []);

  const cleanup = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

  const stop = useCallback(() => { if (mr.current?.state === "recording") mr.current.stop(); }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        cleanup();
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type });
        const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        setResult({ blob, url: URL.createObjectURL(blob), seconds: secs, ext });
        setRecording(false);
      };
      mr.current = rec;
      startedAt.current = Date.now();
      setSeconds(0);
      setResult(null);
      rec.start(1000);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) rec.stop();
      }, 250);
    } catch (e) {
      const name = (e as Error).name;
      setError(name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser settings."
        : name === "NotFoundError" ? "No microphone found." : "Recording couldn't start.");
    }
  }, []);

  const discard = useCallback(() => { if (result) URL.revokeObjectURL(result.url); setResult(null); setSeconds(0); }, [result]);

  useEffect(() => () => { cleanup(); if (mr.current?.state === "recording") mr.current.stop(); }, []);

  return { supported, recording, seconds, result, error, start, stop, discard, max: MAX_SECONDS };
}

/* ---------- Text to speech ---------- */

/** Reads text aloud with the device's built-in voices. Only one thing speaks at a time. */
export function useSpeaker() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  useEffect(() => { setSupported(typeof window !== "undefined" && "speechSynthesis" in window); }, []);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const toggle = useCallback((id: string, text: string) => {
    const synth = window.speechSynthesis;
    if (speakingId === id) { synth.cancel(); setSpeakingId(null); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = navigator.language || "en-US";
    u.rate = 1;
    u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
    u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
    setSpeakingId(id);
    synth.speak(u);
  }, [speakingId]);

  return { supported, speakingId, toggle };
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
