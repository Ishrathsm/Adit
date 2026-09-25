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
    lines = balance(text);
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  if (widest() > maxWidth) {
    size = Math.floor((size * maxWidth) / widest());
    parts = await Promise.all(lines.map((l) => renderLine(markup(l), f, size)));
  }
  return { parts, size };
}

// Closing card: the film's last frame, blurred under a 30% black layer, with a centered stack —
// logo, brand name, accent rule, key message, contact line. Centered and generous, like a real end
// slate. Text and logo are placed flat, with no shadow or glow — the layer alone carries contrast.
// Returned as two layers so the edit can push in on the background alone and keep the text and
// logo pixel-sharp (scaling them every frame softened the type).
export async function renderEndCard(lastFrame: Buffer, content: EndCardContent): Promise<{ background: Buffer; overlay: Buffer }> {
  const { width = 1080, height = 1920 } = await sharp(lastFrame).metadata();
  const S = Math.min(width, height);
  const maxWidth = Math.round(width * 0.8);

  const background = await sharp(lastFrame)
    .blur(Math.max(8, S * 0.02))
    .modulate({ brightness: 0.7, saturation: 0.85 })
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
