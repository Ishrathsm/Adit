// One template remix end to end, outside the queue: fill → generate with the template as style
// reference → proofread/re-roll → real logo overlay. Usage: npx tsx eval/template-test.ts <templateId> "<request>" <out.png> [logoUrl]
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { applyBrandOverlay } from "../src/lib/poster-overlay";
import { fillTemplate, generateTemplatePoster } from "../src/lib/template-poster";
import { getTemplateById } from "../src/lib/templates";

const [id, request, out, logoUrl] = process.argv.slice(2);
(async () => {
  const t = await getTemplateById(id);
  if (!t?.thumbnail_url) throw new Error("template not found or has no image");
  const res = await fetch(t.thumbnail_url);
  const templateImage = { imageBytes: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" };
  const filled = await fillTemplate(t.template_prompt, request, undefined, { productNames: [] });
  console.log("TEXTS:", JSON.stringify(filled.texts));
  const poster = await generateTemplatePoster(filled, "3:4", templateImage, []);
  const buf = await applyBrandOverlay(Buffer.from(poster.imageBytes, "base64"), { logoUrl: logoUrl ?? null });
  writeFileSync(out, buf);
  console.log("wrote", out);
  process.exit(0);
})();
