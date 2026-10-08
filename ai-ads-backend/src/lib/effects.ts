import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import sharp, { type OverlayOptions } from "sharp";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

// The video effects artist: a library of designed effects it knows how to build (text reveals,
// the mandala glow, lower thirds, logo reveals…), the rules for when each fits a film, a planner
// that picks effects per shot, and renderers that turn each into a transparent overlay clip.
// Effects are always designed in code and composited — never generated inside the footage by the
// video model (the user's rule: no sudden AI effects).

const genAI = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;

export type EffectId =
  | "text-fade-up"
  | "text-wipe"
  | "text-tracking"
  | "word-pop-captions"
  | "lower-third"
  | "ingredient-pop"
  | "mandala-glow"
  | "logo-reveal"
  | "light-sweep"
  | "soft-dissolve"
  | "dip-to-white";

// What the artist knows: what each effect is, when it fits, and when it never does.
export const EFFECTS: Record<EffectId, { name: string; what: string; use: string; never: string }> = {
  "text-fade-up": { name: "Fade-up super", what: "A line fades in while rising ~20px over 0.5s, holds, fades out.", use: "Any film; the default for feature lines and claims.", never: "More than one line on screen at once." },
  "text-wipe": { name: "Wipe-reveal super", what: "A line is revealed left to right behind a soft-edged mask over 0.6s, with a short accent rule drawing in first.", use: "Confident launches, tech, automotive, spec callouts.", never: "Soft emotional moments; UGC." },
  "text-tracking": { name: "Tracking-in super", what: "Letters start widely spaced and faint and settle to normal spacing over 1s.", use: "Premium beauty, luxury, perfume, end-card taglines.", never: "Fast cuts; long lines (over 5 words)." },
  "word-pop-captions": { name: "Creator captions", what: "Spoken words appear a few at a time in bold white on a soft dark box, synced to speech.", use: "UGC, creator and social-first films.", never: "TV-style story films (it reads as a Reel)." },
  "lower-third": { name: "Lower third", what: "A small label slides in from the left at the bottom third: a name or role over a thin accent bar.", use: "Introducing a person, a place, or an ingredient once.", never: "More than twice in 30s." },
  "ingredient-pop": { name: "Ingredient pop", what: "Small round ingredient icons pop in one by one (scale 90%→100%, 0.25s each) beside the product, each with its name.", use: "Food, beverage, herbal and wellness products naming 2–4 ingredients, on the shot where they are named.", never: "Beauty-luxury and premium tech; more than 4 items." },
  "mandala-glow": { name: "Mandala glow", what: "A fine golden line-art mandala with a soft warm glow fades in behind a person's head over ~1s and breathes slowly, then fades.", use: "One emotional peak of relief, calm or blessing in Indian wellness, herbal, ayurvedic or devotional films.", never: "More than once per film; comedy; tech, auto or beauty-luxury; behind a product." },
  "logo-reveal": { name: "Logo reveal", what: "The logo fades in from 104% to 100% scale over 0.8s, then the tagline fades up beneath it.", use: "End cards of every film.", never: "Bouncy or spinning logos." },
  "light-sweep": { name: "Light sweep", what: "A soft diagonal band of light passes once across the logo or pack after it lands.", use: "Premium end cards and packshots, once.", never: "UGC; more than once; over faces." },
  "soft-dissolve": { name: "Soft dissolve", what: "A 0.5–0.8s cross-dissolve between shots.", use: "Calm, emotional or premium films; time passing.", never: "Fast creator films; on a line of dialogue." },
  "dip-to-white": { name: "Dip to white", what: "The shot fades to warm white for ~0.3s and the next fades up from it.", use: "A clean move into the end card in bright films.", never: "Dark or moody films; mid-scene." },
};

export interface EffectCue {
  effect: EffectId;
  shot: number;
  // Seconds from the shot's start, and how long it lasts.
  at: number;
  duration: number;
  text?: string;
  // Position for text effects, or the centre of a mandala in 0–1 frame coordinates.
  x?: number;
  y?: number;
  reason: string;
}

export async function planEffects(concept: string, tone: string, scenes: { shot: number; seconds: string; action: string; line: string | null }[]): Promise<{ cues: EffectCue[]; notes: string[] }> {
  if (!genAI) return { cues: [], notes: [] };
  const library = Object.entries(EFFECTS).map(([id, e]) => `- ${id} (${e.name}): ${e.what} USE: ${e.use} NEVER: ${e.never}`).join("\n");
  const r = await withRateLimitRetry("effects-plan", () =>
    genAI.models.generateContent({
      model: env.textModel,
      contents: `You are the video effects artist on an Indian ad agency's team. Choose the effects for this film from your library only. Restraint is the craft: use at most 3 different effect types besides transitions and the end-card logo reveal, every effect needs a reason in this film, and an effect that fights the film's tone is worse than none.

The film: "${concept}"
Tone: ${tone}
Scenes:
${scenes.map((s) => `${s.shot}. [${s.seconds}] ${s.action}${s.line ? ` — "${s.line}"` : ""}`).join("\n")}

Your library:
${library}

Return JSON: cues (effect, shot, at = seconds from the shot's start, duration, text when it is a text effect, x and y in 0–1 for placement or a mandala's centre, reason) and notes (anything the editor must know).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  effect: { type: Type.STRING, enum: Object.keys(EFFECTS) },
                  shot: { type: Type.NUMBER },
                  at: { type: Type.NUMBER },
                  duration: { type: Type.NUMBER },
                  text: { type: Type.STRING, nullable: true },
                  x: { type: Type.NUMBER, nullable: true },
                  y: { type: Type.NUMBER, nullable: true },
                  reason: { type: Type.STRING },
                },
                required: ["effect", "shot", "at", "duration", "reason"],
              },
            },
            notes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["cues", "notes"],
        },
      },
    }),
  );
  return JSON.parse(r.text ?? '{"cues":[],"notes":[]}');
}

// ---------- renderers: each effect as a transparent overlay clip (QuickTime Animation, alpha) ----------

const FPS = 24;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Writes frames(i) for `seconds` and encodes a .mov with alpha that ffmpeg can overlay.
async function encode(out: string, w: number, h: number, seconds: number, frame: (t: number) => Promise<Buffer>): Promise<string> {
  const tmp = `${out}.frames`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) await sharp(await frame(i / FPS)).resize(w, h).png().toFile(join(tmp, `f${String(i).padStart(4, "0")}.png`));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(tmp, "f%04d.png"), "-c:v", "qtrle", "-pix_fmt", "argb", out]);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}
const svg = (w: number, h: number, body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

export interface TextStyle {
  font: string;
  weight?: number;
  size: number;
  color: string;
  accent?: string;
}

// text-fade-up / text-wipe / text-tracking: one line, in and out.
export async function renderTextEffect(effect: "text-fade-up" | "text-wipe" | "text-tracking", text: string, out: string, w: number, h: number, seconds: number, x: number, y: number, style: TextStyle): Promise<string> {
  const X = Math.round(x * w), Y = Math.round(y * h), fadeOut = 0.4;
  return encode(out, w, h, seconds, async (t) => {
    const outA = 1 - ease((t - (seconds - fadeOut)) / fadeOut);
    const font = `font-family="${style.font}" font-weight="${style.weight ?? 600}" font-size="${style.size}" fill="${style.color}"`;
    const rule = style.accent ? `<rect x="${X}" y="${Y - style.size - 14}" width="${44 * ease(t / 0.35)}" height="3" fill="${style.accent}" opacity="${outA}"/>` : "";
    if (effect === "text-fade-up") {
      const k = ease(t / 0.5);
      return svg(w, h, `${rule}<text x="${X}" y="${Y + 20 * (1 - k)}" ${font} opacity="${k * outA}">${esc(text)}</text>`);
    }
    if (effect === "text-tracking") {
      const k = ease(t / 1.0);
      return svg(w, h, `${rule}<text x="${X}" y="${Y}" ${font} letter-spacing="${(1 - k) * style.size * 0.5}" opacity="${(0.2 + 0.8 * k) * outA}">${esc(text)}</text>`);
    }
    // text-wipe: a soft-edged mask sweeps right after the rule draws in.
    const k = ease((t - 0.25) / 0.6);
    const maskW = Math.round(w * k);
    return svg(w, h, `<defs><linearGradient id="m"><stop offset="0" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="mk"><rect x="${X - 10}" y="0" width="${maskW}" height="${h}" fill="url(#m)"/></mask></defs>${rule}<text x="${X}" y="${Y}" ${font} mask="url(#mk)" opacity="${outA}">${esc(text)}</text>`);
  });
}

// mandala-glow: the mandala fades in over ~1s centred at (x, y), breathing gently (±3% scale), then
// fades. `degPerSec` turns it slowly (Swastea's "circulating mandala", 2026-10-08). Pass `subjectMask`
// (white = the person) to put it behind the person; without one it is a soft halo that stays faint
// where it crosses the face.
export async function renderMandala(mandalaPng: string, out: string, w: number, h: number, seconds: number, x: number, y: number, size: number, subjectMask?: Buffer, degPerSec = 0): Promise<string> {
  const base = await sharp(mandalaPng).png().toBuffer();
  return encode(out, w, h, seconds, async (t) => {
    const k = ease(t / 1.0) * (1 - ease((t - (seconds - 0.8)) / 0.8));
    const s = Math.round(size * (1 + 0.03 * Math.sin(t * 2.2)));
    let src = await sharp(base).resize(s, s).png().toBuffer();
    if (degPerSec) {
      // rotate about the centre, then crop back to s×s so the position doesn't drift
      const r = await sharp(src).rotate(degPerSec * t, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
      src = await sharp(r.data).extract({ left: Math.floor((r.info.width - s) / 2), top: Math.floor((r.info.height - s) / 2), width: s, height: s }).png().toBuffer();
    }
    const m = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < m.data.length; i += 4) m.data[i] = Math.round(m.data[i] * k);
    const layer = await sharp(m.data, { raw: { width: s, height: s, channels: 4 } }).png().toBuffer();
    let frame = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: layer, left: Math.round(x * w - s / 2), top: Math.round(y * h - s / 2) }])
      .png()
      .toBuffer();
    if (subjectMask) {
      // Cut the person out of the layer (alpha × (1 − mask)) so the mandala sits behind them.
      const f = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mk = await sharp(subjectMask).resize(w, h).greyscale().raw().toBuffer();
      for (let i = 0, p = 3; i < mk.length; i++, p += 4) f.data[p] = Math.round(f.data[p] * (1 - mk[i] / 255));
      frame = await sharp(f.data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    }
    return frame;
  });
}

// logo-reveal (+ optional light-sweep): the logo settles from 104% to 100% while fading in, then
// the tagline fades up beneath it; an optional single light band passes across the logo.
export async function renderLogoReveal(logoPng: string, tagline: string | null, out: string, w: number, h: number, seconds: number, cx: number, cy: number, logoW: number, style: TextStyle, sweep = false): Promise<string> {
  const logo = await sharp(logoPng).png().toBuffer();
  // metadata() reports the source size, not the resized one, so scale the height ourselves.
  const src = await sharp(logo).metadata();
  const lm = { height: Math.round(((src.height ?? 200) * logoW) / (src.width ?? logoW)) };
  return encode(out, w, h, seconds, async (t) => {
    const k = ease(t / 0.8);
    const scale = 1.04 - 0.04 * k;
    const lw = Math.round(logoW * scale);
    const raw = await sharp(logo).resize({ width: lw }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < raw.data.length; i += 4) raw.data[i] = Math.round(raw.data[i] * k);
    const layer = await sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } }).png().toBuffer();
    const left = Math.round(cx * w - raw.info.width / 2), top = Math.round(cy * h - raw.info.height / 2);
    const comps: OverlayOptions[] = [{ input: layer, left, top }];
    if (tagline) {
      const tk = ease((t - 0.9) / 0.6);
      const ty = Math.round(cy * h + (lm.height ?? 200) / 2 + style.size + 26 + 14 * (1 - tk));
      comps.push({ input: svg(w, h, `<text x="${cx * w}" y="${ty}" text-anchor="middle" font-family="${style.font}" font-weight="${style.weight ?? 600}" font-size="${style.size}" fill="${style.color}" opacity="${tk}">${esc(tagline)}</text>`) });
    }
    if (sweep) {
      const sk = (t - 1.3) / 0.9;
      if (sk > 0 && sk < 1) {
        const bx = left - 120 + (raw.info.width + 240) * sk;
        comps.push({ input: svg(w, h, `<defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect x="${bx}" y="${top}" width="90" height="${raw.info.height}" fill="url(#b)" transform="skewX(-18)"/>`) });
      }
    }
    return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toBuffer();
  });
}

// ingredient-pop: round icons pop in one by one (90%→100%, 0.25s apart) with names beneath.
export async function renderIngredientPop(items: { icon: Buffer; name: string }[], out: string, w: number, h: number, seconds: number, x: number, y: number, style: TextStyle): Promise<string> {
  const d = 120, gap = 40;
  return encode(out, w, h, seconds, async (t) => {
    const fadeOut = 1 - ease((t - (seconds - 0.4)) / 0.4);
    const comps: OverlayOptions[] = [];
    for (const [i, it] of items.entries()) {
      const k = ease((t - 0.25 * i) / 0.3);
      if (k <= 0) continue;
      const s = Math.round(d * (0.9 + 0.1 * k));
      const circle = svg(s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/>`);
      const icon = await sharp(it.icon).resize(s, s, { fit: "cover" }).composite([{ input: circle, blend: "dest-in" }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let p = 3; p < icon.data.length; p += 4) icon.data[p] = Math.round(icon.data[p] * k * fadeOut);
      const cxp = Math.round(x * w + i * (d + gap));
      comps.push({ input: await sharp(icon.data, { raw: { width: s, height: s, channels: 4 } }).png().toBuffer(), left: cxp - s / 2 + d / 2, top: Math.round(y * h - s / 2) });
      comps.push({ input: svg(w, h, `<text x="${cxp + d / 2}" y="${y * h + d / 2 + style.size + 10}" text-anchor="middle" font-family="${style.font}" font-weight="${style.weight ?? 700}" font-size="${style.size}" fill="${style.color}" opacity="${k * fadeOut}">${esc(it.name)}</text>`) });
    }
    return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toBuffer();
  });
}
