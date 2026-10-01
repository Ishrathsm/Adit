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
  { text: "Full-LED headlight.", words: ["full", "led", "headlight"], maxSeconds: 1.8 },
  { text: "Six-eighty cc. Parallel twin.", words: ["680", "parallel", "twin"], maxSeconds: 2.5 },
  { text: "Dual-channel ABS.", words: ["dual", "channel", "abs"], maxSeconds: 1.8 },
  { text: "One seventy-eight kilo kerb weight.", words: ["178", "kilo", "weight"], maxSeconds: 2.6 },
];
// The approved end-card pace (WHISPER_READ_BRISK, ~95 wpm): quicker reads lost the whisper.
// --soft: the user's choice when the whisper wouldn't hold on "LED"/"ABS" — the same voice, low and
// quiet but voiced, so all four headings match.
const SOFT = process.argv.includes("--soft");
const SOFT_READ =
  "Low, soft and quiet, close to the microphone, in a deep, dusky chest voice — calm and intimate, quick and crisp, about 170 words per minute, the whole line in one breath with no pause anywhere inside it, like reading a spec sheet aloud — never slowed or drawn out. Say only these words, nothing else. Not a whisper, never loud, never an announcer";
const WHISPER_READ_HEADINGS =
  "A breathy stage whisper with no voiced tone, close to the microphone, at an easy, even pace of about 95 words per minute — the same pace as the end-card line, never drawn out, no dramatic pauses. Say only these words, nothing else. Low and intimate; never a normal speaking voice, never an announcer";
// The approved end-card accent (eval/torvik-accents.ts runs on import, so it is restated here).
const GERMAN = "German-accented English (a man from Munich)";
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const seconds = (wav: Buffer) => (wav.length - 44) / (24000 * 2);
// Speech length measured from the audio (the model's own estimate was off by 2x): first to last
// 0.1s window louder than -35 dBFS. Assumes 24 kHz mono 16-bit, as Gemini TTS returns.
function speechSeconds(wav: Buffer): number {
  const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, Math.floor((wav.length - 44) / 2));
  const step = 2400, loud: number[] = [];
  for (let i = 0; i < pcm.length; i += step) {
    let sum = 0;
    const end = Math.min(pcm.length, i + step);
    for (let k = i; k < end; k++) sum += pcm[k] * pcm[k];
    if (20 * Math.log10(Math.sqrt(sum / Math.max(1, end - i)) / 32768 + 1e-9) > -35) loud.push(i / 24000);
  }
  return loud.length ? loud[loud.length - 1] + 0.1 - loud[0] : 0;
}

(async () => {
  const dir = join(homedir(), "Desktop", "torvik", SOFT ? "spec-voice-soft" : "spec-voice");
  mkdirSync(dir, { recursive: true });
  for (const [n, line] of LINES.entries()) {
    let best: { wav: Buffer; measured: number } | null = null;
    for (let i = 1; i <= 6; i++) {
      try {
        const wav = await synthesizeVoiceover(line.text, "en", "male", "bold", SOFT ? SOFT_READ : WHISPER_READ_HEADINGS, { voice: "Algenib", persona: SOFT ? "a man in his forties with a deep voice, speaking low, softly and crisply close to the microphone" : WHISPER_PERSONA, accent: GERMAN });
        const r = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: 'Reply as JSON {"transcript": string, "whispered": boolean}. whispered is true only if the whole clip is a whisper with no normal voiced speech.' }] }],
          config: { responseMimeType: "application/json" },
        });
        const j = JSON.parse(r.text ?? "{}");
        const said = String(j.transcript ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
        const norm = said.replace(/six eighty|six hundred (and )?eighty/g, "680").replace(/one seventy eight|one hundred (and )?seventy eight/g, "178").replace(/\s+/g, " ");
        const words = line.words.every((w) => norm.includes(w) || (w === "abs" && norm.includes("a b s"))) && norm.split(" ").filter(Boolean).length <= line.words.length + 3;
        const measured = speechSeconds(wav);
        const ok = (SOFT || j.whispered === true) && words;
        console.log(n + 1, i, ok ? "ok" : "skip", `${measured.toFixed(2)}s speech`, JSON.stringify(j.transcript));
        if (ok && (!best || measured < best.measured)) best = { wav, measured };
      } catch (err) { console.log(n + 1, i, "error", err instanceof Error ? err.message.slice(0, 160) : err); }
    }
    const kept = Boolean(best);
    if (best) { writeFileSync(join(dir, `${n + 1}.wav`), best.wav); console.log(n + 1, "KEEP fastest", best.measured.toFixed(2) + "s"); }
    if (!kept) console.log(n + 1, "NO TAKE PASSED");
  }
  process.exit(0);
})();
