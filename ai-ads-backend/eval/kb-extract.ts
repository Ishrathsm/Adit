// Knowledge base builder: Gemini reads each tutorial transcript and extracts the concrete,
// teachable techniques under fixed headings. Usage: npx tsx eval/kb-extract.ts <rawDir> <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const RUBRIC = `You are building a production knowledge base for an AI video-ad pipeline (Google Veo 3.1 image-to-video, Gemini image generation for keyframes, Lyria for music, Gemini TTS). From this tutorial transcript, extract ONLY concrete, reusable techniques — the actual words of prompts, settings, numbers, orders of operations — not hype. Use these headings (skip empty ones):
1. Workflow (the steps, in order)
2. Keyframe / image prompting (exact phrasing, structure, what to include)
3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)
4. Product & character consistency (how they keep the product identical across shots)
5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)
6. Music & sound (how they score, SFX, voice, mixing)
7. Common failures and fixes
8. Quotes worth keeping (verbatim prompt examples, max 5)
Be terse, bullet points. Say which tool each tip is for.`;

(async () => {
  const [raw, out] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  const meta = readFileSync(join(raw, "meta.txt"), "utf8").trim().split("\n").map((l) => l.split(" | "));
  let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (next < meta.length) {
      const [id, channel, title] = meta[next++];
      let text: string;
      try { text = readFileSync(join(raw, `${id}.txt`), "utf8"); } catch { console.log(id, "no transcript"); continue; }
      const r = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: `${RUBRIC}\n\nVIDEO: "${title}" by ${channel}\n\nTRANSCRIPT:\n${text}` });
      writeFileSync(join(out, `${id}.md`), `# ${title}\n${channel} · https://www.youtube.com/watch?v=${id}\n\n${r.text ?? ""}`);
      console.log(id, "done", (r.text ?? "").length);
    }
  }));
  process.exit(0);
})();
