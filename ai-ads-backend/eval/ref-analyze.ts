// Studies reference ads: Gemini watches each one (picture and sound) and writes a shot-by-shot
// breakdown of camera motion, subject motion, paths, continuity and sound, for turning into prompt
// rules. Usage: npx tsx eval/ref-analyze.ts <outDir> <video.mp4>...
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const PROMPT = `You are a commercial director and editor studying this motorcycle ad so an AI video pipeline can copy its craft. Watch it with sound.
1. SHOT LIST: for every shot, in order, one line: time range | shot size & angle | CAMERA motion (locked / pan / track alongside at constant speed / drone / handheld; direction; speed) | BIKE motion (static / moving straight / one arc through a bend; direction relative to camera) | what moves in frame (camera, bike, both, background only) | location | sound on this shot.
2. MOTION RULES: what patterns make the motion look real? Specifically: how often do camera and bike both move, and when they do, how are they coupled (e.g. camera tracks at the bike's exact speed so the bike stays fixed in frame)? Are paths straight? Does the location ever change within a shot?
3. EDIT: typical shot lengths, how cuts are timed (on beats, on motion, on sound hits), shot-size progression, how the product reveal and logo are built.
4. SOUND: music style and energy curve, engine/effects design, how effects sync with cuts, voice (if any), mix levels.
5. The 10 most important, concrete, copyable rules for making a realistic motorcycle ad with an AI video model that renders 4-8s clips from a first-frame image.
Be concrete and terse.`;

(async () => {
  const [outDir, ...files] = process.argv.slice(2);
  await Promise.all(files.map(async (f) => {
    const r = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: readFileSync(f).toString("base64") } }, { text: PROMPT }] }],
    });
    const out = join(outDir, `${basename(f, ".mp4").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.md`);
    writeFileSync(out, r.text ?? "");
    console.log("wrote", out, (r.text ?? "").length);
  }));
  process.exit(0);
})();
