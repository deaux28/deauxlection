import "server-only";
import type { Candidate, Details, Track } from "../types";
import { getJSON } from "./http";

const BASE = "https://api.discogs.com";
const token = () => process.env.DISCOGS_TOKEN?.trim();
export const discogsEnabled = () => Boolean(token());
const auth = () => ({ Authorization: `Discogs token=${token()}` });
const clean = (name: string) => name.replace(/\s\(\d+\)$/, "").replace(/\*$/, "");

type SearchResult = {
  id: number; title: string; year?: string; label?: string[]; catno?: string; country?: string;
  format?: string[]; thumb?: string; cover_image?: string; type: string;
};

export async function discogsSearch(params: Record<string, string>): Promise<Candidate[]> {
  if (!discogsEnabled()) return [];
  const qs = new URLSearchParams({ type: "release", per_page: "12", ...params });
  const data = await getJSON<{ results: SearchResult[] }>(`${BASE}/database/search?${qs}`, auth());
  return (data?.results ?? []).map((r) => {
    const [artist, ...rest] = r.title.split(" - ");
    return {
      source: "discogs", id: String(r.id), kind: "vinyl",
      title: rest.length ? rest.join(" - ") : r.title,
      creator: rest.length ? clean(artist) : "",
      year: r.year ? Number(r.year) : undefined,
      label: r.label?.[0], catno: r.catno && r.catno !== "none" ? r.catno : undefined,
      country: r.country, format: r.format?.slice(0, 3).join(", "),
      thumb: r.cover_image && !r.cover_image.endsWith("spacer.gif") ? r.cover_image : r.thumb || undefined,
    } satisfies Candidate;
  });
}

type RawTrack = { position: string; title: string; duration?: string; type_?: string; sub_tracks?: RawTrack[] };
type Release = {
  id: number; title: string; year?: number; country?: string; uri?: string; genres?: string[]; styles?: string[];
  artists?: { name: string; join?: string }[];
  labels?: { name: string; catno?: string }[];
  formats?: { name: string; qty?: string; descriptions?: string[]; text?: string }[];
  tracklist?: RawTrack[];
  images?: { type: string; uri: string }[];
  identifiers?: { type: string; value: string }[];
};

function flattenTracks(list: RawTrack[] = []): Track[] {
  const out: Track[] = [];
  for (const t of list) {
    if (t.type_ === "heading") continue;
    if (t.type_ === "index" && t.sub_tracks?.length) { out.push(...flattenTracks(t.sub_tracks)); continue; }
    out.push({ position: t.position || "", title: t.title, duration: t.duration || undefined });
  }
  return out;
}

function mapFormat(f?: Release["formats"]) {
  const vinyl = f?.find((x) => x.name === "Vinyl");
  if (!vinyl) return {};
  const d = vinyl.descriptions ?? [];
  const qty = Number(vinyl.qty || 1);
  const format = d.includes("LP") ? (qty > 1 ? `${qty}×LP` : "LP") : d.includes("EP") ? "EP" : d.includes("Single") ? "Single" : undefined;
  const size = d.find((x) => /^(12|10|7)"$/.test(x));
  const speed = d.includes("33 ⅓ RPM") ? "33⅓ RPM" : d.includes("45 RPM") ? "45 RPM" : d.includes("78 RPM") ? "78 RPM" : undefined;
  const pressing = [d.includes("Reissue") && "Reissue", d.includes("Repress") && "Repress", d.includes("Remastered") && "Remastered", vinyl.text].filter(Boolean).join(", ");
  return { format, size, speed, pressing: pressing || undefined };
}

export async function discogsRelease(id: string): Promise<Details | null> {
  if (!discogsEnabled() || !/^\d+$/.test(id)) return null;
  const r = await getJSON<Release>(`${BASE}/releases/${id}`, auth());
  if (!r) return null;
  const artist = (r.artists ?? []).map((a, i, all) => clean(a.name) + (i < all.length - 1 ? ` ${a.join || "&"} ` : "")).join("").replace(/\s+,/g, ",");
  const barcode = r.identifiers?.find((x) => x.type === "Barcode")?.value?.replace(/\s/g, "");
  const fields: Record<string, string | number> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") fields[k] = v as string | number; };
  set("title", r.title); set("artist", artist); set("year", r.year || undefined); set("country", r.country);
  set("label", r.labels?.[0]?.name ? clean(r.labels[0].name) : undefined);
  set("catno", r.labels?.[0]?.catno !== "none" ? r.labels?.[0]?.catno : undefined);
  set("genre", r.styles?.[0] || r.genres?.[0]); set("barcode", barcode);
  Object.entries(mapFormat(r.formats)).forEach(([k, v]) => set(k, v));
  fields.discogsId = String(r.id);
  const img = r.images?.find((i) => i.type === "primary") ?? r.images?.[0];
  return { fields, tracks: flattenTracks(r.tracklist), coverUrl: img?.uri, sourceUrl: r.uri };
}
