// Swastea pre-production stills for the user's review before any video: a flat (no-glow) logo for
// the daylight end card, one frame per scene with the cast and pack as references, the end-card
// plate, and a mock of the mandala moment. `npx tsx eval/swastea-frames.ts [names]` → ~/Desktop/swastea/frames/
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage, type ReferenceImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "swastea");
const out = join(dir, "frames");
const png = (f: string): ReferenceImage => ({ imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" });
const pack = png(join(dir, "pack.png"));
// The steel cup from s4/s5, so every shot pours chai into the same cup (user, 2026-10-08).
const cup = png(join(dir, "cup-ref.png"));
const CUP = "the same plain stainless-steel cup with a handle as in its reference image (never a ceramic mug or a glass)";
const cast = { bachelor: png(join(dir, "cast", "bachelor-2.png")), aunty: png(join(dir, "cast", "aunty-1.png")), uncle: png(join(dir, "cast", "uncle-1.png")) };

// v2: the user found v1 "poor" and "gloomy" — a bright, colourful, well-kept middle-class home.
const HOME =
  "a bright, colourful, well-kept middle-class Indian family flat in a city, sunny morning: freshly painted walls in warm cheerful colours (a soft peach living room with one teal accent wall), glossy vitrified floor tiles, a comfortable wooden sofa set with colourful printed cushions in mustard, teal and red, a patterned cotton rug, a wooden showcase with crockery, brass showpieces and framed family photos, a wall-mounted TV, bright printed curtains with tie-backs, healthy potted plants including a tulsi plant in a painted pot by the sunny window, a small neat pooja corner with fresh marigolds; the kitchen is a clean modular kitchen with cheerful yellow and white cabinets, a chimney, a gas stove, neat rows of steel containers and colourful spice jars; homely, cared-for and full of life — never shabby, never gloomy, never a showroom";
const FILM =
  "A still frame from a warm Indian TV commercial, 16:9, shot on a cinema camera with a 35mm lens at eye level: bright, cheerful, sunny daylight filling the rooms, bright and colourful but natural, gentle contrast, no dark corners, true skin tones with real texture, realistic and understated, like a well-made Indian ad film. No text, captions or logos anywhere except the Swastea pack's own printed design.";
const WHO = {
  bachelor: "the young man exactly as in his reference image (same face, messy hair, stubble, navy hoodie over a grey t-shirt), with a slightly red nose and tired eyes",
  aunty: "Aunty exactly as in her reference image (same face, grey hair in a low bun, red bindi, maroon cotton saree, reading glasses on a beaded chain)",
  uncle: "Uncle exactly as in his reference image (same face, grey moustache, rimless glasses, cream kurta with a brown sweater vest)",
};
const PACK = "the Swastea herbal tea box exactly as in its reference image (dark green box, the green cup logo, SWASTEA, HERBAL TEA, the three ingredient roundels); never change or invent any text on it";

type Ref = keyof typeof cast | "pack" | "cup";
const FRAMES: Record<string, { refs: Ref[]; text: string }> = {
  // v2.1: v1/v2 put him inside the flat — he must be outside, in the corridor, on the threshold's far side.
  "s1-door": { refs: ["bachelor", "aunty"], text: `Shot from inside the common corridor of the apartment building (plain painted corridor walls, a shoe rack and a doormat, the neighbouring flat's door at the edge of frame). ${WHO.bachelor} stands OUTSIDE in the corridor, on the doormat, facing the open front door of Aunty's flat, holding an empty steel katori, mid-sneeze into his elbow — he has not stepped inside. Framed in the doorway, just inside her own flat, ${WHO.aunty} has just opened the door and looks at him with surprise turning to concern. Only behind her, through the doorway, a glimpse of ${HOME}. The door frame clearly separates them: he is in the corridor, she is in her home. Medium two-shot, camera in the corridor beside him.` },
  "s2-aunty": { refs: ["aunty"], text: `Close-up of ${WHO.aunty} in her doorway, looking at the young man off-screen with quiet, motherly concern, about to step aside to let him in. Behind her, ${HOME}.` },
  "s3-kitchen": { refs: ["aunty", "pack"], text: `In her kitchen (${HOME}), ${WHO.aunty} stands at the gas stove spooning herbal tea powder from an open pack into chai boiling in a steel saucepan. ${PACK} stands on the granite counter beside the stove, front label facing the camera. Steam rises. Medium shot from the side.` },
  "s4-sip": { refs: ["bachelor"], text: `In the living room (${HOME}), ${WHO.bachelor} sits on the sofa holding a steaming steel-rimmed cup of chai in both hands, eyes closed, mid-sip; his shoulders have dropped and his face shows deep, quiet relief and comfort. Medium close-up, window light from the side.` },
  "s5-sincere": { refs: ["bachelor"], text: `Close-up of ${WHO.bachelor} on the sofa, the same plain steel cup of chai from the sip shot (a stainless-steel cup with a handle, never a ceramic mug) held near his chest, looking up at Aunty off-screen with a sincere, slightly homesick, grateful expression, his tiredness eased. Background softly out of focus: ${HOME}.` },
  "s6-pack": { refs: ["aunty", "uncle", "pack"], text: `In the living room (${HOME}), ${WHO.aunty} stands smiling warmly, holding up ${PACK} beside her face, front to the camera. Beside her, ${WHO.uncle} looks on with a gentle smile. Medium two-shot.` },
  "end-plate": { refs: ["pack", "cup"], text: `Product hero shot on Aunty's kitchen counter (${HOME}) in warm morning window light: ${PACK} stands front-on, beside it ${CUP} full of steaming chai, a knob of fresh ginger and a sprig of tulsi leaves on the granite. The right third of the frame is calm, softly out-of-focus kitchen, left empty for the logo and tagline. Shallow depth of field, gentle warm light.` },
};

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2]?.split(",");
  // A flat version of the user's neon logo, for the daylight end card.
  if (only?.includes("logo")) {
    const logo = await generateCleanImage(
      "Redraw the logo in image 1 as a clean, flat brand logo on a pure white background: the same green cup with a saucer, the same leaf and white steam swirl (make the steam a soft light grey so it shows on white), and the same SWASTEA lettering, same shapes and proportions — but with no glow, no neon, no shadow, no gradient halo. Crisp vector-like edges, centred, generous margin.",
      "3:2",
      [png(join(dir, "logo-neon.png"))],
      [png(join(dir, "logo-neon.png"))],
    );
    writeFileSync(join(dir, "logo-flat.png"), Buffer.from(logo.imageBytes, "base64"));
    console.log("logo flat");
  }
  for (const [name, f] of Object.entries(FRAMES)) {
    if (only && !only.includes(name)) continue;
    if (!only && existsSync(join(out, `${name}.png`))) continue;
    const refs = f.refs.map((r) => (r === "pack" ? pack : r === "cup" ? cup : cast[r]));
    const labels = f.refs.map((r, i) => `Image ${i + 1} is the reference for ${r === "pack" ? "the Swastea pack" : r === "cup" ? "the steel chai cup" : r === "aunty" ? "Aunty" : r === "uncle" ? "Uncle" : "the young man"}.`).join(" ");
    const img = await generateCleanImage(`${labels}\n\n${f.text}\n\n${FILM}`, "16:9", refs, f.refs.includes("pack") ? [pack] : []);
    writeFileSync(join(out, `${name}.png`), Buffer.from(img.imageBytes, "base64"));
    console.log(`${name}${img.clean ? "" : " (text check flagged it)"}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
