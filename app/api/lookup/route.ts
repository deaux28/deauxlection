import { NextResponse, type NextRequest } from "next/server";
import { digitsOnly, isIsbn } from "@/lib/lookup/barcode";
import { discogsEnabled, discogsSearch } from "@/lib/lookup/discogs";
import { mbSearch } from "@/lib/lookup/musicbrainz";
import { bookByIsbn, bookSearch } from "@/lib/lookup/books";
import type { Candidate, Details } from "@/lib/types";

type Payload = { kind: "vinyl" | "book"; candidates: Candidate[]; details?: Details; notes: string[] };

async function settle<T>(p: Promise<T[]>, notes: string[], label: string): Promise<T[]> {
  try { return await p; } catch (e) { notes.push(`${label} didn't answer (${(e as Error).message}).`); return []; }
}

function dedupe(list: Candidate[]) {
  const seen = new Set<string>();
  return list.filter((c) => { const k = `${c.source}:${c.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code")?.trim();
  const q = sp.get("q")?.trim();
  const kind = sp.get("kind") === "book" ? "book" : "vinyl";
  const notes: string[] = [];
  if (!discogsEnabled() && kind === "vinyl") notes.push("Discogs isn't connected, so only MusicBrainz was searched.");

  if (code) {
    const c = digitsOnly(code);
    if (isIsbn(c)) {
      const details = await bookByIsbn(c).catch(() => null);
      return NextResponse.json<Payload>({ kind: "book", candidates: [], details: details ?? undefined, notes: details ? [] : ["No book found for that ISBN."] });
    }
    const [d, m] = await Promise.all([
      settle(discogsSearch({ barcode: c }), notes, "Discogs"),
      settle(mbSearch({ barcode: c }), notes, "MusicBrainz"),
    ]);
    return NextResponse.json<Payload>({ kind: "vinyl", candidates: dedupe([...d, ...m]), notes });
  }

  if (!q) return NextResponse.json({ error: "Give a barcode or a search." }, { status: 400 });

  if (kind === "book") {
    if (isIsbn(q)) {
      const details = await bookByIsbn(q).catch(() => null);
      return NextResponse.json<Payload>({ kind, candidates: [], details: details ?? undefined, notes: details ? [] : ["No book found for that ISBN."] });
    }
    const list = await settle(bookSearch(q), notes, "Open Library");
    return NextResponse.json<Payload>({ kind, candidates: list, notes });
  }

  const hasDigits = /\d/.test(q) && q.length <= 20;
  const [d1, d2, m1, m2] = await Promise.all([
    settle(discogsSearch({ q }), notes, "Discogs"),
    hasDigits ? settle(discogsSearch({ catno: q }), notes, "Discogs") : Promise.resolve([]),
    settle(mbSearch({ q }), notes, "MusicBrainz"),
    hasDigits ? settle(mbSearch({ catno: q }), notes, "MusicBrainz") : Promise.resolve([]),
  ]);
  return NextResponse.json<Payload>({ kind, candidates: dedupe([...d2, ...d1, ...m2, ...m1]), notes: [...new Set(notes)] });
}
