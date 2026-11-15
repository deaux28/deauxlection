"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { KINDS } from "@/lib/kinds";
import type { Kind } from "@/lib/types";
import { useStore } from "./store";

type Share = { id: string; token: string; title: string; kinds: Kind[]; show_prices: boolean; created_at: string };

const SHAREABLE: Kind[] = ["vinyl", "book", "quote"];

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function Sharing() {
  const { toast } = useStore();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [title, setTitle] = useState("My collection");
  const [kinds, setKinds] = useState<Kind[]>(["vinyl", "book"]);
  const [prices, setPrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const { data, error } = await supabaseBrowser().from("shares").select("*").order("created_at", { ascending: false });
      if (error) setLoadErr(/relation .*shares.* does not exist|schema cache/i.test(error.message)
        ? "Sharing isn't set up in your database yet. Run supabase/migrations/002_shares.sql in the Supabase SQL editor, then reload."
        : error.message);
      else setShares(data as Share[]);
    })();
  }, []);

  const url = (s: Share) => `${origin}/s/${s.token}`;

  const create = async () => {
    if (!kinds.length) return;
    setBusy(true);
    const { data, error } = await supabaseBrowser().from("shares")
      .insert({ token: newToken(), title: title.trim() || "My collection", kinds, show_prices: prices }).select("*").single();
    setBusy(false);
    if (error) { toast(`The link wasn't created: ${error.message}`); return; }
    setShares((s) => [data as Share, ...(s ?? [])]);
    copy(data as Share);
  };

  const copy = async (s: Share) => {
    try { await navigator.clipboard.writeText(url(s)); toast("Link copied"); }
    catch { toast("Copy didn't work. Select the link and copy it."); }
  };

  const remove = async (s: Share) => {
    if (armed !== s.id) { setArmed(s.id); return; }
    const { error } = await supabaseBrowser().from("shares").delete().eq("id", s.id);
    if (error) { toast(`That link is still on: ${error.message}`); return; }
    setShares((all) => (all ?? []).filter((x) => x.id !== s.id));
    setArmed(null);
    toast("Link switched off");
  };

  return (
    <div className="sharing">
      <h3>Share your collection</h3>
      <p>Anyone with a link can browse what it includes. They can&apos;t change anything. Book pages include your notes and reading journal.</p>
      {loadErr ? <p className="form-err" style={{ gridColumn: "auto" }}>{loadErr}</p> : (
        <>
          <div className="share-new">
            <div className="field" style={{ gridColumn: "auto" }}>
              <label className="mono" htmlFor="share-title">Title visitors see</label>
              <input id="share-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dorian's records and books" maxLength={80} />
            </div>
            <fieldset>
              <legend className="mono">Include</legend>
              {SHAREABLE.map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((ks) => (e.target.checked ? [...ks, k] : ks.filter((x) => x !== k)))} />
                  {KINDS[k].tab}
                </label>
              ))}
              <label className="check">
                <input type="checkbox" checked={prices} onChange={(e) => setPrices(e.target.checked)} disabled={!kinds.includes("vinyl")} />
                Prices paid
              </label>
            </fieldset>
            <div><button className="btn ink" onClick={create} disabled={busy || !kinds.length}>{busy ? "Creating…" : "Create and copy link"}</button></div>
          </div>

          {shares === null ? <p>Loading your links…</p> : shares.length === 0 ? null : (
            <ul className="share-list">
              {shares.map((s) => (
                <li key={s.id}>
                  <div className="top">
                    <b>{s.title}</b>
                    <span className="mono">{s.kinds.map((k) => KINDS[k].tab).join(" · ")}{s.show_prices ? " · prices" : ""}</span>
                  </div>
                  <input className="link" readOnly value={url(s)} onFocus={(e) => e.target.select()} aria-label={`Link for ${s.title}`} />
                  <div className="acts2">
                    <button className="btn sm" onClick={() => copy(s)}>Copy link</button>
                    <a className="btn sm" href={url(s)} target="_blank" rel="noreferrer">Open</a>
                    <button className={`btn sm danger${armed === s.id ? " armed" : ""}`} onClick={() => remove(s)} onBlur={() => setArmed(null)}>
                      {armed === s.id ? "Press again to switch off" : "Switch off"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
