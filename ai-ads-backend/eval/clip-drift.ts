// When does a Veo clip go wrong? For each rendered shot of a storyboard, Gemini watches the raw clip
// and reports the first second the bike's design, the location, or the motion breaks — to set how
// much of a clip is safe to keep. Usage: npx tsx eval/clip-drift.ts <storyboardId> <out.json>
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../src/lib/env";
import { listShots } from "../src/lib/storyboards";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const N = { type: Type.NUMBER, nullable: true };
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    duration: { type: Type.NUMBER },
    design_drift_at: N, design_drift: { type: Type.STRING, nullable: true },
    location_change_at: N,
    motion_breaks_at: N, motion_problem: { type: Type.STRING, nullable: true },
    camera_and_bike_uncoupled: { type: Type.BOOLEAN },
    clean_until: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  },
  required: ["duration", "camera_and_bike_uncoupled", "clean_until", "notes"],
};
(async () => {
  const [storyboardId, out] = process.argv.slice(2);
  const shots = await listShots(storyboardId);
  const rows = await Promise.all(shots.map(async (s) => {
    const mp4 = Buffer.from(await (await fetch(s.video_url!)).arrayBuffer()).toString("base64");
    const r = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: mp4 } }, { text: `AI-generated shot of a motorcycle ad. Intended shot: ${s.description}\nWatch closely, second by second. Report: the first second (from clip start) the motorcycle's design changes (forks, wheels, exhaust, tank, colours) or null; the first second the location/background changes into a different place or null; the first second the motion becomes unrealistic (camera and bike moving independently, bike drifting/floating in frame, wobbly path, runaway zoom, warping) or null; clean_until = the last second before the first problem (the clip duration if none).` }] }],
      config: { responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    return { shot: s.shot_index + 1, ...JSON.parse(r.text ?? "{}") };
  }));
  writeFileSync(out, JSON.stringify(rows, null, 1));
  for (const r of rows.sort((a, b) => a.shot - b.shot)) console.log(`shot ${r.shot} (${r.duration}s): clean until ${r.clean_until}s | design ${r.design_drift_at ?? "-"} | location ${r.location_change_at ?? "-"} | motion ${r.motion_breaks_at ?? "-"} ${r.motion_problem ?? ""}`);
  process.exit(0);
})();
