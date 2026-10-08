// Assembles the Aurelle UGC review as an Instagram Story: the two chained clips joined into one
// continuous take (clip 2's first frame is clip 1's last, so it is dropped), her own Veo audio with
// the click after "kiya" removed, Story-style captions of her words, an "Ad" tag (ASCI) and a
// "Shop Aurelle" link sticker at the end. No music.
// `npx tsx eval/aurelle-ugc-edit.ts` → ~/Desktop/aurelle/ugc/aurelle-ugc-N.mp4
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const dir = join(homedir(), "Desktop", "aurelle", "ugc");
const tmp = join(dir, "layers");
const W = 720;
const H = 1280;

// Phrase timings (seconds on the final timeline), from the pauses in her audio.
// v4: clip 1 is cut at 5.92s (after "try kiya", before her ad-lib and before Veo's painted logo),
// and clip 2 was rendered from that exact frame. Phrase timings from the pauses in her audio.
const CLIP1_END = 142 / 24;
const C = CLIP1_END;
const CLIP2_END = 7.9;
const CAPTIONS: [number, number, string][] = [
  [0.1, 1.9, "Guys, honest review."],
  [1.9, 3.6, "Meri ends itni dry thi na,"],
  [3.6, 4.95, "frizz everywhere."],
  [5.08, C + 0.4, "Phir maine ye try kiya."],
  [C + 0.4, C + 1.5, "Sulphate-free hai,"],
  [C + 1.5, C + 2.85, "argan oil aur vitamin E."],
  [C + 2.93, C + 5.1, "Dekho — so creamy."],
  [C + 5.37, C + 6.2, "And now?"],
  [C + 6.3, C + CLIP2_END, "So smooth yaar."],
];
const STICKER_FROM = C + 5.37;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const textWidth = (t: string, size: number) => t.length * size * 0.56;

// A Story caption: bold white type on a soft dark rounded box, centred over her chest.
async function caption(text: string): Promise<Buffer> {
  const size = 38, padX = 22, h = 62;
  const w = Math.min(W - 60, textWidth(text, size) + padX * 2);
  const x = (W - w) / 2, y = 700;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#000" fill-opacity=".55"/><text x="${W / 2}" y="${y + 43}" text-anchor="middle" font-family="Karla" font-weight="700" font-size="${size}" fill="#fff">${esc(text)}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// A Story header: progress bar, round profile photo (her face from the keyframe), a made-up handle
// and the platform-style "Paid partnership" label — the ASCI disclosure, where a real Story shows it.
async function storyHeader(): Promise<Buffer> {
  const r = 26, cx = 40, cy = 44;
  const face = await sharp(join(dir, "keyframe.png")).extract({ left: 300, top: 340, width: 220, height: 220 }).resize(r * 2, r * 2).png().toBuffer();
  const mask = Buffer.from(`<svg width="${r * 2}" height="${r * 2}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`);
  const avatar = await sharp(face).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="120" fill="url(#top)"/>
<rect x="10" y="8" width="${W - 20}" height="3" rx="1.5" fill="#fff" fill-opacity=".45"/>
<rect x="10" y="8" width="${(W - 20) * 0.35}" height="3" rx="1.5" fill="#fff"/>
<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#fff"/>
<text x="${cx + r + 12}" y="${cy - 3}" font-family="Karla" font-weight="700" font-size="21" fill="#fff">priya.unfiltered</text>
<text x="${cx + r + 12}" y="${cy + 19}" font-family="Karla" font-size="16" fill="#fff" fill-opacity=".9">Paid partnership with aurelle</text></svg>`;
  return sharp(Buffer.from(svg)).composite([{ input: avatar, left: cx - r, top: cy - r }]).png().toBuffer();
}

// A Story link sticker: white pill, a link icon and the link text, tilted a little like a placed sticker.
async function linkSticker(): Promise<Buffer> {
  const sw = 330, sh = 74;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw + 20}" height="${sh + 20}"><rect x="10" y="10" width="${sw}" height="${sh}" rx="16" fill="#fff"/>
<g transform="translate(40 47) rotate(-45)" fill="none" stroke="#3797F0" stroke-width="4"><rect x="-15" y="-6" width="16" height="12" rx="6"/><rect x="-1" y="-6" width="16" height="12" rx="6"/></g>
<text x="66" y="57" font-family="Karla" font-weight="700" font-size="27" letter-spacing="1" fill="#3797F0">SHOP AURELLE</text></svg>`;
  const sticker = await sharp(Buffer.from(svg)).rotate(-4, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(sticker).metadata();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sticker, left: Math.round((W - (m.width ?? sw)) / 2), top: 560 }])
    .png()
    .toBuffer();
}

(async () => {
  mkdirSync(tmp, { recursive: true });
  const layers: { file: string; from: number; to: number }[] = [];
  for (const [i, [a, b, t]] of CAPTIONS.entries()) {
    const file = join(tmp, `cap-${i}.png`);
    writeFileSync(file, await caption(t));
    layers.push({ file, from: a, to: b });
  }
  const total = C + CLIP2_END - 1 / 24;
  writeFileSync(join(tmp, "header.png"), await storyHeader());
  layers.push({ file: join(tmp, "header.png"), from: 0, to: total });
  writeFileSync(join(tmp, "sticker.png"), await linkSticker());
  layers.push({ file: join(tmp, "sticker.png"), from: STICKER_FROM, to: total });

  // Clip 1 then clip 2 minus its first frame, as one stream; the click after "kiya" is removed.
  const inputs = ["-t", CLIP1_END.toFixed(4), "-i", join(dir, "clip1.mp4"), "-ss", (1 / 24).toFixed(4), "-i", join(dir, "clip2.mp4")];
  for (const l of layers) inputs.push("-loop", "1", "-t", total.toFixed(3), "-i", l.file);
  const f: string[] = [
    "[0:v]setpts=PTS-STARTPTS[v0]",
    "[1:v]setpts=PTS-STARTPTS[v1]",
    `[0:a]asetpts=PTS-STARTPTS,afade=t=out:st=${(CLIP1_END - 0.06).toFixed(3)}:d=0.06[a0]`,
    "[1:a]asetpts=PTS-STARTPTS,afade=t=in:d=0.06[a1]",
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[base][aud]",
  ];
  let last = "base";
  layers.forEach((l, i) => {
    const fade = 0.12;
    f.push(`[${i + 2}:v]format=rgba,fade=t=in:st=${l.from.toFixed(3)}:d=${fade}:alpha=1,fade=t=out:st=${Math.max(l.from, l.to - fade).toFixed(3)}:d=${fade}:alpha=1[l${i}]`);
    f.push(`[${last}][l${i}]overlay=0:0:enable='between(t,${l.from.toFixed(3)},${l.to.toFixed(3)})'[o${i}]`);
    last = `o${i}`;
  });
  let k = 1;
  while (existsSync(join(dir, `aurelle-ugc-${k}.mp4`))) k++;
  const out = join(dir, `aurelle-ugc-${k}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", f.join(";"), "-map", `[${last}]`, "-map", "[aud]", "-t", total.toFixed(3), "-r", "24", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out]);
  console.log(out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
