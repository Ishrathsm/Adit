// Swastea plan v3 keyframes (user said "start keyframes", 2026-10-08): real-movie coverage, not theatre.
// Profiles, OTS shots, door-frame foregrounds, movement toward the lens; he discovers the pack himself;
// no Uncle. Composed for a 2.39:1 crop of the 16:9 frame. Cast, the steel cup and the pack are references;
// the real pack is composited afterwards (eval/swastea-pack.py).
// `npx tsx eval/swastea-keyframes-v3.ts [names]` → ~/Desktop/swastea/frames-v3/
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage, type ReferenceImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "swastea");
const out = join(dir, "frames-v3");
const png = (f: string): ReferenceImage => ({ imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" });
const REFS = {
  bachelor: png(join(dir, "cast", "bachelor-2.png")),
  aunty: png(join(dir, "cast", "aunty-1.png")),
  pack: png(join(dir, "pack.png")),
  cup: png(join(dir, "cup-ref.png")),
};
type Ref = keyof typeof REFS;
const LABEL: Record<Ref, string> = { bachelor: "the young man", aunty: "Aunty", pack: "the Swastea pack", cup: "the steel chai cup" };

const HOME = "a bright, colourful, cared-for middle-class Indian flat on a sunny morning: warm peach and teal walls, a wooden sofa with printed cushions, potted plants, brass showpieces, a clean yellow-and-white modular kitchen";
const LOOK = "A frame from a real Indian feature film, not a TV ad: shot on a cinema camera with prime lenses, shallow depth of field, soft motivated window light, natural warm grade, real skin texture, unposed natural behaviour, nobody looks into the lens. Composed for a 2.39:1 widescreen crop: keep all faces and key action inside the middle 76% of the frame height. No text, captions or logos except the Swastea pack's own printed design.";
const HIM = "the young man exactly as in his reference image (same face, messy hair, stubble, navy hoodie over a grey t-shirt), a slightly red nose, tired eyes";
const HER = "Aunty exactly as in her reference image (same face, grey hair in a low bun, red bindi, maroon cotton saree, reading glasses on a beaded chain)";
const CUP = "the plain stainless-steel cup with a handle from its reference image (never a ceramic mug or glass)";
const PACK = "the Swastea herbal tea box exactly as in its reference image (dark green box, green cup logo, SWASTEA, HERBAL TEA, three ingredient roundels)";

const FRAMES: Record<string, { refs: Ref[]; text: string }> = {
  "s1-door": { refs: ["bachelor"], text: `50mm medium close-up from just inside Aunty's flat: the dark wooden edge of her open front door is a soft, out-of-focus shape in the left foreground. Beyond it, in the plain, cool-lit common corridor of the apartment building, ${HIM} stands holding an empty steel katori, looking just past the lens (at Aunty, off-screen), hopeful and a little embarrassed, weight shifted to one leg. Warm light from the flat spills across his face; the corridor behind him falls soft and cool.` },
  "s2-aunty": { refs: ["aunty"], text: `35mm medium shot of ${HER}, in profile, standing just inside her open front door and looking toward the doorway (frame left) at someone off-screen, her face moving from surprise to concern. A potted plant is soft in the mid-ground; behind her, softly out of focus, ${HOME}. Soft morning window light from the side models her face. Nobody else in frame.` },
  "s3-andar": { refs: ["aunty", "bachelor"], text: `35mm medium shot from deep inside the living room of ${HOME}: ${HER} walks toward the camera, heading for the kitchen, glancing back over her shoulder with a small nod that says 'come in'. Behind her, in the open front doorway and slightly soft, ${HIM} is stepping inside, katori in hand. Sunlight from a window falls across the floor between them. Natural, unposed, as if the camera simply happened to be there.` },
  "s4a-spoon": { refs: ["aunty", "pack"], text: `85mm macro insert in Aunty's kitchen: her hand (a gold bangle, the edge of a maroon saree sleeve) dips a steel spoon of fine herbal tea powder into milky chai bubbling in a steel saucepan on a gas flame. The open ${PACK} stands at the edge of frame on the granite, soft. Steam rises, backlit by the window so it glows. Very shallow focus on the powder meeting the chai.` },
  // v3.1: the first render added a stray yellow tea pouch and a man's hands.
  "s4b-pour": { refs: ["aunty", "cup"], text: `85mm macro insert: Aunty's hands (an elderly woman's hands, a gold bangle, the edge of her maroon cotton saree sleeve) tilt a steel saucepan and pour hot milky chai through a small steel tea strainer into ${CUP} on the granite kitchen counter. Steam curls up, backlit by warm morning window light. Very shallow focus on the pour; the kitchen behind is soft yellow and white. No packets, pouches, boxes, jars with labels or any printed packaging anywhere in frame.` },
  "s5-sip": { refs: ["bachelor", "cup"], text: `85mm close-up, framed slightly off-centre: ${HIM}, sitting on Aunty's sofa, holds ${CUP} in both hands at his lips, eyes closed mid-sip, face softening into quiet relief. Directly behind his head is a clean, plain, warm peach wall, softly lit and out of focus, with nothing on it (space for a glowing mandala later). Window light from the side; a wisp of steam glows in the light. Shallow depth of field.` },
  "s6-maa": { refs: ["bachelor", "cup"], text: `50mm medium close-up on Aunty's sofa: ${HIM} holds ${CUP} in both hands in his lap; he has just looked up from it toward Aunty (off-screen, just past the lens), eyes open and a little moist, a grateful, slightly homesick small smile. Softly out of focus behind: ${HOME}. Window light from the side. Natural and unposed.` },
  "s7-pack": { refs: ["bachelor", "pack", "cup"], text: `High-angle 50mm shot over the young man's shoulder (his navy hoodie shoulder soft in the foreground), looking down at a small wooden side table beside Aunty's sofa: next to ${CUP} of chai, his hand has just picked up ${PACK} and turns its front toward himself to read it, so the front of the box faces the camera clearly and sits flat, sharp and evenly lit. Warm morning light.` },
  "s8-hero": { refs: ["pack", "cup"], text: `Product hero frame on Aunty's granite kitchen counter in warm, natural morning window light (the same kitchen as the story, not a studio): ${PACK} stands front-on in the LEFT third of the frame, beside it ${CUP} full of chai with a wisp of steam, a knob of fresh ginger and a sprig of tulsi. The right half of the frame is the softly out-of-focus yellow-and-white kitchen and window, calm and uncluttered, left empty for the logo and tagline. NO people anywhere in frame (an empty kitchen). 50mm, shallow depth of field.` },
};

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2]?.split(",");
  const todo = Object.entries(FRAMES).filter(([k]) => (only ? only.includes(k) : !existsSync(join(out, `${k}.png`))));
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(todo.slice(i, i + 3).map(async ([name, f]) => {
      try {
        const refs = f.refs.map((r) => REFS[r]);
        const labels = f.refs.map((r, j) => `Image ${j + 1} is the reference for ${LABEL[r]}.`).join(" ");
        const img = await generateCleanImage(`${labels}\n\n${f.text}\n\n${LOOK}`, "16:9", refs, f.refs.includes("pack") ? [REFS.pack] : []);
        writeFileSync(join(out, `${name}.png`), Buffer.from(img.imageBytes, "base64"));
        console.log(`${name}${img.clean ? "" : " (text check flagged it)"}`);
      } catch (e) {
        console.error(`${name} failed:`, String(e).slice(0, 160));
      }
    }));
  }
})();
