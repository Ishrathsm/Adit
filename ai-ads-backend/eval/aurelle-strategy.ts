// Ad direction team on a new brief: Aurelle premium shampoo (fictional brand). Text only.
// `npx tsx eval/aurelle-strategy.ts [--script] [--reuse]`
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clipSecondsFor, type CreativeBrief, DEFAULT_BRIEF, footageSeconds } from "../src/lib/creative-brief";
import { DIAL_IDS, dialLine, shotCountForPace } from "../src/lib/dials";
import { type AdStrategy, writeStrategy } from "../src/lib/strategy";
import { generateAdScript } from "../src/lib/text-gen";

const CONCEPT =
  "Launch film for Aurelle Bio-Protein Repair Shampoo, the first product from a new high-end haircare brand. A science-led formula, not a herbal one: Vitamin E, argan oil and a bio-protein complex, sulphate-free. Faceless product film: the bottle is the hero, with its ingredients, its texture and its lather. Hair may appear only from behind or in close detail; a face is never visible. Key claims (approved for callouts; Aurelle is a new brand): Vitamin E-enriched; argan oil; bio-protein care complex; sulphate-free.";

const BRIEF: CreativeBrief = {
  ...DEFAULT_BRIEF,
  format: "ad",
  lengthSeconds: 30,
  tone: "premium",
  look: "photoreal",
  pacing: "balanced",
  audience: "Urban women aged 22–35 who buy high-end haircare",
  mustShow: "The Aurelle bottle with its own logo; the shampoo's texture; the lather; healthy, glossy hair seen from behind; the final hero packshot",
  brandName: "Aurelle",
  avoid: "Faces, crowds, other brands' logos, readable text other than our own logo, smoke, sudden effects, medical or clinical claims, dark or black backgrounds, low-key lighting. In all copy (proposition, tagline, callouts, CTA, end card): never self-labels or origin words such as premium, luxury, luxurious, high-end, Indian, India, best, advanced, ultimate; let the product and its formula speak",
  voiceover: false,
  voiceGender: "female",
  variableShots: true,
  endCardVoice: true,
  veoAudio: true,
};

// Assets in ~/Desktop/aurelle: bottle-front.png (product reference), logo.svg + logo-{dark,light,gold}.png.
const BRAND = {
  productName: "Aurelle",
  primaryColor: "#c9a66b",
  secondaryColor: "#111111",
  font: "Cormorant Garamond",
  tagline: "Your hair’s true nature, restored.",
  brandRules: "Sophisticated, elegant haircare brand; high-end tier. Palette: ivory white (a clean near-white, never cream or beige), champagne gold, black. Science-led, not herbal. The bottle is exactly the reference: a tall soft-oval matte ivory-white bottle (clean near-white, never cream), brushed champagne-gold pump, the AURELLE wordmark (wide geometric sans caps, black or champagne gold) on the front with \"BIO-PROTEIN REPAIR SHAMPOO\" in serif caps beneath, a thin gold rule and the ingredient line. It always carries this AURELLE wordmark; never any real brand's bottle, logo or packaging. Faceless: hair only from behind or in close detail; the hair is always long, straight, glossy jet-black, never blonde or brown. Look: everything light and white: an all-white set, bright high-key soft daylight, faint pale shadows; never dark, black or moody backgrounds.",
};

// The bottle as the product reference (~/Desktop/aurelle/bottle-front.png, ivory-white version).
const BOTTLE =
  "A 250 ml shampoo bottle about 20 cm tall: a softly rounded tall oval in matte ivory white (a clean near-white, never cream), soft-touch finish. A brushed champagne-gold pump with a short gold collar and a spout pointing left. Front label printed directly on the bottle: the AURELLE wordmark in wide geometric sans capitals (black), below it BIO-PROTEIN REPAIR SHAMPOO in two lines of spaced serif capitals, a thin gold hairline rule, the line Vitamin E · Argan Oil · Bio-Protein Complex, and at the foot SULPHATE-FREE and 250 ml.";

(async () => {
  const out = join(__dirname, "out");
  mkdirSync(out, { recursive: true });
  const saved = join(out, "aurelle-strategy.json");
  const strategy: AdStrategy = process.argv.includes("--reuse") && existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")) : await writeStrategy(CONCEPT, BRIEF, BRAND);
  writeFileSync(saved, JSON.stringify(strategy, null, 2));
  console.log(JSON.stringify({ ...strategy, dials: undefined }, null, 2));
  for (const id of DIAL_IDS) console.log(dialLine(id, strategy.dials[id]), "\n   ", strategy.dials[id].reasons.join(" · "));

  if (!process.argv.includes("--script")) return;
  const footage = footageSeconds(BRIEF);
  const shotCount = shotCountForPace(footage, strategy.dials.D6.value);
  const plan = { shotCount, cutSeconds: footage / shotCount, clipSeconds: clipSecondsFor(footage / shotCount) };
  console.log(`\nPLAN: ${shotCount} shots over ${footage}s`);
  const script = await generateAdScript(CONCEPT, BRIEF, plan, { brand: BRAND, assets: [{ kind: "product", name: "Aurelle Bio-Protein Repair Shampoo", description: BOTTLE }], strategy });
  writeFileSync(join(out, "aurelle-script.json"), JSON.stringify({ concept: CONCEPT, brief: BRIEF, plan, strategy, script }, null, 2));
  console.log(`\nIDEA: ${script.idea}\nTAGLINE: ${script.endCardTagline}`);
  script.shots.forEach((s, i) => console.log(`\n${i + 1}. [${s.spec.seconds}s] ${s.spec.purpose}\n   ${s.spec.movement}\n   ${s.spec.action}\n   light: ${s.spec.lighting}\n   sfx: ${s.spec.sfx}`));
  (script.audit ?? []).forEach((round, i) => console.log(`\nAUDIT ROUND ${i + 1}: ${round.length} failure(s)\n${round.map((f) => `  - ${f}`).join("\n")}`));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
