import { NextResponse, type NextRequest } from "next/server";
import { discogsRelease } from "@/lib/lookup/discogs";
import { mbRelease } from "@/lib/lookup/musicbrainz";
import { bookByIsbn } from "@/lib/lookup/books";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    const details =
      source === "discogs" ? await discogsRelease(id)
      : source === "musicbrainz" ? await mbRelease(id)
      : source === "openlibrary" || source === "googlebooks" ? await bookByIsbn(id)
      : null;
    if (!details) return NextResponse.json({ error: "That release couldn't be found." }, { status: 404 });
    return NextResponse.json(details);
  } catch (e) {
    return NextResponse.json({ error: `The lookup failed: ${(e as Error).message}` }, { status: 502 });
  }
}
