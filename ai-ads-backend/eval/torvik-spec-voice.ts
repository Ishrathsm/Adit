// The four spec headings read in the end card's voice (Algenib whisper, German accent) at a natural
// pace — never slowed. Each take is checked by Gemini (fully whispered, exact words) and must fit
// its callout's window. Usage: npx tsx eval/torvik-spec-voice.ts → ~/Desktop/torvik/spec-voice/N.wav
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";
import { synthesizeVoiceover } from "../src/lib/voiceover";
import { WHISPER_PERSONA } from "./torvik-bike";

const LINES: { text: string; words: string[]; maxSeconds: number }[] = [
  { text: "Full-LED headlight.", words: ["full", "led", "headlight"], maxSeconds: 2.3 },
  { text: "Six-eighty cc. Parallel twin.", words: ["680", "parallel", "twin"], maxSeconds: 2.4 },
  { text: "Dual-channel ABS.", words: ["dual", "channel", "abs"], maxSeconds: 2.3 },
  { text: "One seventy-eight kilo kerb weight.", words: ["178", "kilo", "weight"], maxSeconds: 3.4 },
];
// The approved end-card pace (WHISPER_READ_BRISK, ~95 wpm): quicker reads lost the whisper.
const READ =
  "A breathy stage whisper with no voiced tone, close to the microphone, at an easy, even pace of about 95 words per minute — the same pace as the end-card line, never drawn out, no dramatic pauses. Say only these words, nothing else. Low and intimate; never a normal speaking voice, never an announcer";
// The approved end-card accent (eval/torvik-accents.ts runs on import, so it is restated here).
const GERMAN = "German-accented English (a man from Munich)";
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const seconds = (wav: Buffer) => (wav.length - 44) / (24000 * 2);

(async () => {
  const dir = join(homedir(), "Desktop", "torvik", "spec-voice");
  mkdirSync(dir, { recursive: true });
  for (const [n, line] of LINES.entries()) {
    let kept = false;
    for (let i = 1; i <= 8 && !kept; i++) {
      try {
        const wav = await synthesizeVoiceover(line.text, "en", "male", "bold", READ, { voice: "Algenib", persona: WHISPER_PERSONA, accent: GERMAN });
        const r = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: 'Reply as JSON {"transcript": string, "whispered": boolean, "speech_seconds": number}. whispered is true only if the whole clip is a whisper with no normal voiced speech; speech_seconds is how long the speech itself lasts, without leading or trailing silence.' }] }],
          config: { responseMimeType: "application/json" },
        });
        const j = JSON.parse(r.text ?? "{}");
        const said = String(j.transcript ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
        // Numbers come back as digits ("680cc", "178 kilo"); "kerb" as "curb".
        const norm = said.replace(/six eighty|six hundred (and )?eighty/g, "680").replace(/one seventy eight|one hundred (and )?seventy eight/g, "178").replace(/\s+/g, " ");
        const words = line.words.every((w) => norm.includes(w) || (w === "abs" && norm.includes("a b s")));
        const ok = j.whispered === true && words && Number(j.speech_seconds) <= line.maxSeconds;
        console.log(n + 1, i, ok ? "KEEP" : "skip", seconds(wav).toFixed(2) + "s file", JSON.stringify(j));
        if (ok) { writeFileSync(join(dir, `${n + 1}.wav`), wav); kept = true; }
      } catch (err) { console.log(n + 1, i, "error", err instanceof Error ? err.message.slice(0, 160) : err); }
    }
    if (!kept) console.log(n + 1, "NO TAKE PASSED");
  }
  process.exit(0);
})();
