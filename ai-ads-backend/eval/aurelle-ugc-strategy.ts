// Ad direction team on Aurelle's second film: a 20s UGC review, the first with a person on camera
// speaking (Veo's own audio and lip sync). Text only. `npx tsx eval/aurelle-ugc-strategy.ts [--reuse]`
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF } from "../src/lib/creative-brief";
import { DIAL_IDS, dialLine } from "../src/lib/dials";
import { type AdStrategy, writeStrategy } from "../src/lib/strategy";

const CONCEPT =
  "20-second UGC review ad for Aurelle Bio-Protein Repair Shampoo. A 22-year-old Indian woman films herself on her phone at home in soft natural daylight, holding the Aurelle bottle up to the camera and giving her review in her own voice, in natural Indian English, like a real creator video: the hook, her hair problem (dry, frizzy ends), why she tried it (sulphate-free, argan oil, Vitamin E, bio-protein complex), a quick moment using it, the result (her long jet-black hair smooth and glossy) and her recommendation. Fast-paced jump cuts like a real creator video. She speaks on camera; the video model renders her voice and lip movement itself, so each spoken line must fit inside one 4–8 second clip. No voice-over. Only claims the label supports; no numbers, no clinical claims.";

const BRIEF: CreativeBrief = {
  ...DEFAULT_BRIEF,
  format: "ad",
  lengthSeconds: 20,
  tone: "warm",
  look: "photoreal",
  pacing: "fast",
  audience: "Urban women aged 20–30 who buy their haircare after watching creator reviews on Instagram and YouTube",
  mustShow: "Her face and long jet-black hair; the Aurelle bottle held up to the camera with its label readable; one quick moment of the shampoo in use; her hair smooth and glossy at the end",
  brandName: "Aurelle",
  avoid: "Other brands' products or logos, celebrity look-alikes, exaggerated reactions, fake-looking skin, numbers or clinical claims. In all copy: never self-labels or origin words such as premium, luxury, high-end, Indian, best, advanced, ultimate",
  voiceover: false,
  voiceGender: "female",
  variableShots: true,
  endCardVoice: false,
  veoAudio: true,
};

const BRAND = {
  productName: "Aurelle",
  primaryColor: "#c9a66b",
  secondaryColor: "#111111",
  font: "Cormorant Garamond",
  tagline: "Your hair’s true nature, restored.",
  brandRules:
    "Sophisticated, warm haircare brand; science-led, not herbal. The bottle is exactly the reference: a tall soft-oval matte ivory-white bottle, brushed champagne-gold pump, the black AURELLE wordmark with BIO-PROTEIN REPAIR SHAMPOO in serif capitals beneath, a thin gold rule, the ingredient line Vitamin E · Argan Oil · Bio-Protein Complex, SULPHATE-FREE and 250 ml. Never any real brand's bottle or logo. The creator always has long, straight, glossy jet-black hair.",
};

(async () => {
  const out = join(__dirname, "out");
  mkdirSync(out, { recursive: true });
  const saved = join(out, "aurelle-ugc-strategy.json");
  const strategy: AdStrategy = process.argv.includes("--reuse") && existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")) : await writeStrategy(CONCEPT, BRIEF, BRAND);
  // The user's direction for this film: fast, unlike every film so far. The dials' beauty default
  // is contemplative (D6 0), so the user's choice sets the pace here.
  if (strategy.dials.D6.value < 3) {
    strategy.dials.D6 = { value: 3, reasons: [...strategy.dials.D6.reasons, "→ 3 user: fast-paced creator video with jump cuts (every film so far was slow)"] };
  }
  writeFileSync(saved, JSON.stringify(strategy, null, 2));
  const { research, dials, ...rest } = strategy;
  console.log(JSON.stringify(rest, null, 2));
  for (const id of DIAL_IDS) console.log(dialLine(id, dials[id]), "\n   ", dials[id].reasons.join(" · "));
  console.log(`\nRESEARCH: ${research?.sources.length ?? 0} sources, ${research?.notes.split(/\s+/).length ?? 0} words`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
