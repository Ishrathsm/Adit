import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planShots } from "../src/lib/creative-brief";
import { env } from "../src/lib/env";
import { generateAdScript } from "../src/lib/text-gen";
import { TEST_BRIEFS } from "./briefs";

// Script-model comparison: every test brief through the real director + review passes, once per
// model. Usage: npx tsx eval/script-models.ts gemini-2.5-pro gemini-3.1-pro-preview
// BRIEFS=turito,skincare limits the run to those brief ids.
const models = process.argv.slice(2);
const only = process.env.BRIEFS?.split(",");
if (!models.length) throw new Error("pass one or more model ids");

const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });

(async () => {
  const results = [];
  for (const model of models) {
    // generateAdScript reads env.textModel per call.
    env.textModel = model;
    for (const t of TEST_BRIEFS.filter((b) => !only || only.includes(b.id))) {
      const started = Date.now();
      try {
        const script = await generateAdScript(t.concept, t.brief, planShots(t.brief), { brand: t.brand });
        const seconds = Math.round((Date.now() - started) / 1000);
        console.log(`${model} ${t.id}: ok in ${seconds}s`);
        results.push({ model, briefId: t.id, seconds, script });
      } catch (err) {
        console.log(`${model} ${t.id}: FAILED ${err instanceof Error ? err.message : err}`);
        results.push({ model, briefId: t.id, error: String(err) });
      }
    }
  }
  const file = join(outDir, `scripts-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`);
  writeFileSync(file, JSON.stringify({ briefs: TEST_BRIEFS, results }, null, 2));
  console.log("wrote", file);
})();
