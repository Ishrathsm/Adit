// Shot 4 of the Aurelle film: a 6s "how it works" diagram made in code, not by Veo. One hair
// strand in fine line art; three beats: protein particles settle into the worn gaps, argan oil
// coats the strand, a Vitamin E shield appears. SVG frames → sharp → ffmpeg.
// `npx tsx eval/aurelle-diagram.ts [--still]` → ~/Desktop/aurelle/diagram.mp4 (+ diagram-still.png)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const W = 1920;
const H = 1080;
const FPS = 24;
const SECONDS = 6;

const BG = "#FAFAF8";
const INK = "#141414";
const MUTED = "#8A857C";
const FILL = "#EEECE7";
const GOLD = "#B8955A";
const GOLD_SOFT = "#D9C29A";

// The strand: a long rounded shaft across the lower middle of the frame.
const SX = 170;
const SW = 1580;
const SY = 610;
const SH = 92;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const t = clamp(v);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
// Progress of a beat that runs from a to b seconds.
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));

// Seeded random, so every render is identical.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// Cuticle scales: slanted arcs along the shaft. Some are lifted (worn) and settle flat in beat 1.
const SCALE_STEP = 46;
const scales = Array.from({ length: Math.floor((SW - 60) / SCALE_STEP) }, (_, i) => ({
  x: SX + 40 + i * SCALE_STEP,
  lifted: [3, 7, 8, 13, 18, 22, 23, 27, 31].includes(i) ? 22 + rand() * 14 : 0,
}));
// Worn gaps: notches on the top edge that the protein particles fill.
const gaps = [0.14, 0.31, 0.47, 0.6, 0.78, 0.9].map((f) => SX + f * SW);
const particles = Array.from({ length: 46 }, (_, i) => {
  const gx = gaps[i % gaps.length] + (rand() - 0.5) * 26;
  return { fromX: gx + (rand() - 0.5) * 220, fromY: SY - 110 - rand() * 150, toX: gx + (rand() - 0.5) * 20, toY: SY + 10 + rand() * 14, r: 3.5 + rand() * 3, delay: rand() * 0.55 };
});

function strand(t: number): string {
  const settle = span(t, 1.4, 2.4);
  const top = SY;
  const bottom = SY + SH;
  // The shaft's outline with shallow notches that close as the gaps fill.
  const notchDepth = 14 * (1 - settle);
  let topEdge = `M ${SX + SH / 2} ${top}`;
  for (const g of gaps) topEdge += ` L ${g - 18} ${top} Q ${g} ${top + notchDepth} ${g + 18} ${top}`;
  topEdge += ` L ${SX + SW - SH / 2} ${top}`;
  const outline = `${topEdge} A ${SH / 2} ${SH / 2} 0 0 1 ${SX + SW - SH / 2} ${bottom} L ${SX + SH / 2} ${bottom} A ${SH / 2} ${SH / 2} 0 0 1 ${SX + SH / 2} ${top} Z`;
  const scaleArcs = scales
    .map((s) => {
      const lift = s.lifted * (1 - settle);
      return `<path d="M ${s.x} ${top + 2} q ${16 + lift * 0.6} ${-lift} ${30} ${SH * 0.5 - lift * 0.4} q -6 ${SH * 0.3} -26 ${SH * 0.48}" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".55"/>`;
    })
    .join("");
  return `<path d="${outline}" fill="${FILL}" stroke="${INK}" stroke-width="2.4"/>${scaleArcs}`;
}

function protein(t: number): string {
  return particles
    .map((p) => {
      const k = span(t, 0.7 + p.delay, 1.9 + p.delay);
      if (t < 0.7 + p.delay) return "";
      const x = p.fromX + (p.toX - p.fromX) * k;
      const y = p.fromY + (p.toY - p.fromY) * k;
      // Once landed they sink into the strand: smaller and fainter, a gold trace in each gap.
      const sink = span(t, 2.0 + p.delay * 0.5, 2.6 + p.delay * 0.5);
      const r = p.r * (1 - 0.55 * sink);
      const op = (0.35 + 0.65 * k) * (1 - 0.45 * sink);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${GOLD}" opacity="${op.toFixed(2)}"/>`;
    })
    .join("");
}

// Argan oil: a gold coat drawn along the strand, left to right, then a soft sheen travels it.
function coat(t: number): string {
  const k = span(t, 2.5, 3.9);
  if (k <= 0) return "";
  const pad = 7;
  const len = 2 * (SW + 2 * pad) + 2 * (SH + 2 * pad);
  const sheen = span(t, 3.6, 5.2);
  const sx = SX + sheen * SW;
  return `<rect x="${SX - pad}" y="${SY - pad}" width="${SW + 2 * pad}" height="${SH + 2 * pad}" rx="${SH / 2 + pad}" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="${len * k} ${len}" opacity=".9"/>
<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="${SH / 2}" fill="url(#sheen)" opacity="${(0.55 * k * (1 - span(t, 5.0, 5.7))).toFixed(2)}"/>
<defs><linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="${sx - 260}" y1="0" x2="${sx + 260}" y2="0"><stop offset="0" stop-color="${GOLD_SOFT}" stop-opacity="0"/><stop offset=".5" stop-color="${GOLD_SOFT}" stop-opacity=".8"/><stop offset="1" stop-color="${GOLD_SOFT}" stop-opacity="0"/></linearGradient></defs>`;
}

// Vitamin E: a faint dotted shield around the strand.
function shield(t: number): string {
  const k = span(t, 4.3, 5.5);
  if (k <= 0) return "";
  const pad = 34;
  return `<rect x="${SX - pad}" y="${SY - pad}" width="${SW + 2 * pad}" height="${SH + 2 * pad}" rx="${SH / 2 + pad}" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="2 12" stroke-linecap="round" opacity="${(0.9 * k).toFixed(2)}"/>`;
}

// The three labels build as a list; the current one is dark, earlier ones step back.
const LABELS = [
  { at: 0.7, title: "Bio-Protein Complex", sub: "fills the worn gaps along each strand" },
  { at: 2.5, title: "Argan Oil", sub: "a fine coat for softness and shine" },
  { at: 4.3, title: "Vitamin E", sub: "antioxidant care, a light shield" },
];
function labels(t: number): string {
  return LABELS.map((l, i) => {
    const k = span(t, l.at, l.at + 0.6);
    if (k <= 0) return "";
    const current = i === LABELS.length - 1 || t < LABELS[i + 1].at;
    const y = 180 + i * 118;
    const dy = (1 - k) * 18;
    const op = k * (current ? 1 : 0.45);
    return `<g opacity="${op.toFixed(2)}" transform="translate(0 ${dy.toFixed(1)})">
<circle cx="${SX + 8}" cy="${y - 17}" r="7" fill="${GOLD}"/>
<text x="${SX + 34}" y="${y}" font-family="Cormorant Garamond" font-weight="600" font-size="58" fill="${INK}">${l.title}</text>
<text x="${SX + 36}" y="${y + 42}" font-family="Karla" font-size="30" fill="${MUTED}">${l.sub}</text></g>`;
  }).join("");
}

function frame(t: number): string {
  const intro = span(t, 0, 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${BG}"/>
<g opacity="${intro.toFixed(2)}">${strand(t)}</g>
${coat(t)}${protein(t)}${shield(t)}${labels(t)}
<text x="${W - 120}" y="${H - 70}" text-anchor="end" font-family="Karla" font-weight="700" font-size="20" letter-spacing="3" fill="${MUTED}" opacity="${intro.toFixed(2)}">ILLUSTRATION · NOT TO SCALE</text>
</svg>`;
}

(async () => {
  const dir = join(homedir(), "Desktop", "aurelle");
  if (process.argv.includes("--still")) {
    for (const t of [1.2, 2.4, 3.6, 5.9]) await sharp(Buffer.from(frame(t))).png().toFile(join(dir, `diagram-still-${t}s.png`));
    return;
  }
  const frames = join(dir, "diagram-frames");
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  for (let i = 0; i < FPS * SECONDS; i++) {
    await sharp(Buffer.from(frame(i / FPS))).png().toFile(join(frames, `f${String(i).padStart(4, "0")}.png`));
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(dir, "diagram.mp4")]);
  rmSync(frames, { recursive: true, force: true });
  console.log(join(dir, "diagram.mp4"));
})();
