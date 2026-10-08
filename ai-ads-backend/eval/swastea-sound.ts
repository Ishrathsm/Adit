// The sound team's first job: Swastea's soundtrack plan, then the music director listens to the
// two Raag Malhar takes. `npx tsx eval/swastea-sound.ts` → eval/out/swastea-sound.json
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { planSound, reviewMusicTake, type SoundScene } from "../src/lib/sound-team";

const SCENES: SoundScene[] = [
  { shot: 1, seconds: "0–4s", action: "In the apartment corridor, the bachelor with a cold knocks on the neighbours' door holding an empty steel katori; Aunty opens; he sneezes into his elbow.", line: "Aunty, thodi adrak milegi?", speaker: "Bachelor" },
  { shot: 2, seconds: "4–7s", action: "Aunty, with quiet motherly concern, steps aside to let him in.", line: "Lagta hai zukaam hai. Andar aao, beta.", speaker: "Aunty" },
  { shot: 3, seconds: "7–11s", action: "In her bright kitchen, Aunty spoons Swastea into chai boiling on the gas stove; the pack on the counter; Uncle nods from the dining table.", line: null, speaker: null },
  { shot: 4, seconds: "11–16s", action: "On the sofa the bachelor sips; his shoulders drop, he takes a long easy breath; a golden mandala of light fades in behind his head on 'Aah'.", line: "Aah… kitna aaram mila.", speaker: "Bachelor" },
  { shot: 5, seconds: "16–20s", action: "He looks up at Aunty, sincere and a little homesick.", line: "Aunty… bilkul maa ke haath jaisi.", speaker: "Bachelor" },
  { shot: 6, seconds: "20–25s", action: "Aunty smiles and holds up the Swastea pack; Uncle smiles beside her.", line: "Adrak, ashwagandha aur tulsi se bana shuddh — Swastea.", speaker: "Aunty" },
  { shot: 7, seconds: "25–30s", action: "End card: the pack on the kitchen counter with a steaming cup, ginger and tulsi; logo and tagline.", line: "Swastea. Roj piyo, swasth raho.", speaker: "Aunty (voice)" },
];
const CONCEPT = "30-second TV ad for Swastea, a herbal tea powder of ginger, ashwagandha and tulsi: a bachelor with a cold borrows adrak from the elderly couple next door, and Aunty gives him Swastea chai — care, comfort and a taste of home. Sincere and warm, no humour.";
const DIRECTION = "Faint background music in the mood of Raag Malhar (the monsoon raga of rain and relief), kept low under the dialogue. On shot 4, as he sips with his eyes closed, a woman sings one short 2–3s 'dhi-re-na dhi-re-na' tarana hook (~/Desktop/swastea/jingle-cuts/cut-3.wav, entering ~11.2s); the bed dips under it and comes straight back. No long aalap (user: 'worst'). Everyone speaks at a brisk, natural everyday pace — quick and conversational, never slow, drawn out or theatrical (user, 2026-10-08). The people speak their own lines on camera in Hinglish (Veo's native audio, with lip sync); Aunty's voice also reads the end-card line. No humour. The brand name 'Swastea' is said as 'Swas-tea' (swas as in swasth, then tea).";

(async () => {
  const plan = await planSound(CONCEPT, SCENES, DIRECTION);
  writeFileSync(join(__dirname, "out", "swastea-sound.json"), JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ music: plan.music, voices: plan.voices, mix: plan.mix, checkWords: plan.checkWords, review: plan.review }, null, 2));
  plan.lines.forEach((l) => console.log(`LINE ${l.shot} ${l.speaker}: "${l.line}" — ${l.delivery} | risks: ${l.risks.join("; ")}`));
  plan.sfx.forEach((s) => console.log(`SFX ${s.shot}: ${s.cues.join(", ")}`));
  for (const i of [1, 2]) {
    const r = await reviewMusicTake(readFileSync(join(homedir(), "Desktop", "swastea", `malhar-${i}.wav`)), plan);
    console.log(`\nMALHAR ${i}:\n${r.notes}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
