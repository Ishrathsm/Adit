// Ad direction team on Swastea, a herbal tea (fictional brand), from the user's own story. Text only.
// `npx tsx eval/swastea-strategy.ts [--reuse]`
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF } from "../src/lib/creative-brief";
import { DIAL_IDS, dialLine } from "../src/lib/dials";
import { type AdStrategy, writeStrategy } from "../src/lib/strategy";

// The user's story, as told (2026-10-07), with light, warm humour at the user's request.
const CONCEPT =
  "30-second film for Swastea, a new herbal tea powder made from ginger, ashwagandha and tulsi. The user's own story, with light, warm humour: a young bachelor in a rented flat knocks on the door of the elderly couple next door and asks, 'Aunty, thodi adrak milegi?' — and sneezes. Aunty says, 'Lagta hai zukaam hai. Andar aao beta,' and goes into her kitchen. She comes back with a cup of her ginger tea. He takes a sip and reacts with comic, over-the-top relief — the warmth spreading, eyes closing, a dramatic sigh — while uncle watches, amused. Then Aunty shows him what she used: Swastea — ginger, ashwagandha aur tulsi se bana shuddh tea powder. End line: 'Swastea. Roj piyo, swasth raho.' The people speak their own lines on camera in Hindi (Hinglish). A food product: it must never claim to cure, treat or relieve a cold or any illness.";

const BRIEF: CreativeBrief = {
  ...DEFAULT_BRIEF,
  format: "ad",
  lengthSeconds: 30,
  tone: "warm",
  look: "photoreal",
  pacing: "balanced",
  audience: "Urban Indian families and young working adults who drink tea daily and trust traditional ingredients like adrak and tulsi",
  mustShow: "The bachelor at the neighbours' door and his sneeze; Aunty's kitchen and the cup of tea; his comic reaction to the first sip; the Swastea pack in Aunty's hand with its ingredients; the end line",
  brandName: "Swastea",
  avoid: "Any claim that the tea cures, treats, relieves or prevents a cold or any illness; medical language; doctors; numbers; other brands' packs or logos; slapstick that mocks the elderly couple. In all copy: never self-labels such as premium, best, ultimate",
  voiceover: false,
  voiceGender: "female",
  variableShots: true,
  endCardVoice: true,
  veoAudio: true,
};

const BRAND = {
  productName: "Swastea",
  primaryColor: "#2f6b3a",
  secondaryColor: "#c8752d",
  font: null,
  tagline: "Roj piyo, swasth raho.",
  brandRules: "A warm, traditional-but-modern Indian herbal tea brand. Ingredients: ginger (adrak), ashwagandha, tulsi. Never medical claims; the benefit is warmth, comfort and a daily ritual of wellbeing.",
};

(async () => {
  const out = join(__dirname, "out");
  mkdirSync(out, { recursive: true });
  const saved = join(out, "swastea-strategy.json");
  const strategy: AdStrategy = process.argv.includes("--reuse") && existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")) : await writeStrategy(CONCEPT, BRIEF, BRAND);
  writeFileSync(saved, JSON.stringify(strategy, null, 2));
  const { research, dials, ...rest } = strategy;
  console.log(JSON.stringify(rest, null, 2));
  for (const id of DIAL_IDS) console.log(dialLine(id, dials[id]), "\n   ", dials[id].reasons.join(" · "));
  console.log(`\nRESEARCH: ${research?.sources.length ?? 0} sources\n${research?.notes.slice(0, 3500) ?? ""}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
