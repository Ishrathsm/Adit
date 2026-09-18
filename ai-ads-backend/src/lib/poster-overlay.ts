import sharp, { type OverlayOptions } from "sharp";

// Brand assets are applied post-generation as a logo watermark + tagline bar — not per-brand
// model fine-tuning — per the product plan's "Brand Assets — technical approach" decision.
export interface BrandOverlayOptions {
  logoUrl?: string | null;
  primaryColor?: string | null;
  tagline?: string | null;
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

export async function applyBrandOverlay(baseImage: Buffer, options: BrandOverlayOptions): Promise<Buffer> {
  const { logoUrl, primaryColor, tagline } = options;

  const base = sharp(baseImage);
  const { width = 1024, height = 1024 } = await base.metadata();
  const composites: OverlayOptions[] = [];

  if (logoUrl) {
    const res = await fetch(logoUrl);
    if (res.ok) {
      const logoBuffer = Buffer.from(await res.arrayBuffer());
      const logoHeight = Math.round(height * 0.08);
      const resizedLogo = await sharp(logoBuffer).resize({ height: logoHeight }).toBuffer();
      composites.push({
        input: resizedLogo,
        left: Math.round(width * 0.04),
        top: height - logoHeight - Math.round(height * 0.04),
      });
    }
  }

  if (tagline) {
    const barHeight = Math.round(height * 0.12);
    const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${primaryColor ?? "#000000"}" fill-opacity="0.6" />
      <text x="50%" y="58%" font-family="sans-serif" font-size="${Math.round(barHeight * 0.32)}"
        fill="white" text-anchor="middle" dominant-baseline="middle">${escapeXml(tagline)}</text>
    </svg>`;
    composites.push({ input: Buffer.from(svg), left: 0, top: height - barHeight });
  }

  return base.composite(composites).png().toBuffer();
}
