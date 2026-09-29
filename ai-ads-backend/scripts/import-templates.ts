// Imports curated ad templates from the repo's ad-templates/ folder into Adit's template library
// (see ad-templates/README.md for the folder format and writing guidelines). The template image is
// uploaded as the card thumbnail — Remix also uses it as the style reference — and the prompt is
// stored as written. Templates that already exist (same name) are skipped, so re-running is safe.
//
// Usage (from ai-ads-backend/, with the backend .env in place):
//   npx tsx scripts/import-templates.ts                 # every template folder
//   npx tsx scripts/import-templates.ts --dry-run       # check the folders, upload nothing
//   npx tsx scripts/import-templates.ts food-restaurant-promotion other-folder
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { uploadPoster } from "../src/lib/storage";
import { supabase } from "../src/lib/supabase";
import { createTemplate, type TemplateType } from "../src/lib/templates";

const ROOT = join(__dirname, "..", "..", "ad-templates");
const IMAGE_FILES = ["template.png", "template.jpg", "template.jpeg", "template.webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface Meta {
  name: string;
  description?: string;
  type?: TemplateType;
}

function check(folder: string): { meta: Meta; prompt: string; image: string } | string {
  const dir = join(ROOT, folder);
  const image = IMAGE_FILES.map((f) => join(dir, f)).find(existsSync);
  if (!image) return `needs one of ${IMAGE_FILES.join(", ")}`;
  if (statSync(image).size > MAX_IMAGE_BYTES) return "template image is over 8 MB";
  if (!existsSync(join(dir, "prompt.txt"))) return "needs prompt.txt";
  if (!existsSync(join(dir, "meta.json"))) return "needs meta.json";
  let meta: Meta;
  try {
    meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  } catch {
    return "meta.json is not valid JSON";
  }
  if (!meta.name?.trim()) return 'meta.json needs a "name"';
  if (meta.type && meta.type !== "poster" && meta.type !== "video") return 'meta.json "type" must be "poster" or "video"';
  const prompt = readFileSync(join(dir, "prompt.txt"), "utf8").trim();
  if (prompt.length < 400) return "prompt.txt is too short to be a template (write the full design direction)";
  if (!/\[[^\]]+\]/.test(prompt)) return "prompt.txt has no [Placeholders] — hard-coded copy can't be remixed";
  return { meta, prompt, image };
}

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.filter((a) => !a.startsWith("--"));
  const folders = readdirSync(ROOT).filter((f) => !f.startsWith("_") && !f.startsWith(".") && statSync(join(ROOT, f)).isDirectory() && (!only.length || only.includes(f)));
  const { data: existing, error } = await supabase.from("templates").select("name");
  if (error) throw error;
  const have = new Set((existing ?? []).map((t) => t.name));
  let failed = 0;
  for (const folder of folders) {
    const result = check(folder);
    if (typeof result === "string") {
      console.log(`✗ ${folder}: ${result}`);
      failed++;
      continue;
    }
    const { meta, prompt, image } = result;
    if (have.has(meta.name)) {
      console.log(`– ${folder}: "${meta.name}" is already in the library, skipped`);
      continue;
    }
    if (dryRun) {
      console.log(`✓ ${folder}: ready ("${meta.name}", ${prompt.length} chars)`);
      continue;
    }
    const thumbnailUrl = await uploadPoster(`templates/${folder}`, readFileSync(image));
    const t = await createTemplate({ type: meta.type ?? "poster", name: meta.name.trim(), description: meta.description?.trim() || null, thumbnailUrl, templatePrompt: prompt });
    console.log(`✓ ${folder}: imported "${t.name}"`);
  }
  process.exit(failed ? 1 : 0);
})();
