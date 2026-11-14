"use client";
import { useCallback, useState } from "react";
import type { Candidate, Details } from "@/lib/types";
import { looksLikeBarcode } from "@/lib/lookup/barcode";
import { Scanner } from "./scanner";

type Props = { kind: "vinyl" | "book"; initialQuery?: string; onPick: (d: Details) => void };

const SOURCE: Record<Candidate["source"], string> = { discogs: "Discogs", musicbrainz: "MusicBrainz", openlibrary: "Open Library", googlebooks: "Google Books" };

export function Lookup({ kind, initialQuery = "", onPick }: Props) {
  const [scan, setScan] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [busy, setBusy] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (params: URLSearchParams) => {
    setBusy("Searching…"); setErr(null); setCands(null); setNotes([]);
    try {
      const res = await fetch(`/api/lookup?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "The lookup failed.");
      setNotes(body.notes ?? []);
      if (body.details) { onPick(body.details); setBusy(null); return; }
      setCands(body.candidates);
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }, [onPick]);

  const onCode = useCallback((code: string) => {
    setScan(false); setQ(code);
    run(new URLSearchParams({ code, kind }));
  }, [run, kind]);

  const submit = () => {
    const v = q.trim(); if (!v) return;
    run(new URLSearchParams(looksLikeBarcode(v) ? { code: v, kind } : { q: v, kind }));
  };

  const pick = async (c: Candidate) => {
    setBusy(`Loading ${c.title}…`); setErr(null);
    try {
      const res = await fetch(`/api/lookup/release?source=${c.source}&id=${encodeURIComponent(c.id)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That release couldn't be loaded.");
      onPick(body as Details);
      setCands(null);
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };

  return (
    <div className="lookup">
      <div className="lbl-row mono" style={{ margin: 0 }}><span>Fill in from a barcode or search</span></div>
      {scan && <Scanner onCode={onCode} onClose={() => setScan(false)} />}
      <div className="row">
        <button type="button" className="btn ink icon-only" onClick={() => setScan((s) => !s)} aria-label="Scan a barcode" title="Scan a barcode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" /></svg>
        </button>
        <input id="lookup-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={kind === "vinyl" ? "Barcode, catalog no., or artist and album" : "ISBN, or title and author"} autoComplete="off" />
        <button type="button" className="btn" onClick={submit} disabled={!q.trim() || !!busy}>Find</button>
      </div>
      {busy && <p className="hint">{busy}</p>}
      {err && <p className="form-err" style={{ gridColumn: "auto" }}>{err}</p>}
      {notes.map((n) => <p key={n} className="hint">{n}</p>)}
      {cands && !cands.length && <p className="hint">No matches. Try the catalog number printed on the spine or label, or the artist and album.</p>}
      {cands && cands.length > 0 && (
        <>
          <p className="hint">{cands.length} match{cands.length === 1 ? "" : "es"}. Pick your copy.</p>
          <div className="cands">
            {cands.map((c) => (
              <button type="button" key={`${c.source}:${c.id}`} className="cand" onClick={() => pick(c)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="im">{c.thumb && <img src={c.thumb} alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />}</span>
                <span>
                  <span className="t" style={{ display: "block" }}>{c.title}</span>
                  <span className="m" style={{ display: "block" }}>{[c.creator, c.year, c.label, c.catno, c.country, c.format].filter(Boolean).join(" · ")}</span>
                  <span className="m mono src">{SOURCE[c.source]}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
