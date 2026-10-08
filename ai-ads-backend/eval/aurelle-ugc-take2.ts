// Take 2 of the Aurelle UGC review (the user's pick), rebuilt with "Seriously" removed: Veo said it
// as "serially", so 6.80–7.27s of clip 2 (picture and sound together, so her lips never move
// silently) is cut out with a short blend, leaving "…so smooth yaar. Try karo." The join between
// the clips gets a 0.25s blend. Same Ad tag, captions and link sticker as take 2.
// `npx tsx eval/aurelle-ugc-take2.ts` → ~/Desktop/aurelle/ugc/aurelle-ugc-2-trykaro.mp4
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const dir = join(homedir(), "Desktop", "aurelle", "ugc");
const src = join(dir, "v2");
const tmp = join(dir, "layers-take2");
const W = 720;
const H = 1280;
const F = 1 / 24;
// Clip 2: from its second frame (its first is clip 1's last) to the word, then from after it.
const CUT_FROM = 6.8;
const CUT_TO = 7.27;
const CLIP2_END = 7.8;
const JOIN = 0.25;
const MICRO = 0.12;
const c2aLen = CUT_FROM - F;
const c2bLen = CLIP2_END - CUT_TO;
const c2aStart = 8 - JOIN;
const c2bStart = c2aStart + c2aLen - MICRO;
const total = c2bStart + c2bLen;
const at2 = (t: number) => c2aStart + t - F;

const CAPTIONS: [number, number, string][] = [
  [0.1, 1.5, "Guys, honest review."],
  [1.5, 4.0, "Meri ends itni dry thi na,"],
  [4.0, 5.5, "frizz everywhere."],
  [5.8, 7.6, "Phir maine ye Aurelle try kiya."],
  [at2(0.05), at2(1.3), "Sulphate-free hai,"],
  [at2(1.3), at2(2.6), "argan oil aur vitamin E."],
  [at2(2.95), at2(4.1), "Texture dekho yaar,"],
  [at2(4.1), at2(5.25), "so creamy."],
  [at2(5.25), c2bStart - 0.02, "And now? So smooth yaar."],
  [c2bStart, total, "Try karo."],
];
const STICKER_FROM = at2(5.25);

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function caption(text: string): Promise<Buffer> {
  const size = 38, padX = 22, h = 62;
  const w = Math.min(W - 60, text.length * size * 0.56 + padX * 2);
  const x = (W - w) / 2, y = 700;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#000" fill-opacity=".55"/><text x="${W / 2}" y="${y + 43}" text-anchor="middle" font-family="Karla" font-weight="700" font-size="${size}" fill="#fff">${esc(text)}</text></svg>`)).png().toBuffer();
}
async function adTag(): Promise<Buffer> {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="28" y="70" width="64" height="34" rx="9" fill="#000" fill-opacity=".45"/><text x="60" y="94" text-anchor="middle" font-family="Karla" font-weight="700" font-size="20" fill="#fff">Ad</text></svg>`)).png().toBuffer();
}
async function linkSticker(): Promise<Buffer> {
  const sw = 330, sh = 74;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw + 20}" height="${sh + 20}"><rect x="10" y="10" width="${sw}" height="${sh}" rx="16" fill="#fff"/>
<g transform="translate(40 47) rotate(-45)" fill="none" stroke="#3797F0" stroke-width="4"><rect x="-15" y="-6" width="16" height="12" rx="6"/><rect x="-1" y="-6" width="16" height="12" rx="6"/></g>
<text x="66" y="57" font-family="Karla" font-weight="700" font-size="27" letter-spacing="1" fill="#3797F0">SHOP AURELLE</text></svg>`;
  const sticker = await sharp(Buffer.from(svg)).rotate(-4, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(sticker).metadata();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: sticker, left: Math.round((W - (m.width ?? sw)) / 2), top: 560 }]).png().toBuffer();
}

(async () => {
  mkdirSync(tmp, { recursive: true });
  const layers: { file: string; from: number; to: number }[] = [];
  for (const [i, [a, b, t]] of CAPTIONS.entries()) {
    const file = join(tmp, `cap-${i}.png`);
    writeFileSync(file, await caption(t));
    layers.push({ file, from: a, to: b });
  }
  writeFileSync(join(tmp, "ad.png"), await adTag());
  layers.push({ file: join(tmp, "ad.png"), from: 0, to: total });
  writeFileSync(join(tmp, "sticker.png"), await linkSticker());
  layers.push({ file: join(tmp, "sticker.png"), from: STICKER_FROM, to: total });

  const inputs = ["-i", join(src, "clip1.mp4"), "-i", join(src, "clip2.mp4")];
  for (const l of layers) inputs.push("-loop", "1", "-t", total.toFixed(3), "-i", l.file);
  const f = [
    `[1:v]split[s1][s2]`,
    `[0:v]setpts=PTS-STARTPTS[c1]`,
    `[s1]trim=start=${F.toFixed(4)}:end=${CUT_FROM},setpts=PTS-STARTPTS[c2a]`,
    `[s2]trim=start=${CUT_TO}:end=${CLIP2_END},setpts=PTS-STARTPTS[c2b]`,
    `[c1][c2a]xfade=transition=fade:duration=${JOIN}:offset=${(8 - JOIN).toFixed(3)}[j1]`,
    `[j1][c2b]xfade=transition=fade:duration=${MICRO}:offset=${c2bStart.toFixed(3)}[base]`,
    `[1:a]asplit[t1][t2]`,
    `[0:a]adeclick,asetpts=PTS-STARTPTS[a1]`,
    `[t1]atrim=start=${F.toFixed(4)}:end=${CUT_FROM},asetpts=PTS-STARTPTS[a2a]`,
    `[t2]atrim=start=${CUT_TO}:end=${CLIP2_END},asetpts=PTS-STARTPTS[a2b]`,
    `[a1][a2a]acrossfade=d=${JOIN}[aj]`,
    `[aj][a2b]acrossfade=d=${MICRO}[aud]`,
  ];
  let last = "base";
  layers.forEach((l, i) => {
    const fade = 0.12;
    f.push(`[${i + 2}:v]format=rgba,fade=t=in:st=${l.from.toFixed(3)}:d=${fade}:alpha=1,fade=t=out:st=${Math.max(l.from, l.to - fade).toFixed(3)}:d=${fade}:alpha=1[l${i}]`);
    f.push(`[${last}][l${i}]overlay=0:0:enable='between(t,${l.from.toFixed(3)},${l.to.toFixed(3)})'[o${i}]`);
    last = `o${i}`;
  });
  const out = join(dir, "aurelle-ugc-2-trykaro.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", f.join(";"), "-map", `[${last}]`, "-map", "[aud]", "-t", total.toFixed(3), "-r", "24", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out]);
  console.log(out, total.toFixed(2) + "s");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
