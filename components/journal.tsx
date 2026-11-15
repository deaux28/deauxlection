"use client";
import { useCallback, useRef, useState } from "react";
import { stamp } from "@/lib/format";
import type { Item } from "@/lib/types";
import { clock, useDictation, useRecorder, useSpeaker } from "@/hooks/voice";
import { useStore } from "./store";

export type Note = { id: string; at: string; text: string; page?: string; photo?: string; audio?: string; seconds?: number };

const Mic = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const Dot = () => <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor" /></svg>;
const Speaker = ({ on }: { on: boolean }) => on
  ? <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>;

/** A reading journal on each book: dated notes with an optional page, photo, and voice recording, read aloud on request. */
export function Journal({ item }: { item: Item }) {
  const { patch, uploadImage, uploadBlob, publicUrl, removeFiles, openNew, toast, readOnly } = useStore();
  const notes = ((item.journal as Note[] | undefined) ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const append = useCallback((phrase: string) => {
    if (!phrase) return;
    setText((t) => {
      const sep = !t ? "" : /[\s\n]$/.test(t) ? "" : " ";
      const p = !t || /[.!?]\s*$/.test(t) ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
      return t + sep + p;
    });
  }, []);
  const dict = useDictation(append);
  const rec = useRecorder();
  const speaker = useSpeaker();

  const startRecording = async () => {
    if (dict.listening) dict.stop();
    await rec.start();
    // Also write out what's said, where the browser allows recording and recognition together.
    if (dict.supported) setTimeout(() => dict.start(), 250);
  };
  const stopRecording = () => { rec.stop(); if (dict.listening) dict.stop(); };

  const pickFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("Choose an image file."); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const add = async () => {
    if (rec.recording) stopRecording();
    if (dict.listening) dict.stop();
    if (!text.trim() && !file && !rec.result) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const tag = `notes/${item.id}-${id.slice(0, 8)}`;
      const photo = file ? await uploadImage(file, tag) : undefined;
      const audio = rec.result ? await uploadBlob(rec.result.blob, `${tag}-voice`, rec.result.ext) : undefined;
      const note: Note = {
        id, at: new Date().toISOString(), text: text.trim(),
        ...(page.trim() ? { page: page.trim() } : {}),
        ...(photo ? { photo } : {}),
        ...(audio ? { audio, seconds: rec.result!.seconds } : {}),
      };
      const all = (item.journal as Note[] | undefined) ?? [];
      await patch(item.id, { journal: [...all, note] });
      setText(""); setPage(""); setFile(null); setPreview(null); rec.discard();
      toast("Note saved");
    } catch (e) {
      toast(`That note didn't save: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  const del = async (n: Note) => {
    if (armed !== n.id) { setArmed(n.id); return; }
    const all = ((item.journal as Note[] | undefined) ?? []).filter((x) => x.id !== n.id);
    await patch(item.id, { journal: all });
    const files = [n.photo, n.audio].filter((x): x is string => !!x);
    if (files.length) removeFiles(files).catch(() => {});
    setArmed(null);
  };

  if (readOnly && !notes.length) return null;
  const voiceErr = rec.error ?? dict.error;
  const canSave = !busy && !rec.recording && (!!text.trim() || !!file || !!rec.result);

  return (
    <div className="journal">
      <div className="lbl-row mono" style={{ margin: 0 }}><span>Reading journal · {notes.length}</span></div>
      {!readOnly && <div className="composer">
        <label htmlFor={`jn-${item.id}`} className="sr">New note</label>
        <div className="ta-wrap">
          <textarea id={`jn-${item.id}`} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={dict.supported ? "Type, or tap Dictate and speak…" : "What are you thinking about this book?"}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }} />
          {dict.interim && <div className="interim" aria-live="polite">{dict.interim}</div>}
        </div>

        {rec.recording && (
          <div className="rec-live" role="status">
            <span className="pulse" /><b>Recording</b><span className="mono">{clock(rec.seconds)} / {clock(rec.max)}</span>
            <button type="button" className="btn sm ink" style={{ marginLeft: "auto" }} onClick={stopRecording}>Stop</button>
          </div>
        )}
        {rec.result && !rec.recording && (
          <div className="rec-done">
            <audio controls src={rec.result.url} preload="metadata" />
            <button type="button" className="linkish" onClick={rec.discard}>Remove recording</button>
          </div>
        )}
        {preview && (
          <div className="shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Photo to attach" />
            <button type="button" className="linkish" onClick={() => { setFile(null); setPreview(null); }}>Remove photo</button>
          </div>
        )}
        {voiceErr && <p className="form-err">{voiceErr}</p>}

        <div className="bar2">
          {dict.supported && !rec.recording && (
            <button type="button" className={`btn sm${dict.listening ? " live" : ""}`} aria-pressed={dict.listening}
              onClick={() => (dict.listening ? dict.stop() : dict.start())} title="Speak and it's written out as text">
              <Mic />{dict.listening ? "Stop dictating" : "Dictate"}
            </button>
          )}
          {rec.supported && !rec.recording && !rec.result && (
            <button type="button" className="btn sm" onClick={startRecording} title="Save a recording of your voice with this note">
              <span style={{ color: "var(--danger)", display: "inline-flex" }}><Dot /></span>Voice note
            </button>
          )}
          <input aria-label="Page" className="pg" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Page" inputMode="numeric" />
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()} title="Photograph a page or passage">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            {preview ? "Retake" : "Photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="btn ink sm" style={{ marginLeft: "auto" }} disabled={!canSave} onClick={add}>{busy ? "Saving…" : "Add note"}</button>
        </div>
      </div>}

      {notes.length === 0 ? <p className="hint" style={{ color: "var(--muted)", margin: 0 }}>Notes you write or record while reading appear here, newest first.</p> : (
        <ol className="notes-list">
          {notes.map((n) => (
            <li key={n.id}>
              <div className="meta mono">
                <span>{stamp(n.at)}{n.page ? ` · p. ${n.page}` : ""}{n.audio ? ` · voice ${clock(n.seconds ?? 0)}` : ""}</span>
                {speaker.supported && n.text && (
                  <button type="button" className={`listen${speaker.speakingId === n.id ? " on" : ""}`} onClick={() => speaker.toggle(n.id, n.text)}
                    aria-label={speaker.speakingId === n.id ? "Stop reading aloud" : "Read this note aloud"}>
                    <Speaker on={speaker.speakingId === n.id} />{speaker.speakingId === n.id ? "Stop" : "Listen"}
                  </button>
                )}
              </div>
              {n.text && <p>{n.text}</p>}
              {n.audio && <audio controls preload="none" src={publicUrl(n.audio)} />}
              {n.photo && (
                <a href={publicUrl(n.photo)} target="_blank" rel="noreferrer" className="shot-link">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(n.photo)} alt={`Photo from page ${n.page ?? ""}`} loading="lazy" />
                </a>
              )}
              {!readOnly && <div className="acts2">
                {n.text && <button type="button" className="linkish" onClick={() => openNew("quote", { text: n.text, by: item.author, bookId: item.id, page: n.page })}>Save as quote</button>}
                <button type="button" className={`linkish del${armed === n.id ? " armed" : ""}`} onClick={() => del(n)} onBlur={() => setArmed(null)}>{armed === n.id ? "Press again to delete" : "Delete"}</button>
              </div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
