// Puts the approved Torvik R7 sound and shot changes on the storyboard before the render: final
// shot lengths, the approved score bed and German whisper take (with its offset, so the logo and
// the hit land in the pause after "Torvik"), Veo's own sound on, and the reworked shots 2 and 3
// (their keyframes are reset for regeneration).
// Usage: npx tsx eval/torvik-production.ts <scoreBed.wav> <whisper.wav>
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync } from "node:fs";
import { fitShotCuts } from "../src/lib/creative-brief";
import { supabase } from "../src/lib/supabase";

const ID = "ace12486-d78b-4e3a-a3df-b7247a47ee7a";
const SHOT_2 =
  "Extreme close-up on the round headlight, filling the frame. 85mm. Locked-off tripod. At first the headlight is OFF: the lens is dark and unlit, the copper bezel only catching a faint cool sliver of garage light. Then the circular LED ring snaps on in one instant, its bright white light flaring across the copper bezel. Light: before it turns on, only the faint garage practical; once on, the LED is the key light, with sharp, clean highlights on the copper against the surrounding dark.";
const SHOT_3 =
  "Medium shot from a low angle, side-on to the bike. 35mm. Locked-off tripod. The rider, in full black gear and a full-face matte-black helmet with a dark visor, is already seated on the Torvik R7, gloved hands on the grips, feet on the pegs. The bike rolls slowly forward toward the half-open roller door, the rider's body still and composed. In the background, the garage's roller door is halfway up, revealing the deep blue pre-dawn street outside. Performance: calm, deliberate, no hesitation; the face is never visible. Light: cool overhead key light from the garage practical, with deep blue ambient light filling from the open door.";

async function upload(path: string, file: string, type: string) {
  const up = await supabase.storage.from("generated-media").upload(path, readFileSync(file), { contentType: type, upsert: true });
  if (up.error) throw up.error;
  return supabase.storage.from("generated-media").getPublicUrl(path).data.publicUrl;
}

(async () => {
  const [scoreFile, whisperFile] = process.argv.slice(2);
  const stamp = Date.now();
  const musicUrl = await upload(`torvik-score-bed-${stamp}.wav`, scoreFile, "audio/wav");
  const whisperUrl = await upload(`torvik-endcard-german-${stamp}.wav`, whisperFile, "audio/wav");
  const { data } = await supabase.from("storyboards").select("creative_brief, shot_count").eq("id", ID).single();
  const b = data!.creative_brief;
  const brief = {
    ...b,
    shotCuts: fitShotCuts([2, 1.5, 3, 4, 2.5, 4, 5.5, 4], 25.4),
    veoAudio: true,
    voiceBassDb: 8,
    // "Torvik" starts 1.05s before the end card, so the logo and the hit land in the pause.
    voiceTakes: [{ shot: data!.shot_count, url: whisperUrl, offset: -1.05 }],
    audio: { ...b.audio, musicUrl },
  };
  const { error } = await supabase.from("storyboards").update({ creative_brief: brief }).eq("id", ID);
  if (error) throw error;
  for (const [index, description] of [[1, SHOT_2], [2, SHOT_3]] as const) {
    const { error: e } = await supabase.from("storyboard_shots").update({ description, choice_urls: null, selected_choice: null, status: "pending" }).eq("storyboard_id", ID).eq("shot_index", index);
    if (e) throw e;
  }
  console.log(JSON.stringify({ shotCuts: brief.shotCuts, musicUrl, whisperUrl }));
  process.exit(0);
})();
