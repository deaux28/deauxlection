"use client";
import { useEffect, useRef, useState } from "react";
import type { Kind } from "@/lib/types";
import { useStore } from "./store";
import { Sharing } from "./sharing";

type Incoming = { kind: Kind; data: Record<string, unknown>; created_at?: string };

/** Accepts this app's own export, or the earlier claude.ai prototype's documents (flat objects with a `kind` field). */
function parse(text: string): Incoming[] {
  const raw = JSON.parse(text);
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];
  return list.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const body = (o.data && typeof o.data === "object" && !("kind" in (o.data as object)) ? o.data : o.data ?? o) as Record<string, unknown>;
    const kind = (o.kind ?? body.kind) as Kind;
    if (!["vinyl", "book", "quote"].includes(kind)) return [];
    const { kind: _k, id: _i, example: _e, createdAt, updatedAt: _u, ...data } = body;
    return [{ kind, data, created_at: typeof (o.created_at ?? createdAt) === "string" ? String(o.created_at ?? createdAt) : undefined }];
  });
}

export function Settings() {
  const { items, importItems, toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [discogs, setDiscogs] = useState<{ discogs: string; username?: string; detail?: string } | null>(null);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setDiscogs).catch(() => setDiscogs({ discogs: "unreachable" })); }, []);

  const exportJson = () => {
    const rows = items.map(({ id: _id, coverUrl: _c, coverPath: _p, createdAt, updatedAt: _u, kind, ...data }) => ({ kind, data, created_at: createdAt }));
    const blob = new Blob([JSON.stringify({ app: "deauxlection", exported: new Date().toISOString(), items: rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deauxlection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setMsg("Importing…");
    try {
      const list = parse(await f.text());
      if (!list.length) { setMsg("That file has no records, books or quotes in it."); return; }
      const n = await importItems(list);
      setMsg(`Imported ${n} item${n === 1 ? "" : "s"}. Links between quotes and books from the old app need re-picking.`);
      toast("Import finished");
    } catch (e) {
      setMsg(`That file couldn't be imported: ${(e as Error).message}`);
    }
  };

  return (
    <section className="wrap page-head">
      <div className="sec-head"><h2>Settings</h2></div>
      <div className="settings">
        <Sharing />
        <div>
          <h3>Record lookups</h3>
          <p style={{ color: "var(--ink)" }}>
            {!discogs ? "Checking Discogs…"
              : discogs.discogs === "ok" ? <>✅ Discogs is connected{discogs.username ? <> as <b>{discogs.username}</b></> : null}. Lookups search Discogs first, then MusicBrainz.</>
              : discogs.discogs === "missing" ? <>⚠️ Discogs isn&apos;t connected. The site can&apos;t see a <code>DISCOGS_TOKEN</code>, so only MusicBrainz is searched. Add it in Vercel → Settings → Environment Variables (Production), then redeploy.</>
              : discogs.discogs === "rejected" ? <>⚠️ Discogs rejected the token. Generate a new <b>personal access token</b> at discogs.com/settings/developers (not the Consumer Key/Secret), update <code>DISCOGS_TOKEN</code> in Vercel, then redeploy.</>
              : <>⚠️ Discogs couldn&apos;t be reached{discogs.detail ? ` (${discogs.detail})` : ""}. Try again in a minute.</>}
          </p>
        </div>
        <div>
          <h3>Export</h3>
          <p>Download everything as a JSON file. Covers stay in your storage and aren&apos;t included.</p>
          <button className="btn" onClick={exportJson} disabled={!items.length}>Download {items.length} items</button>
        </div>
        <div>
          <h3>Import</h3>
          <p>Add items from a Deauxlection export, including one from the earlier claude.ai version.</p>
          <button className="btn" onClick={() => file.current?.click()}>Choose a JSON file</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          {msg && <p style={{ marginTop: 12, color: "var(--ink)" }}>{msg}</p>}
        </div>
        <div>
          <h3>Sign out</h3>
          <form action="/auth/signout" method="post"><button className="btn danger">Sign out</button></form>
        </div>
      </div>
    </section>
  );
}
