// Reviews each Swastea Veo clip before the edit: words with timestamps, the brand word, motion
// realism, face/pack consistency, and any music Veo slipped in. `npx tsx eval/swastea-review.ts [shots]`
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const EXPECT: Record<string, string> = {
  s1: 'young man sneezes, says "Aunty, thodi adrak milegi?"; Aunty silent',
  s2: 'Aunty says "Lagta hai zukaam hai. Andar aao, beta." and steps aside',
  s3: "Aunty spoons tea powder into boiling chai; no speech",
  s4: 'he sips with eyes closed, relief, then says "Aah… kitna aaram mila."',
  s5: 'he says "Aunty… bilkul maa ke haath jaisi."',
  s6: 'Aunty holds the pack and says "Adrak, ashwagandha aur tulsi se bana — Swastea. Roj piyo, swasth raho." (Swastea = swaas-tee); Uncle silent',
  end: "pack and steaming steel cup, near-still, no people, no speech",
};
(async () => {
  const shots = process.argv[2]?.split(",") ?? Object.keys(EXPECT);
  await Promise.all(shots.map(async (s) => {
    const r = await ai.models.generateContent({
      model: env.textModel,
      contents: [
        { inlineData: { data: readFileSync(join(homedir(), "Desktop", "swastea", "video", `${s}.mp4`)).toString("base64"), mimeType: "video/mp4" } },
        `You are a strict ad film supervisor. Expected: ${EXPECT[s]}. Report briefly:
1. Every spoken word with start–end times (0.1s), and who speaks. Flag wrong/missing/extra words. If 'Swastea' is said, how exactly does it sound?
2. Speaking pace: brisk and natural, or slow?
3. Motion: anything unrealistic (morphing hands/faces, objects appearing/vanishing, sudden camera moves, physics errors), with times.
4. Faces/clothes consistent with the first frame? Any extra people?
5. Any music, singing or humming in the audio?
6. The best usable window (start–end) for the edit.
End with VERDICT: USE / USE WITH TRIM / PROBLEM — <one line>.`,
      ],
    });
    console.log(`\n===== ${s}\n${r.text?.trim()}`);
  }));
})();
