import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync } from "node:fs";
import { planShots } from "../src/lib/creative-brief";
import { createProject } from "../src/lib/projects";
import { enqueueShotChoices } from "../src/lib/queue";
import { createShots, createStoryboard } from "../src/lib/storyboards";
import type { AdScript } from "../src/lib/text-gen";
import type { TestBrief } from "./briefs";

// Renders a reviewed treatment from a script-models run as a real storyboard, exactly as the
// create route would after writing it — so the film matches the script that was approved. The
// running worker (npm run worker, same QUEUE_PREFIX) does the rest.
// Usage: npx tsx eval/run-storyboard.ts <scripts.json> <briefId> <userId> <productId> [overrides.json]
const [file, briefId, userId, productId, overridesFile] = process.argv.slice(2);

(async () => {
  const run = JSON.parse(readFileSync(file, "utf8")) as { briefs: TestBrief[]; results: { briefId: string; script?: AdScript }[] };
  const t = run.briefs.find((b) => b.id === briefId)!;
  const script = run.results.find((r) => r.briefId === briefId && r.script)!.script!;
  const brief = { ...t.brief, ...(overridesFile ? JSON.parse(readFileSync(overridesFile, "utf8")) : {}) };
  const plan = planShots(brief);

  const project = await createProject(userId, `${t.brand.productName} — treatment test`, "video", productId);
  const storyboard = await createStoryboard(project.id, t.concept, plan.shotCount, plan.clipSeconds, {
    aspectRatio: t.aspectRatio,
    lookSheet: script.lookSheet,
    creativeBrief: {
      ...brief,
      audio: {
        musicPrompt: script.musicPrompt,
        voiceoverScript: script.voiceoverScript,
        voiceoverDirection: script.voiceoverDirection,
        voiceoverLines: brief.voiceoverScript ? undefined : script.shots.map((s) => s.spec.voLine),
      },
      exclusions: script.look.exclusions,
      endCardTagline: script.endCardTagline,
      soundDesign: { ambience: script.soundAmbience, cues: script.shots.map((s) => s.spec.sfx) },
    },
    status: "drafting",
  });
  const shots = await createShots(
    storyboard.id,
    script.shots.map((s) => ({ ...s, screenUrl: s.spec.screen !== null ? brief.screens[s.spec.screen]?.url ?? null : null })),
  );
  await enqueueShotChoices(shots[0].id);
  console.log(JSON.stringify({ projectId: project.id, storyboardId: storyboard.id, shots: shots.map((s) => s.id) }));
  process.exit(0);
})();
