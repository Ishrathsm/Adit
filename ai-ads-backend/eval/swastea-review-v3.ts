// Reviews every Swastea v3 take before the edit: words with times, clarity, pace, motion realism,
// wardrobe/cup continuity, anyone looking at the lens, and any music Veo slipped in.
// `npx tsx eval/swastea-review-v3.ts` → eval/out/swastea-review-v3.md
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";

const dir = join(homedir(), "Desktop", "swastea", "video-v3");
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const EXPECT: Record<string, string> = {
  s1: 'young man (navy hoodie) in corridor, says "Aunty, thodi adrak milegi?", small sneeze',
  s2: 'Aunty (maroon saree) in profile says "Lagta hai zukaam hai."',
  s3: 'Aunty walks toward camera saying "Andar aao, beta."; young man (navy hoodie) follows',
  s4a: "a spoon of powder into boiling chai; no speech",
  s4b: "chai poured through a strainer into a steel cup; no speech",
  s5: 'he sips with eyes closed, relief, says softly "Aah… kitna aaram mila."; head stays roughly in place',
  s6: 'he looks up and says "Aunty, bilkul maa ke haath jaisi."',
  s7: 'his hand holds the green box steady; off-screen elderly woman says "Adrak, ashwagandha aur tulsi se bani hai."',
  s8: "still pack shot with steam, slow push-in, no people, no speech",
};
(async () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".mp4")).sort();
  const results = await Promise.all(files.map(async (f) => {
    const shot = f.split("-t")[0];
    const r = await withRateLimitRetry("review", () => ai.models.generateContent({ model: env.textModel, contents: [
      { inlineData: { data: readFileSync(join(dir, f)).toString("base64"), mimeType: "video/mp4" } },
      `Strict ad-film supervisor. Expected: ${EXPECT[shot]}. Report briefly:
1. Every spoken word with start–end (0.1s) and speaker. Wrong/missing/extra words? Each word clearly pronounced?
2. Pace: brisk-natural or slow?
3. Motion problems (morphing, objects appearing/vanishing, physics, sudden camera moves) with times.
4. Wardrobe/face consistent with the first frame? Anyone looking into the lens? Extra people?
5. Any music, singing or narration?
6. Best usable window (start–end).
End with VERDICT: USE / USE WITH TRIM / REJECT — reason.`] }));
    return `===== ${f}\n${r.text?.trim()}\n`;
  }));
  const text = results.join("\n");
  writeFileSync(join(__dirname, "out", "swastea-review-v3.md"), text);
  console.log(text.split("\n").filter((l) => /^=====|VERDICT/i.test(l)).join("\n"));
})();
