import { readFileSync, writeFileSync } from "node:fs";
import { planShots } from "../src/lib/creative-brief";
import type { AdScript } from "../src/lib/text-gen";
import type { TestBrief } from "./briefs";

// Builds the blind script review page from a script-models run. Options are shuffled per brief
// and labelled A/B/C; the model behind each label is written to a separate key file, never into
// the page. Usage: npx tsx eval/build-review.ts <scripts.json> <page.html> <key.json> [featured.json]
// featured.json: a run in the treatment format, shown above the comparison with every field, unblinded.
const [input, pagePath, keyPath, featuredPath] = process.argv.slice(2);
const run = JSON.parse(readFileSync(input, "utf8")) as {
  briefs: TestBrief[];
  results: { model: string; briefId: string; script?: AdScript; error?: string }[];
};

const LABELS = ["A", "B", "C", "D"];
const key: Record<string, Record<string, string>> = {};
const briefs = run.briefs.map((b) => {
  const options = run.results.filter((r) => r.briefId === b.id && r.script).sort(() => Math.random() - 0.5);
  key[b.id] = Object.fromEntries(options.map((o, i) => [LABELS[i], o.model]));
  const plan = planShots(b.brief);
  return {
    id: b.id,
    category: b.category,
    concept: b.concept,
    aspectRatio: b.aspectRatio,
    brandName: b.brand.productName,
    tagline: b.brand.tagline ?? null,
    brandRules: b.brand.brandRules ?? null,
    tone: b.brief.tone,
    pacing: b.brief.pacing,
    audience: b.brief.audience,
    keyMessage: b.brief.keyMessage,
    mustShow: b.brief.mustShow,
    avoid: b.brief.avoid,
    onScreenText: b.brief.onScreenText,
    voiceover: b.brief.voiceover ? { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil" }[b.brief.voiceoverLanguage] : null,
    shotCount: plan.shotCount,
    cutSeconds: plan.cutSeconds,
    options: options.map((o, i) => ({
      label: LABELS[i],
      lookSheet: o.script!.lookSheet,
      shots: o.script!.shots.map((s) => s.description),
      musicPrompt: o.script!.musicPrompt,
      voiceoverScript: o.script!.voiceoverScript,
    })),
  };
});

// Artifact pages can't load remote images, so known screen images are embedded as data URIs.
const embedded: Record<string, string> = {
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/turito-screen-ai-tutor.png":
    `data:image/png;base64,${readFileSync(`${__dirname}/out/turito-ui/ai-tutor-panel.png`).toString("base64")}`,
};
const featuredRun = featuredPath ? (JSON.parse(readFileSync(featuredPath, "utf8")) as { briefs: TestBrief[]; results: { model: string; briefId: string; script?: AdScript }[] }) : null;
const featured = featuredRun
  ? featuredRun.results
      .filter((r) => r.script)
      .map((r) => {
        const b = featuredRun.briefs.find((x) => x.id === r.briefId) ?? run.briefs.find((x) => x.id === r.briefId)!;
        const plan = planShots(b.brief);
        return { briefId: r.briefId, brandName: b.brand.productName, category: b.category, concept: b.concept, aspectRatio: b.aspectRatio, cutSeconds: plan.cutSeconds, screens: (b.brief.screens ?? []).map((sc) => ({ ...sc, url: embedded[sc.url] ?? sc.url })), keyMessage: b.brief.keyMessage, contactLine: b.brief.contactLine, script: r.script };
      })
  : [];

const template = readFileSync(`${__dirname}/review-template.html`, "utf8");
writeFileSync(pagePath, template.replace("__DATA__", JSON.stringify(briefs).replace(/</g, "\\u003c")).replace("__FEATURED__", JSON.stringify(featured).replace(/</g, "\\u003c")));
writeFileSync(keyPath, JSON.stringify(key, null, 2));
console.log(`page: ${pagePath}\nkey: ${keyPath}`);
