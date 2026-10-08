// The Aurelle film's first cut: the 8 Veo clips (each trimmed to its clean stretch, some slowed
// further for slow motion), soft dissolves, the voice lines placed so each plays over its own
// shot, matching supers, the corner wordmark, the Lyria bed and the end card.
// `npx tsx eval/aurelle-edit.ts [music-1|music-2]` → ~/Desktop/aurelle/aurelle-cut-1.mp4
import "../src/lib/gcp-credentials-bootstrap";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { stitchVideos, trimSilence } from "../src/lib/video-stitch";

const dir = join(homedir(), "Desktop", "aurelle");
const clips = join(dir, "clips");
const W = 1280;
const H = 720;
const T = 0.6;
const GOLD = "#B8955A";

// Each shot: the clean stretch of its clip (from my frame-by-frame check), how much to slow it
// (1 = as rendered), and its line. `voiced` lines are read; the others are text only.
// `pos` puts each super in the shot's empty white space; `haze` lays a soft white glow behind it
// where the shot has none (the lather shot is hair and foam edge to edge).
type Pos = "middle-left" | "top-left" | "bottom-left";
const SHOTS: { from: number; to: number; slow: number; line: string | null; voice: number | null; pos?: Pos; haze?: boolean }[] = [
  { from: 0, to: 5.4, slow: 1, line: "Heat, sun and harsh washes wear hair down.", voice: 1, pos: "middle-left" },
  { from: 1.0, to: 4.0, slow: 1.2, line: "Aurelle Bio-Protein Repair Shampoo", voice: 2, pos: "top-left" },
  { from: 0, to: 3.5, slow: 1.6, line: "Argan oil adds shine. Vitamin E protects.", voice: 3, pos: "bottom-left" },
  { from: 2.0, to: 6.0, slow: 1.15, line: "Bio-protein fills the worn gaps.", voice: 4, pos: "top-left" },
  { from: 0, to: 4.0, slow: 1.3, line: "Sulphate-free, so it cleans without stripping.", voice: 5, pos: "middle-left", haze: true },
  { from: 0, to: 3.4, slow: 1, line: "Smooth from root to tip.", voice: 6, pos: "middle-left" },
  { from: 0, to: 2.5, slow: 1.12, line: null, voice: null },
  { from: 0, to: 2.4, slow: 1, line: null, voice: null },
];

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/’/g, "&#8217;");
// A super: the line in the bottle's serif, large, with a short gold rule above, flat (no shadow),
// wrapped to two lines when long, set in the shot's empty space.
async function superPng(text: string, pos: Pos, haze: boolean): Promise<Buffer> {
  const words = text.split(" ");
  const lines = text.length > 30 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [text];
  const size = 46, lh = 54, x = 80;
  const blockH = 22 + lines.length * lh;
  const top = pos === "top-left" ? 70 : pos === "bottom-left" ? H - 70 - blockH : (H - blockH) / 2;
  const ink = "#161412";
  const glow = haze
    ? `<defs><radialGradient id="h"><stop offset="0" stop-color="#FAFAF8" stop-opacity=".9"/><stop offset=".6" stop-color="#FAFAF8" stop-opacity=".75"/><stop offset="1" stop-color="#FAFAF8" stop-opacity="0"/></radialGradient></defs><ellipse cx="${x + 270}" cy="${top + blockH / 2}" rx="430" ry="${blockH + 50}" fill="url(#h)"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${glow}<rect x="${x}" y="${top}" width="44" height="3" fill="${GOLD}"/>${lines
    .map((l, i) => `<text x="${x}" y="${top + 22 + (i + 1) * lh - 12}" font-family="Cormorant Garamond" font-weight="600" font-size="${size}" fill="${ink}">${esc(l)}</text>`)
    .join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// The end card: plain warm white, the wordmark, the tagline, a gold rule and the call to action.
async function endCard(): Promise<{ background: Buffer; overlay: Buffer }> {
  const background = await sharp({ create: { width: W, height: H, channels: 3, background: "#FAFAF8" } }).png().toBuffer();
  const logo = await sharp(join(dir, "logo-black.png")).resize({ width: 440 }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<text x="${W / 2}" y="420" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="40" fill="#161412">Your hair&#8217;s true nature, restored.</text>
<rect x="${W / 2 - 30}" y="452" width="60" height="3" fill="${GOLD}"/>
<text x="${W / 2}" y="500" text-anchor="middle" font-family="Karla" font-weight="700" font-size="17" letter-spacing="6" fill="${GOLD}">DISCOVER AURELLE</text></svg>`;
  const overlay = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: Math.round((W - (lm.width ?? 440)) / 2), top: 250 }, { input: Buffer.from(svg) }])
    .png()
    .toBuffer();
  return { background, overlay };
}

// A clip's clean stretch, slowed with motion-interpolated frames (not duplicated ones).
function prepare(n: number): string {
  const s = SHOTS[n - 1];
  const outFile = join(clips, `shot-${n}-edit.mp4`);
  const slow = s.slow > 1 ? `,setpts=${s.slow}*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1` : "";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(s.from), "-to", String(s.to), "-i", join(clips, `shot-${n}.mp4`), "-vf", `setpts=PTS-STARTPTS${slow}`, "-an", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", outFile]);
  return outFile;
}
const duration = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

// The black wordmark, small and soft in the top-right corner (the stock watermark is light, for dark films).
async function watermark(): Promise<Buffer> {
  const logo = await sharp(join(dir, "logo-black.png")).resize({ width: Math.round(W * 0.1) }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < logo.data.length; i += 4) logo.data[i] = Math.round(logo.data[i] * 0.55);
  const png = await sharp(logo.data, { raw: { width: logo.info.width, height: logo.info.height, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: png, left: W - logo.info.width - 40, top: 34 }])
    .png()
    .toBuffer();
}

(async () => {
  const musicName = process.argv[2] ?? "music-1";
  const files = SHOTS.map((_, i) => prepare(i + 1));
  const cuts = files.map(duration);
  // Shot start times on the final timeline (each dissolve overlaps the previous shot by T).
  const starts: number[] = [];
  cuts.reduce((t, c) => (starts.push(t), t + c - T), 0);
  const endCardStart = starts[7] + cuts[7] - T;

  // Voice lines: each enters once its shot's dissolve settles, never before the previous line ends.
  const voiceLines: { shot: number; audio: Buffer; offset: number }[] = [];
  const layers: { png: Buffer; from: [number, number]; to: [number, number] }[] = [];
  let prevEnd = 0;
  for (const [i, s] of SHOTS.entries()) {
    const shotStart = starts[i];
    const shotEnd = (starts[i + 1] ?? endCardStart) + 0.1;
    let a = shotStart + (i === 0 ? 0.4 : T * 0.6 + 0.15);
    let b = shotEnd - 0.15;
    if (s.voice) {
      const audio = await trimSilence(readFileSync(join(dir, "voice", `line-${s.voice}.wav`)));
      const len = (audio.length - 44) / 48000;
      a = Math.max(a, prevEnd + 0.25);
      voiceLines.push({ shot: 0, audio, offset: a });
      prevEnd = a + len;
      b = Math.max(b, prevEnd + 0.3);
      console.log(`shot ${i + 1}: ${shotStart.toFixed(2)}–${shotEnd.toFixed(2)}s, line ${a.toFixed(2)}–${prevEnd.toFixed(2)}s`);
    }
    if (s.line) {
      // Never two supers at once: the previous one ends as this one begins.
      const prev = layers[layers.length - 1];
      if (prev && prev.to[1] > a - 0.05) prev.to = [0, a - 0.05];
      layers.push({ png: await superPng(s.line, s.pos ?? "bottom-left", Boolean(s.haze)), from: [0, a], to: [0, b] });
    }
  }
  const endAudio = await trimSilence(readFileSync(join(dir, "voice", "line-7.wav")));
  voiceLines.push({ shot: 8, audio: endAudio, offset: T * 0.6 + 0.4 });
  layers.push({ png: await watermark(), from: [0, 0.3], to: [8, 0] });

  const clipBuffers = files.map((f) => readFileSync(f));
  const card = await endCard();
  writeFileSync(join(dir, "end-card-preview.png"), await sharp(card.background).composite([{ input: card.overlay }]).png().toBuffer());

  const film = await stitchVideos(clipBuffers, {
    cutSeconds: cuts,
    transitionSeconds: T,
    endCard: card.background,
    endCardOverlay: card.overlay,
    layers,
    voiceoverLines: voiceLines,
    music: readFileSync(join(dir, `${musicName}.wav`)),
    // The user found the full-level bed loud under the voice.
    musicLevel: 0.45,
  });
  mkdirSync(dir, { recursive: true });
  let k = 1;
  while (existsSync(join(dir, `aurelle-cut-${k}.mp4`))) k++;
  const out = join(dir, `aurelle-cut-${k}.mp4`);
  writeFileSync(out, film);
  console.log(`${out} — ${duration(out).toFixed(2)}s`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
