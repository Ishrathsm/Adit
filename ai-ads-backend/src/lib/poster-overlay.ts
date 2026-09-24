import { GoogleGenAI, Type } from "@google/genai";
import sharp, { type OverlayOptions } from "sharp";
import { env } from "./env";
import { resolveFontFile } from "./font-cache";
import { type PosterCopy, splitPosterCopy } from "./poster-copy";

const visionAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation })
  : null;

// Brand assets are applied post-generation as a logo + typeset copy — not per-brand model
// fine-tuning — per the product plan's "Brand Assets — technical approach" decision.
//
// Layout follows basic poster craft rather than a fixed strip: copy gets a hierarchy (kicker /
// dominant headline / quieter subline), is set as one left- or right-aligned block on a margin,
// and goes wherever the image is calmest; the logo takes a different quiet corner.
export interface BrandOverlayOptions {
  logoUrl?: string | null;
  primaryColor?: string | null;
  // Older posters: one tagline, split into kicker/headline/subline automatically.
  tagline?: string | null;
  // Poster brief: structured copy, each part placed and styled as given (takes precedence).
  copy?: PosterCopyParts | null;
  font?: string | null;
}

export interface PosterCopyParts {
  headline?: string | null;
  subline?: string | null;
  offer?: string | null;
  cta?: string | null;
  contactLine?: string | null;
}

type Rgb = [number, number, number];
type Align = "left" | "right" | "center";

interface Box { x: number; y: number; w: number; h: number }

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      default: return "&quot;";
    }
  });
}

// ---------- color ----------

export function hexToRgb(hex: string): Rgb | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const rgbToHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// WCAG relative luminance / contrast ratio.
export function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// No brand color: pull the image's own most vivid color so the accent harmonizes with the art.
async function vividColor(image: Buffer): Promise<Rgb> {
  const { data } = await sharp(image).resize(24, 24, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let best: Rgb = [255, 255, 255];
  let bestScore = -1;
  for (let i = 0; i < data.length; i += 3) {
    const px: Rgb = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(...px), min = Math.min(...px);
    const score = max === 0 ? 0 : ((max - min) / max) * (max / 255);
    if (score > bestScore) { bestScore = score; best = px; }
  }
  return best;
}

// ---------- where the image is calm ----------

const GRID = 96;

// Gradient-magnitude map of a small greyscale copy: high where the image is busy (the subject,
// texture, edges), low over clean wall/sky/floor where copy can sit and stay legible.
async function analyze(image: Buffer): Promise<{ energy: Float32Array; lum: Float32Array }> {
  const grey = await sharp(image).resize(GRID, GRID, { fit: "fill" }).greyscale().blur(0.8).raw().toBuffer();
  const energy = new Float32Array(GRID * GRID);
  const lum = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const dx = grey[y * GRID + Math.min(GRID - 1, x + 1)] - grey[y * GRID + Math.max(0, x - 1)];
      const dy = grey[Math.min(GRID - 1, y + 1) * GRID + x] - grey[Math.max(0, y - 1) * GRID + x];
      energy[i] = Math.abs(dx) + Math.abs(dy);
      lum[i] = grey[i] / 255;
    }
  }
  return { energy, lum };
}

function regionStats(map: { energy: Float32Array; lum: Float32Array }, box: Box, width: number, height: number) {
  const x0 = Math.max(0, Math.floor((box.x / width) * GRID)), x1 = Math.min(GRID, Math.ceil(((box.x + box.w) / width) * GRID));
  const y0 = Math.max(0, Math.floor((box.y / height) * GRID)), y1 = Math.min(GRID, Math.ceil(((box.y + box.h) / height) * GRID));
  const values: number[] = [];
  let l = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { values.push(map.energy[y * GRID + x]); l += map.lum[y * GRID + x]; }
  if (!values.length) return { energy: Infinity, lum: 0.5 };
  // Mean alone lets a block sit over the subject if the rest of its area is calm — weigh in the
  // busiest part (85th percentile) so overlapping a face or product counts heavily against a spot.
  values.sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const p85 = values[Math.floor(values.length * 0.85)];
  return { energy: mean * 0.5 + p85 * 0.5, lum: l / values.length };
}

// Where the people / faces / product are. Detail-based calmness alone can't see a person in plain,
// smooth clothing (a teal saree measured as "calm" and got the headline set over it), so copy and
// logo placement also avoid these boxes. Best effort: no boxes on failure.
async function detectSubjects(image: Buffer, width: number, height: number): Promise<Box[]> {
  if (!visionAI) return [];
  try {
    const small = await sharp(image).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const response = await visionAI.models.generateContent({
      model: env.imageCheckModel,
      contents: [
        { inlineData: { data: small.toString("base64"), mimeType: "image/jpeg" } },
        "Return a bounding box for every person (whole body, including clothing and limbs) and every featured product in this image, as [ymin, xmin, ymax, xmax] on a 0-1000 scale.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { boxes: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
          required: ["boxes"],
        },
      },
    });
    const parsed = JSON.parse(response.text ?? "{}") as { boxes?: number[][] };
    return (parsed.boxes ?? [])
      .filter((b) => b.length === 4)
      .map(([ymin, xmin, ymax, xmax]) => ({ x: (xmin / 1000) * width, y: (ymin / 1000) * height, w: ((xmax - xmin) / 1000) * width, h: ((ymax - ymin) / 1000) * height }));
  } catch (err) {
    console.warn("[poster-overlay] subject detection failed, placing by calmness only:", err instanceof Error ? err.message : err);
    return [];
  }
}

// Fraction of box `a` covered by any subject box.
function subjectOverlap(a: Box, subjects: Box[]): number {
  const covered = subjects.reduce((sum, b) => {
    const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return sum + w * h;
  }, 0);
  return Math.min(1, covered / Math.max(1, a.w * a.h));
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------- type ----------

const WEIGHT_NAMES: Record<number, string> = { 400: "Normal", 500: "Medium", 700: "Bold", 800: "Ultra-Bold" };

export interface Face { family: string; weight: number; file: string | null }

export async function face(font: string | null | undefined, weight: number): Promise<Face> {
  const file = font ? await resolveFontFile(font, weight) : null;
  return { family: file && font ? font : "sans-serif", weight, file };
}

// One line of Pango markup rendered to a transparent PNG. Pango (unlike SVG <text> via librsvg)
// accepts the font as a file, so brand fonts don't need to be installed on the host.
export async function renderLine(markup: string, f: Face, size: number): Promise<{ buf: Buffer; w: number; h: number }> {
  const buf = await sharp({
    text: {
      text: markup,
      font: `${f.family} ${WEIGHT_NAMES[f.weight] ?? "Bold"} ${Math.max(1, Math.round(size))}`,
      ...(f.file ? { fontfile: f.file } : {}),
      dpi: 72, // 1pt = 1px, so sizes are in pixels
      rgba: true,
    },
  }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  return { buf, w: width, h: height };
}

// Split into two lines at the space that best balances their lengths.
export function balance(text: string): string[] {
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index!);
  if (!spaces.length) return [text];
  const split = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best));
  // Drop a separator left dangling at the break ("…for 2027 ·" / "· Nursery to Grade 10").
  return [text.slice(0, split), text.slice(split + 1)].map((line) => line.replace(/^\s*[·•|–—-]\s*|\s*[·•|–—,-]\s*$/g, "").trim());
}

// Offer figures ("30%", "$49", "₹999", "free") pick up the accent color — the one spot of color
// that tells the eye where the deal is.
function emphasizeOffer(text: string, accent: string | null): string {
  const escaped = escapeXml(text);
  if (!accent) return escaped;
  return escaped.replace(/([$€£₹]\s?\d[\d,.]*|\d[\d,.]*\s?%|\bfree\b)/gi, `<span foreground="${accent}">$1</span>`);
}

interface Placed { buf: Buffer; w: number; h: number; top: number }

// A filled rounded label — the offer badge and the call-to-action button. Text color is picked
// for contrast against the fill.
async function pill(text: string, f: Face, size: number, fill: string, radius: "soft" | "full"): Promise<{ buf: Buffer; w: number; h: number }> {
  const fillRgb = hexToRgb(fill) ?? [255, 255, 255];
  const textColor = luminance(fillRgb) > 0.4 ? "#111111" : "#ffffff";
  const label = await renderLine(
    `<span foreground="${textColor}" letter_spacing="${Math.round(size * 0.08 * 1024)}">${escapeXml(text.toUpperCase())}</span>`,
    f, size,
  );
  const padX = Math.round(size * 1.1), padY = Math.round(size * 0.55);
  const w = label.w + padX * 2, h = label.h + padY * 2;
  const r = radius === "full" ? h / 2 : Math.round(size * 0.35);
  const bg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" /></svg>`);
  const buf = await sharp(bg).composite([{ input: label.buf, left: padX, top: padY }]).png().toBuffer();
  return { buf, w, h };
}

// Builds the copy block (accent rule or offer badge, kicker, headline, subline, call-to-action
// button, contact line) as one transparent image.
async function buildCopyBlock(
  copy: PosterCopy,
  font: string | null | undefined,
  S: number,
  maxWidth: number,
  align: Align,
  ink: string,
  accent: string | null,
  extras: Pick<PosterCopyParts, "offer" | "cta" | "contactLine"> = {},
): Promise<{ buf: Buffer; w: number; h: number }> {
  const [heavy, bold, medium, regular] = await Promise.all([face(font, 800), face(font, 700), face(font, 500), face(font, 400)]);
  const elements: Placed[] = [];
  let y = 0;

  if (extras.offer) {
    // Offer badge takes the anchor spot — the deal is the first thing the eye should land on.
    const badge = await pill(extras.offer, bold, S * 0.03, accent ?? ink, "soft");
    elements.push({ ...badge, top: y });
    y += badge.h + S * 0.026;
  } else {
    // Accent rule — a short thick bar that anchors the block and carries the brand color.
    const ruleW = Math.round(S * 0.075), ruleH = Math.max(3, Math.round(S * 0.009));
    const rule = await sharp({ create: { width: ruleW, height: ruleH, channels: 4, background: accent ?? ink } }).png().toBuffer();
    elements.push({ buf: rule, w: ruleW, h: ruleH, top: y });
    y += ruleH + S * 0.022;
  }

  if (copy.kicker) {
    const size = S * 0.026;
    // Small caps-style label: uppercase, wide tracking (0.2em), accent colored.
    const k = await renderLine(
      `<span foreground="${accent ?? ink}" letter_spacing="${Math.round(size * 0.2 * 1024)}">${escapeXml(copy.kicker.toUpperCase())}</span>`,
      bold, size,
    );
    elements.push({ ...k, top: y });
    y += k.h + S * 0.006;
  }

  // Headline may be absent when a poster brief only has an offer / CTA.
  let headSize = S * 0.115;
  if (copy.headline) {
    // Headline: short hooks go uppercase; big display type gets slightly tightened tracking and
    // tight leading, the way a designer would set it. Shrinks to fit, wraps to two lines at most.
    const words = copy.headline.split(/\s+/).length;
    const headText = words <= 4 ? copy.headline.toUpperCase() : copy.headline;
    const headMarkup = (line: string, size: number) =>
      `<span foreground="${ink}" letter_spacing="${Math.round(-size * 0.015 * 1024)}">${emphasizeOffer(line, accent)}</span>`;
    const renderHead = async (lines: string[], size: number) => Promise.all(lines.map((l) => renderLine(headMarkup(l, size), heavy, size)));
    let headLines = [headText];
    let rendered = await renderHead(headLines, headSize);
    const widest = () => Math.max(...rendered.map((r) => r.w));
    if (widest() > maxWidth && headText.includes(" ")) {
      headLines = balance(headText);
      rendered = await renderHead(headLines, headSize);
    }
    if (widest() > maxWidth) {
      headSize = Math.floor((headSize * maxWidth) / widest());
      rendered = await renderHead(headLines, headSize);
    }
    const leading = headSize * 0.98;
    rendered.forEach((r, i) => elements.push({ ...r, top: y + i * leading }));
    y += (rendered.length - 1) * leading + rendered[rendered.length - 1].h + S * 0.02;
  }

  if (copy.subline) {
    const size = Math.min(S * 0.04, headSize * 0.42);
    const subMarkup = (line: string) => `<span foreground="${ink}" fgalpha="88%">${escapeXml(line)}</span>`;
    const single = await renderLine(subMarkup(copy.subline), medium, size);
    const parts = single.w > maxWidth
      ? await Promise.all(balance(copy.subline).map((l) => renderLine(subMarkup(l), medium, size)))
      : [single];
    parts.forEach((p, i) => elements.push({ ...p, top: y + i * size * 1.25 }));
    y += (parts.length - 1) * size * 1.25 + parts[parts.length - 1].h;
  }

  if (extras.cta) {
    y += S * 0.032;
    const button = await pill(extras.cta, bold, S * 0.03, accent ?? ink, "full");
    elements.push({ ...button, top: y });
    y += button.h;
  }

  if (extras.contactLine) {
    y += S * 0.024;
    const size = S * 0.024;
    const contactMarkup = (line: string) => `<span foreground="${ink}" fgalpha="80%">${escapeXml(line)}</span>`;
    const single = await renderLine(contactMarkup(extras.contactLine), regular, size);
    const parts = single.w > maxWidth
      ? await Promise.all(balance(extras.contactLine).map((l) => renderLine(contactMarkup(l), regular, size)))
      : [single];
    parts.forEach((p, i) => elements.push({ ...p, top: y + i * size * 1.3 }));
    y += (parts.length - 1) * size * 1.3 + parts[parts.length - 1].h;
  }

  const w = Math.ceil(Math.max(...elements.map((e) => e.w)));
  const h = Math.ceil(y);
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(elements.map((e) => ({
      input: e.buf,
      top: Math.round(e.top),
      left: align === "left" ? 0 : align === "right" ? w - e.w : Math.round((w - e.w) / 2),
    })))
    .png()
    .toBuffer();
  return { buf, w, h };
}

// Soft blurred silhouette of an overlay element, composited just under it so it separates from
// the image without a backing plate or band.
export async function withShadow(element: Buffer, darkShadow: boolean, blur: number, strength = 0.5): Promise<{ input: Buffer; pad: number }> {
  const { width = 0, height = 0 } = await sharp(element).metadata();
  const pad = Math.max(4, Math.round(blur * 2));
  const padded = await sharp(element).ensureAlpha()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const alpha = await sharp(padded).extractChannel(3).linear(strength, 0).blur(Math.max(0.3, blur)).toBuffer();
  const shade = darkShadow ? 0 : 255;
  const shadow = await sharp({ create: { width: width + pad * 2, height: height + pad * 2, channels: 3, background: { r: shade, g: shade, b: shade } } })
    .joinChannel(alpha).png().toBuffer();
  const input = await sharp(shadow).composite([{ input: padded, left: 0, top: 0 }]).png().toBuffer();
  return { input, pad };
}

// ---------- logo ----------

// A brand-kit "logo" that is one flat color with no transparency (e.g. a placeholder square)
// reads as a glitch on the poster, not a mark — leave it off rather than stamp a colored box.
export async function isPlaceholderLogo(logo: Buffer): Promise<boolean> {
  const { channels } = await sharp(logo).ensureAlpha().stats();
  return channels.every((c) => c.stdev < 4);
}

// Alpha-weighted luminance of the logo's visible pixels.
export async function logoLuminance(logo: Buffer): Promise<number> {
  const { data } = await sharp(logo).resize(32, 32, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    sum += luminance([data[i], data[i + 1], data[i + 2]]) * a;
    weight += a;
  }
  return weight ? sum / weight : 0.5;
}

// Knockout version (all white or all black, same alpha) — what designers use when a full-color
// logo would disappear against the photo behind it.
export async function knockout(logo: Buffer, white: boolean): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(logo).metadata();
  const alpha = await sharp(logo).ensureAlpha().extractChannel(3).toBuffer();
  const v = white ? 255 : 0;
  return sharp({ create: { width, height, channels: 3, background: { r: v, g: v, b: v } } }).joinChannel(alpha).png().toBuffer();
}

// ---------- compose ----------

export async function applyBrandOverlay(baseImage: Buffer, options: BrandOverlayOptions): Promise<Buffer> {
  const { logoUrl, primaryColor, tagline, font } = options;
  const structured = options.copy && (options.copy.headline || options.copy.subline || options.copy.offer || options.copy.cta || options.copy.contactLine)
    ? options.copy
    : null;

  const base = sharp(baseImage);
  const { width = 1024, height = 1024 } = await base.metadata();
  const S = Math.min(width, height);
  const M = Math.round(S * 0.06); // outer margin
  const [map, subjects] = await Promise.all([analyze(baseImage), detectSubjects(baseImage, width, height)]);
  const composites: OverlayOptions[] = [];
  let textBox: Box | null = null;

  if (structured || tagline) {
    // Poster brief copy is used exactly as given; older posters split their single tagline.
    const copy: PosterCopy = structured
      ? { kicker: null, headline: structured.headline ?? "", subline: structured.subline ?? null }
      : await splitPosterCopy(tagline!);
    const extras = structured ? { offer: structured.offer, cta: structured.cta, contactLine: structured.contactLine } : {};
    const brandAccent = primaryColor ? hexToRgb(primaryColor) : null;
    const accentRgb = brandAccent ?? (await vividColor(baseImage));

    // Measure the block once (left-aligned) to know its footprint, then score every candidate
    // anchor by how busy the image is under it; alignment follows the side it lands on.
    // Try a few block widths: a narrower block (smaller type) often fits the image's actual calm
    // area where a wide one would run over the subject. A full copy set can also make the block
    // tall, so each width's type is scaled down until the block takes at most ~40% of the height.
    const BLOCK_WIDTHS = [0.52, 0.42, 0.34];
    const probes = [];
    for (const fraction of BLOCK_WIDTHS) {
      let typeScale = S;
      let probe = await buildCopyBlock(copy, font, typeScale, width * fraction, "left", "#ffffff", null, extras);
      while (probe.h > height * 0.4 && typeScale > S * 0.6) {
        typeScale *= 0.88;
        probe = await buildCopyBlock(copy, font, typeScale, width * fraction, "left", "#ffffff", null, extras);
      }
      probes.push({ fraction, typeScale, w: probe.w, h: probe.h });
    }
    const candidates = probes.flatMap((p) => {
      // Mild preference for the widest block (bigger type) when it's just as calm.
      const widthBias = 1 + (BLOCK_WIDTHS[0] - p.fraction) * 0.8;
      const anchors: { box: Box; align: Align; bias: number }[] = [
        { box: { x: M, y: M, w: p.w, h: p.h }, align: "left", bias: 1 },
        { box: { x: M, y: height - M - p.h, w: p.w, h: p.h }, align: "left", bias: 1 },
        { box: { x: width - M - p.w, y: M, w: p.w, h: p.h }, align: "right", bias: 1.08 },
        { box: { x: width - M - p.w, y: height - M - p.h, w: p.w, h: p.h }, align: "right", bias: 1.08 },
        { box: { x: (width - p.w) / 2, y: M, w: p.w, h: p.h }, align: "center", bias: 1.12 },
        { box: { x: (width - p.w) / 2, y: height - M - p.h, w: p.w, h: p.h }, align: "center", bias: 1.12 },
      ];
      return anchors.map((a) => ({ ...a, ...regionStats(map, a.box, width, height), probe: p, score: 0, widthBias }));
    });
    // Covering a person or the product is the worst outcome — it outweighs any calmness gain.
    candidates.forEach((c) => (c.score = c.energy * c.bias * c.widthBias * (1 + subjectOverlap(c.box, subjects) * 8)));
    const pick = candidates.reduce((best, c) => (c.score < best.score ? c : best));
    const typeScale = pick.probe.typeScale;

    const bgLum = pick.lum; // greyscale mean, ~perceptual 0-1
    const darkInk = bgLum > 0.62;
    const ink = darkInk ? "#141414" : "#ffffff";
    // Accent only where it actually reads against the background; otherwise stay monochrome.
    const accent = contrast(luminance(accentRgb), bgLum ** 2.2) >= 2.6 ? rgbToHex(accentRgb) : null;

    const block = await buildCopyBlock(copy, font, typeScale, width * pick.probe.fraction, pick.align, ink, accent, extras);
    const x = pick.align === "left" ? M : pick.align === "right" ? width - M - block.w : Math.round((width - block.w) / 2);
    const y = pick.box.y < height / 2 ? M : height - M - block.h;
    textBox = { x, y, w: block.w, h: block.h };

    // Local soft scrim: an elliptical glow of shade behind the block only, fading to nothing —
    // lifts the copy off texture without any visible band or box.
    const sw = Math.round(block.w * 1.9), sh = Math.round(block.h * 2.1);
    const tint = darkInk ? "#ffffff" : "#000000";
    const scrim = Buffer.from(`<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="g"><stop offset="0" stop-color="${tint}" stop-opacity="0.38" />
      <stop offset="0.55" stop-color="${tint}" stop-opacity="0.18" /><stop offset="1" stop-color="${tint}" stop-opacity="0" /></radialGradient></defs>
      <ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw / 2}" ry="${sh / 2}" fill="url(#g)" /></svg>`);
    const sx = Math.round(x + block.w / 2 - sw / 2), sy = Math.round(y + block.h / 2 - sh / 2);
    // Crop the scrim to the canvas — sharp rejects composites that hang off the edge.
    const cl = Math.max(0, -sx), ct = Math.max(0, -sy);
    const cw = Math.min(sw - cl, width - Math.max(0, sx)), ch = Math.min(sh - ct, height - Math.max(0, sy));
    if (cw > 0 && ch > 0) {
      const cropped = await sharp(scrim).extract({ left: cl, top: ct, width: cw, height: ch }).png().toBuffer();
      composites.push({ input: cropped, left: Math.max(0, sx), top: Math.max(0, sy) });
    }

    const { input, pad } = await withShadow(block.buf, !darkInk, S * 0.006, 0.45);
    composites.push({ input, left: x - pad, top: y - pad });
  }

  if (logoUrl) {
    const res = await fetch(logoUrl);
    const raw = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (raw && (await isPlaceholderLogo(raw))) {
      console.warn("[poster-overlay] brand logo is a flat single-color image (placeholder?) — skipping it");
    } else if (raw) {
      let logo: Buffer = await sharp(raw).resize({ height: Math.round(S * 0.065), width: Math.round(width * 0.24), fit: "inside" }).png().toBuffer();
      const { width: lw = 0, height: lh = 0 } = await sharp(logo).metadata();
      const corners: Box[] = [
        { x: M, y: M, w: lw, h: lh },
        { x: width - M - lw, y: M, w: lw, h: lh },
        { x: M, y: height - M - lh, w: lw, h: lh },
        { x: width - M - lw, y: height - M - lh, w: lw, h: lh },
      ];
      // Calmest corner that doesn't collide with the copy block (with breathing room).
      const gap = S * 0.03;
      const free = corners.filter((c) => !textBox || !overlaps({ x: c.x - gap, y: c.y - gap, w: c.w + gap * 2, h: c.h + gap * 2 }, textBox));
      const spot = (free.length ? free : corners)
        .map((c) => ({ c, ...regionStats(map, c, width, height) }))
        .reduce((best, c) => (c.energy * (1 + subjectOverlap(c.c, subjects) * 8) < best.energy * (1 + subjectOverlap(best.c, subjects) * 8) ? c : best));

      if (contrast(await logoLuminance(logo), spot.lum ** 2.2) < 1.8) logo = await knockout(logo, spot.lum < 0.55);
      const shadowed = await withShadow(logo, spot.lum < 0.55, S * 0.005, 0.4);
      composites.push({ input: shadowed.input, left: Math.round(spot.c.x) - shadowed.pad, top: Math.round(spot.c.y) - shadowed.pad });
    }
  }

  return base.composite(composites).png().toBuffer();
}
