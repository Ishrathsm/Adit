// Re-uploads each ad-templates/ folder's template.png and re-syncs its prompt/description/ratio
// for templates that already exist in the library (matched by name) — for when the local files
// change after the initial import (e.g. a corrected thumbnail, rewritten prompt, or a ratio fix).
// Templates not yet in the library are imported as usual. Safe to re-run.
//
// Usage (from ai-ads-backend/, with the backend .env in place):
//   npx tsx scripts/resync-templates.ts                 # every template folder
//   npx tsx scripts/resync-templates.ts --dry-run       # check only, upload nothing
//   npx tsx scripts/resync-templates.ts food-restaurant-promotion other-folder
import "../src/lib/gcp-credentials-bootstrap";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { uploadPoster } from "../src/lib/storage";
import { supabase } from "../src/lib/supabase";
import { createTemplate, updateTemplateSync } from "../src/lib/templates";
import { checkTemplateFolder, resolveAspectRatio, uploadVideoTemplate } from "./template-folder";

const ROOT = join(__dirname, "..", "..", "ad-templates");

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.filter((a) => !a.startsWith("--"));
  const folders = readdirSync(ROOT).filter((f) => !f.startsWith("_") && !f.startsWith(".") && statSync(join(ROOT, f)).isDirectory() && (!only.length || only.includes(f)));
  const { data: existing, error } = await supabase.from("templates").select("id, name, template_prompt, description, aspect_ratio");
  if (error) throw error;
  const byName = new Map((existing ?? []).map((t) => [t.name, t]));
  let failed = 0;
  for (const folder of folders) {
    const result = checkTemplateFolder(ROOT, folder);
    if (typeof result === "string") {
      console.log(`✗ ${folder}: ${result}`);
      failed++;
      continue;
    }
    const { meta, prompt, image } = result;
    const name = meta.name.trim();
    const description = meta.description?.trim() || null;
    const aspectRatio = meta.type === "video" ? meta.aspectRatio! : await resolveAspectRatio(meta, image);
    const row = byName.get(name);

    if (!row) {
      if (dryRun) {
        console.log(`+ ${folder}: would import new template "${name}" (${aspectRatio})`);
        continue;
      }
      const { thumbnailUrl, recipe } =
        meta.type === "video" ? await uploadVideoTemplate(folder, meta, image) : { thumbnailUrl: await uploadPoster(`templates/${folder}`, readFileSync(image)), recipe: null };
      const t = await createTemplate({ type: meta.type ?? "poster", name, description, thumbnailUrl, templatePrompt: prompt, aspectRatio, recipe });
      console.log(`✓ ${folder}: imported new template "${t.name}" (${aspectRatio})`);
      continue;
    }

    const promptChanged = row.template_prompt !== prompt;
    const descriptionChanged = (row.description ?? null) !== description;
    const ratioChanged = row.aspect_ratio !== aspectRatio;
    if (dryRun) {
      console.log(
        `~ ${folder}: would re-sync "${name}" (image always re-uploaded, prompt changed=${promptChanged}, description changed=${descriptionChanged}, ratio ${row.aspect_ratio} -> ${aspectRatio}${ratioChanged ? " [CHANGED]" : ""})`,
      );
      continue;
    }
    const { thumbnailUrl, recipe } =
      meta.type === "video" ? await uploadVideoTemplate(folder, meta, image) : { thumbnailUrl: await uploadPoster(`templates/${folder}`, readFileSync(image)), recipe: undefined };
    await updateTemplateSync(row.id, { thumbnailUrl, templatePrompt: prompt, description, aspectRatio, recipe });
    console.log(`✓ ${folder}: re-synced "${name}" (${aspectRatio})`);
  }
  process.exit(failed ? 1 : 0);
})();
