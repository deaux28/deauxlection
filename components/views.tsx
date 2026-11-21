"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { KINDS, ORDER, creatorOf, str, tagsOf, titleOf } from "@/lib/kinds";
import type { Item, Kind } from "@/lib/types";
import { Cover, Disc, QuoteCard, RecordCard, Spine } from "./art";
import { useStore } from "./store";
import { money } from "@/lib/format";

type Sort = "recent" | "title" | "creator" | "year-new" | "year-old" | "acquired";
const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
function sortItems(list: Item[], s: Sort) {
  const by: Record<Sort, (a: Item, b: Item) => number> = {
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
    title: (a, b) => cmp(titleOf(a), titleOf(b)),
    creator: (a, b) => cmp(creatorOf(a), creatorOf(b)) || cmp(titleOf(a), titleOf(b)),
    "year-new": (a, b) => (Number(b.year) || -1e9) - (Number(a.year) || -1e9),
    "year-old": (a, b) => (Number(a.year) || 1e9) - (Number(b.year) || 1e9),
    acquired: (a, b) => str(b.acquired || "0000").localeCompare(str(a.acquired || "0000")) || b.createdAt.localeCompare(a.createdAt),
  };
  return list.slice().sort(by[s]);
}

function Empty({ kind }: { kind: Kind }) {
  const { openNew, readOnly } = useStore();
  if (readOnly) return <div className="empty"><h3>Nothing here yet.</h3></div>;
  const copy = {
    vinyl: ["The crate is empty.", "Scan a record's barcode and its cover, track list and pressing details fill in for you."],
    book: ["Nothing on the shelf yet.", "Scan a book's ISBN barcode. Its spine is sized by page count, and a ribbon marks what you're reading."],
    quote: ["No quotes saved yet.", "Keep the lines that stay with you, and link them to a book on your shelf."],
  }[kind];
  return <div className="empty"><h3>{copy[0]}</h3><p>{copy[1]}</p><button className="btn sm" onClick={() => openNew(kind)}>Add a {KINDS[kind].one}</button></div>;
}

const Legend = () => (
  <div className="shelf-legend mono"><span><i className="rb" />Reading now</span><span>Spine width follows page count</span><span>Faded spines are still to read</span></div>
);

function Hero() {
  const { ofKind, cats, openItem, byId } = useStore();
  const vinyl = useMemo(() => sortItems(ofKind("vinyl"), "recent"), [ofKind]);
  const [pick, setPick] = useState<string | null>(null);
  const f = (pick && byId(pick)) || vinyl[0];
  if (f) {
    const len = str(f.title).length;
    const hs = len <= 8 ? "clamp(48px, 8.4vw, 116px)" : len <= 16 ? "clamp(40px, 6.6vw, 92px)" : len <= 28 ? "clamp(34px, 5vw, 72px)" : "clamp(30px, 4vw, 56px)";
    const facts = ([["Label", f.label], ["Year", f.year], ["Format", [f.format, f.size].filter(Boolean).join(" ")], ["Grade", f.media]] as [string, unknown][]).filter(([, v]) => v);
    return (
      <section className="wrap hero">
        <div>
          <div className="eyebrow mono"><span className="live" />Now spinning · {cats[f.id]}</div>
          <h1 style={{ ["--hs" as string]: hs, ["--lw" as string]: Math.max(4, ...str(f.title).split(/\s+/).map((w) => w.length)) }}>{str(f.title)}</h1>
          <div className="by">{str(f.artist)}</div>
          {facts.length > 0 && <div className="facts mono">{facts.map(([k, v]) => <span key={k}>{k} <b>{str(v)}</b></span>)}</div>}
          <div className="acts">
            <button className="btn ink" onClick={() => openItem(f.id)}>Open record</button>
            {vinyl.length > 1 && <button className="btn" onClick={() => { const rest = vinyl.filter((v) => v.id !== f.id); setPick(rest[Math.floor(Math.random() * rest.length)].id); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>Pull another</button>}
          </div>
        </div>
        <button className="stage" onClick={() => openItem(f.id)} aria-label={`Open ${str(f.title)}`} key={f.id}><Cover item={f} cat={cats[f.id]} /><Disc item={f} /></button>
      </section>
    );
  }
  const q = ofKind("quote")[0];
  if (!q) return null;
  return (
    <section className="wrap hero" style={{ gridTemplateColumns: "1fr" }}>
      <div style={{ maxWidth: 980 }}>
        <div className="eyebrow mono"><span className="live" style={{ background: "var(--c-quote)" }} />From your quotes</div>
        <blockquote style={{ margin: "18px 0 14px", fontFamily: "var(--f-serif)", fontSize: "clamp(30px, 4.4vw, 58px)", lineHeight: 1.08 }}>“{str(q.text)}”</blockquote>
        <div className="by">{str(q.by)}</div>
      </div>
    </section>
  );
}

export function Overview() {
  const { items, ofKind, openNew, q, readOnly, kinds, href, shareTitle } = useStore();
  const shown = ORDER.filter((k) => kinds.includes(k));
  if (q.trim()) return <SearchResults />;
  if (!items.length && readOnly) {
    return <section className="wrap big-empty"><div className="eyebrow mono">Shared collection</div><h1>{shareTitle}</h1><p>Nothing has been added yet. Check back soon.</p></section>;
  }
  if (!items.length) {
    return (
      <section className="wrap big-empty">
        <div className="eyebrow mono">Your collection</div>
        <h1>Start the crate. Fill the shelf.</h1>
        <p>Scan a barcode and the cover, track list and details fill in. Your books, the lines you love, all in one place.</p>
        <div className="acts">{ORDER.map((k) => <button key={k} className={`btn${k === "vinyl" ? " ink" : ""}`} onClick={() => openNew(k)}>Add a {KINDS[k].one}</button>)}</div>
      </section>
    );
  }
  const head = (k: Kind, title: string) => (
    <div className="sec-head" style={{ ["--k" as string]: KINDS[k].color }}>
      <h2>{title}<span className="count">{ofKind(k).length}</span></h2>
      <div className="side"><Link className="see-all" href={href(KINDS[k].route)}>See all <span aria-hidden="true">→</span></Link></div>
    </div>
  );
  const recs = sortItems(ofKind("vinyl"), "recent").slice(0, 14);
  const books = sortItems(ofKind("book"), "recent").slice(0, 40);
  const quotes = sortItems(ofKind("quote"), "recent").slice(0, 6);
  return (
    <>
      {readOnly && !ofKind("vinyl").length && (
        <section className="wrap page-head"><div className="eyebrow mono">Shared collection</div><div className="sec-head" style={{ marginTop: 10 }}><h2>{shareTitle}</h2></div></section>
      )}
      <Hero />
      <div className="wrap"><div className="stats" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>{shown.map((k) => {
        const n = ofKind(k).length;
        return <Link key={k} className="stat" href={href(KINDS[k].route)} style={{ ["--k" as string]: KINDS[k].color }}><span className="num">{n}</span><span className="lbl mono"><i />{n === 1 ? KINDS[k].one : KINDS[k].tab}</span></Link>;
      })}</div></div>
      {shown.includes("vinyl") && <section className="wrap block">{head("vinyl", "The crate")}{recs.length ? <div className="crate">{recs.map((r) => <RecordCard key={r.id} item={r} />)}</div> : <Empty kind="vinyl" />}</section>}
      {shown.includes("book") && <section className="wrap block">{head("book", "The shelf")}{books.length ? <><div className="shelf">{books.map((b) => <Spine key={b.id} item={b} />)}</div><Legend /></> : <Empty kind="book" />}</section>}
      {shown.includes("quote") && <section className="wrap block">{head("quote", "Marginalia")}{quotes.length ? <div className="quotes">{quotes.map((x) => <QuoteCard key={x.id} item={x} />)}</div> : <Empty kind="quote" />}</section>}
    </>
  );
}

export function Collection({ kind }: { kind: Kind }) {
  const { ofKind, openNew, q, readOnly } = useStore();
  const [sort, setSort] = useState<Sort>("recent");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  if (q.trim()) return <SearchResults />;
  const K = KINDS[kind];
  const all = ofKind(kind);
  let list = all;
  let filters: React.ReactNode = null;
  if (kind === "book") {
    const c = (s: string) => all.filter((b) => str(b.status) === s).length;
    filters = <div className="chips" style={{ ["--k" as string]: K.color }}>
      {([["", "All", all.length], ["Reading", "Reading", c("Reading")], ["To read", "To read", c("To read")], ["Read", "Read", c("Read")]] as [string, string, number][]).map(([v, l, n]) =>
        <button key={l} className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}<span className="n">{n}</span></button>)}
    </div>;
    if (status) list = list.filter((b) => str(b.status) === status);
  }
  if (kind === "quote") {
    const counts: Record<string, number> = {};
    all.forEach((x) => tagsOf(x).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (tags.length) filters = <div className="chips" style={{ ["--k" as string]: K.color }}>
      <button className="chip" aria-pressed={!tag} onClick={() => setTag("")}>All</button>
      {tags.map(([t, n]) => <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(t)}>#{t}<span className="n">{n}</span></button>)}
    </div>;
    if (tag) list = list.filter((x) => tagsOf(x).includes(tag));
  }
  list = sortItems(list, sort);
  const dek = { vinyl: "Every record with its pressing, grade and track list. Hover a sleeve to slide the record out.", book: "Spines sized by page count. A ribbon marks what you're reading.", quote: "Lines worth keeping, linked to the books they came from." }[kind];
  const creatorLabel = kind === "vinyl" ? "Artist A–Z" : kind === "book" ? "Author A–Z" : "Speaker A–Z";
  return (
    <section className="wrap page-head">
      <div className="sec-head" style={{ ["--k" as string]: K.color }}>
        <h2>{K.tab}<span className="count">{all.length}</span></h2>
        <div className="side">
          {!readOnly && <button className="btn sm" onClick={() => openNew(kind)}>Add {K.one}</button>}
          <select className="sort" id={`sort-${kind}`} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="creator">{creatorLabel}</option>
            {kind !== "quote" && <><option value="acquired">Date acquired</option><option value="year-new">Newest release</option><option value="year-old">Oldest release</option></>}
          </select>
        </div>
        <p className="dek">{dek}</p>
        {kind === "vinyl" && (() => {
          const priced = all.filter((r) => r.price !== undefined && r.price !== "" && !isNaN(Number(r.price)));
          if (!priced.length) return null;
          const total = priced.reduce((s, r) => s + Number(r.price), 0);
          return <p className="dek spent">Paid {money(total)} across {priced.length} of {all.length} records{priced.length > 1 ? ` · average ${money(total / priced.length)}` : ""}</p>;
        })()}
      </div>
      {filters && <div style={{ marginBottom: 30 }}>{filters}</div>}
      {!all.length ? <Empty kind={kind} />
        : !list.length ? <div className="empty"><h3>Nothing under that filter.</h3><p>Choose “All” to see everything.</p></div>
        : kind === "vinyl" ? <div className="records">{list.map((r) => <RecordCard key={r.id} item={r} />)}</div>
        : kind === "book" ? <><div className="shelf">{list.map((b) => <Spine key={b.id} item={b} />)}</div><Legend /></>
        : <div className="quotes">{list.map((x) => <QuoteCard key={x.id} item={x} />)}</div>}
    </section>
  );
}

export function Wishlist() {
  const { wishlist, openWish, q } = useStore();
  const [sort, setSort] = useState<Sort>("recent");
  if (q.trim()) return <SearchResults />;
  const list = sortItems(wishlist, sort);
  return (
    <section className="wrap page-head">
      <div className="sec-head" style={{ ["--k" as string]: KINDS.vinyl.color }}>
        <h2>Wishlist<span className="count">{wishlist.length}</span></h2>
        <div className="side">
          <button className="btn sm" onClick={() => openWish()}>Add to wishlist</button>
          <select className="sort" id="sort-wish" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="creator">Artist A–Z</option>
            <option value="year-new">Newest release</option><option value="year-old">Oldest release</option>
          </select>
        </div>
        <p className="dek">Records you&apos;re after. Open one and choose Move to collection when you get it.</p>
      </div>
      {list.length ? <div className="records">{list.map((r) => <RecordCard key={r.id} item={r} />)}</div>
        : <div className="empty"><h3>Nothing on the wishlist.</h3><p>Scan a barcode or search a catalog number, the same way you add a record, to keep track of what you&apos;re looking for.</p><button className="btn sm" onClick={() => openWish()}>Add to wishlist</button></div>}
    </section>
  );
}

function matches(it: Item, q: string, byId: (id: string) => Item | undefined) {
  const hay = Object.entries(it).filter(([k]) => !["id", "createdAt", "updatedAt", "coverPath", "coverUrl", "kind"].includes(k))
    .map(([k, v]) => (k === "tracks" && Array.isArray(v) ? v.map((t: { title: string }) => t.title).join(" ")
      : k === "journal" && Array.isArray(v) ? v.map((n: { text?: string }) => n.text ?? "").join(" ") : typeof v === "string" || typeof v === "number" ? String(v) : ""))
    .join(" ").toLowerCase();
  const book = it.bookId ? byId(str(it.bookId)) : undefined;
  return hay.includes(q) || (!!book && str(book.title).toLowerCase().includes(q));
}

function SearchResults() {
  const { q, ofKind, byId, kinds, wishlist } = useStore();
  const needle = q.trim().toLowerCase();
  const groups = ORDER.filter((k) => kinds.includes(k)).map((k) => [k, KINDS[k].tab, sortItems(ofKind(k).filter((i) => matches(i, needle, byId)), "recent")] as [Kind, string, Item[]]);
  groups.push(["vinyl", "Wishlist", sortItems(wishlist.filter((i) => matches(i, needle, byId)), "recent")]);
  const found = groups.filter(([, , l]) => l.length);
  const total = found.reduce((n, [, , l]) => n + l.length, 0);
  return (
    <section className="wrap page-head">
      <div className="sec-head"><h2 style={{ fontSize: "clamp(30px,5vw,60px)" }}>“{q.trim()}”<span className="count" style={{ color: "var(--muted)" }}>{total} found</span></h2></div>
      {!total ? <div className="empty"><h3>No matches.</h3><p>Search covers titles, artists, authors, labels, track names, notes, tags and quote text.</p></div>
        : found.map(([k, label, l]) => (
          <div key={label} style={{ marginTop: 34, ["--k" as string]: KINDS[k].color }}>
            <div className="mono" style={{ color: "var(--k)", marginBottom: 16 }}>{label} · {l.length}</div>
            {k === "vinyl" ? <div className="records">{l.map((r) => <RecordCard key={r.id} item={r} />)}</div>
              : k === "book" ? <div className="shelf">{l.map((b) => <Spine key={b.id} item={b} />)}</div>
              : <div className="quotes">{l.map((x) => <QuoteCard key={x.id} item={x} />)}</div>}
          </div>
        ))}
    </section>
  );
}
