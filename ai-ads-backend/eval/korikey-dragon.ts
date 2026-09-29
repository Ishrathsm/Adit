// KoriKey "how KoriKey was born" legend: three production treatments from the real script writer
// (each best-of-3 with review and judge), one per storytelling angle. Stop-motion puppet film,
// narrated by a grandmother. Usage: npx tsx eval/korikey-dragon.ts → eval/out/korikey-dragon-scripts.json
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF, planShots } from "../src/lib/creative-brief";
import { generateAdScript } from "../src/lib/text-gen";

const STORY =
  "Brand legend film for KoriKey Pudina Chutney Flavour corn-puff sticks: how KoriKey was born, told as a bedtime story by an old Indian grandmother to her grandchildren. Once upon a time a kingdom lived happily. One day a dragon arrived and demanded food, or it would eat the people. The people cooked many tasty dishes, but the dragon was never impressed. Then a clever snack-maker made crunchy corn-puff sticks with the taste of mint chutney — the first KoriKey — and presented them on his turn. The dragon crunched, was impressed, and the story ends there: the dragon winks, and its shape becomes the K of the KoriKey logo. Shot as a real-looking stop-motion puppet film on handmade miniature sets; emotional and warm, with gentle humour, never scary or violent.";

const ANGLES = [
  { id: "bedtime", title: "Dadi's Bedtime Story", note: "Framing: the film opens on the grandmother puppet telling the story to two small grandchildren by an oil lamp at bedtime, moves into the story world, and returns to them at the very end as the kids smile — the dragon's wink lands in both worlds." },
  { id: "fable", title: "The Fable", note: "Framing: the whole film lives inside the story's kingdom — no grandmother on screen, only her voice telling it, like an old picture book come to life." },
  { id: "underdog", title: "The Humble Snack-Maker", note: "Framing: the story centres on the clever snack-maker — a small, overlooked man in the kingdom whom nobody noticed, who quietly invents the sticks in his tiny stall and becomes the hero." },
];

export const DRAGON = {
  brand: {
    productName: "KoriKey",
    primaryColor: "#e3262b",
    secondaryColor: "#1e3a1e",
    tagline: "Crunchy. Tasty. Desi Twist.",
    brandRules:
      "Every character — villagers, the grandmother, the children, the snack-maker, the dragon — is a handmade stop-motion puppet, never a real human; no animators' hands in frame. The dragon is friendly-grand, not frightening: no one is ever shown being hurt or eaten. The pack is a glossy dark bottle-green pouch with the red KoriKey logo, shown only as the real pack photo, never redrawn or sculpted. Palette: KoriKey red, bottle green, fresh lime green, turmeric yellow, warm earthy miniature-set tones. Indian folk-tale world: a small kingdom with a fort, market lanes, clay pots, brass vessels, rangoli, oil lamps.",
  },
  brief: {
    ...DEFAULT_BRIEF,
    lengthSeconds: 30,
    shotCount: 7,
    shotSeconds: 6,
    tone: "warm",
    look: "puppet",
    pacing: "balanced",
    audience: "Indian families — kids 6–14 and their parents — and young adults who grew up on grandmothers' stories",
    keyMessage: "KoriKey Pudina Chutney — just ₹20",
    mustShow:
      "The dragon arriving; the people's many dishes being refused; the snack-maker making the orange corn-puff sticks; presenting them on his turn; the dragon's big crunch and delight; the real KoriKey pack; the final dragon wink, whose pose becomes the K of the KoriKey logo",
    brandName: "KoriKey",
    avoid: "Real humans, animators' hands, anyone being hurt or eaten, gore, scary horror tone, readable text or lettering other than the real pack, other snack brands",
    voiceover: true,
    voiceoverLanguage: "en",
    voiceGender: "female",
  } satisfies CreativeBrief,
};

(async () => {
  const plan = planShots(DRAGON.brief);
  const runs = await Promise.allSettled(
    ANGLES.map((a) => generateAdScript(`${STORY} ${a.note}`, DRAGON.brief, plan, { brand: DRAGON.brand })),
  );
  const scripts = runs.map((r, i) => (r.status === "fulfilled" ? { angle: ANGLES[i], script: r.value } : { angle: ANGLES[i], error: String(r.reason) }));
  scripts.forEach((s) => "error" in s && console.log(`${s.angle.id} failed:`, s.error));
  const file = join(__dirname, "out", "korikey-dragon-scripts.json");
  writeFileSync(file, JSON.stringify({ story: STORY, ...DRAGON, plan, scripts }, null, 2));
  console.log(`wrote ${scripts.filter((s) => !("error" in s)).length} script(s) to`, file);
})();
