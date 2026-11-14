import "server-only";

export const USER_AGENT = "Deauxlection/0.1 (+https://github.com/deaux28/deauxlection)";

export async function getJSON<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as T;
}

export const toYear = (v: unknown) => {
  const m = String(v ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : undefined;
};
