import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";

const FFMPEG = ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg";
const FPS = 24;
// The stage is built at twice the output size so the push-in samples real pixels.
const SUPERSAMPLE = 2;
const PUSH_IN = 0.06;
const STAGE = { r: 244, g: 244, b: 246 };
// Response reveal: starts after a short beat (the question reads first) and finishes with time to
// read the answer before the cut.
const REVEAL_START = 0.6;
const REVEAL_SHARE = 0.55;

function outputSize(aspectRatio: string): { width: number; height: number } {
  const [w, h] = aspectRatio.split(":").map(Number);
  // 720p on the short side, like the generated shots.
  return w >= h ? { width: Math.round((720 * w) / h / 2) * 2, height: 720 } : { width: 720, height: Math.round((720 * h) / w / 2) * 2 };
}

const easeOut = (x: number) => 1 - (1 - x) ** 3;

// A screen-insert shot: the client's real product screen, presented like a clean product demo —
// centered on a soft off-white stage with rounded corners and a quiet shadow, on a slow push-in.
// With `reveal`, that part of the screen (the product's response) streams in top to bottom.
// Built from the supplied image, so the interface is pixel-real (AI video garbles UI and text).
export async function renderScreenInsert(
  screen: Buffer,
  aspectRatio: string,
  seconds: number,
  reveal?: { from: number; to: number } | null,
): Promise<Buffer> {
  const { width, height } = outputSize(aspectRatio);
  const W = width * SUPERSAMPLE, H = height * SUPERSAMPLE;
  const S = Math.min(W, H);

  const fitted = await sharp(screen).resize({ width: Math.round(W * 0.82), height: Math.round(H * 0.84), fit: "inside" }).png().toBuffer();
  const { width: sw = 0, height: sh = 0 } = await sharp(fitted).metadata();
  const radius = Math.round(S * 0.02);
  const roundedMask = Buffer.from(`<svg width="${sw}" height="${sh}"><rect width="${sw}" height="${sh}" rx="${radius}" ry="${radius}"/></svg>`);
  const blur = Math.round(S * 0.02);
  const shadow = await sharp({ create: { width: sw + blur * 4, height: sh + blur * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="${sw}" height="${sh}"><rect width="${sw}" height="${sh}" rx="${radius}" ry="${radius}" fill="rgba(20,20,30,0.16)"/></svg>`), left: blur * 2, top: blur * 2 }])
    .blur(blur)
    .png()
    .toBuffer();
  const left = Math.round((W - sw) / 2), top = Math.round((H - sh) / 2);
  const background = await sharp({ create: { width: W, height: H, channels: 3, background: STAGE } })
    .composite([{ input: shadow, left: left - blur * 2, top: top - blur * 2 + Math.round(S * 0.01) }])
    .png()
    .toBuffer();

  // The not-yet-revealed part of the response is covered in the screen's own background color,
  // sampled just above the response area.
  const revealTop = reveal ? Math.round(sh * reveal.from) : 0;
  const revealBottom = reveal ? Math.round(sh * reveal.to) : 0;
  const cover = reveal
    ? (await sharp(fitted).extract({ left: Math.round(sw / 2), top: Math.max(0, revealTop - 2), width: 1, height: 1 }).raw().toBuffer())
    : null;

  const frames = Math.round(seconds * FPS);
  const dir = await mkdtemp(join(tmpdir(), "screen-insert-"));
  try {
    const output = join(dir, "insert.mp4");
    const proc = spawn(FFMPEG, [
      "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${width}x${height}`, "-r", String(FPS), "-i", "-",
      "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", output,
    ]);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c; });
    const done = new Promise<void>((resolve, reject) => {
      proc.on("error", reject);
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`))));
    });

    let lastScreen: Buffer | null = null;
    let lastCovered = -1;
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      // Screen with the unrevealed rows covered (rebuilt only when the reveal line moves).
      const progress = reveal ? easeOut(Math.min(1, Math.max(0, (t - REVEAL_START) / (seconds * REVEAL_SHARE)))) : 1;
      const covered = reveal ? Math.round((revealBottom - revealTop) * (1 - progress)) : 0;
      if (lastScreen === null || covered !== lastCovered) {
        const layers = covered > 0 && cover
          ? [{ input: { create: { width: sw, height: covered, channels: 3 as const, background: { r: cover[0], g: cover[1], b: cover[2] } } }, left: 0, top: revealBottom - covered }]
          : [];
        const shown = await sharp(fitted).composite(layers).png().toBuffer();
        lastScreen = await sharp(shown).composite([{ input: roundedMask, blend: "dest-in" }]).png().toBuffer();
        lastCovered = covered;
      }
      // Slow push-in: crop toward the center, then scale to the output size.
      const zoom = 1 + (PUSH_IN * f) / frames;
      const cw = Math.round(W / zoom), ch = Math.round(H / zoom);
      // Two steps: sharp crops before it composites within one pipeline.
      const full = await sharp(background).composite([{ input: lastScreen, left, top }]).png({ compressionLevel: 0 }).toBuffer();
      const frame = await sharp(full)
        .extract({ left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2), width: cw, height: ch })
        .resize(width, height)
        .removeAlpha()
        .raw()
        .toBuffer();
      if (!proc.stdin.write(frame)) await new Promise((r) => proc.stdin.once("drain", r));
    }
    proc.stdin.end();
    await done;
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
