// Ad direction team, stage 2: strategist + creative director ahead of the director, on Torvik.
// Text only — no images or video. `npx tsx eval/strategy-test.ts [--script]`
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clipSecondsFor, type CreativeBrief, DEFAULT_BRIEF, footageSeconds } from "../src/lib/creative-brief";
import { DIAL_IDS, dialLine, shotCountForPace } from "../src/lib/dials";
import { type AdStrategy, writeStrategy } from "../src/lib/strategy";
import { generateAdScript } from "../src/lib/text-gen";
import { BIKE } from "./torvik-bike";

// The same Torvik brief as v1 (eval/torvik-storyboard.ts), with the user's chosen tagline.
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
  mustShow: "The round LED headlight with its copper bezel; the graphite tank with the copper pinstripe; the parallel-twin engine; the bike leaning through a bend on the ghat road; the final hero shot of the parked bike at sunrise",
  brandName: "Torvik",
  avoid: "Faces, riders without a helmet, crowds, other vehicles, stunts, wheelies, burnouts, crashes, smoke, dust clouds, readable text, logos, number plates with characters, speedometer numbers",
  voiceover: false,
  voiceGender: "male",
  variableShots: true,
  endCardVoice: true,
  veoAudio: true,
};

const BRAND = {
  productName: "Torvik",
  primaryColor: "#c8743a",
  secondaryColor: "#2b2d31",
  font: "Orbitron",
  tagline: "Ride with the wind",
  brandRules: "Premium but raw Indian motorcycle brand. Palette: matte graphite, copper accents, warm tan leather. The bike is always the exact Torvik R7 from the reference: never any real manufacturer's model, badge or logo. Riders are always fully geared with a full-face helmet and dark visor; no faces.",
};

(async () => {
  const out = join(__dirname, "out");
  mkdirSync(out, { recursive: true });
  // --reuse: the strategy already signed off (eval/out/torvik-strategy.json) instead of a new one.
  const saved = join(out, "torvik-strategy.json");
  const strategy: AdStrategy = process.argv.includes("--reuse") && existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")) : await writeStrategy(CONCEPT, BRIEF, BRAND);
  writeFileSync(saved, JSON.stringify(strategy, null, 2));
  console.log(JSON.stringify({ ...strategy, dials: undefined }, null, 2));
  for (const id of DIAL_IDS) console.log(dialLine(id, strategy.dials[id]), "\n   ", strategy.dials[id].reasons.join(" · "));

  if (!process.argv.includes("--script")) return;
  // The pace dial sets the shot count.
  const footage = footageSeconds(BRIEF);
  const shotCount = shotCountForPace(footage, strategy.dials.D6.value);
  const plan = { shotCount, cutSeconds: footage / shotCount, clipSeconds: clipSecondsFor(footage / shotCount) };
  console.log(`\nPLAN: ${shotCount} shots over ${footage}s`);
  const script = await generateAdScript(CONCEPT, BRIEF, plan, { brand: BRAND, assets: [{ kind: "product", name: "Torvik R7", description: BIKE }], strategy });
  writeFileSync(join(out, "torvik-script-team.json"), JSON.stringify({ concept: CONCEPT, brief: BRIEF, plan, strategy, script }, null, 2));
  console.log(`\nIDEA: ${script.idea}\nTAGLINE: ${script.endCardTagline}`);
  script.shots.forEach((s, i) => console.log(`\n${i + 1}. [${s.spec.seconds}s] ${s.spec.purpose}\n   ${s.spec.movement}\n   ${s.spec.action}\n   light: ${s.spec.lighting}\n   sfx: ${s.spec.sfx}`));
  (script.audit ?? []).forEach((round, i) => console.log(`\nAUDIT ROUND ${i + 1}: ${round.length} failure(s)\n${round.map((f) => `  - ${f}`).join("\n")}`));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
