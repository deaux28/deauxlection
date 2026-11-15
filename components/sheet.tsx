"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRADES, GRADE_NAMES, KINDS, str, tagsOf, type Field } from "@/lib/kinds";
import { sleeveArt, cloth } from "@/lib/art";
import type { Details, Item, Kind, Track } from "@/lib/types";
import { BookCover, Cover, Disc, Tracklist } from "./art";
import { Journal } from "./journal";
import { currencySymbol, day, money, today } from "@/lib/format";
import { Lookup } from "./lookup";
import { useStore, type CoverSource } from "./store";

const META = new Set(["id", "kind", "createdAt", "updatedAt", "coverPath", "coverUrl", "tracks"]);

export function Sheet() {
  const { sheet, closeSheet, byId } = useStore();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  const item = sheet?.mode === "view" ? byId(sheet.id) : sheet?.mode === "edit" && sheet.id ? byId(sheet.id) : undefined;
  const kind: Kind | undefined = sheet?.mode === "edit" ? sheet.kind : item?.kind;

  useEffect(() => { if (sheet?.mode === "view" && !item) closeSheet(); }, [sheet, item, closeSheet]);

  return (
    <dialog ref={ref} className="sheet" onClose={closeSheet} onClick={(e) => { if (e.target === ref.current) closeSheet(); }}
      style={kind ? { ["--k" as string]: KINDS[kind].color } : undefined} aria-label="Item details">
      {sheet && kind && (sheet.mode === "view" && item ? <ViewPane item={item} /> : sheet.mode === "edit" ? <EditPane key={sheet.id ?? "new"} kind={kind} item={item} prefill={sheet.prefill} /> : null)}
    </dialog>
  );
}

function Top({ label }: { label: string }) {
  const { closeSheet } = useStore();
  return (
    <div className="sheet-top">
      <span className="k mono"><i />{label}</span>
      <button type="button" className="icon-btn" onClick={closeSheet} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}

function Facts({ pairs }: { pairs: [string, unknown][] }) {
  const list = pairs.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!list.length) return null;
  return <dl className="facts">{list.map(([k, v]) => <div key={k}><dt className="mono">{k}</dt><dd>{str(v)}</dd></div>)}</dl>;
}

function Gauge({ label, grade }: { label: string; grade?: string }) {
  const idx = grade ? GRADES.indexOf(grade as (typeof GRADES)[number]) : -1;
  const on = idx < 0 ? 0 : 8 - idx;
  return (
    <div className="gauge">
      <div className="top"><b>{label}</b><span>{grade ? `${grade} · ${GRADE_NAMES[grade]}` : "Not graded"}</span></div>
      <div className="bar8">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</div>
      <div className="ends mono"><span>Poor</span><span>Mint</span></div>
    </div>
  );
}

function ViewPane({ item }: { item: Item }) {
  const { cats, editItem, remove, toast, closeSheet, patch, ofKind, openItem, openNew, byId, readOnly, kinds } = useStore();
  const [armed, setArmed] = useState(false);
  const K = KINDS[item.kind];

  const del = async () => {
    if (!armed) { setArmed(true); return; }
    try { await remove(item.id); toast("Deleted"); closeSheet(); } catch { toast("That didn't delete. Check your connection."); }
  };

  const source = item.discogsId ? { href: `https://www.discogs.com/release/${item.discogsId}`, name: "Discogs" }
    : item.mbid ? { href: `https://musicbrainz.org/release/${item.mbid}`, name: "MusicBrainz" } : null;

  let body: React.ReactNode;
  if (item.kind === "vinyl") {
    body = (
      <>
        <div className="d-art rec-art"><Cover item={item} cat={cats[item.id]} /><Disc item={item} /></div>
        <div className="d-title">
          <h2>{str(item.title)}</h2><div className="by">{str(item.artist)}</div>
          <div className="cat mono"><span>{cats[item.id]}</span>{source && <a href={source.href} target="_blank" rel="noreferrer">View on {source.name} ↗</a>}</div>
        </div>
        {item.tracks?.length ? <Tracklist tracks={item.tracks} /> : readOnly ? null : (
          <div className="empty" style={{ paddingTop: 18 }}>
            <h3>No track list yet.</h3>
            <p>Look this record up by barcode or catalog number to add its tracks and original cover.</p>
            <button className="btn sm" onClick={() => editItem(item.id)}>Find tracks and cover</button>
          </div>
        )}
        <Facts pairs={[["Label", item.label], ["Catalog no.", item.catno], ["Year", item.year], ["Country", item.country], ["Genre", item.genre], ["Format", item.format], ["Size · speed", [item.size, item.speed].filter(Boolean).join(" · ")], ["Pressing", item.pressing], ["Barcode", item.barcode], ["Acquired", item.acquired ? day(item.acquired) : ""], ["Price paid", money(item.price)]]} />
        <div className="gauges"><Gauge label="Record" grade={str(item.media) || undefined} /><Gauge label="Sleeve" grade={str(item.sleeve) || undefined} /></div>
        {item.notes ? <p className="notes">{str(item.notes)}</p> : null}
      </>
    );
  } else if (item.kind === "book") {
    const qs = ofKind("quote").filter((q) => q.bookId === item.id);
    const r = Number(item.rating) || 0;
    body = (
      <>
        <div className="d-art"><BookCover item={item} /></div>
        <div className="d-title"><h2>{str(item.title)}</h2><div className="by">{str(item.author)}</div><div className="cat mono"><span>{cats[item.id]}</span></div></div>
        {readOnly ? (
          (item.status || r > 0) ? (
            <div className="ro-status">
              {item.status ? <span className="pill-status">{str(item.status)}</span> : null}
              {r > 0 && <span className="stars ro" aria-label={`Rated ${r} of 5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= r ? "on" : ""}>★</span>)}</span>}
            </div>
          ) : null
        ) : (
          <>
            <div>
              <div className="lbl-row mono"><span>Status</span></div>
              <div className="seg">{["To read", "Reading", "Read"].map((s) => <button key={s} type="button" aria-pressed={item.status === s} onClick={() => patch(item.id, { status: s })}>{s}</button>)}</div>
            </div>
            <div>
              <div className="lbl-row mono"><span>Your rating</span>{r > 0 && <button type="button" className="linkish mono" onClick={() => patch(item.id, { rating: null })}>Clear</button>}</div>
              <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= r ? "on" : ""} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => patch(item.id, { rating: n })}>★</button>)}</div>
            </div>
          </>
        )}
        <Facts pairs={[["Published", item.year], ["Publisher", item.publisher], ["Format", item.format], ["Pages", item.pages], ["ISBN", item.isbn], ["Acquired", item.acquired ? day(item.acquired) : ""]]} />
        {item.notes ? <div><div className="lbl-row mono"><span>About this copy</span></div><p className="notes">{str(item.notes)}</p></div> : null}
        <Journal item={item} />
        {(!readOnly || (kinds.includes("quote") && qs.length > 0)) && <div className="from-book">
          <div className="lbl-row mono"><span>Quotes from this book · {qs.length}</span>{!readOnly && <button type="button" className="btn sm" onClick={() => openNew("quote", { bookId: item.id, by: item.author })}>Add a quote</button>}</div>
          {qs.map((q) => <button key={q.id} type="button" onClick={() => openItem(q.id)}><blockquote>{str(q.text)}{q.page ? <span className="mono" style={{ color: "var(--muted)" }}> p. {str(q.page)}</span> : null}</blockquote></button>)}
        </div>}
      </>
    );
  } else {
    const book = item.bookId ? byId(str(item.bookId)) : undefined;
    body = (
      <>
        <div className="d-quote">
          <blockquote><span className="open">“</span>{str(item.text)}<span className="open">”</span></blockquote>
          <div className="attr">— <b>{str(item.by)}</b>
            {book ? <>, <button type="button" onClick={() => openItem(book.id)}>{str(book.title)}</button></> : item.source ? <>, <i style={{ fontFamily: "var(--f-serif)" }}>{str(item.source)}</i></> : null}
            {item.page ? `, p. ${str(item.page)}` : ""}
          </div>
        </div>
        <div className="mono" style={{ color: "var(--muted)", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>{cats[item.id]}</span>{tagsOf(item).map((t) => <span key={t} style={{ color: "var(--c-quote)" }}>#{t}</span>)}
        </div>
      </>
    );
  }

  return (
    <div className="sheet-in">
      <Top label={K.one} />
      <div className="sheet-body">{body}</div>
      {readOnly ? (
        <div className="sheet-foot"><div className="r"><button type="button" className="btn" onClick={closeSheet}>Close</button></div></div>
      ) : <div className="sheet-foot">
        <button type="button" className={`btn danger${armed ? " armed" : ""}`} onClick={del} onBlur={() => setArmed(false)}>{armed ? "Press again to delete" : "Delete"}</button>
        <div className="r"><button type="button" className="btn ink" onClick={() => editItem(item.id)}>Edit</button></div>
      </div>}
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const { ofKind } = useStore();
  const id = `f-${f.k}`;
  const label = <label className="mono" htmlFor={id}>{f.label}{f.req && <span className="req"> *</span>}</label>;
  const hint = f.hint ? <div className="hint">{f.hint}</div> : null;
  const cls = `field${f.half ? " half" : ""}`;
  if (f.type === "select") {
    return <div className={cls}>{label}<select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{f.empty ?? "—"}</option>
      {value && !f.options!.includes(value) && <option value={value}>{value}</option>}
      {f.options!.map((o) => <option key={o} value={o}>{f.labels ? `${o} · ${f.labels[o]}` : o}</option>)}
    </select>{hint}</div>;
  }
  if (f.type === "bookref") {
    const books = ofKind("book").sort((a, b) => str(a.title).localeCompare(str(b.title)));
    return <div className={cls}>{label}<select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{books.length ? "None" : "No books yet"}</option>
      {books.map((b) => <option key={b.id} value={b.id}>{str(b.title)} — {str(b.author)}</option>)}
    </select>{hint}</div>;
  }
  if (f.type === "date") {
    return <div className={cls}>{label}<div style={{ display: "flex", gap: 6 }}>
      <input id={id} type="date" value={value} max={today()} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
      {!value && <button type="button" className="btn sm" style={{ alignSelf: "center" }} onClick={() => onChange(today())}>Today</button>}
    </div>{hint}</div>;
  }
  if (f.type === "money") {
    return <div className={cls}>{label}<div className="money"><span aria-hidden="true">{currencySymbol()}</span>
      <input id={id} type="number" inputMode="decimal" step="0.01" min="0" value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>{hint}</div>;
  }
  if (f.type === "textarea") {
    return <div className={cls}>{label}<textarea id={id} className={f.big ? "big" : ""} value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />{hint}</div>;
  }
  return <div className={cls}>{label}<input id={id} type={f.type === "number" ? "number" : "text"} inputMode={f.type === "number" ? "numeric" : undefined}
    value={value} placeholder={f.placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />{hint}</div>;
}

function TrackEditor({ tracks, setTracks }: { tracks: Track[]; setTracks: (t: Track[]) => void }) {
  const set = (i: number, k: keyof Track, v: string) => setTracks(tracks.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const nextPos = () => {
    const last = tracks[tracks.length - 1]?.position ?? "";
    const m = last.match(/^([A-Z]+)(\d+)$/i);
    return m ? `${m[1]}${Number(m[2]) + 1}` : last && /^\d+$/.test(last) ? String(Number(last) + 1) : tracks.length ? "" : "A1";
  };
  return (
    <div className="tr-edit">
      <div className="lbl-row mono" style={{ margin: 0 }}><span>Track list · {tracks.length}</span>{tracks.length > 0 && <button type="button" className="linkish mono" onClick={() => setTracks([])}>Clear all</button>}</div>
      {tracks.map((t, i) => (
        <div className="tr-row" key={i}>
          <input aria-label="Position" value={t.position} onChange={(e) => set(i, "position", e.target.value)} placeholder="A1" />
          <input aria-label="Title" value={t.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Track title" />
          <input aria-label="Length" value={t.duration ?? ""} onChange={(e) => set(i, "duration", e.target.value)} placeholder="3:45" />
          <button type="button" className="x" aria-label={`Remove ${t.title || "track"}`} onClick={() => setTracks(tracks.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div><button type="button" className="btn sm" onClick={() => setTracks([...tracks, { position: nextPos(), title: "", duration: "" }])}>Add track</button></div>
    </div>
  );
}

function EditPane({ kind, item, prefill }: { kind: Kind; item?: Item; prefill?: Record<string, unknown> }) {
  const { save, toast, openItem, closeSheet } = useStore();
  const K = KINDS[kind];
  const init = useMemo(() => {
    const src: Record<string, unknown> = item ?? prefill ?? {};
    return Object.fromEntries(Object.entries(src).filter(([k, v]) => !META.has(k) && (typeof v === "string" || typeof v === "number")).map(([k, v]) => [k, str(v)]));
  }, [item, prefill]);
  const [values, setValues] = useState<Record<string, string>>(init);
  const [tracks, setTracks] = useState<Track[]>(item?.tracks ?? []);
  const [cover, setCover] = useState<CoverSource>(null);
  const [preview, setPreview] = useState<string | null>(item?.coverUrl ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback((d: Details) => {
    setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(d.fields).map(([k, x]) => [k, String(x)])) }));
    if (d.tracks?.length) setTracks(d.tracks);
    if (d.coverUrl) { setCover({ url: d.coverUrl }); setPreview(d.coverUrl); }
    setFilled(`Filled in ${str(d.fields.title)}${d.tracks?.length ? `, ${d.tracks.length} tracks` : ""}${d.coverUrl ? " and the cover" : ""}. Check it, then save.`);
  }, []);

  const onFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("Choose an image file."); return; }
    setCover({ file: f }); setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      const def = K.fields.find((f) => f.k === k);
      const t = v.trim();
      if (!t) continue;
      fields[k] = (def?.type === "number" || def?.type === "money") && !isNaN(Number(t)) ? Number(t) : t;
    }
    // Keep data the form doesn't edit (rating, reading journal, source ids).
    if (item) for (const [k, v] of Object.entries(item)) {
      if (!META.has(k) && !K.fields.some((f) => f.k === k) && !(k in fields) && v !== undefined && v !== null && typeof v !== "string") fields[k] = v;
    }
    const missing = K.fields.filter((f) => f.req && !fields[f.k]).map((f) => f.label.toLowerCase());
    if (missing.length) { setErr(`Add the ${missing.join(" and ")} to save.`); return; }
    const cleanTracks = tracks.filter((t) => t.title.trim()).map((t) => ({ position: t.position.trim(), title: t.title.trim(), ...(t.duration?.trim() ? { duration: t.duration.trim() } : {}) }));
    setSaving(true); setErr(null);
    try {
      const id = await save({ id: item?.id, kind, fields, tracks: kind === "vinyl" ? cleanTracks : undefined, cover });
      toast(item ? "Saved" : `Added to ${K.tab.toLowerCase()}`);
      openItem(id);
    } catch (e2) {
      setErr(`That didn't save: ${(e2 as Error).message}`);
      setSaving(false);
    }
  };

  const lookupQuery = kind === "vinyl" ? (values.barcode || values.catno || [values.artist, values.title].filter(Boolean).join(" ")) : (values.isbn || [values.title, values.author].filter(Boolean).join(" "));
  const art = kind === "vinyl" ? sleeveArt(values.title ?? "", values.artist ?? "") : null;
  const cl = kind === "book" ? cloth(values.title ?? "", values.author ?? "") : null;

  return (
    <form className="sheet-in" onSubmit={submit} noValidate>
      <Top label={item ? `Edit ${K.one}` : `New ${K.one}`} />
      <div className="sheet-body">
        <div className="form">
          {kind !== "quote" && <Lookup kind={kind} initialQuery={lookupQuery} onPick={onPick} />}
          {filled && <p className="hint" style={{ gridColumn: "span 2", margin: 0, color: "var(--k)", fontWeight: 600 }}>{filled}</p>}
          {kind !== "quote" && (
            <div className="cover-field">
              <div className={`thumb${kind === "book" ? " book" : ""}`} style={cl ? { background: cl.bg } : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="Cover preview" /> : art ? <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: art.svg }} /> : null}
              </div>
              <div className="ctl">
                <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>{preview ? "Replace cover" : "Add a photo"}</button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                {cover && <button type="button" className="linkish" onClick={() => { setCover(null); setPreview(item?.coverUrl ?? null); }}>Undo</button>}
                <span style={{ flexBasis: "100%" }}>{preview ? (cover && "url" in cover ? "Cover from the lookup. It's copied to your storage when you save." : "") : "No cover yet. A generated sleeve is shown until you add one."}</span>
              </div>
            </div>
          )}
          {K.fields.map((f) => <FieldInput key={f.k} f={f} value={values[f.k] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.k]: v }))} />)}
          {kind === "vinyl" && <TrackEditor tracks={tracks} setTracks={setTracks} />}
          {err && <p className="form-err">{err}</p>}
        </div>
      </div>
      <div className="sheet-foot">
        <div className="r">
          <button type="button" className="btn" onClick={() => (item ? openItem(item.id) : closeSheet())}>Cancel</button>
          <button type="submit" className="btn ink" disabled={saving}>{saving ? "Saving…" : item ? "Save changes" : `Add to ${K.tab.toLowerCase()}`}</button>
        </div>
      </div>
    </form>
  );
}
