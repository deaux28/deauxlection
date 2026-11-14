import "server-only";
import type { Candidate, Details } from "../types";
import { getJSON, toYear } from "./http";

type OLBook = {
  title: string; subtitle?: string; authors?: { name: string }[]; publishers?: { name: string }[];
  publish_date?: string; number_of_pages?: number; cover?: { large?: string; medium?: string }; url?: string;
};
type GVolume = {
  id: string;
  volumeInfo: { title: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; pageCount?: number;
    imageLinks?: { thumbnail?: string }; industryIdentifiers?: { type: string; identifier: string }[]; infoLink?: string };
};

const https = (u?: string) => u?.replace(/^http:/, "https:");
const gCover = (u?: string) => https(u)?.replace("&edge=curl", "").replace(/zoom=\d/, "zoom=1");

function isbn13(isbn: string) {
  const c = isbn.replace(/[^0-9X]/gi, "").toUpperCase();
  if (c.length !== 10) return c;
  const core = "978" + c.slice(0, 9);
  const sum = core.split("").reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}

async function openLibrary(isbn: string): Promise<Details | null> {
  const key = `ISBN:${isbn}`;
  const data = await getJSON<Record<string, OLBook>>(`https://openlibrary.org/api/books?bibkeys=${key}&format=json&jscmd=data`);
  const b = data?.[key];
  if (!b) return null;
  const fields: Record<string, string | number> = { title: b.subtitle ? `${b.title}: ${b.subtitle}` : b.title, isbn };
  if (b.authors?.length) fields.author = b.authors.map((a) => a.name).join(", ");
  if (b.publishers?.[0]) fields.publisher = b.publishers[0].name;
  const y = toYear(b.publish_date); if (y) fields.year = y;
  if (b.number_of_pages) fields.pages = b.number_of_pages;
  return { fields, coverUrl: b.cover?.large ?? b.cover?.medium, sourceUrl: b.url };
}

async function googleBooks(q: string, max = 1) {
  const data = await getJSON<{ items?: GVolume[] }>(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}`);
  return data?.items ?? [];
}

function fromVolume(v: GVolume, isbn?: string): Details {
  const i = v.volumeInfo;
  const fields: Record<string, string | number> = { title: i.subtitle ? `${i.title}: ${i.subtitle}` : i.title };
  if (i.authors?.length) fields.author = i.authors.join(", ");
  if (i.publisher) fields.publisher = i.publisher;
  const y = toYear(i.publishedDate); if (y) fields.year = y;
  if (i.pageCount) fields.pages = i.pageCount;
  const id = isbn ?? i.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier;
  if (id) fields.isbn = id;
  return { fields, coverUrl: gCover(i.imageLinks?.thumbnail), sourceUrl: i.infoLink };
}

/** ISBN → one book. Open Library first, Google Books when Open Library has nothing or no cover. */
export async function bookByIsbn(raw: string): Promise<Details | null> {
  const isbn = isbn13(raw);
  const [ol, g] = await Promise.allSettled([openLibrary(isbn), googleBooks(`isbn:${isbn}`)]);
  const olv = ol.status === "fulfilled" ? ol.value : null;
  const gv = g.status === "fulfilled" && g.value[0] ? fromVolume(g.value[0], isbn) : null;
  if (!olv && !gv) return null;
  if (olv && gv) return { ...olv, fields: { ...gv.fields, ...olv.fields }, coverUrl: olv.coverUrl ?? gv.coverUrl };
  return olv ?? gv;
}

type OLDoc = { key: string; title: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number; publisher?: string[] };

export async function bookSearch(q: string): Promise<Candidate[]> {
  const data = await getJSON<{ docs: OLDoc[] }>(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher`);
  return (data?.docs ?? []).filter((d) => d.isbn?.length).map((d) => ({
    source: "openlibrary", kind: "book",
    id: d.isbn!.find((x) => x.length === 13) ?? d.isbn![0],
    title: d.title, creator: d.author_name?.join(", ") ?? "",
    year: d.first_publish_year, label: d.publisher?.[0],
    thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
  } satisfies Candidate));
}
