// Puts KoriKey script B into production as a real storyboard: brand kit (logo, colors, font), the
// real pack cutout composited into shots 5 and 7, and the director's paper transitions. Shots 5
// and 7 are rewritten to leave the pack's space empty, since the pack is laid in by the edit.
// Usage: npx tsx eval/korikey-setup.ts <userId> <logo.png> <pack.png>   (a local worker does the rest)
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planShots } from "../src/lib/creative-brief";
import { completeQuestionnaire, createProduct } from "../src/lib/products";
import { createProject } from "../src/lib/projects";
import { enqueueShotChoices } from "../src/lib/queue";
import { uploadLogo, uploadPoster } from "../src/lib/storage";
import { createShots, createStoryboard } from "../src/lib/storyboards";
import type { AdScript } from "../src/lib/text-gen";

const [userId, logoFile, packFile] = process.argv.slice(2);

const STICK = "'Corn Stick' is a long, slim, gently curved stick about eight times as long as it is wide, made of crumpled orange crepe paper with a bumpy puffed-corn texture, like the corn sticks pictured on the pack.";

const SHOT_5 =
  "Medium shot, eye-level, locked-off on a tripod. 50mm, shallow depth of field. The centre of the warm cream paper tabletop is completely clear and open, in front of the red geometric paper wall and the turmeric-yellow paper sun. The orange paper corn stick waits small at the far left edge and the paper chutney bowl small at the far right edge, both turned towards the empty centre. Halfway through, both give one small startled hop backwards, as if something just landed between them; the centre stays empty. Light: hard key from high camera-right, crisp paper drop shadows on the tabletop.";
const SHOT_7 =
  "Hero close-up, locked-off on a tripod. 85mm, shallow depth of field. The left half of the frame is clear warm cream tabletop against the red geometric paper wall, kept completely open. In the right half, a single long orange paper corn stick, its tip generously dipped in textured green paper chutney, leans at an angle towards the left, with two green paper mint leaves at its base. The stick gives one small happy wobble, then settles. Light: crisp beauty light from camera-right, a glossy highlight on the paper chutney.";

(async () => {
  const run = JSON.parse(readFileSync(join(__dirname, "out", "korikey-scripts.json"), "utf8"));
  const script: AdScript = run.scripts[1];
  const brief = run.brief;
  const plan = planShots(brief);

  const product = await createProduct(userId, "KoriKey");
  const logoUrl = await uploadLogo(product.id, readFileSync(logoFile), "image/png", "png");
  await completeQuestionnaire(userId, product.id, {
    name: "KoriKey",
    logoUrl,
    primaryColor: run.brand.primaryColor,
    secondaryColor: run.brand.secondaryColor,
    font: "Baloo 2",
    tagline: run.brand.tagline,
    brandRules: run.brand.brandRules,
  });
  const packUrl = await uploadPoster(`korikey-pack-${Date.now()}`, readFileSync(packFile));

  const lookSheet = script.lookSheet.replace(/'Corn Stick' is a [^.]*\./, STICK);
  const shots = script.shots.map((s, i) => (i === 4 ? { ...s, description: SHOT_5 } : i === 6 ? { ...s, description: SHOT_7 } : s));
  const clip = plan.clipSeconds, cut = plan.cutSeconds, T = 0.5;
  // The drop lands after shot 5's paper transition settles: kept window opens at (clip - cut - T) * 0.4.
  const dropAt = (clip - (cut + T)) * 0.4 + T + 0.25;

  const project = await createProject(userId, "KoriKey — The Chutney Chase", "video", product.id);
  const storyboard = await createStoryboard(project.id, run.concept, plan.shotCount, plan.clipSeconds, {
    aspectRatio: "16:9",
    lookSheet,
    creativeBrief: {
      ...brief,
      audio: { musicPrompt: script.musicPrompt, voiceoverScript: null, voiceoverDirection: null },
      exclusions: script.look.exclusions,
      endCardTagline: script.endCardTagline,
      soundDesign: { ambience: script.soundAmbience, cues: script.shots.map((s) => s.spec.sfx) },
      transitions: script.shots.map((s) => s.spec.transition ?? null),
      pack: {
        url: packUrl,
        inserts: [
          { shot: 4, motion: "drop", x: 0.5, ground: 0.9, height: 0.66, at: dropAt },
          { shot: 6, motion: "hold", x: 0.3, ground: 0.93, height: 0.78 },
        ],
      },
    },
    status: "drafting",
  });
  const rows = await createShots(storyboard.id, shots.map((s) => ({ ...s, assetNames: [], screenUrl: null })));
  await enqueueShotChoices(rows[0].id);
  console.log(JSON.stringify({ productId: product.id, projectId: project.id, storyboardId: storyboard.id, shots: rows.map((r) => r.id), packUrl, logoUrl }));
  process.exit(0);
})();
