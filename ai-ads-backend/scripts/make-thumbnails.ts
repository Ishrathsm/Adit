// Adds the small <name>.thumb.webp preview next to every poster (.png) and video (.mp4) in the
// generated-media bucket that doesn't have one yet: templates, posters and videos made before
// thumbs existed. New uploads get theirs from lib/storage.ts. Files that already have a thumb are
// skipped, so re-running is safe.
//
// Usage (from ai-ads-backend/, with the backend .env in place):
//   npx tsx scripts/make-thumbnails.ts --dry-run       # list what's missing, upload nothing
//   npx tsx scripts/make-thumbnails.ts
import "../src/lib/gcp-credentials-bootstrap";
import { MEDIA_BUCKET, posterThumb, thumbPathFor, uploadThumb, videoThumb } from "../src/lib/storage";
import { supabase } from "../src/lib/supabase";

// Every file path in the bucket; folders come back from list() as entries without an id.
async function listAll(prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) paths.push(path);
      else paths.push(...(await listAll(path)));
    }
    if (!data || data.length < 1000) return paths;
  }
}

(async () => {
  const dryRun = process.argv.includes("--dry-run");
  const all = await listAll();
  const have = new Set(all);
  const todo = all.filter((p) => /\.(png|mp4)$/.test(p) && !p.endsWith(".thumb.webp") && !have.has(thumbPathFor(p)));
  console.log(`${all.length} files, ${todo.length} without a thumb${dryRun ? " (dry run)" : ""}`);
  let done = 0;
  for (const path of todo) {
    if (dryRun) {
      console.log(`  would thumb ${path}`);
      continue;
    }
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(path);
    if (error || !data) {
      console.warn(`  ! ${path}: download failed (${error?.message})`);
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    await uploadThumb(path, () => (path.endsWith(".mp4") ? videoThumb(buffer) : posterThumb(buffer)));
    done++;
    console.log(`  ✓ ${path} (${done}/${todo.length})`);
  }
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
