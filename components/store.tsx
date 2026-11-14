"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { COVERS_BUCKET } from "@/lib/supabase/env";
import { KINDS, ORDER } from "@/lib/kinds";
import type { Item, ItemRow, Kind, Track } from "@/lib/types";

export type SheetState =
  | { mode: "view"; id: string }
  | { mode: "edit"; id?: string; kind: Kind; prefill?: Record<string, unknown> }
  | null;

export type CoverSource = { url: string } | { file: File } | null;

type Store = {
  items: Item[];
  cats: Record<string, string>;
  byId: (id: string) => Item | undefined;
  ofKind: (k: Kind) => Item[];
  q: string;
  setQ: (q: string) => void;
  sheet: SheetState;
  openItem: (id: string) => void;
  openNew: (kind: Kind, prefill?: Record<string, unknown>) => void;
  editItem: (id: string) => void;
  closeSheet: () => void;
  save: (args: { id?: string; kind: Kind; fields: Record<string, unknown>; tracks?: Track[]; cover?: CoverSource }) => Promise<string>;
  patch: (id: string, fields: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  importItems: (rows: { kind: Kind; data: Record<string, unknown>; created_at?: string }[]) => Promise<number>;
  toast: (msg: string) => void;
  toastMsg: string | null;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
};

function toItem(row: ItemRow): Item {
  const sb = supabaseBrowser();
  const { tracks, ...data } = row.data as { tracks?: Track[] } & Record<string, unknown>;
  return {
    ...data,
    id: row.id, kind: row.kind, createdAt: row.created_at, updatedAt: row.updated_at,
    coverPath: row.cover_path,
    coverUrl: row.cover_path ? sb.storage.from(COVERS_BUCKET).getPublicUrl(row.cover_path).data.publicUrl : null,
    tracks: Array.isArray(tracks) ? tracks : undefined,
  };
}

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export function StoreProvider({ initial, children }: { initial: ItemRow[]; children: React.ReactNode }) {
  const [rows, setRows] = useState<ItemRow[]>(initial);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => rows.map(toItem), [rows]);
  const cats = useMemo(() => {
    const map: Record<string, string> = {};
    for (const k of ORDER) items.filter((i) => i.kind === k).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((it, n) => { map[it.id] = `${KINDS[k].prefix}-${String(n + 1).padStart(3, "0")}`; });
    return map;
  }, [items]);

  const toast = useCallback((m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const upsertRow = (row: ItemRow) => setRows((rs) => (rs.some((r) => r.id === row.id) ? rs.map((r) => (r.id === row.id ? row : r)) : [row, ...rs]));

  const applyCover = useCallback(async (id: string, cover: CoverSource) => {
    if (!cover) return;
    const sb = supabaseBrowser();
    if ("url" in cover) {
      const res = await fetch("/api/covers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, url: cover.url }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "The cover didn't copy.");
    } else {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Sign in again to upload.");
      const ext = (cover.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${id}-${Date.now()}.${ext}`;
      const up = await sb.storage.from(COVERS_BUCKET).upload(path, cover.file, { contentType: cover.file.type || "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      const old = rows.find((r) => r.id === id)?.cover_path;
      const { error } = await sb.from("items").update({ cover_path: path }).eq("id", id);
      if (error) throw new Error(error.message);
      if (old) await sb.storage.from(COVERS_BUCKET).remove([old]);
    }
    const { data } = await sb.from("items").select("*").eq("id", id).single();
    if (data) upsertRow(data as ItemRow);
  }, [rows]);

  const save: Store["save"] = useCallback(async ({ id, kind, fields, tracks, cover }) => {
    const sb = supabaseBrowser();
    const data = clean({ ...fields, tracks: tracks?.length ? tracks : undefined });
    const now = new Date().toISOString();
    const res = id
      ? await sb.from("items").update({ data, updated_at: now }).eq("id", id).select("*").single()
      : await sb.from("items").insert({ kind, data }).select("*").single();
    if (res.error) throw new Error(res.error.message);
    const row = res.data as ItemRow;
    upsertRow(row);
    if (cover) {
      try { await applyCover(row.id, cover); }
      catch (e) { toast(`Saved, but the cover didn't: ${(e as Error).message}`); }
    }
    return row.id;
  }, [applyCover, toast]);

  const patch: Store["patch"] = useCallback(async (id, fields) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const data = clean({ ...row.data, ...fields });
    const optimistic = { ...row, data };
    upsertRow(optimistic);
    const { error } = await supabaseBrowser().from("items").update({ data, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { upsertRow(row); toast("That change didn't save. Check your connection."); }
  }, [rows, toast]);

  const remove: Store["remove"] = useCallback(async (id) => {
    const sb = supabaseBrowser();
    const row = rows.find((r) => r.id === id);
    const { error } = await sb.from("items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (row?.cover_path) await sb.storage.from(COVERS_BUCKET).remove([row.cover_path]);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, [rows]);

  const importItems: Store["importItems"] = useCallback(async (list) => {
    const sb = supabaseBrowser();
    const valid = list.filter((r) => ["vinyl", "book", "quote"].includes(r.kind) && r.data && typeof r.data === "object");
    if (!valid.length) return 0;
    const { data, error } = await sb.from("items").insert(valid.map((r) => ({ kind: r.kind, data: r.data, ...(r.created_at ? { created_at: r.created_at } : {}) }))).select("*");
    if (error) throw new Error(error.message);
    setRows((rs) => [...(data as ItemRow[]), ...rs]);
    return data?.length ?? 0;
  }, []);

  const value: Store = {
    items, cats, q, setQ, sheet, toast, toastMsg,
    byId: (id) => items.find((i) => i.id === id),
    ofKind: (k) => items.filter((i) => i.kind === k),
    openItem: (id) => setSheet({ mode: "view", id }),
    openNew: (kind, prefill) => setSheet({ mode: "edit", kind, prefill }),
    editItem: (id) => { const it = items.find((i) => i.id === id); if (it) setSheet({ mode: "edit", id, kind: it.kind }); },
    closeSheet: () => setSheet(null),
    save, patch, remove, importItems,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
