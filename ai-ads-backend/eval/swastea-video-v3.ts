// Swastea plan v3 video (user approved everything, 2026-10-08: score draft 3 with the bansuri sigh, VO A).
// One Veo clip per keyframe in frames-v3. Dialogue shots get two takes so the clearer read can be kept.
// Each prompt asks for one action, one camera move, real-film behaviour (nobody looks at the lens), no
// music, and a brisk, natural line with pronunciation hints. Nobody says the brand name on camera: the
// TTS voice-over says it on the pack shot.
// `npx tsx eval/swastea-video-v3.ts [shot-take,...]` → ~/Desktop/swastea/video-v3/<shot>-t<n>.mp4
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateVideo } from "../src/lib/veo";

const dir = join(homedir(), "Desktop", "swastea");
const out = join(dir, "video-v3");
const frame = (f: string) => ({ imageBytes: readFileSync(join(dir, "frames-v3", `${f}.png`)).toString("base64"), mimeType: "image/png" });

const FILM = "Shot like a scene from a real Indian feature film: natural, unperformed behaviour, nobody looks into the camera, physically believable motion, everyone keeps exactly the face, hair and clothes of the first frame. Soft natural light, shallow depth of field.";
const NO_MUSIC = "Audio: only the natural sound of the scene and the spoken line. No music, no background score, no humming, no narration.";
const SPEAK = "He or she speaks at a brisk, natural everyday pace, every word clear and fully pronounced.";
const HIM = "The young man (messy hair, stubble, navy hoodie over a grey t-shirt)";
const HER = "Aunty (grey hair in a low bun, red bindi, maroon cotton saree)";

const SHOTS: Record<string, { frame: string; takes: number; prompt: string }> = {
  // v3.1 (user, 2026-10-08): s1 didn't say "Aunty, thodi adrak milegi" clearly and the sneeze was lost;
  // s2's Aunty spoke very slowly and a second woman slid in at the right edge. Lines are now given in
  // Devanagari too, with when to start and how long the line may take.
  s1: { frame: "s1-door", takes: 3, prompt: `${FILM} Camera: a very gentle handheld drift, almost still. ${HIM} stands in the cool corridor outside Aunty's door holding an empty steel katori, looking just past the camera at Aunty (off-screen). Within the first half second he says clearly in Hindi, at a normal conversational pace, slightly nasal from a cold: "आंटी, थोड़ी अदरक मिलेगी?" ("Aunty, thodi adrak milegi?" — aan-tee, tho-dee ud-ruck mi-lay-gee), the whole line taking about 2 seconds, every word distinct. Immediately after the line he turns his head and sneezes once, clearly and audibly ("aah-chhoo"), into his elbow, then sniffs and looks back. Only he speaks. ${NO_MUSIC}` },
  s2: { frame: "s2-aunty", takes: 3, prompt: `${FILM} Camera: locked off. ${HER}, in profile at her doorway, looks at the young man off-screen; her face shows quick, motherly concern and, within the first half second, she says in Hindi at a NORMAL, natural speaking speed (not slow, not drawn out): "लगता है ज़ुकाम है।" ("Lagta hai zukaam hai." — lug-taa hai zoo-kaam hai), the whole line taking about 1.5 seconds. Then she keeps looking at him with concern. Only Aunty is in the frame the whole time; nobody else enters or appears at the edges. Only she speaks. ${NO_MUSIC}` },
  s3: { frame: "s3-andar", takes: 2, prompt: `${FILM} Camera: locked off. ${HER} walks toward the camera across her sunlit living room, heading to the kitchen; she glances back over her shoulder and says warmly in Hindi: "Andar aao, beta." (pronounced: un-dar aa-o, bay-taa). Behind her, ${HIM} steps in through the doorway with the steel katori and follows. Only she speaks. ${SPEAK} ${NO_MUSIC}` },
  s4a: { frame: "s4a-spoon", takes: 1, prompt: `${FILM} Camera: locked off macro. Aunty's hand tips a spoonful of herbal tea powder into the milky chai bubbling in the steel saucepan; the powder swirls in and steam rises, glowing in the window light. The tea box at the edge of frame stays still. No one speaks. Audio: the chai bubbling, a soft spoon tap on steel. No music.` },
  s4b: { frame: "s4b-pour", takes: 1, prompt: `${FILM} Camera: locked off macro. Aunty's hands pour the hot chai from the steel saucepan through the strainer into the steel cup; steam curls up in the backlight; the pour slows and ends. No one speaks. Audio: the pour, a faint clink. No music.` },
  s5: { frame: "s5-sip", takes: 2, prompt: `${FILM} Camera: locked off with a very slow, almost imperceptible push-in. ${HIM} holds the steel cup in both hands at his lips, eyes closed, and takes a slow sip; his shoulders drop and he breathes out long and easy through his nose, a calm smile of relief spreading. Then, eyes still closed, he says softly in Hindi: "Aah… kitna aaram mila." (pronounced: kit-naa aa-raam mi-laa). His head stays roughly in place. Only he speaks. ${NO_MUSIC}` },
  s6: { frame: "s6-maa", takes: 2, prompt: `${FILM} Camera: a very gentle handheld drift. ${HIM} on the sofa holds the steel cup in his lap, glances down at it, then looks up at Aunty (her shoulder soft in the foreground) with a grateful, slightly homesick smile and says warmly in Hindi: "Aunty, bilkul maa ke haath jaisi." (pronounced: aan-tee, bil-kul maa ke haath jai-see). Aunty does not speak. ${SPEAK} ${NO_MUSIC}` },
  s7: { frame: "s7-pack", takes: 2, prompt: `${FILM} Camera: locked off, over his shoulder. His hand holds the green tea box steady and turns it very slightly toward himself as he reads it; the box front stays facing the camera, flat and still. Off-screen, Aunty's warm, motherly elderly voice says in Hindi: "Adrak, ashwagandha aur tulsi se bani hai." (pronounced: ud-ruck, ush-wa-gun-dhaa aur tul-see se ba-nee hai). The box's printed design never changes. ${SPEAK} ${NO_MUSIC}` },
  s8: { frame: "s8-hero", takes: 1, prompt: `${FILM} Camera: a very slow, smooth push-in. A still kitchen counter in warm morning light: steam curls gently from the steel cup beside the green tea box, ginger and tulsi. Nothing else moves. No people. The box's printed design never changes. Audio: quiet kitchen room tone, faint birds outside. No music, no voice.` },
};
const NEGATIVE = "second woman, extra person at the edge of frame, slow speech, music, background score, singing, narration, subtitles, captions, on-screen text, watermark, extra people, uncle, waving, looking at camera, face change, morphing, flicker, sudden camera move, zoom, smoke, sparkles";

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2]?.split(",");
  const jobs = Object.entries(SHOTS).flatMap(([k, s]) => Array.from({ length: s.takes }, (_, i) => [k, i + 1, s] as const))
    .filter(([k, t]) => (only ? only.includes(`${k}-t${t}`) : !existsSync(join(out, `${k}-t${t}.mp4`))));
  for (let i = 0; i < jobs.length; i += 2) {
    await Promise.all(jobs.slice(i, i + 2).map(async ([k, t, s]) => {
      try {
        const v = await generateVideo(s.prompt, { image: frame(s.frame), durationSeconds: 8, aspectRatio: "16:9", generateAudio: true, negativePrompt: NEGATIVE });
        writeFileSync(join(out, `${k}-t${t}.mp4`), Buffer.from(v.videoBytes, "base64"));
        console.log(`${k}-t${t} done`);
      } catch (e) {
        console.error(`${k}-t${t} failed:`, String(e).slice(0, 160));
      }
    }));
  }
})();
