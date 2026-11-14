/** Deterministic generative art: sleeve covers for records without a photo, and cloth colors for book spines. */

export function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const PALETTES: [string, string, string][] = [
  ["#1D3557", "#F1E9DA", "#E63946"], ["#F2C14E", "#161616", "#F25C2A"], ["#2A9D8F", "#F4F1DE", "#16323B"],
  ["#ECE6D8", "#C1121F", "#0B2545"], ["#111114", "#F5F5F0", "#FF6A2B"], ["#5B3E96", "#F7D6E0", "#FFC93A"],
  ["#C8553D", "#F4D7AE", "#2E294E"], ["#DDE2DE", "#17201B", "#3C9D6B"], ["#22404D", "#E9C46A", "#F08A4B"],
  ["#F0EAD6", "#2B59C3", "#D1495B"], ["#9DB4C0", "#13293D", "#F2F2EC"], ["#E8505B", "#FFF3E2", "#14213D"],
];

const n = (x: number) => Math.round(x * 100) / 100;

export function sleeveArt(title: string, artist: string) {
  const seed = hash(`${title}|${artist}`);
  const r = rng(seed);
  const [bg, fg, ac] = PALETTES[seed % PALETTES.length];
  const t = (seed >>> 8) % 6;
  let g = `<rect width="100" height="100" fill="${bg}"/>`;
  if (t === 0) {
    const cx = 34 + r() * 32, cy = 40 + r() * 22, rad = 22 + r() * 12;
    g += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad)}" fill="${fg}"/><circle cx="${n(cx + rad * 0.55)}" cy="${n(cy - rad * 0.5)}" r="${n(5 + r() * 7)}" fill="${ac}"/>`;
  } else if (t === 1) {
    let y = 18 + r() * 10, i = 0;
    while (y < 92) { const h = 2 + r() * 9; g += `<rect x="0" y="${n(y)}" width="100" height="${n(h)}" fill="${i % 3 === 2 ? ac : fg}"/>`; y += h + 2 + r() * 7; i++; }
  } else if (t === 2) {
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 50, y = Math.floor(i / 2) * 50, o = Math.floor(r() * 4);
      const cx = x + (o === 1 || o === 2 ? 50 : 0), cy = y + (o >= 2 ? 50 : 0);
      g += `<clipPath id="q${seed}${i}"><rect x="${x}" y="${y}" width="50" height="50"/></clipPath><circle clip-path="url(#q${seed}${i})" cx="${cx}" cy="${cy}" r="50" fill="${i === Math.floor(r() * 4) ? ac : fg}"/>`;
    }
  } else if (t === 3) {
    const a = 20 + r() * 60;
    g += `<polygon points="0,${n(a)} 100,${n(100 - a * 0.6)} 100,100 0,100" fill="${fg}"/><circle cx="${n(30 + r() * 40)}" cy="${n(a * 0.7 + 12)}" r="${n(9 + r() * 8)}" fill="${ac}"/>`;
  } else if (t === 4) {
    let rad = 44, i = 0;
    while (rad > 4) { const w = 1.5 + r() * 4; g += `<circle cx="50" cy="56" r="${n(rad)}" fill="none" stroke="${i === 2 ? ac : fg}" stroke-width="${n(w)}"/>`; rad -= w + 2 + r() * 5; i++; }
  } else {
    const cells = 7, hit = Math.floor(r() * cells * cells);
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      const i = y * cells + x;
      g += `<circle cx="${14 + x * 12}" cy="${n(20 + y * 11.5)}" r="${r() < 0.18 ? 1.4 : 3.6}" fill="${i === hit || i === hit + 8 ? ac : fg}"/>`;
    }
  }
  return { svg: `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`, bg, fg, accent: ac };
}

const CLOTH: [string, string][] = [
  ["#6B1F2A", "#EBD9B4"], ["#1F2E4A", "#E3D3A8"], ["#2F4A3A", "#E6D8B0"], ["#B8892B", "#1E1A12"], ["#4A5563", "#F1EDE2"],
  ["#23585C", "#EEE3C6"], ["#4B2E4F", "#EAD7C0"], ["#A65A2A", "#FBEBD3"], ["#E3D9C2", "#2A2620"], ["#1C1C1E", "#D9C38E"],
  ["#8C2F39", "#F3E3C8"], ["#5E6B3A", "#F0E6C8"],
];

export function cloth(title: string, author: string) {
  const h = hash(`${title}#${author}`);
  const [bg, foil] = CLOTH[h % CLOTH.length];
  return { bg, foil, h };
}
