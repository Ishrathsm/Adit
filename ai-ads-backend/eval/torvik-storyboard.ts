// Torvik R7 launch film: a faceless motorcycle ad with variable shot lengths, music only, and the
// brand name + tagline spoken over the end card. Creates the brand kit, writes the script (the same
// path as the create route), and queues the first shot's keyframes — run the worker with
// KEYFRAMES_ONLY=1 so every keyframe can be reviewed before any Veo spend.
// Usage: npx tsx eval/torvik-storyboard.ts <userId> <bikeRef.png>
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF, fitShotCuts, footageSeconds, planShots } from "../src/lib/creative-brief";
import { completeQuestionnaire, createProduct, getProductById, toBrandContext } from "../src/lib/products";
import { createProject } from "../src/lib/projects";
import { enqueueShotChoices } from "../src/lib/queue";
import { uploadPoster } from "../src/lib/storage";
import { createAssets, createShots, createStoryboard } from "../src/lib/storyboards";
import { generateAdScript } from "../src/lib/text-gen";
import { BIKE } from "./torvik-bike";

const [userId, refFile] = process.argv.slice(2);

const CONCEPT =
  "Launch film for the Torvik R7, the first motorcycle from a new Indian brand: a mid-weight naked roadster. Faceless product film — the bike is the hero. The only person is one rider in a full-face matte-black helmet with a dark tinted visor, black riding jacket, gloves and boots; the face is never visible and the rider never removes the helmet. Story: before sunrise the bike waits in a quiet garage; details wake up (headlight, tank, engine); the rider rolls out of a sleeping city onto an empty mountain ghat road in the Western Ghats as the sky lightens; sweeping bends, mist-free clear morning; it ends with the bike parked on its side stand at a hilltop viewpoint as the sun rises behind it. No other traffic.";

const BRIEF: CreativeBrief = {
  ...DEFAULT_BRIEF,
  format: "ad",
  lengthSeconds: 30,
  tone: "bold",
  look: "photoreal",
  pacing: "balanced",
  audience: "Urban Indian riders aged 22–35 buying their first serious motorcycle",
  keyMessage: null,
  mustShow: "The round LED headlight with its copper bezel; the graphite tank with the copper pinstripe; the parallel-twin engine; the bike leaning through a bend on the ghat road; the final hero shot of the parked bike at sunrise",
  brandName: "Torvik",
  avoid: "Faces, riders without a helmet, crowds, other vehicles, stunts, wheelies, burnouts, crashes, smoke, dust clouds, readable text, logos, number plates with characters, speedometer numbers",
  voiceover: false,
  voiceoverLanguage: "en",
  voiceGender: "male",
  variableShots: true,
  endCardVoice: true,
};

(async () => {
  const product = await createProduct(userId, "Torvik");
  await completeQuestionnaire(userId, product.id, {
    name: "Torvik",
    logoUrl: null,
    primaryColor: "#c8743a",
    secondaryColor: "#2b2d31",
    font: "Montserrat",
    tagline: null,
    brandRules: "Premium but raw Indian motorcycle brand. Palette: matte graphite, copper accents, warm tan leather. The bike is always the exact Torvik R7 from the reference: never any real manufacturer's model, badge or logo. Riders are always fully geared with a full-face helmet and dark visor; no faces.",
  });
  const brand = toBrandContext(await getProductById(product.id));
  const refUrl = await uploadPoster(`torvik-r7-ref-${Date.now()}`, readFileSync(refFile));
  const assets = [{ kind: "product" as const, name: "Torvik R7", description: BIKE, imageUrl: refUrl, source: "uploaded" as const }];

  const plan = planShots(BRIEF);
  const script = await generateAdScript(CONCEPT, BRIEF, plan, { brand, assets: assets.map((a) => ({ kind: a.kind, name: a.name, description: a.description })) });
  const shotCuts = fitShotCuts(script.shots.map((s) => s.spec.seconds), footageSeconds(BRIEF));
  writeFileSync(join(__dirname, "out", "torvik-script.json"), JSON.stringify({ concept: CONCEPT, brief: BRIEF, plan, shotCuts, script }, null, 2));

  const project = await createProject(userId, "Torvik R7 — launch film", "video", product.id);
  const storyboard = await createStoryboard(project.id, CONCEPT, plan.shotCount, plan.clipSeconds, {
    aspectRatio: "16:9",
    referenceImageUrl: null,
    referenceImageRole: null,
    lookSheet: script.lookSheet,
    creativeBrief: {
      ...BRIEF,
      audio: { musicPrompt: script.musicPrompt, voiceoverScript: null, voiceoverDirection: null, voiceoverLines: script.shots.map(() => null) },
      exclusions: script.look.exclusions,
      endCardTagline: script.endCardTagline,
      soundDesign: { ambience: script.soundAmbience, cues: script.shots.map((s) => s.spec.sfx) },
      shotCuts,
    },
    status: "drafting",
  });
  const shots = await createShots(storyboard.id, script.shots.map((s) => ({ ...s, screenUrl: null })));
  await createAssets(storyboard.id, assets);
  await enqueueShotChoices(shots[0].id);
  console.log(JSON.stringify({ productId: product.id, projectId: project.id, storyboardId: storyboard.id, shotCuts, tagline: script.endCardTagline }));
  process.exit(0);
})();
