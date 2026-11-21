import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { ItemRow, Kind } from "@/lib/types";

export type Shared = { title: string; kinds: Kind[]; items: ItemRow[] };

/** Loads a share link's collection as an anonymous visitor. Returns null for unknown or switched-off links. */
export const loadShare = cache(async (token: string): Promise<Shared | null> => {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("shared_collection", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const shared = data as Shared;
  // Wishlist records stay private. Migration 003 also drops them in the database; this covers projects that haven't run it.
  return { ...shared, items: shared.items.filter((i) => i.data?.wish !== true) };
});
