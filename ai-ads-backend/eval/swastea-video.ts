// Swastea's film (user said "start the video now", 2026-10-08): one Veo take per shot from the
// approved frames, one speaker per clip, Veo's own voices and room sound but NO music (the Malhar bed
// and the faint "dhi-re-naaa" on the sip go in at the edit). Everyone speaks at a brisk, natural pace.
// `npx tsx eval/swastea-video.ts [shots]` → ~/Desktop/swastea/video/<shot>.mp4
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateVideo } from "../src/lib/veo";

const dir = join(homedir(), "Desktop", "swastea");
const out = join(dir, "video");
const frame = (f: string) => ({ imageBytes: readFileSync(join(dir, "frames", `${f}.png`)).toString("base64"), mimeType: "image/png" });

const LOOK = "A warm, realistic Indian TV commercial shot on a cinema camera: bright sunny daylight, natural colours, true skin tones. The camera moves slowly and smoothly or stays still; no sudden moves, no zooms, no effects. Everyone keeps exactly the face, hair and clothes of the first frame.";
const PACE = "He or she speaks at a brisk, natural everyday pace, quick and conversational, never slow or drawn out.";
const AUDIO = "Audio: only the spoken line and natural room sound (a quiet home, faint birds outside). No music, no background score, no humming.";
const SAY = "Swastea is pronounced 'swaas-tee' (swaas as in swaasth, then tee).";
const PACK = "The Swastea box keeps exactly its printed design from the first frame; its text never changes.";

const SHOTS: Record<string, { frame: string; prompt: string }> = {
  s1: { frame: "s1-door", prompt: `${LOOK} In the building corridor, the young man with a cold, holding an empty steel katori, finishes a small sneeze into his elbow, sniffs, then looks at Aunty in the doorway and says in Hindi with a blocked nose: "Aunty, thodi adrak milegi?" Aunty only listens with growing concern; she does not speak. Then both hold still. ${PACE} ${AUDIO}` },
  s2: { frame: "s2-aunty", prompt: `${LOOK} Close-up of Aunty in her doorway. With quiet, motherly concern she says in Hindi: "Lagta hai zukaam hai. Andar aao, beta." and gently steps aside, gesturing him in. Only she speaks. ${PACE} ${AUDIO}` },
  s3: { frame: "s3-kitchen", prompt: `${LOOK} In her bright kitchen Aunty tips a spoonful of herbal tea powder into the chai boiling in the steel saucepan and stirs once; steam rises gently. The box on the counter stays still, front label to camera. ${PACK} No one speaks. Audio: the soft bubbling of chai, a spoon clinking on steel, faint birds outside. No music.` },
  s4: { frame: "s4-sip", prompt: `${LOOK} On the sofa, the young man holds the steel cup of hot chai in both hands, eyes closed, and takes a slow sip; his shoulders drop, he breathes out long and easy through his nose, and a calm smile of relief spreads across his face. Then, eyes still closed, he says softly in Hindi: "Aah… kitna aaram mila." Only he speaks. ${AUDIO}` },
  s5: { frame: "s5-sincere", prompt: `${LOOK} On the sofa, holding the steel cup, the young man looks up at Aunty off-screen with a sincere, grateful, slightly homesick expression, and says warmly in Hindi: "Aunty… bilkul maa ke haath jaisi." Then he smiles softly. Only he speaks. ${PACE} ${AUDIO}` },
  s6: { frame: "s6-pack", prompt: `${LOOK} In the living room Aunty holds the Swastea box steady beside her, front to the camera, and says warmly, looking into the lens: "Adrak, ashwagandha aur tulsi se bana — Swastea. Roj piyo, swasth raho." Uncle beside her nods and smiles but does not speak. She keeps the box still and upright throughout. ${PACK} ${SAY} ${PACE} ${AUDIO}` },
  end: { frame: "end-plate", prompt: `${LOOK} Product shot on the kitchen counter, almost still: gentle steam curls up from the steel cup of chai beside the Swastea box, warm morning light; the camera pushes in very slowly. ${PACK} No people, no one speaks. Audio: quiet kitchen room tone only. No music.` },
};
const NEGATIVE = "music, background score, singing, subtitles, captions, on-screen text, watermark, logo animation, extra people, face change, morphing, sudden camera move, zoom, smoke, sparkles";

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2]?.split(",");
  const todo = Object.entries(SHOTS).filter(([k]) => (only ? only.includes(k) : !existsSync(join(out, `${k}.mp4`))));
  // two at a time, to stay under Vertex rate limits
  for (let i = 0; i < todo.length; i += 2) {
    await Promise.all(todo.slice(i, i + 2).map(async ([k, s]) => {
      try {
        const v = await generateVideo(s.prompt, { image: frame(s.frame), durationSeconds: 8, aspectRatio: "16:9", generateAudio: true, negativePrompt: NEGATIVE });
        writeFileSync(join(out, `${k}.mp4`), Buffer.from(v.videoBytes, "base64"));
        console.log(`${k} done`);
      } catch (err) {
        console.error(`${k} failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
    }));
  }
})();
