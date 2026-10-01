// All four spec headings whispered in one read (short lines alone lose the whisper), then split at
// the three longest pauses. → ~/Desktop/torvik/spec-voice/all-N.wav
import "../src/lib/gcp-credentials-bootstrap";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";
import { synthesizeVoiceover } from "../src/lib/voiceover";
import { WHISPER_PERSONA } from "./torvik-bike";

const FFMPEG = join(__dirname, "..", "node_modules", "ffmpeg-static", "ffmpeg");
const GERMAN = "German-accented English (a man from Munich)";
const READ =
  "A breathy stage whisper with no voiced tone, close to the microphone, at an easy, even pace of about 95 words per minute, with a clear one-second pause between the four phrases. Say only these words, nothing else. Low and intimate; never a normal speaking voice, never an announcer";
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const dir = join(homedir(), "Desktop", "torvik", "spec-voice");

async function check(wav: Buffer) {
  const r = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: 'Reply as JSON {"transcript": string, "whispered": boolean}. whispered is true only if the whole clip is a whisper with no normal voiced speech.' }] }],
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(r.text ?? "{}") as { transcript?: string; whispered?: boolean };
}

(async () => {
  for (let i = 1; i <= 8; i++) {
    const wav = await synthesizeVoiceover("Full-LED headlight. Six-eighty cc parallel twin. Dual-channel ABS. One seventy-eight kilo kerb weight.", "en", "male", "bold", READ, { voice: "Algenib", persona: WHISPER_PERSONA, accent: GERMAN });
    const j = await check(wav);
    const said = String(j.transcript ?? "").toLowerCase();
    console.log(i, JSON.stringify(j));
    if (!(j.whispered && /headlight.*twin.*abs.*weight/.test(said))) continue;
    const path = join(dir, "all.wav");
    writeFileSync(path, wav);
    const out = execFileSync("bash", ["-c", `"${FFMPEG}" -i "${path}" -af silencedetect=noise=-40dB:d=0.3 -f null - 2>&1 || true`], { encoding: "utf8" });
    const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...out.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
    // Pauses between phrases: those that start after speech began and end before it stops.
    const gaps = starts.map((st, k) => ({ st, en: ends[k] ?? Infinity })).filter((g) => g.st > 0.2 && Number.isFinite(g.en));
    const cuts = gaps.sort((x, y) => (y.en - y.st) - (x.en - x.st)).slice(0, 3).map((g) => (g.st + g.en) / 2).sort((x, y) => x - y);
    if (cuts.length < 3) { console.log("pauses found:", cuts.length); continue; }
    const bounds = [0, ...cuts, 99];
    const parts: string[] = [];
    for (let k = 0; k < 4; k++) {
      const f = join(dir, `all-${k + 1}.wav`);
      execFileSync(FFMPEG, ["-y", "-v", "error", "-ss", bounds[k].toFixed(3), "-i", path, ...(bounds[k + 1] < 99 ? ["-t", (bounds[k + 1] - bounds[k]).toFixed(3)] : []), f]);
      parts.push(String((await check(readFileSync(f))).transcript ?? ""));
    }
    console.log("cuts", cuts.map((c) => c.toFixed(2)).join(","), JSON.stringify(parts));
    const want = [/headlight/i, /twin/i, /abs|a\.?b\.?s/i, /weight/i];
    if (parts.every((p, k) => want[k].test(p))) { console.log("KEEP"); process.exit(0); }
  }
  console.log("NO TAKE PASSED");
  process.exit(0);
})();
