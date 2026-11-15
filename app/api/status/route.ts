import { NextResponse } from "next/server";
import { USER_AGENT } from "@/lib/lookup/http";

/** Reports whether the Discogs token is present and accepted, without revealing it. */
export async function GET() {
  const token = process.env.DISCOGS_TOKEN?.trim();
  if (!token) return NextResponse.json({ discogs: "missing" });
  try {
    const res = await fetch("https://api.discogs.com/oauth/identity", {
      headers: { Authorization: `Discogs token=${token}`, "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) return NextResponse.json({ discogs: "rejected" });
    if (!res.ok) return NextResponse.json({ discogs: "unreachable", detail: `Discogs answered ${res.status}` });
    const body = (await res.json()) as { username?: string };
    return NextResponse.json({ discogs: "ok", username: body.username });
  } catch (e) {
    return NextResponse.json({ discogs: "unreachable", detail: (e as Error).message });
  }
}
