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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { uploadPoster } from "../src/lib/storage";
import { supabase } from "../src/lib/supabase";
import { createTemplate } from "../src/lib/templates";
import { checkTemplateFolder, resolveAspectRatio } from "./template-folder";

const ROOT = join(__dirname, "..", "..", "ad-templates");

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
    const result = checkTemplateFolder(ROOT, folder);
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
    const aspectRatio = await resolveAspectRatio(meta, image);
    if (dryRun) {
      console.log(`✓ ${folder}: ready ("${meta.name}", ${prompt.length} chars, ${aspectRatio})`);
      continue;
    }
    const thumbnailUrl = await uploadPoster(`templates/${folder}`, readFileSync(image));
    const t = await createTemplate({
      type: meta.type ?? "poster",
      name: meta.name.trim(),
      description: meta.description?.trim() || null,
      thumbnailUrl,
      templatePrompt: prompt,
      aspectRatio,
    });
    console.log(`✓ ${folder}: imported "${t.name}" (${aspectRatio})`);
  }
  process.exit(failed ? 1 : 0);
})();
