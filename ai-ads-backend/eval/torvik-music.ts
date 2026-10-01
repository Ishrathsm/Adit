// Torvik score options: one Lyria sample per direction, for choosing by ear.
// Usage: npx tsx eval/torvik-music.ts <outDir> [name...]
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateMusic } from "../src/lib/music";

export const MUSIC_OPTIONS: Record<string, string> = {
  "dark-cinematic":
    "Dark cinematic instrumental trailer score, 30 seconds, about 70 BPM. Opens in near-silence with a deep sub-bass drone and a slow low heartbeat pulse in a dark garage. Low cellos and contrabass enter as a motorcycle rolls through a sleeping city. The pulse tightens with deep taiko-style hits and rising low strings on the mountain road, building steadily to one huge low impact on a fast corner. Then the strings open into a wide, warm resolving chord over a sunrise and hold, leaving space for a whispered voice at the end. Moody, controlled, premium; no vocals, no choir, no synth leads.",
  "ambient-groove":
    "Ambient instrumental with a riding groove, 30 seconds, about 92 BPM. Opens with airy analog pads and a soft ticking pulse in a quiet pre-dawn garage. A warm round bassline and a steady, laid-back kick-and-snare groove come in as the motorcycle rolls out onto empty streets. The groove carries on cruising through mountain bends, with shimmering guitar delays and a gentle lift, never frantic. It settles onto a calm sustained pad chord over the sunrise hero shot and fades softly, leaving space for a whispered voice at the end. Calm, confident, open-road feeling; no vocals.",
  // The client's own music brief, verbatim.
  "client-brief":
    "Create a premium cinematic instrumental score for a high-end motorcycle brand commercial. Begin with a deep, restrained atmospheric drone and subtle mechanical textures, building into a steady, pulsing low-end rhythm. Layer powerful cinematic percussion, tight metallic impacts, dark synth bass, and a blend of gritty electric guitar and orchestral strings. Gradually increase intensity as the motorcycle accelerates through sweeping roads, with rhythmic accents synchronized to gear shifts, wheel movement, and dramatic camera cuts. Reach a bold, exhilarating climax with massive but controlled percussion and a soaring musical motif, then end with a clean, deep impact and a short atmospheric tail for the brand reveal. Mood: fearless, engineered, sophisticated, adventurous, confident. Tempo: 100–115 BPM. Instrumental only. No vocals, no lyrics, no cheesy EDM drops, no excessive risers, no random booms, no overused trailer braams, no cluttered percussion. Premium cinematic commercial mix, deep bass, crisp transients, wide stereo image.",
  // The client brief, rewritten against the shot timings so each musical moment lands on its shot.
  "scene-timed":
    "Premium cinematic instrumental score for a high-end motorcycle commercial, 30 seconds, 108 BPM, scored to picture. 0-2s: a deep, restrained atmospheric drone with subtle mechanical textures over a macro of a fuel tank in a dark garage. 2s: one tight metallic impact as a headlight snaps on. 3-6s: the drone thickens as the engine starts; a steady, pulsing low-end rhythm begins. 6-10s: dark synth bass and tight cinematic percussion carry the bike through a sleeping city. 10-12s: gritty electric guitar enters over the pulse on a close-up of the engine at speed. 12-15s: orchestral strings join and intensity climbs as the bike accelerates onto a mountain road, rhythmic accents on each gear shift. 15-20s: the climax, massive but controlled percussion and a soaring motif as the bike sweeps through a fast corner. 20-25s: the music resolves and opens up over a sunrise hero shot of the parked bike, ending on one clean, deep impact at 25s. 25-30s: a short atmospheric tail, very quiet, leaving space for a whispered voice. Mood: fearless, engineered, sophisticated, adventurous, confident. Instrumental only; no vocals, no EDM drops, no excessive risers, no random booms, no trailer braams, no cluttered percussion. Premium commercial mix, deep bass, crisp transients, wide stereo image.",
  // Lyria holds one mood per clip, so the climax is its own piece, cut in on the corner.
  climax:
    "High-energy cinematic motorcycle chase climax, 110 BPM, full intensity from the first second: massive but controlled cinematic drums and tight metallic hits, driving dark synth bass, gritty distorted electric guitar riff, and soaring orchestral strings playing a bold heroic motif. Fearless, engineered, exhilarating. Instrumental only; no vocals, no EDM drop, no braams. Premium commercial mix, deep bass, crisp transients, wide stereo.",
  // Rebuild after "not energetic": drives from the first second, and a bigger peak for the corner.
  intro:
    "Energetic, driving cinematic rock intro for a motorcycle commercial, 116 BPM, punchy from the very first second: tight pulsing distorted synth bass, a ticking hi-hat and snare building fast, taut staccato strings, a gritty electric guitar riff. Tense, charged, full of forward momentum, like an engine about to fire. Instrumental only; no vocals, no EDM drop, no braams. Deep bass, crisp transients, wide stereo.",
  peak:
    "Peak-energy cinematic rock anthem, 116 BPM, maximum intensity: pounding big drums and toms, crashing cymbals, heavy distorted electric guitar power chords with a soaring lead melody, driving bass, and powerful orchestral strings. Fearless, exhilarating, speed and freedom. Instrumental only; no vocals, no EDM drop. Premium commercial mix, deep bass, crisp transients, wide stereo.",
};

const [outDir, ...only] = process.argv.slice(2);
(async () => {
  mkdirSync(outDir, { recursive: true });
  await Promise.all(Object.entries(MUSIC_OPTIONS).filter(([name]) => !only.length || only.includes(name)).map(async ([name, prompt]) => {
    const wav = await generateMusic(prompt);
    writeFileSync(join(outDir, `${name}.wav`), wav);
    console.log(name, wav.length);
  }));
  process.exit(0);
})();
