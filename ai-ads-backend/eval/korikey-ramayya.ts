// KoriKey "Ramayya's Korikey" legend: the full production treatment from the real script writer
// (best-of-3 with review and judge). Telugu folk-art cut-out puppets, Telugu narration with the
// dragon's and Ramayya's own lines, Carnatic score. Usage: npx tsx eval/korikey-ramayya.ts
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF, planShots } from "../src/lib/creative-brief";
import { generateAdScript } from "../src/lib/text-gen";

export const STORY = `Brand legend film for KoriKey Pudina Chutney Flavour corn-puff sticks: how KoriKey got its name. A Telugu folk tale in 8 beats, one per shot, in this order:
1. The narration opens with exactly "అనగనగా ఒక రాజ్యంలో అందరూ సంతోషంగా ఉండేవారు…" (Anaganaga oka rajyam lo andaru santhoshanga undevaaru). A bright, happy Telugu kingdom: a busy santha market, kites over the fort, children playing, cooks at their stoves.
2. The sky darkens and a huge dragon lands on the fort walls. DRAGON line (in Telugu): give me something tasty to eat, or I will eat you all — booming but comic, never truly frightening.
3. The whole kingdom cooks for it — pulihora, bobbatlu, gongura pachadi, avakaya — and the dragon sniffs each and turns away; the people grow worried.
4. Ramayya, a humble snack-maker with a small stall at the edge of the santha, quietly mixes corn with fresh pudina pachadi and fries crunchy orange corn-puff sticks.
5. On his turn, Ramayya walks up to the giant dragon holding a small plate of the sticks; the crowd holds its breath.
6. The dragon picks one up, puzzled — DRAGON line: "ఇది ఏమిటి? దీనితో ఏం చేయాలి?" (What is this? What do I do with it?) — and Ramayya smiles — RAMAYYA line: "కొరికే!" (Korikey! — bite it!). This is how the name is born.
7. CRUNCH! The dragon's eyes go wide, it breaks into a huge smile, and the whole kingdom cheers.
8. The dragon winks, and its curled body forms the K of the KoriKey logo. Narration ends with "ఆ రోజు నుంచి… కొరికే పుట్టింది!" (From that day on, KoriKey was born!)
Narration in Telugu by an elderly Telugu woman's voice, like a village storyteller, never seen on screen; the dragon and Ramayya speak their own lines in their own voices. No grandmother or narrator on screen.
MUSIC (fixed — follow it exactly, it drives the edit): totally Carnatic. Instruments: veena, venu (Carnatic flute), Carnatic violin, mridangam, ghatam, kanjira, morsing, nadaswaram and thavil, tambura drone, and konnakol voices. Beat 1: raga Hamsadhwani in Adi talam, bright veena and mridangam. Beat 2: raga Shanmukhapriya, low register, heavy thavil strokes like footsteps, violin tremolo. Beat 3: raga Kadanakuthuhalam in Khanda chapu, playful, a morsing twang on each rejection. Beat 4: raga Kapi, tender solo venu over tambura (Ramayya's theme). Beat 5: tambura only, single mridangam strokes like a heartbeat. Beat 6: silence for one beat, then "Korikey!". Beat 7: back to Hamsadhwani, fast, full ensemble with nadaswaram and thavil, a mridangam flourish, konnakol chorus chanting "Ko-ri-key". Beat 8: a tihai whose final stroke lands exactly as the K appears — the KoriKey sonic logo.`;

export const RAMAYYA = {
  brand: {
    productName: "KoriKey",
    primaryColor: "#e3262b",
    secondaryColor: "#1e3a1e",
    tagline: "Crunchy. Tasty. Desi Twist.",
    brandRules:
      "Every character — villagers, cooks, Ramayya, the king, the dragon — is a flat hand-painted cut-out puppet in the Cheriyal/Kalamkari folk style; never a real human. The dragon is grand and comic, never truly frightening, and no one is ever shown being hurt or eaten. The pack is a glossy dark bottle-green pouch with the red KoriKey logo, shown only as the real pack photo, never redrawn or painted. Palette: Cheriyal red, KoriKey red, bottle green, fresh lime green, turmeric yellow, ochre, indigo. A Telugu kingdom: a fort with painted ramparts, a gopuram, palm trees, a santha market with clay pots, brass vessels, banana leaves, rangoli, kites.",
  },
  brief: {
    ...DEFAULT_BRIEF,
    lengthSeconds: 30,
    shotCount: 8,
    shotSeconds: 6,
    tone: "warm",
    look: "folkpuppet",
    pacing: "balanced",
    audience: "Telugu families — kids 6–14 and their parents — and young adults across Andhra Pradesh and Telangana",
    keyMessage: "KoriKey Pudina Chutney — just ₹20",
    mustShow:
      "The happy kingdom; the dragon landing; the dishes refused (pulihora, bobbatlu, gongura pachadi, avakaya); Ramayya making the orange corn-puff sticks; Ramayya presenting them; the dragon asking what to do and Ramayya answering 'Korikey!'; the big crunch and the kingdom cheering; the dragon's wink with its body forming the K",
    brandName: "KoriKey",
    avoid: "Real humans, 3D or CGI rendering, anyone being hurt or eaten, gore, horror, readable text or lettering other than the real pack, other snack brands",
    voiceover: true,
    voiceoverLanguage: "te",
    voiceGender: "female",
  } satisfies CreativeBrief,
};

(async () => {
  const plan = planShots(RAMAYYA.brief);
  const script = await generateAdScript(STORY, RAMAYYA.brief, plan, { brand: RAMAYYA.brand });
  const file = join(__dirname, "out", "korikey-ramayya-script.json");
  writeFileSync(file, JSON.stringify({ story: STORY, ...RAMAYYA, plan, script }, null, 2));
  console.log("wrote", file);
})();
