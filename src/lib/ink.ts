function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A ragged ink-blot alpha mask drawn once to PNG; SVG-filter masks re-rasterize on every paint. */
function inkMask(seed: number, rough: number): string {
  const size = 400;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const x = cv.getContext("2d");
  if (!x) return "none";
  const r = rng(seed);
  x.fillStyle = "#fff";
  x.beginPath();
  const pts = 90;
  const c0 = size / 2;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const k = 1 / Math.max(Math.abs(c), Math.abs(sn));
    const rad = size * 0.42 * Math.min(k, 1.28) * (1 - rough * (r() * 0.5 + (i % 7 === 0 ? r() * 0.6 : 0)));
    if (i) x.lineTo(c0 + c * rad, c0 + sn * rad);
    else x.moveTo(c0 + c * rad, c0 + sn * rad);
  }
  x.closePath();
  x.filter = "blur(2px)";
  x.fill();
  x.filter = "none";
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2;
    const d = size * (0.44 + r() * 0.12);
    x.beginPath();
    x.arc(c0 + Math.cos(a) * d, c0 + Math.sin(a) * d * 0.95, 1 + r() ** 2 * 7, 0, 7);
    x.fill();
  }
  return `url(${cv.toDataURL("image/png")})`;
}

export function installInkMasks(): void {
  const s = document.documentElement.style;
  s.setProperty("--inkmask", inkMask(7, 0.22));
  s.setProperty("--inkedge", inkMask(3, 0.14));
}

/** Seeded splatter shapes for the dossier backdrop. */
export function splatterDots(seed: number, w: number, h: number): { cx: number; cy: number; r: number }[] {
  const r = rng(seed);
  return Array.from({ length: 70 }, () => {
    const a = r() * Math.PI;
    const d = 0.3 + r() * 0.7;
    const side = r() < 0.5 ? -1 : 1;
    return {
      cx: w * 0.42 + Math.cos(a) * w * 0.5 * d * side,
      cy: h * 0.78 - Math.sin(a) * h * 0.75 * d,
      r: r() ** 2 * 9 + 0.8,
    };
  });
}
