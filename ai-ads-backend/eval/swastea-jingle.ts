// Swastea's sip jingle (user, 2026-10-08): the long aalap was "worst" — they want a 2–3s sung hook,
// a woman singing "dhirena dhirena"-style tarana syllables, on the sip. Lyria makes ~32s takes; a
// listener transcribes the syllables with timestamps so the best short phrase can be cut out.
// `npx tsx eval/swastea-jingle.ts [listen]` → ~/Desktop/swastea/jingle-N.wav
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";

const dir = join(homedir(), "Desktop", "swastea");
// v2 (user, 2026-10-08): fast and captivating, "dhirena dhirena dhirena dhirenaa" in 2 seconds, since
// the film is fast-paced. Light hand percussion is allowed now.
// v4 (user, 2026-10-08): not repeats. Three women in chorus sing ONE sustained aalap phrase,
// "dhi-re-naaa", about 2 seconds, when he drinks. Each take should repeat that one phrase with
// gaps, so a clean 2s cut can be found. v3 chorus takes are jingle-chorus-*.wav.
const PROMPTS = [
  "Three Indian women singing together in close harmony, a single short sustained Hindustani aalap phrase 'dhi-re-naaaa': two quick syllables then a long open 'naaa' gliding upward with a gentle meend, about two seconds, then silence, then the phrase again with small variations. Sweet, bright, uplifting, like a famous Indian tea ad jingle signature. Soft tanpura and a light santoor shimmer, no drums.",
  "A small female trio choir, three voices in unison and a third above, singing one soaring two-second vocal signature 'dhirenaaa' — a quick 'dhi-re' then a long ringing 'naaa' — repeated a few times with pauses in between. Warm, joyful, morning freshness, Indian classical flavour, tanpura drone, gentle sitar strum. No percussion, no words.",
  "Indian ad jingle sonic logo: three female singers sing a single sustained melodic phrase 'dhi re naaa' in harmony, the final vowel held and rising like a sigh of relief, about two seconds long, repeated four times with breaths and short rests. Bright, sweet, captivating, Hindustani aalap style over tanpura. No drums, no lyrics.",
  "Female vocal trio, Hindustani tarana-aalap, one short catchy phrase 'dhi-re-naaa' held for two seconds with a graceful upward glide at the end, sung together in sweet harmony, repeated several times separated by silence. Fresh, uplifting, cinematic Indian commercial jingle. Soft strings and tanpura, no percussion.",
  "Three young Indian women harmonising a brief joyful aalap 'dhirenaaaa', quick start and a long held open vowel that blooms and fades, two seconds per phrase, phrases separated by silence, repeated. Like a tea brand's musical signature. Tanpura drone, light flute, no drums, no words.",
];
const negative = "male voice, men, solo voice, lyrics, english words, slow, sad, heavy drums, electronic, harsh";

(async () => {
  if (process.argv[2] !== "listen") {
    for (const [i, p] of PROMPTS.entries()) {
      try {
        writeFileSync(join(dir, `aalap-trio-${i + 1}.wav`), await generateMusic(p, undefined, negative));
        console.log(`jingle ${i + 1} done`);
      } catch (err) {
        console.error(`jingle ${i + 1} failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
    }
  }
  const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
  for (const i of [1, 2, 3, 4, 5]) {
    const f = join(dir, `aalap-trio-${i}.wav`);
    if (!existsSync(f)) continue;
    const r = await ai.models.generateContent({
      model: env.textModel,
      contents: [
        { inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } },
        "You are a music director looking for a 2-second sonic signature: a chorus of about three women singing ONE sustained aalap phrase 'dhi-re-naaa' (quick dhi-re, long held naaa). List every sung phrase with start and end time to 0.1s and its syllables; say for each whether it is a group (how many voices) or solo, and whether any male voice or real words appear. Then name the two best self-contained phrases of 1.6–2.6s that begin and end cleanly (start–end), and say how sweet and catchy each is.",
      ],
    });
    console.log(`\n== jingle ${i}\n${r.text?.trim()}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
