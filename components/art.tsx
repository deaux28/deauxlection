"use client";
import { cloth, sleeveArt } from "@/lib/art";
import { GRADE_NAMES, str, tagsOf } from "@/lib/kinds";
import type { Item, Track } from "@/lib/types";
import { useStore } from "./store";

export function Cover({ item, cat }: { item: Item; cat?: string }) {
  if (item.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className="cover"><img src={item.coverUrl} alt="" loading="lazy" /></div>;
  }
  const art = sleeveArt(str(item.title), str(item.artist));
  return (
    <div className="cover" style={{ color: art.fg }}>
      <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: art.svg }} />
      {cat && <span className="cat">{cat}</span>}
    </div>
  );
}

export function Disc({ item }: { item: Item }) {
  const art = sleeveArt(str(item.title), str(item.artist));
  if (item.coverUrl) {
    return <div className="disc"><div className="grooves photo" style={{ ["--label-img" as string]: `url("${item.coverUrl}")` }} /></div>;
  }
  return <div className="disc"><div className="grooves" style={{ ["--label" as string]: art.accent }} /></div>;
}

export function RecordCard({ item }: { item: Item }) {
  const { cats, openItem } = useStore();
  const media = str(item.media), sleeve = str(item.sleeve);
  return (
    <button className="rec" onClick={() => openItem(item.id)}>
      <div className="art"><Cover item={item} /><Disc item={item} /></div>
      <div>
        <div className="t">{str(item.title)}</div>
        <div className="a">{str(item.artist)}{item.year ? ` · ${item.year}` : ""}</div>
      </div>
      <div className="row">
        <span className="mono">{cats[item.id]}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {item.tracks?.length ? <span className="mono" title="Track list saved">{item.tracks.length} trk</span> : null}
          {media && <span className="pill" title={`Record ${GRADE_NAMES[media]}${sleeve ? `, sleeve ${GRADE_NAMES[sleeve]}` : ""}`}>{media}{sleeve ? `/${sleeve}` : ""}</span>}
        </span>
      </div>
    </button>
  );
}

export function Spine({ item }: { item: Item }) {
  const { openItem } = useStore();
  const c = cloth(str(item.title), str(item.author));
  const pages = Number(item.pages) || 0;
  const w = pages ? Math.round(Math.min(58, Math.max(24, 18 + pages / 14))) : 26 + (c.h % 18);
  const h = 150 + ((c.h >>> 5) % 56);
  const last = str(item.author).trim().split(/\s+/).pop() ?? "";
  const st = str(item.status);
  const style = { ["--w" as string]: `${w}px`, ["--h" as string]: `${h}px`, ["--cloth" as string]: c.bg, ["--foil" as string]: c.foil };
  return (
    <div className="slot">
      <button className={`spine${st === "To read" ? " unread" : ""}`} style={style} onClick={() => openItem(item.id)}
        title={`${str(item.title)} — ${str(item.author)}${st ? ` · ${st}` : ""}`} aria-label={`${str(item.title)} by ${str(item.author)}${st ? `, ${st}` : ""}`}>
        {st === "Reading" && <span className="ribbon" />}
        <span className="bands" />
        <span className="ttl">{str(item.title)}</span>
        <span className="au">{last.slice(0, Math.max(3, Math.floor(w / 6)))}</span>
      </button>
    </div>
  );
}

export function BookCover({ item }: { item: Item }) {
  const c = cloth(str(item.title), str(item.author));
  if (item.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className="bookcover photo"><img src={item.coverUrl} alt="" /></div>;
  }
  return (
    <div className="bookcover" style={{ ["--cloth" as string]: c.bg, ["--foil" as string]: c.foil }}>
      <span className="ba">{str(item.author)}</span>
      <span className="bt">{str(item.title)}</span>
      <span className="orn">{item.year ? str(item.year) : "❦"}</span>
    </div>
  );
}

export function QuoteCard({ item }: { item: Item }) {
  const { byId, openItem } = useStore();
  const book = item.bookId ? byId(str(item.bookId)) : undefined;
  const src = book ? str(book.title) : str(item.source);
  const len = str(item.text).length;
  const size = len < 40 ? 34 : len < 90 ? 28 : len < 180 ? 24 : 21;
  const tags = tagsOf(item);
  return (
    <button className="q" style={{ ["--qs" as string]: `${size}px` }} onClick={() => openItem(item.id)}>
      <blockquote><span className="open">“</span>{str(item.text)}</blockquote>
      <div className="attr">
        <span className="who">{str(item.by)}</span>
        {src && <cite>{src}</cite>}
        {item.page ? <span className="mono">p. {str(item.page)}</span> : null}
      </div>
      {tags.length > 0 && <div className="tags">{tags.map((t) => `#${t}`).join(" ")}</div>}
    </button>
  );
}

/** "9:22" → seconds */
const secs = (d?: string) => {
  if (!d) return 0;
  const p = d.split(":").map(Number);
  return p.some(isNaN) ? 0 : p.reduce((s, x) => s * 60 + x, 0);
};
const fmt = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");

export function Tracklist({ tracks }: { tracks: Track[] }) {
  const groups: { side: string; list: Track[] }[] = [];
  for (const t of tracks) {
    const m = t.position.match(/^([A-Z]{1,2})\d*$/i) ?? t.position.match(/^(\d+)-\d+$/);
    const side = m ? m[1].toUpperCase() : "";
    const g = groups[groups.length - 1];
    if (g && g.side === side) g.list.push(t); else groups.push({ side, list: [t] });
  }
  return (
    <div className="tracks">
      {groups.map((g, i) => {
        const total = g.list.reduce((s, t) => s + secs(t.duration), 0);
        const label = !g.side ? "Tracks" : /^\d+$/.test(g.side) ? `Disc ${g.side}` : `Side ${g.side}`;
        return (
          <div key={i}>
            <div className="side-h"><b>{label}</b><span className="mono">{g.list.length} tracks{total ? ` · ${fmt(total)}` : ""}</span></div>
            <ol className="tl">
              {g.list.map((t, j) => (
                <li key={j}><span className="pos">{t.position}</span><span className="tt">{t.title}</span><span className="du">{t.duration}</span></li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
