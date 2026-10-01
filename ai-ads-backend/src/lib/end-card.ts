import sharp, { type OverlayOptions } from "sharp";
import {
  balance,
  contrast,
  escapeXml,
  face,
  hexToRgb,
  isPlaceholderLogo,
  colourfulShare,
  knockout,
  logoLuminance,
  luminance,
  renderLine,
} from "./poster-overlay";

// Body copy is near-black and headings take the brand color, on light backings (the user's
// direction for every overlay; contrast is kept by lightening what's behind the text).
const INK = "#141414";
// Light ink for the dark card.
const PAPER = "#f2efe9";
// Wash over the blurred end-card frame (0-1): white for the light card, black for the dark one.
const CARD_WASH = 0.72;
const DARK_WASH = 0.68;

// Typeset text for video: the closing end card and the on-screen text lines ("supers") shown over
// shots. Both are rendered as images here and composited by the edit (video-stitch.ts), so the
// wording is exactly what the user typed — never generated into the footage.

export interface EndCardContent {
  brandName: string | null;
  // A short supporting line under the brand name (e.g. "Your personal AI tutor").
  tagline?: string | null;
  keyMessage: string | null;
  contactLine: string | null;
  logoUrl: string | null;
  // Brand primary color for the accent rule (falls back to white).
  accentColor: string | null;
  // Brand-kit font, else the tone's font.
  font: string;
  // Uppercase display for loud tones (bold), mixed case otherwise.
  uppercaseName: boolean;
  // Light (white wash, dark type) or dark (black wash, light type) card. Auto picks dark when the
  // film ends on a dark frame, so a moody film doesn't flash white at the end.
  tone?: "light" | "dark" | "auto";
}

// Renders text at a size that fits maxWidth, wrapping to two balanced lines before shrinking.
// Brand fonts are usually Latin-only; Telugu text in one rendered as empty boxes. Telugu lines use
// the brand font's Telugu sibling where Google Fonts has one, else Noto Sans Telugu.
const TELUGU_SIBLING: Record<string, string> = { "Baloo 2": "Baloo Tammudu 2", Poppins: "Hind Guntur" };
const scriptFont = (text: string, font: string) => (/[\u0C00-\u0C7F]/.test(text) ? TELUGU_SIBLING[font] ?? "Noto Sans Telugu" : font);

async function fittedLines(text: string, font: string, weight: number, size: number, maxWidth: number, color: string, alpha = "100%") {
  const f = await face(scriptFont(text, font), weight);
  const markup = (line: string) => `<span foreground="${color}" fgalpha="${alpha}">${escapeXml(line)}</span>`;
  let lines = [text];
  let parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  const widest = () => Math.max(...parts.map((p) => p.w));
  if (widest() > maxWidth && text.includes(" ")) {
    lines = balance(text);
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  if (widest() > maxWidth) {
    size = Math.floor((size * maxWidth) / widest());
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  return { parts, size };
}

// Closing card: the film's last frame, blurred under a light or dark wash, with a centered stack —
// logo, brand name, accent rule, key message, contact line. Centered and generous, like a real end
// slate. Text and logo are placed flat, with no shadow or glow — the layer alone carries contrast.
// Returned as two layers so the edit can push in on the background alone and keep the text and
// logo pixel-sharp (scaling them every frame softened the type).
export async function renderEndCard(lastFrame: Buffer, content: EndCardContent): Promise<{ background: Buffer; overlay: Buffer }> {
  const { width = 1080, height = 1920 } = await sharp(lastFrame).metadata();
  const S = Math.min(width, height);
  const maxWidth = Math.round(width * 0.8);

  // The last frame blurred under a wash: white with dark type, or black with light type (the user
  // asked that the card not always be white). Two steps — sharp runs composite after blur
  // regardless of chain order, but the wash must sit on the blurred frame.
  let dark = content.tone === "dark";
  if (!content.tone || content.tone === "auto") {
    const { channels } = await sharp(lastFrame).stats();
    const mean = (0.2126 * channels[0].mean + 0.7152 * channels[1].mean + 0.0722 * channels[2].mean) / 255;
    dark = mean < 0.42;
  }
  const ink = dark ? PAPER : INK;
  const blurred = await sharp(lastFrame).blur(Math.max(8, S * 0.02)).modulate({ saturation: 0.85 }).png().toBuffer();
  const washRgb = dark ? { r: 12, g: 12, b: 14, alpha: DARK_WASH } : { r: 255, g: 255, b: 255, alpha: CARD_WASH };
  const wash = await sharp({ create: { width, height, channels: 4, background: washRgb } }).png().toBuffer();
  const background = await sharp(blurred).composite([{ input: wash, left: 0, top: 0 }]).png().toBuffer();
  const cardLum = dark ? 0.04 : 0.8; // roughly what the wash leaves behind

  const items: { buf: Buffer; w: number; h: number; gapAfter: number }[] = [];

  // A wordmark logo (wide, it already spells the name) is shown larger and replaces the typed brand
  // name, which would otherwise repeat it right underneath.
  let wordmark = false;
  if (content.logoUrl) {
    const res = await fetch(content.logoUrl).catch(() => null);
    const raw = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (raw && !(await isPlaceholderLogo(raw))) {
      const { width: lw = 1, height: lh = 1 } = await sharp(raw).metadata();
      wordmark = lw / lh >= 2.2;
      let logo: Buffer = await sharp(raw)
        .resize({ height: Math.round(S * (wordmark ? 0.12 : 0.1)), width: Math.round(width * (wordmark ? 0.36 : 0.3)), fit: "inside" })
        .png()
        .toBuffer();
      // A neutral logo that wouldn't read on the card gets its neutral parts flipped to the ink.
      if ((await colourfulShare(logo)) < 0.4 && contrast(await logoLuminance(logo), cardLum) < 2.5) logo = await knockout(logo, dark);
      const meta = await sharp(logo).metadata();
      items.push({ buf: logo, w: meta.width ?? 0, h: meta.height ?? 0, gapAfter: S * 0.045 });
    }
  }

  // Heading in the brand color when it reads on the light card (≥3:1, large text), else ink.
  const accentRgb = content.accentColor ? hexToRgb(content.accentColor) : null;
  const heading = accentRgb && contrast(luminance(accentRgb), cardLum) >= 3 ? content.accentColor! : ink;

  if (content.brandName && !wordmark) {
    const name = content.uppercaseName ? content.brandName.toUpperCase() : content.brandName;
    const { parts } = await fittedLines(name, content.font, 700, S * 0.06, maxWidth, heading);
    parts.forEach((p, i) => items.push({ ...p, gapAfter: i === parts.length - 1 ? S * 0.03 : S * 0.005 }));
  }

  if (content.tagline) {
    const { parts } = await fittedLines(content.tagline, content.font, 500, S * 0.036, maxWidth, ink, "82%");
    parts.forEach((p, i) => items.push({ ...p, gapAfter: i === parts.length - 1 ? S * 0.03 : S * 0.005 }));
  }

  // Accent rule between the name and the message.
  const accent = accentRgb && contrast(luminance(accentRgb), cardLum) >= 1.4 ? content.accentColor! : ink;
  const ruleW = Math.round(S * 0.07), ruleH = Math.max(3, Math.round(S * 0.007));
  items.push({
    buf: await sharp({ create: { width: ruleW, height: ruleH, channels: 4, background: accent } }).png().toBuffer(),
    w: ruleW, h: ruleH, gapAfter: S * 0.035,
  });

  if (content.keyMessage) {
    const { parts } = await fittedLines(content.keyMessage, content.font, 500, S * 0.042, maxWidth, ink);
    parts.forEach((p, i) => items.push({ ...p, gapAfter: i === parts.length - 1 ? S * 0.04 : S * 0.005 }));
  }

  if (content.contactLine) {
    const { parts } = await fittedLines(content.contactLine, content.font, 400, S * 0.026, maxWidth, ink, "82%");
    parts.forEach((p) => items.push({ ...p, gapAfter: S * 0.006 }));
  }

  const blockH = items.reduce((sum, it, i) => sum + it.h + (i < items.length - 1 ? it.gapAfter : 0), 0);
  let y = (height - blockH) / 2;
  const composites: OverlayOptions[] = [];
  for (const it of items) {
    composites.push({ input: it.buf, left: Math.round((width - it.w) / 2), top: Math.round(y) });
    y += it.h + it.gapAfter;
  }
  const overlay = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
  return { background, overlay };
}

// One on-screen text line as a full-frame transparent PNG: lower third, left-aligned on the margin,
// with a short accent bar — the standard ad "super". Overlaid (with fades) during its shot, over a
// light blur of the footage (see `mask`).
export async function renderSuper(text: string, width: number, height: number, font: string, accentColor: string | null): Promise<{ text: Buffer; mask: Buffer }> {
  const S = Math.min(width, height);
  const margin = Math.round(S * 0.07);
  const { parts, size } = await fittedLines(text, font, 700, S * 0.06, Math.round(width * 0.8), INK);

  const barW = Math.round(S * 0.06), barH = Math.max(3, Math.round(S * 0.008));
  const accentRgb = accentColor ? hexToRgb(accentColor) : null;
  const bar = await sharp({
    create: { width: barW, height: barH, channels: 4, background: accentRgb && luminance(accentRgb) < 0.8 ? accentColor! : INK },
  }).png().toBuffer();

  const lineGap = size * 1.15;
  const textH = (parts.length - 1) * lineGap + parts[parts.length - 1].h;
  const blockTop = Math.round(height * 0.72 - textH / 2);
  const composites: OverlayOptions[] = [{ input: bar, left: margin, top: blockTop - barH - Math.round(S * 0.02) }];
  for (let i = 0; i < parts.length; i++) {
    composites.push({ input: parts[i].buf, left: margin, top: Math.round(blockTop + i * lineGap) });
  }
  const textLayer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();

  // Text stays crisp (no shadow/glow). Behind it, only around the text block, the edit lightly
  // blurs the footage: this mask marks that patch, feathered so it has no visible edge.
  const pad = Math.round(S * 0.05);
  const textW = Math.max(barW, ...parts.map((p) => p.w));
  const boxTop = Math.max(0, blockTop - barH - Math.round(S * 0.02) - pad);
  const boxH = Math.min(height - boxTop, Math.round(textH + barH + S * 0.02 + pad * 2));
  const boxLeft = Math.max(0, margin - pad);
  const boxW = Math.min(width - boxLeft, textW + pad * 2);
  const box = await sharp({ create: { width: boxW, height: boxH, channels: 3, background: "#ffffff" } }).png().toBuffer();
  // Two steps: sharp runs composite after every other operation, so blurring in the same
  // pipeline would feather the empty canvas and leave the box hard-edged.
  const hardMask = await sharp({ create: { width, height, channels: 3, background: "#000000" } })
    .composite([{ input: box, left: boxLeft, top: boxTop }])
    .png()
    .toBuffer();
  const mask = await sharp(hardMask).blur(Math.max(4, S * 0.03)).png().toBuffer();
  return { text: textLayer, mask };
}

// ---------- finishing layer: feature callouts, corner watermark, disclaimer ----------
// Full-frame transparent PNGs the edit fades in over the footage. Flat light type with a short
// accent rule, no box or shadow (the approved Torvik finish); placed where the shot leaves room.

export type CalloutPosition = "bottom-left" | "middle-left" | "bottom-right";

// A feature callout: the feature's name in the brand font, and an optional spec line under it.
export async function renderCallout(
  title: string,
  line: string | null,
  width: number,
  height: number,
  font: string,
  accentColor: string | null,
  position: CalloutPosition = "bottom-left",
): Promise<Buffer> {
  const S = Math.min(width, height);
  const margin = Math.round(S * 0.09);
  // Middle-left sits in the empty side of a frame, so it wraps narrow; the lower third runs wider.
  const maxW = Math.round(width * (position === "middle-left" ? 0.27 : 0.45));
  const head = await fittedLines(title.toUpperCase(), font, 500, S * 0.044, maxW, PAPER);
  const sub = line ? await fittedLines(line, "Montserrat", 500, S * 0.029, Math.round(width * 0.45), PAPER, "92%") : null;
  const accentRgb = accentColor ? hexToRgb(accentColor) : null;
  const ruleW = Math.round(S * 0.064), ruleH = Math.max(3, Math.round(S * 0.005));
  const rule = await sharp({ create: { width: ruleW, height: ruleH, channels: 4, background: accentRgb ? accentColor! : PAPER } }).png().toBuffer();

  const items: { buf: Buffer; w: number; h: number; gapAfter: number }[] = [{ buf: rule, w: ruleW, h: ruleH, gapAfter: S * 0.02 }];
  head.parts.forEach((p, i) => items.push({ ...p, gapAfter: i === head.parts.length - 1 ? S * 0.016 : S * 0.008 }));
  sub?.parts.forEach((p) => items.push({ ...p, gapAfter: S * 0.006 }));
  const blockH = items.reduce((sum, it, i) => sum + it.h + (i < items.length - 1 ? it.gapAfter : 0), 0);
  let y = position === "middle-left" ? Math.round(height * 0.46 - blockH / 2) : Math.round(height - S * 0.1 - blockH);
  const composites: OverlayOptions[] = [];
  for (const it of items) {
    const left = position === "bottom-right" ? width - margin - it.w : margin;
    composites.push({ input: it.buf, left, top: Math.round(y) });
    y += it.h + it.gapAfter;
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
}

// The brand logo, small and light, in the top-right corner for the length of the footage.
export async function renderWatermark(logoUrl: string, width: number, height: number): Promise<Buffer | null> {
  const res = await fetch(logoUrl).catch(() => null);
  const raw = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  if (!raw || (await isPlaceholderLogo(raw))) return null;
  const S = Math.min(width, height);
  const resized = await sharp(raw).resize({ width: Math.round(width * 0.117), height: Math.round(S * 0.06), fit: "inside" }).png().toBuffer();
  // Light and slightly see-through, so it reads on dark and bright shots without shouting.
  const { data, info } = await sharp(await knockout(resized, true)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.82);
  const logo = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: width - info.width - Math.round(S * 0.06), top: Math.round(S * 0.05) }])
    .png()
    .toBuffer();
}

// Small print, centred at the foot of the frame (e.g. "Visuals for illustration only. T&C apply.").
export async function renderDisclaimer(text: string, width: number, height: number): Promise<Buffer> {
  const S = Math.min(width, height);
  const { parts } = await fittedLines(text, "Montserrat", 400, S * 0.021, Math.round(width * 0.9), PAPER, "75%");
  const p = parts[parts.length - 1];
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts.map((part, i) => ({ input: part.buf, left: Math.round((width - part.w) / 2), top: Math.round(height - S * 0.042 - p.h - (parts.length - 1 - i) * p.h * 1.2) })))
    .png()
    .toBuffer();
}
