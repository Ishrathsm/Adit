import sharp, { type OverlayOptions } from "sharp";
import {
  balance,
  contrast,
  escapeXml,
  face,
  hexToRgb,
  isPlaceholderLogo,
  knockout,
  logoLuminance,
  luminance,
  renderLine,
  withShadow,
} from "./poster-overlay";

// Typeset text for video: the closing end card and the on-screen text lines ("supers") shown over
// shots. Both are rendered as images here and composited by the edit (video-stitch.ts), so the
// wording is exactly what the user typed — never generated into the footage.

export interface EndCardContent {
  brandName: string | null;
  keyMessage: string | null;
  contactLine: string | null;
  logoUrl: string | null;
  // Brand primary color for the accent rule (falls back to white).
  accentColor: string | null;
  // Brand-kit font, else the tone's font.
  font: string;
  // Uppercase display for loud tones (bold), mixed case otherwise.
  uppercaseName: boolean;
}

// Renders text at a size that fits maxWidth, wrapping to two balanced lines before shrinking.
async function fittedLines(text: string, font: string, weight: number, size: number, maxWidth: number, color: string, alpha = "100%") {
  const f = await face(font, weight);
  const markup = (line: string) => `<span foreground="${color}" fgalpha="${alpha}">${escapeXml(line)}</span>`;
  let lines = [text];
  let parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  const widest = () => Math.max(...parts.map((p) => p.w));
  if (widest() > maxWidth && text.includes(" ")) {
    // Drop a separator left dangling at the wrap point ("CBSE curriculum ·" / "Smart classrooms").
    lines = balance(text).map((l) => l.replace(/^\s*[·•|–—-]\s*|\s*[·•|–—,-]\s*$/g, "").trim());
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  if (widest() > maxWidth) {
    size = Math.floor((size * maxWidth) / widest());
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  return { parts, size };
}

// Closing card: the film's last frame, blurred and darkened, with a centered stack — logo, brand
// name, accent rule, key message, contact line. Centered and generous, like a real end slate.
export async function renderEndCard(lastFrame: Buffer, content: EndCardContent): Promise<Buffer> {
  const { width = 1080, height = 1920 } = await sharp(lastFrame).metadata();
  const S = Math.min(width, height);
  const maxWidth = Math.round(width * 0.8);

  const background = await sharp(lastFrame)
    .blur(Math.max(8, S * 0.02))
    .modulate({ brightness: 0.55, saturation: 0.85 })
    .png()
    .toBuffer();

  const items: { buf: Buffer; w: number; h: number; gapAfter: number }[] = [];

  if (content.logoUrl) {
    const res = await fetch(content.logoUrl).catch(() => null);
    const raw = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (raw && !(await isPlaceholderLogo(raw))) {
      let logo: Buffer = await sharp(raw).resize({ height: Math.round(S * 0.14), width: Math.round(width * 0.5), fit: "inside" }).png().toBuffer();
      // The card background is darkened, so a dark logo gets a white knockout.
      if (contrast(await logoLuminance(logo), 0.04) < 2.5) logo = await knockout(logo, true);
      const meta = await sharp(logo).metadata();
      items.push({ buf: logo, w: meta.width ?? 0, h: meta.height ?? 0, gapAfter: S * 0.045 });
    }
  }

  if (content.brandName) {
    const name = content.uppercaseName ? content.brandName.toUpperCase() : content.brandName;
    const { parts } = await fittedLines(name, content.font, 700, S * 0.085, maxWidth, "#ffffff");
    parts.forEach((p, i) => items.push({ ...p, gapAfter: i === parts.length - 1 ? S * 0.03 : S * 0.005 }));
  }

  // Accent rule between the name and the message.
  const accentRgb = content.accentColor ? hexToRgb(content.accentColor) : null;
  const accent = accentRgb && luminance(accentRgb) > 0.08 ? content.accentColor! : "#ffffff";
  const ruleW = Math.round(S * 0.09), ruleH = Math.max(3, Math.round(S * 0.007));
  items.push({
    buf: await sharp({ create: { width: ruleW, height: ruleH, channels: 4, background: accent } }).png().toBuffer(),
    w: ruleW, h: ruleH, gapAfter: S * 0.035,
  });

  if (content.keyMessage) {
    const { parts } = await fittedLines(content.keyMessage, content.font, 500, S * 0.055, maxWidth, "#ffffff");
    parts.forEach((p, i) => items.push({ ...p, gapAfter: i === parts.length - 1 ? S * 0.04 : S * 0.005 }));
  }

  if (content.contactLine) {
    const { parts } = await fittedLines(content.contactLine, content.font, 400, S * 0.03, maxWidth, "#ffffff", "82%");
    parts.forEach((p) => items.push({ ...p, gapAfter: S * 0.006 }));
  }

  const blockH = items.reduce((sum, it, i) => sum + it.h + (i < items.length - 1 ? it.gapAfter : 0), 0);
  let y = (height - blockH) / 2;
  const composites: OverlayOptions[] = [];
  for (const it of items) {
    const shadowed = await withShadow(it.buf, true, S * 0.006, 0.5);
    composites.push({ input: shadowed.input, left: Math.round((width - it.w) / 2) - shadowed.pad, top: Math.round(y) - shadowed.pad });
    y += it.h + it.gapAfter;
  }
  return sharp(background).composite(composites).png().toBuffer();
}

// One on-screen text line as a full-frame transparent PNG: lower third, left-aligned on the margin,
// with a short accent bar — the standard ad "super". Overlaid (with fades) during its shot.
export async function renderSuper(text: string, width: number, height: number, font: string, accentColor: string | null): Promise<Buffer> {
  const S = Math.min(width, height);
  const margin = Math.round(S * 0.07);
  const { parts, size } = await fittedLines(text, font, 700, S * 0.06, Math.round(width * 0.8), "#ffffff");

  const barW = Math.round(S * 0.06), barH = Math.max(3, Math.round(S * 0.008));
  const accentRgb = accentColor ? hexToRgb(accentColor) : null;
  const bar = await sharp({
    create: { width: barW, height: barH, channels: 4, background: accentRgb && luminance(accentRgb) > 0.08 ? accentColor! : "#ffffff" },
  }).png().toBuffer();

  const lineGap = size * 1.15;
  const textH = (parts.length - 1) * lineGap + parts[parts.length - 1].h;
  const blockTop = Math.round(height * 0.72 - textH / 2);
  const composites: OverlayOptions[] = [{ input: bar, left: margin, top: blockTop - barH - Math.round(S * 0.02) }];
  for (let i = 0; i < parts.length; i++) {
    const shadowed = await withShadow(parts[i].buf, true, S * 0.007, 0.6);
    composites.push({ input: shadowed.input, left: margin - shadowed.pad, top: Math.round(blockTop + i * lineGap) - shadowed.pad });
  }
  // Soft shade under the lower third so the line reads over busy footage — no hard band.
  const shade = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.5" stop-color="#000" stop-opacity="0" /><stop offset="0.8" stop-color="#000" stop-opacity="0.32" />
      <stop offset="1" stop-color="#000" stop-opacity="0.4" /></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)" /></svg>`);
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shade, left: 0, top: 0 }, ...composites])
    .png()
    .toBuffer();
}
