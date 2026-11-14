import "server-only";
import type { Candidate, Details, Track } from "../types";
import { getJSON, toYear } from "./http";

const BASE = "https://musicbrainz.org/ws/2";
const CAA = "https://coverartarchive.org";

type Credit = { name: string; joinphrase?: string };
type MBRelease = {
  id: string; title: string; date?: string; country?: string; barcode?: string;
  "artist-credit"?: Credit[];
  "label-info"?: { "catalog-number"?: string; label?: { name: string } }[];
  media?: { format?: string; "track-count"?: number; position?: number; tracks?: { number: string; title: string; length?: number }[] }[];
  "release-group"?: { "primary-type"?: string; genres?: { name: string; count: number }[] };
  "cover-art-archive"?: { front?: boolean };
};

const credit = (c?: Credit[]) => (c ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("");
const esc = (s: string) => s.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
const fmtLen = (ms?: number) => {
  if (!ms) return undefined;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function formatOf(media: MBRelease["media"]) {
  if (!media?.length) return undefined;
  const names = media.map((m) => m.format || "").filter(Boolean);
  const first = names[0];
  return names.length > 1 && names.every((x) => x === first) ? `${names.length}×${first}` : names.join(" + ");
}

export async function mbSearch(opts: { barcode?: string; catno?: string; q?: string }): Promise<Candidate[]> {
  const query = opts.barcode ? `barcode:${opts.barcode}`
    : opts.catno ? `catno:"${esc(opts.catno)}"`
    : opts.q ? esc(opts.q) : "";
  if (!query) return [];
  const data = await getJSON<{ releases: MBRelease[] }>(`${BASE}/release?query=${encodeURIComponent(query)}&limit=12&fmt=json`);
  return (data?.releases ?? []).map((r) => ({
    source: "musicbrainz", id: r.id, kind: "vinyl",
    title: r.title, creator: credit(r["artist-credit"]),
    year: toYear(r.date), country: r.country,
    label: r["label-info"]?.[0]?.label?.name, catno: r["label-info"]?.[0]?.["catalog-number"],
    format: formatOf(r.media),
    thumb: `${CAA}/release/${r.id}/front-250`,
  } satisfies Candidate));
}

export async function mbRelease(id: string): Promise<Details | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await getJSON<MBRelease>(`${BASE}/release/${id}?inc=recordings+artist-credits+labels+release-groups+genres&fmt=json`);
  if (!r) return null;
  const fields: Record<string, string | number> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") fields[k] = v as string | number; };
  set("title", r.title); set("artist", credit(r["artist-credit"])); set("year", toYear(r.date)); set("country", r.country);
  set("label", r["label-info"]?.[0]?.label?.name); set("catno", r["label-info"]?.[0]?.["catalog-number"]); set("barcode", r.barcode);
  const genre = r["release-group"]?.genres?.sort((a, b) => b.count - a.count)[0]?.name;
  if (genre) set("genre", genre.replace(/\b\w/g, (c) => c.toUpperCase()));
  const vinyl = (r.media ?? []).filter((m) => /vinyl/i.test(m.format || ""));
  if (vinyl.length) {
    const sizeMatch = vinyl[0].format?.match(/(12|10|7)"/);
    if (sizeMatch) set("size", `${sizeMatch[1]}"`);
    set("format", vinyl.length > 1 ? `${vinyl.length}×LP` : "LP");
  }
  fields.mbid = r.id;
  const multi = (r.media?.length ?? 0) > 1;
  const tracks: Track[] = (r.media ?? []).flatMap((m) => (m.tracks ?? []).map((t) => ({
    position: /^[A-Z]/.test(t.number) || !multi ? t.number : `${m.position}-${t.number}`,
    title: t.title, duration: fmtLen(t.length),
  })));
  return {
    fields, tracks,
    coverUrl: r["cover-art-archive"]?.front ? `${CAA}/release/${r.id}/front-1200` : undefined,
    sourceUrl: `https://musicbrainz.org/release/${r.id}`,
  };
}
