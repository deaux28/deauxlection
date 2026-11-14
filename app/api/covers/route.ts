import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { COVERS_BUCKET } from "@/lib/supabase/env";
import { USER_AGENT } from "@/lib/lookup/http";

/** Copies a cover image from a lookup source into the owner's storage, so covers never depend on outside links. */

const ALLOWED = ["discogs.com", "coverartarchive.org", "archive.org", "openlibrary.org", "books.google.com", "googleusercontent.com", "googleapis.com"];
const MAX_BYTES = 12 * 1024 * 1024;
const okHost = (u: URL) => u.protocol === "https:" && ALLOWED.some((h) => u.hostname === h || u.hostname.endsWith("." + h));

async function fetchImage(start: string) {
  let url = new URL(start);
  for (let hop = 0; hop < 5; hop++) {
    if (!okHost(url)) throw new Error(`Covers can't be copied from ${url.hostname}.`);
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, url); continue; }
    if (!res.ok) throw new Error(`The image host answered ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp|gif)/.test(type)) throw new Error("That link isn't an image.");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("That image is larger than 12 MB.");
    return { buf, type: type.split(";")[0] };
  }
  throw new Error("Too many redirects.");
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { itemId, url } = (await req.json().catch(() => ({}))) as { itemId?: string; url?: string };
  if (!itemId || !url) return NextResponse.json({ error: "Missing item or image link." }, { status: 400 });

  const { data: item } = await supabase.from("items").select("id, cover_path").eq("id", itemId).single();
  if (!item) return NextResponse.json({ error: "That item doesn't exist." }, { status: 404 });

  try {
    const { buf, type } = await fetchImage(url);
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
    const path = `${user.id}/${itemId}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from(COVERS_BUCKET).upload(path, buf, { contentType: type, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { error } = await supabase.from("items").update({ cover_path: path, updated_at: new Date().toISOString() }).eq("id", itemId);
    if (error) throw new Error(error.message);
    if (item.cover_path) await supabase.storage.from(COVERS_BUCKET).remove([item.cover_path]);
    return NextResponse.json({ coverPath: path });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
