// Aurelle UGC review: a 22-year-old Indian woman's Instagram Story review in Hinglish, one
// continuous front-camera take built from two chained Veo clips (clip 2 starts on clip 1's last
// frame), her own voice and a faint home ambience from Veo's audio, no music.
// `npx tsx eval/aurelle-ugc.ts keyframe|clip1|clip2` → ~/Desktop/aurelle/ugc/
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";
import { generateVideo } from "../src/lib/veo";
import { extractLastFrame } from "../src/lib/video-stitch";

const dir = join(homedir(), "Desktop", "aurelle");
const out = join(dir, "ugc");
const png = (f: string) => ({ imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" });
const bottle = png(join(dir, "bottle-ref.png"));

// v2: the user found v1's face "too AI generic" and the room "too tidy" — specific, imperfect detail.
const HER =
  "a real, ordinary 22-year-old Indian college girl, not a model: medium-brown skin with real texture — visible pores, a few small acne marks on her cheeks and chin, a slightly oily T-zone, faint under-eye darkness — a slightly asymmetric smile, a small gold nose pin, a little smudged kajal, thick natural eyebrows, no foundation; long straight jet-black hair worn loose with a few flyaway strands at the crown; a faded grey oversized t-shirt with a small stain near the collar";
const ROOM =
  "her messy, lived-in Indian bedroom in the daytime: an unmade bed with a crumpled bedsheet behind her, clothes and a dupatta thrown over a chair, a steel almirah, a white plastic wall switchboard with a charger plugged in, a few books and a water bottle on the shelf; on her desk a clutter of a phone charger cable, a hair clip, a couple of skincare tubes and a small hand towel; slightly uneven daylight from a window on her left; ordinary and untidy, never styled";
const PHONE =
  "filmed on a smartphone front camera propped up on her desk at eye level: vertical 9:16, the slight wide-angle look of a front camera, chest-up framing, phone auto-exposure and natural colour, gentle phone sharpening and a little sensor grain, no cinematic lighting, no beauty filter, no depth-of-field effects beyond what a phone does";
const BOTTLE =
  "the Aurelle shampoo bottle exactly as in the reference image, with its full printed label exactly as shown: a tall soft-oval matte ivory-white bottle, brushed champagne-gold pump, the black AURELLE wordmark with BIO-PROTEIN REPAIR SHAMPOO beneath";

const KEYFRAME = `A real, candid frame from a casual phone selfie video: ${HER}, in ${ROOM}. ${PHONE}. The phone stands on a small tripod on the desk, so both her hands are free: neither arm reaches toward the camera and no arm runs out of the frame edge. She sits at the desk leaning slightly toward the camera with a small, natural smile, looking straight into the lens, one hand holding up a few ends of her hair, the other forearm resting on the desk; her mouth is relaxed and closed. ${BOTTLE} stands on the desk in the lower corner of the frame, label facing the camera. Photorealistic, an ordinary phone video still, not a photoshoot. Never change, add or invent any text on the bottle; no other text, captions, stickers or logos anywhere.`;

const AUDIO = "Audio: only her own voice, recorded by the phone's microphone in a quiet room, plus a very faint room tone (a distant ceiling-fan hum, faint far-off traffic). No music, no sound effects.";
const VOICE = "She speaks in natural Hinglish (English and Hindi mixed) with an Indian accent, quickly and casually, warm, a little laugh in her voice, like talking to friends on a casual phone video; her lip movements match every word.";

// v3: no spoken brand name (Veo said "Aurelle" like "L'Oréal"); she ends clip 1 still and quiet so the
// join to clip 2 is invisible.
const CLIP1 = `One continuous take from a casual phone selfie video, ${PHONE}. ${HER}, in ${ROOM}. The camera never moves; she moves naturally, and her face stays exactly the same person throughout. She leans in, holding up a few ends of her hair to the lens, and says: "Guys, honest review. Meri ends itni dry thi na — frizz everywhere." Then she picks up the shampoo bottle from the desk and holds it up beside her face, label toward the lens, and says: "Phir maine ye try kiya." After the line she calmly sets the bottle back down on the desk in the same spot, then rests her hands on the desk and holds still for the last two seconds, looking into the lens with a small closed-mouth smile, not speaking, mouth closed. ${VOICE} ${BOTTLE}; the label stays readable and unchanged. ${AUDIO}`;
// v4: clip 2 starts at 5.92s of clip 1 (her hands on the bottle she has just set down), so her
// "ho gaya" ad-lib is cut; no "Instagram" anywhere (Veo painted its logo); a shorter line so the
// last phrase isn't dropped again.
const CLIP2 = `The same continuous take continues from this exact frame, ${PHONE}. ${HER}, in ${ROOM}. The camera never moves. She lets go of the shampoo bottle, which stays standing upright on the desk, rigid and unchanged the whole time. She presses its gold pump straight down once with one finger, never tilting or bending the bottle, catching a small dollop in her other palm, and tilts that palm toward the lens, saying quickly and brightly: "Sulphate-free hai, argan oil aur vitamin E. Dekho — so creamy." She wipes that palm clean on the small hand towel on the desk, then with her clean hand runs her fingers down a long section of her hair and says: "And now? So smooth yaar. Sach mein, try karo." She says every word, all the way to "try karo", then smiles at the camera and holds still. ${VOICE} ${BOTTLE}. ${AUDIO}`;
const NEGATIVE =
  "app icons, Instagram logo, social media interface, saying a brand name, bending bottle, warping bottle, melting objects, music, background music, singing, subtitles, captions, on-screen text, stickers, watermark, other logos, changing label text, extra fingers, distorted hands, warped face, face changing, different person, beauty filter, plastic skin, cinematic lighting, camera movement, camera shake, cuts, jump cuts";

(async () => {
  const step = process.argv[2];
  if (step === "keyframe") {
    for (let i = 5; i <= 6; i++) {
      const img = await generateCleanImage(KEYFRAME, "9:16", [bottle], [bottle]);
      writeFileSync(join(out, `keyframe-${i}.png`), Buffer.from(img.imageBytes, "base64"));
      console.log(`keyframe ${i}${img.clean ? "" : " (text check flagged it)"}`);
    }
  } else if (step === "clip1" || step === "clip2") {
    // Clip 2 starts on the frame where clip 1 is cut (cut-frame.png), else on clip 1's last frame.
    const start = step === "clip1" ? png(join(out, "keyframe.png")) : existsSync(join(out, "cut-frame.png")) ? png(join(out, "cut-frame.png")) : { imageBytes: (await extractLastFrame(readFileSync(join(out, "clip1.mp4")))).toString("base64"), mimeType: "image/png" };
    const file = join(out, `${step}.mp4`);
    if (existsSync(file)) throw new Error(`${file} exists; one take per clip`);
    const video = await generateVideo(step === "clip1" ? CLIP1 : CLIP2, { image: start, durationSeconds: 8, aspectRatio: "9:16", generateAudio: true, negativePrompt: NEGATIVE });
    writeFileSync(file, Buffer.from(video.videoBytes, "base64"));
    console.log(file);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
