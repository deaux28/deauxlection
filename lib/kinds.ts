import type { Kind } from "./types";

export const GRADES = ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"] as const;
export const GRADE_NAMES: Record<string, string> = {
  M: "Mint", NM: "Near Mint", "VG+": "Very Good Plus", VG: "Very Good", "G+": "Good Plus", G: "Good", F: "Fair", P: "Poor",
};

export type Field = {
  k: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "bookref";
  options?: readonly string[];
  labels?: Record<string, string>;
  empty?: string;
  req?: boolean;
  half?: boolean;
  big?: boolean;
  placeholder?: string;
  hint?: string;
};

export type KindDef = { route: string; tab: string; one: string; prefix: string; color: string; fields: Field[] };

export const KINDS: Record<Kind, KindDef> = {
  vinyl: {
    route: "/records", tab: "Records", one: "record", prefix: "VNL", color: "var(--c-vinyl)",
    fields: [
      { k: "title", label: "Album", req: true, placeholder: "Kind of Blue" },
      { k: "artist", label: "Artist", req: true, placeholder: "Miles Davis" },
      { k: "year", label: "Year", type: "number", half: true, placeholder: "1959" },
      { k: "label", label: "Label", half: true, placeholder: "Columbia" },
      { k: "catno", label: "Catalog no.", half: true, placeholder: "CS 8163" },
      { k: "barcode", label: "Barcode", half: true, placeholder: "UPC or EAN" },
      { k: "country", label: "Country", half: true, placeholder: "US" },
      { k: "genre", label: "Genre", half: true, placeholder: "Jazz" },
      { k: "format", label: "Format", type: "select", options: ["LP", "2×LP", "3×LP", "EP", "Single", "Box set"], half: true },
      { k: "size", label: "Size", type: "select", options: ['12"', '10"', '7"'], half: true },
      { k: "speed", label: "Speed", type: "select", options: ["33⅓ RPM", "45 RPM", "78 RPM"], half: true },
      { k: "pressing", label: "Pressing", half: true, placeholder: "2015 reissue, 180g" },
      { k: "media", label: "Record condition", type: "select", options: GRADES, labels: GRADE_NAMES, half: true, empty: "Not graded" },
      { k: "sleeve", label: "Sleeve condition", type: "select", options: GRADES, labels: GRADE_NAMES, half: true, empty: "Not graded" },
      { k: "notes", label: "Notes", type: "textarea", placeholder: "Where you found it, favorite tracks, signatures…" },
    ],
  },
  book: {
    route: "/books", tab: "Books", one: "book", prefix: "BK", color: "var(--c-book)",
    fields: [
      { k: "title", label: "Title", req: true, placeholder: "Beloved" },
      { k: "author", label: "Author", req: true, placeholder: "Toni Morrison" },
      { k: "year", label: "Year published", type: "number", half: true, placeholder: "1987" },
      { k: "publisher", label: "Publisher", half: true, placeholder: "Knopf" },
      { k: "format", label: "Format", type: "select", options: ["Hardcover", "Paperback", "Ebook", "Audiobook"], half: true },
      { k: "status", label: "Status", type: "select", options: ["To read", "Reading", "Read"], half: true },
      { k: "isbn", label: "ISBN", half: true, placeholder: "978-1-4000-3341-6" },
      { k: "pages", label: "Pages", type: "number", half: true, placeholder: "324", hint: "Sets the width of its spine." },
      { k: "notes", label: "Notes", type: "textarea", placeholder: "Who lent it to you, what stayed with you…" },
    ],
  },
  quote: {
    route: "/quotes", tab: "Quotes", one: "quote", prefix: "QT", color: "var(--c-quote)",
    fields: [
      { k: "text", label: "Quote", type: "textarea", big: true, req: true, placeholder: "Type or paste the line…" },
      { k: "by", label: "Who said it", req: true, half: true, placeholder: "Kurt Vonnegut" },
      { k: "bookId", label: "From a book on your shelf", type: "bookref", half: true },
      { k: "source", label: "Or another source", half: true, placeholder: "A film, a song, a friend…", hint: "Used when no shelf book is picked." },
      { k: "page", label: "Page", half: true, placeholder: "34" },
      { k: "tags", label: "Tags", placeholder: "time, war, humor", hint: "Separate with commas." },
    ],
  },
};

export const ORDER: Kind[] = ["vinyl", "book", "quote"];

export const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
export const creatorOf = (it: { kind: Kind; [k: string]: unknown }) =>
  str(it.kind === "vinyl" ? it.artist : it.kind === "book" ? it.author : it.by);
export const titleOf = (it: { kind: Kind; [k: string]: unknown }) => str(it.kind === "quote" ? it.text : it.title);
export const tagsOf = (it: { [k: string]: unknown }) =>
  str(it.tags).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
