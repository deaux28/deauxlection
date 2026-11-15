"use client";
import { useRef, useState } from "react";
import { stamp } from "@/lib/format";
import type { Item } from "@/lib/types";
import { useStore } from "./store";

export type Note = { id: string; at: string; text: string; page?: string; photo?: string };

/** A reading journal on each book: dated notes with an optional page number and photo of the page. */
export function Journal({ item }: { item: Item }) {
  const { patch, uploadImage, publicUrl, removeFiles, openNew, toast, readOnly } = useStore();
  const notes = ((item.journal as Note[] | undefined) ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("Choose an image file."); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const add = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const photo = file ? await uploadImage(file, `notes/${item.id}-${id.slice(0, 8)}`) : undefined;
      const note: Note = { id, at: new Date().toISOString(), text: text.trim(), ...(page.trim() ? { page: page.trim() } : {}), ...(photo ? { photo } : {}) };
      const all = (item.journal as Note[] | undefined) ?? [];
      await patch(item.id, { journal: [...all, note] });
      setText(""); setPage(""); setFile(null); setPreview(null);
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
    if (n.photo) removeFiles([n.photo]).catch(() => {});
    setArmed(null);
  };

  if (readOnly && !notes.length) return null;

  return (
    <div className="journal">
      <div className="lbl-row mono" style={{ margin: 0 }}><span>Reading journal · {notes.length}</span></div>
      {!readOnly && <div className="composer">
        <label htmlFor={`jn-${item.id}`} className="sr">New note</label>
        <textarea id={`jn-${item.id}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="What are you thinking about this book?"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }} />
        {preview && (
          <div className="shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Photo to attach" />
            <button type="button" className="linkish" onClick={() => { setFile(null); setPreview(null); }}>Remove photo</button>
          </div>
        )}
        <div className="bar2">
          <input aria-label="Page" className="pg" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Page" inputMode="numeric" />
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()} title="Photograph a page or passage">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            {preview ? "Retake" : "Photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="btn ink sm" style={{ marginLeft: "auto" }} disabled={busy || (!text.trim() && !file)} onClick={add}>{busy ? "Saving…" : "Add note"}</button>
        </div>
      </div>}
      {notes.length === 0 ? <p className="hint" style={{ color: "var(--muted)", margin: 0 }}>Notes you write while reading appear here, newest first. Photograph a page to keep a passage.</p> : (
        <ol className="notes-list">
          {notes.map((n) => (
            <li key={n.id}>
              <div className="meta mono"><span>{stamp(n.at)}{n.page ? ` · p. ${n.page}` : ""}</span></div>
              {n.text && <p>{n.text}</p>}
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
