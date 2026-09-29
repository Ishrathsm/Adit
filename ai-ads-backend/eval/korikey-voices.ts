// Voice auditions and a timed voice track for "Ramayya's Korikey". Every take goes through the
// same transcript check as the pipeline. Usage: npx tsx eval/korikey-voices.ts <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { synthesizeCastLines } from "../src/lib/voiceover";

const out = process.argv[2];
const d = JSON.parse(readFileSync(join(__dirname, "out", "korikey-ramayya-final.json"), "utf8"));
const lines: (string | null)[] = d.script.shots.map((s: { spec: { voLine: string | null } }) => s.spec.voLine);
const cast = d.voiceCast as Record<string, { voice: string; persona: string }>;
const AUDITIONS: Record<string, { line: string; voices: string[] }> = {
  NARRATOR: { line: lines[0]!, voices: ["Gacrux", "Sulafat", "Vindemiatrix"] },
  DRAGON: { line: lines[1]!, voices: ["Algenib", "Charon", "Orus"] },
  RAMAYYA: { line: lines[5]!, voices: ["Achird", "Enceladus"] },
};

(async () => {
  mkdirSync(join(out, "auditions"), { recursive: true });
  for (const [role, a] of Object.entries(AUDITIONS)) {
    for (const voice of a.voices) {
      const trial = { ...cast, [role]: { ...cast[role], voice } };
      // The Ramayya audition keeps the dragon's question in front, as in the film.
      const [clip] = await synthesizeCastLines([a.line], "te", trial, "warm", role === "NARRATOR" ? d.script.voiceoverDirection : null);
      const name = `${role.toLowerCase()}-${voice}.wav`;
      writeFileSync(join(out, "auditions", name), clip.audio);
      console.log("audition", name, ((clip.audio.length - 44) / 48000).toFixed(1) + "s");
    }
  }
  const track = await synthesizeCastLines(lines, "te", cast, "warm", d.script.voiceoverDirection);
  for (const t of track) {
    writeFileSync(join(out, `shot-${t.shot + 1}.wav`), t.audio);
    console.log(`shot ${t.shot + 1}: ${((t.audio.length - 44) / 48000).toFixed(1)}s (shot is ${d.plan.cutSeconds}s)`);
  }
})();
