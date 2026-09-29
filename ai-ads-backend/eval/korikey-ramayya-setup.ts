// Puts "Ramayya's Korikey" into production as a real storyboard, using what was already reviewed:
// the approved keyframes (one per shot, uploaded as each shot's chosen frame), the approved,
// transcript-checked voice takes, the real pack in the last shot, and a Carnatic temp score.
// Usage: npx tsx eval/korikey-ramayya-setup.ts <userId> <productId> <keyframesDir> <voicesDir> <pack.png>
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { planShots } from "../src/lib/creative-brief";
import { createProject } from "../src/lib/projects";
import { enqueueShotVideo } from "../src/lib/queue";
import { uploadPoster } from "../src/lib/storage";
import { createShots, createStoryboard, updateShot } from "../src/lib/storyboards";
import { supabase } from "../src/lib/supabase";
import { composeLookSheet, composeShot } from "../src/lib/text-gen";

const [userId, productId, kfDir, voDir, packFile] = process.argv.slice(2);
const MUSIC =
  "Carnatic classical instrumental for a 50-second Telugu folk-tale film. Opens bright and auspicious in raga Hamsadhwani on veena with mridangam in Adi talam; turns dark and heavy with deep thavil strokes and low violin tremolo; becomes playful and bouncy with morsing twangs and kanjira; then a tender solo venu (bamboo flute) over a tambura drone; near-silence with single mridangam strokes; then a joyous fast finale with nadaswaram, thavil and rapid mridangam, ending on a crisp three-times-repeated rhythmic cadence (tihai). No vocals.";

(async () => {
  const d = JSON.parse(readFileSync(join(__dirname, "out", "korikey-ramayya-final.json"), "utf8"));
  const s = d.script;
  const plan = planShots(d.brief);
  const stamp = Date.now();
  const { error } = await supabase.from("products").update({ brand_rules: d.brand.brandRules }).eq("id", productId);
  if (error) throw error;

  const packUrl = await uploadPoster(`korikey-pack-${stamp}`, readFileSync(packFile));
  const voiceTakes = [];
  for (let i = 0; i < s.shots.length; i++) {
    const f = join(voDir, `shot-${i + 1}.wav`);
    if (!existsSync(f)) continue;
    const path = `korikey-vo-${stamp}-${i + 1}.wav`;
    const up = await supabase.storage.from("generated-media").upload(path, readFileSync(f), { contentType: "audio/wav", upsert: true });
    if (up.error) throw up.error;
    voiceTakes.push({ shot: i, url: supabase.storage.from("generated-media").getPublicUrl(path).data.publicUrl });
  }

  const project = await createProject(userId, "KoriKey — Ramayya's Korikey", "video", productId);
  const storyboard = await createStoryboard(project.id, d.story, plan.shotCount, plan.clipSeconds, {
    aspectRatio: "16:9",
    lookSheet: composeLookSheet(s.look, s.continuity),
    creativeBrief: {
      ...d.brief,
      audio: { musicPrompt: MUSIC, voiceoverScript: null, voiceoverDirection: s.voiceoverDirection, voiceoverLines: s.shots.map((x: { spec: { voLine: string | null } }) => x.spec.voLine) },
      exclusions: s.look.exclusions,
      endCardTagline: s.endCardTagline,
      soundDesign: { ambience: s.soundAmbience, cues: s.shots.map((x: { spec: { sfx: string | null } }) => x.spec.sfx) },
      transitions: s.shots.map((x: { spec: { transition?: string | null } }) => x.spec.transition ?? null),
      voiceCast: d.voiceCast,
      voiceTakes,
      pack: { url: packUrl, inserts: [{ shot: 7, motion: "hold", x: 0.72, ground: 0.9, height: 0.7 }] },
    },
    status: "drafting",
  });
  const rows = await createShots(storyboard.id, s.shots.map((x: { spec: never }) => ({ description: composeShot(x.spec), assetNames: [], screenUrl: null })));
  for (const row of rows) {
    const url = await uploadPoster(`${row.id}-choice-0`, readFileSync(join(kfDir, `shot-${row.shot_index + 1}.png`)));
    await updateShot(row.id, { choice_urls: [url], selected_choice: 0, status: "choices_ready" });
  }
  for (const row of rows) await enqueueShotVideo(row.id);
  console.log(JSON.stringify({ projectId: project.id, storyboardId: storyboard.id, shots: rows.map((r) => r.id), voiceTakes: voiceTakes.length }));
  process.exit(0);
})();
