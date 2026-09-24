import sharp, { type OverlayOptions } from "sharp";
import { resolveFontFile } from "./font-cache";

// Brand assets are applied post-generation as a logo watermark + tagline — not per-brand
// model fine-tuning — per the product plan's "Brand Assets — technical approach" decision.
export interface BrandOverlayOptions {
  logoUrl?: string | null;
  tagline?: string | null;
  font?: string | null;
}

function escapeXml(value: string): string {
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

// Zone geometry — keep in sync with the reserved-zone wording in prompt-refiner.ts's imageAddendum.
const ZONE_HEIGHT = 0.12; // bottom strip holding the tagline
const LOGO_HEIGHT = 0.08;
const MARGIN = 0.04;

// Mean luminance (0-1) of the bottom strip, so the tagline can go light-on-dark or dark-on-light
// instead of needing a solid band behind it to be readable.
async function bottomLuminance(image: Buffer, width: number, height: number): Promise<number> {
  const zoneHeight = Math.round(height * ZONE_HEIGHT);
  const { channels } = await sharp(image)
    .extract({ left: 0, top: height - zoneHeight, width, height: zoneHeight })
    .removeAlpha()
    .stats();
  const [r, g, b] = channels.map((c) => c.mean / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Soft blurred silhouette of an overlay element (logo or tagline), composited just under it so it
// separates from whatever the poster has behind it without needing a backing plate or band.
async function withShadow(element: Buffer, darkShadow: boolean, blurRatio: number, offsetY = 0): Promise<{ input: Buffer; pad: number }> {
  const { width = 0, height = 0 } = await sharp(element).metadata();
  const pad = Math.max(4, Math.round(height * blurRatio));
  const extend = (buf: Buffer, top: number, bottom: number) =>
    sharp(buf)
      .ensureAlpha()
      .extend({ top, bottom, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  const padded = await extend(element, pad, pad);
  // Shadow is the same silhouette nudged down by offsetY (capped so the extend stays non-negative).
  const offset = Math.min(offsetY, pad);
  const shifted = await extend(element, pad + offset, pad - offset);
  const alpha = await sharp(shifted).extractChannel(3).linear(0.55, 0).blur(pad / 2).toBuffer();
  const shade = darkShadow ? 0 : 255;
  const shadow = await sharp({
    create: { width: width + pad * 2, height: height + pad * 2, channels: 3, background: { r: shade, g: shade, b: shade } },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  const input = await sharp(shadow).composite([{ input: padded, left: 0, top: 0 }]).png().toBuffer();
  return { input, pad };
}

// Renders tagline lines with Pango via sharp — unlike SVG <text> (librsvg), this can take the
// brand font as a file, so it doesn't depend on the font being installed on the host.
async function renderText(lines: string[], fontSize: number, fill: string, family: string, fontFile: string | null): Promise<Buffer> {
  return sharp({
    text: {
      text: `<span foreground="${fill}">${escapeXml(lines.join("\n"))}</span>`,
      font: `${family} Bold ${fontSize}`,
      ...(fontFile ? { fontfile: fontFile } : {}),
      dpi: 72, // 1pt = 1px, so fontSize is in pixels
      align: "centre",
      rgba: true,
    },
  })
    .png()
    .toBuffer();
}

export async function applyBrandOverlay(baseImage: Buffer, options: BrandOverlayOptions): Promise<Buffer> {
  const { logoUrl, tagline, font } = options;

  const base = sharp(baseImage);
  const { width = 1024, height = 1024 } = await base.metadata();
  const composites: OverlayOptions[] = [];

  const lightBackground = (await bottomLuminance(baseImage, width, height)) > 0.6;
  const margin = Math.round(height * MARGIN);

  // Transparent treatment, no solid band: a gradient that is fully clear at the top of the zone
  // and only lightly tinted at the very bottom edge, just enough to lift the tagline off a busy
  // image. Tint follows the background so it deepens contrast rather than muddying it.
  if (tagline) {
    const scrimHeight = Math.round(height * ZONE_HEIGHT * 1.8);
    const tint = lightBackground ? "#ffffff" : "#000000";
    composites.push({
      input: Buffer.from(`<svg width="${width}" height="${scrimHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${tint}" stop-opacity="0" />
          <stop offset="1" stop-color="${tint}" stop-opacity="0.45" />
        </linearGradient></defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>`),
      left: 0,
      top: height - scrimHeight,
    });
  }

  let logoRight = 0;
  if (logoUrl) {
    const res = await fetch(logoUrl);
    if (res.ok) {
      const logoHeight = Math.round(height * LOGO_HEIGHT);
      const resizedLogo = await sharp(Buffer.from(await res.arrayBuffer())).resize({ height: logoHeight }).toBuffer();
      const { input, pad } = await withShadow(resizedLogo, !lightBackground, 0.15);
      const logoWidth = (await sharp(resizedLogo).metadata()).width ?? logoHeight;
      composites.push({ input, left: margin - pad, top: height - logoHeight - margin - pad });
      logoRight = margin + logoWidth;
    }
  }

  if (tagline) {
    const zoneHeight = Math.round(height * ZONE_HEIGHT);
    // Centered, but kept clear of the logo on both sides so it stays visually centered.
    const textWidth = width - 2 * (logoRight ? logoRight + margin : margin);
    const fontFile = font ? await resolveFontFile(font) : null;
    const family = fontFile && font ? font : "sans-serif";
    const fill = lightBackground ? "#111111" : "#ffffff";

    // Render, measure, and scale down to fit the width; past a readable minimum, wrap onto two
    // lines at the space nearest the middle instead of shrinking further.
    const renderFitted = async (lines: string[], maxSize: number) => {
      let size = Math.round(maxSize);
      let buf = await renderText(lines, size, fill, family, fontFile);
      const measured = (await sharp(buf).metadata()).width ?? 0;
      if (measured > textWidth) {
        size = Math.floor((size * textWidth) / measured);
        buf = await renderText(lines, size, fill, family, fontFile);
      }
      return { buf, size };
    };
    let text = await renderFitted([tagline], zoneHeight * 0.36);
    if (text.size < zoneHeight * 0.24 && tagline.includes(" ")) {
      const mid = tagline.length / 2;
      const spaces = [...tagline.matchAll(/ /g)].map((m) => m.index!);
      const split = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
      text = await renderFitted([tagline.slice(0, split), tagline.slice(split + 1)], zoneHeight * 0.3);
    }

    const { input } = await withShadow(text.buf, !lightBackground, 0.12, Math.max(1, Math.round(text.size * 0.05)));
    const meta = await sharp(input).metadata();
    composites.push({
      input,
      left: Math.round((width - (meta.width ?? 0)) / 2),
      top: Math.round(height - zoneHeight / 2 - (meta.height ?? 0) / 2),
    });
  }

  return base.composite(composites).png().toBuffer();
}
