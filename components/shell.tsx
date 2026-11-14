"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KINDS, ORDER } from "@/lib/kinds";
import type { Kind } from "@/lib/types";
import { useStore } from "./store";

const ICONS: Record<Kind, React.ReactNode> = {
  vinyl: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /></svg>,
  book: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.6-.9 3 15.5-3.6.9z" fill="currentColor" /></svg>,
  quote: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18c0-6 2-10 6-11v3c-2 1-2.6 3-2.6 4H10v4zm9 0c0-6 2-10 6-11v3c-2 1-2.6 3-2.6 4H19v4z" fill="currentColor" /></svg>,
};
const KEY: Record<Kind, string> = { vinyl: "R", book: "B", quote: "Q" };

export function Shell({ children }: { children: React.ReactNode }) {
  const { q, setQ, ofKind, openNew, sheet, toastMsg, items } = useStore();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(""); }, [path, setQ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement | null)?.tagName ?? "");
      if (e.key === "Escape" && menu) { setMenu(false); return; }
      if (typing || sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); setTimeout(() => input.current?.focus(), 0); }
      else if (e.key === "n") { e.preventDefault(); setMenu(true); }
      else if (menu) {
        const k = (Object.keys(KEY) as Kind[]).find((x) => KEY[x].toLowerCase() === e.key.toLowerCase());
        if (k) { e.preventDefault(); setMenu(false); openNew(k); }
      }
    };
    const onClick = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, [menu, sheet, openNew]);

  const views: [string, string, number | null][] = [["/", "Overview", null], ...ORDER.map((k) => [KINDS[k].route, KINDS[k].tab, ofKind(k).length] as [string, string, number])];

  return (
    <>
      <header className="bar">
        <div className="wrap">
          <Link className="mark" href="/" aria-label="Deauxlection, overview"><span className="glyph" /><span>Deauxlection</span></Link>
          <nav className="views" aria-label="Collections">
            {views.map(([href, label, n]) => (
              <Link key={href} href={href} className="view-link" aria-current={path === href && !q ? "page" : undefined}>{label}{n !== null && <sup>{n}</sup>}</Link>
            ))}
          </nav>
          <div className="tools">
            <div className={`search${searchOpen ? " open" : ""}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
              <input ref={input} id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything" aria-label="Search your collection" autoComplete="off" />
              <kbd>/</kbd>
            </div>
            <button className="btn icon-only search-toggle" onClick={() => { setSearchOpen((s) => !s); setTimeout(() => input.current?.focus(), 0); }} aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
            </button>
            <div className="add-wrap" ref={wrap}>
              <button className="btn ink" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add
              </button>
              {menu && (
                <div className="menu" role="menu">
                  {ORDER.map((k) => (
                    <button key={k} role="menuitem" style={{ ["--k" as string]: KINDS[k].color }} onClick={() => { setMenu(false); openNew(k); }}>
                      <span className="sw">{ICONS[k]}</span>{KINDS[k].one[0].toUpperCase() + KINDS[k].one.slice(1)}<kbd>{KEY[k]}</kbd>
                    </button>
                  ))}
                  <hr />
                  <Link role="menuitem" href="/settings" onClick={() => setMenu(false)}><span className="sw plain">⚙</span>Import, export, sign out<span /></Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="wrap foot mono">
        <span>Deauxlection</span>
        <span>Record data from <a href="https://www.discogs.com" target="_blank" rel="noreferrer">Discogs</a> and <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> · Books from <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a></span>
        <span>{ORDER.map((k) => `${ofKind(k).length} ${KINDS[k].tab.toLowerCase()}`).join(" · ")}{items.length ? "" : ""}</span>
      </footer>
      <div className={`toast${toastMsg ? " show" : ""}`} role="status" aria-live="polite">{toastMsg}</div>
    </>
  );
}
