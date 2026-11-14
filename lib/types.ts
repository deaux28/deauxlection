export type Kind = "vinyl" | "book" | "quote";

export type Track = { position: string; title: string; duration?: string };

/** Row as stored in Postgres. */
export type ItemRow = {
  id: string;
  kind: Kind;
  data: Record<string, unknown>;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
};

/** Row flattened for the UI: `data` fields sit at the top level. */
export type Item = {
  id: string;
  kind: Kind;
  createdAt: string;
  updatedAt: string;
  coverPath: string | null;
  coverUrl: string | null;
  tracks?: Track[];
  [field: string]: unknown;
};

/** A match returned by a barcode, catalog number or text lookup. */
export type Candidate = {
  source: "discogs" | "musicbrainz" | "openlibrary" | "googlebooks";
  id: string;
  kind: "vinyl" | "book";
  title: string;
  creator: string;
  year?: number;
  label?: string;
  catno?: string;
  country?: string;
  format?: string;
  thumb?: string;
};

/** Full details for a picked candidate, ready to drop into the form. */
export type Details = {
  fields: Record<string, string | number>;
  tracks?: Track[];
  coverUrl?: string;
  sourceUrl?: string;
};
