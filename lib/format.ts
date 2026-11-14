const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";

export function money(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY }).format(n); }
  catch { return n.toFixed(2); }
}

export const currencySymbol = () => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
  } catch { return "$"; }
};

/** "2026-11-14" → "Nov 14, 2026". Date-only strings are read as local dates, not UTC. */
export function day(v: unknown) {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function stamp(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
