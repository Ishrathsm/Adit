// The Torvik end-card whisper (Algenib) in a few European accents. Each take is checked by Gemini
// and kept only when it is fully whispered and says the line exactly.
// Usage: npx tsx eval/torvik-accents.ts <outDir> [accent...] [--brisk]
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";
import { synthesizeVoiceover } from "../src/lib/voiceover";
import { WHISPER_PERSONA, WHISPER_READ, WHISPER_READ_BRISK } from "./torvik-bike";

export const ACCENTS: Record<string, string> = {
  italian: "Italian-accented English (a man from Milan)",
  french: "French-accented English (a man from Paris)",
  german: "German-accented English (a man from Munich)",
  british: "British English (Received Pronunciation, a man from London)",
};
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });

// Optional: only these accents, and the brisk read.
const [outDir, ...args] = process.argv.slice(2);
const brisk = args.includes("--brisk");
const only = args.filter((x) => !x.startsWith("--"));
(async () => {
  mkdirSync(outDir, { recursive: true });
  for (const [name, accent] of Object.entries(ACCENTS).filter(([n]) => !only.length || only.includes(n))) {
    for (let i = 1; i <= 6; i++) {
      try {
        const wav = await synthesizeVoiceover("Torvik. Ride with the wind.", "en", "male", "bold", brisk ? WHISPER_READ_BRISK : WHISPER_READ, { voice: "Algenib", persona: WHISPER_PERSONA, accent });
        const r = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: 'Reply as JSON {"transcript": string, "whispered": boolean, "accent": string}. whispered is true only if the whole clip is a whisper with no normal voiced speech; accent is the speaker\'s accent in a few words.' }] }],
          config: { responseMimeType: "application/json" },
        });
        const j = JSON.parse(r.text ?? "{}");
        const ok = j.whispered === true && /^torvik[.,!]?\s+ride with the wind[.!]?$/i.test((j.transcript ?? "").trim());
        console.log(name, i, ok ? "KEEP" : "skip", JSON.stringify(j));
        if (ok) { writeFileSync(join(outDir, `${name}.wav`), wav); break; }
      } catch (err) { console.log(name, i, "error", err instanceof Error ? err.message.slice(0, 160) : err); }
    }
  }
  process.exit(0);
})();
