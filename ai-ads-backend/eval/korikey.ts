// KoriKey mock-brand ad: two production treatments from the real script writer (each best-of-3 with
// review and judge). Usage: npx tsx eval/korikey.ts → eval/out/korikey-scripts.json
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CreativeBrief, DEFAULT_BRIEF, planShots } from "../src/lib/creative-brief";
import { generateAdScript } from "../src/lib/text-gen";

export const KORIKEY = {
  concept:
    "TV launch film for KoriKey Pudina Chutney Flavour — crunchy orange corn-stick snacks with the refreshing taste of mint (pudina) chutney, in a ₹20 pack. A very playful stop-motion film in a paper-cut collage world, with paper-cut collage style transitions between shots and fun Indian music: brass-band trumpets, tabla, and dhol. Faceless: the pack, the corn sticks, fresh mint leaves, green chilli and a bowl of green chutney are the characters.",
  brand: {
    productName: "KoriKey",
    primaryColor: "#e3262b",
    secondaryColor: "#1e3a1e",
    tagline: "Crunchy. Tasty. Desi Twist.",
    brandRules:
      "No people, no hands, no faces anywhere — the snacks and the pack are the heroes. The pack is a glossy dark bottle-green pouch with the red KoriKey logo (cartoon googly eyes in the letters), shown only as the real pack photo, never redrawn. Palette: KoriKey red, bottle green, fresh lime green, turmeric yellow, warm cream paper. Playful, desi, youthful, a little cheeky — Indian street-snack energy, never premium or moody.",
  },
  brief: {
    ...DEFAULT_BRIEF,
    lengthSeconds: 30,
    shotCount: 7,
    shotSeconds: 4,
    tone: "playful",
    look: "stopmotion",
    pacing: "fast",
    audience: "Indian teens and young adults (15–30) who snack between classes, at work, and with friends",
    keyMessage: "Grab the crunch — just ₹20",
    mustShow: "The KoriKey pack, the orange corn sticks, fresh mint leaves, a bowl of green pudina chutney",
    brandName: "KoriKey",
    avoid: "People, hands, faces, readable text or lettering other than the real pack, other snack brands",
  } satisfies CreativeBrief,
};

(async () => {
  const plan = planShots(KORIKEY.brief);
  const runs = await Promise.allSettled([1, 2].map(() => generateAdScript(KORIKEY.concept, KORIKEY.brief, plan, { brand: KORIKEY.brand })));
  const scripts = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  runs.forEach((r, i) => r.status === "rejected" && console.log(`run ${i + 1} failed:`, r.reason));
  const file = join(__dirname, "out", "korikey-scripts.json");
  writeFileSync(file, JSON.stringify({ ...KORIKEY, plan, scripts }, null, 2));
  console.log(`wrote ${scripts.length} script(s) to`, file);
})();
