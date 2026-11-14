/** Barcode helpers shared by the client scanner and the server lookups. */

export const digitsOnly = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();

/** EAN-13 starting 978/979 is an ISBN ("Bookland"); a 10-character code with valid check digit is ISBN-10. */
export function isIsbn(code: string) {
  const c = digitsOnly(code);
  if (c.length === 13 && /^97[89]/.test(c)) return true;
  if (c.length === 10 && /^\d{9}[\dX]$/.test(c)) {
    const sum = c.split("").reduce((s, ch, i) => s + (ch === "X" ? 10 : Number(ch)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

export function looksLikeBarcode(s: string) {
  const c = s.replace(/[\s-]/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(c) || isIsbn(c);
}
