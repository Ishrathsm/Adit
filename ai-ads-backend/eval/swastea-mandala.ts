// The "Aah" moment's mandala: fine golden line art drawn in code (never a generated glow), as a
// transparent PNG the edit fades in behind the bachelor's head. → ~/Desktop/swastea/mandala.png
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const S = 900, c = S / 2;
const gold = "#F2C46D";
const ring = (r: number, w: number, o: number) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${gold}" stroke-width="${w}" opacity="${o}"/>`;
// Petals: n ellipses around the centre at radius r.
const petals = (n: number, r: number, rx: number, ry: number, o: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i + offset;
    return `<ellipse cx="${c}" cy="${c - r}" rx="${rx}" ry="${ry}" fill="none" stroke="${gold}" stroke-width="2" opacity="${o}" transform="rotate(${a} ${c} ${c})"/>`;
  }).join("");
const dots = (n: number, r: number, size: number, o: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((2 * Math.PI) / n) * i;
    return `<circle cx="${c + r * Math.cos(a)}" cy="${c + r * Math.sin(a)}" r="${size}" fill="${gold}" opacity="${o}"/>`;
  }).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
<defs><radialGradient id="g"><stop offset="0" stop-color="#FFE7B0" stop-opacity=".55"/><stop offset=".45" stop-color="#F2C46D" stop-opacity=".18"/><stop offset="1" stop-color="#F2C46D" stop-opacity="0"/></radialGradient>
<filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
<circle cx="${c}" cy="${c}" r="${c}" fill="url(#g)"/>
<g filter="url(#soft)">
${ring(120, 2, 0.8)}${ring(190, 1.5, 0.7)}${ring(300, 1.5, 0.55)}${ring(400, 1, 0.4)}
${petals(12, 150, 26, 55, 0.75)}${petals(24, 245, 22, 58, 0.6)}${petals(24, 245, 22, 58, 0.35, 7.5)}${petals(36, 350, 14, 48, 0.45)}
${dots(48, 300, 3, 0.7)}${dots(72, 400, 2, 0.5)}
</g></svg>`;
(async () => {
  const out = join(homedir(), "Desktop", "swastea", "mandala.png");
  writeFileSync(out, await sharp(Buffer.from(svg)).png().toBuffer());
  console.log(out);
})();
