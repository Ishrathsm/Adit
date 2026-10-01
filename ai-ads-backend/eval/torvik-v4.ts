// Torvik R7 v4: the approved v3 strategy and features in 6 longer shots (the user's call: longer
// shots tell the story better; 4s, 6s and 8s Veo clips), as a new storyboard. Keyframes only —
// run the worker with KEYFRAMES_ONLY=1. `npx tsx eval/torvik-v4.ts`
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { clipSecondsFor, fitShotCuts, footageSeconds } from "../src/lib/creative-brief";
import { createProject } from "../src/lib/projects";
import { enqueueShotChoices } from "../src/lib/queue";
import { uploadPoster } from "../src/lib/storage";
import { createAssets, createShots, createStoryboard } from "../src/lib/storyboards";
import { supabase } from "../src/lib/supabase";
import { composeShot, type ShotSpec } from "../src/lib/text-gen";
import { BIKE } from "./torvik-bike";

const V1 = "ace12486-d78b-4e3a-a3df-b7247a47ee7a";
const v3 = JSON.parse(readFileSync(join(__dirname, "out", "torvik-script-v3-final.json"), "utf8"));
const s3: ShotSpec[] = v3.script.shots.map((s: { spec: ShotSpec }) => s.spec);
const SUN = "Low, warm golden-hour sunlight from camera-right, the film's one light direction; muted, filmic contrast.";

const specs: ShotSpec[] = [
  { ...s3[0], seconds: 3 },
  { ...s3[1], seconds: 3 },
  { ...s3[2], seconds: 3 },
  {
    ...s3[3],
    purpose: "BUILD: the escape begins — the bike leaves the dark garage for the golden morning.",
    framing: "Medium-wide, side-on at hip height from inside the garage, the open door filling the right half of frame with the empty street and golden light beyond.",
    lens: "35mm, deep focus.",
    movement: "Locked-off tripod. The camera does not move.",
    action: "The rider, already seated in full black gear and a full-face matte-black helmet with a dark visor, rolls the Torvik R7 slowly and steadily forward in one straight line, out through the open garage door and into the golden light of the empty street, until it is just past the threshold.",
    performance: "Calm and composed, body still on the bike, feet on the pegs; the face is never visible.",
    lighting: "Dark garage interior; low golden sunlight from camera-right floods in through the door and lights the side of the bike more fully as it rolls into it.",
    sfx: "The engine's deep idle echoing in the garage, the soft crunch of tyres over the concrete threshold.",
    seconds: 5,
  },
  {
    ...s3[10],
    purpose: "TURN / 178kg Kerb Weight: the bike on the open ghat road, leaning easily through one long gentle arc — light, agile, its power easy to command.",
    framing: "Medium-wide side profile, the bike and rider held mid-frame in the left two-thirds; the Western Ghats valley in soft focus behind; calm sky in the upper third for the callout.",
    lens: "50mm, the bike sharp, the background softened by speed.",
    movement: "Tracking from a camera car driving alongside at exactly the bike's speed; the bike stays fixed in the same place in the frame and only the road and hills stream past. No other camera move.",
    action: "The Torvik R7 rides at a constant, steady speed along the empty ghat road and follows one long, gentle arc, leaning smoothly and moderately into it and holding the lean. No acceleration, no braking, no change of direction other than the one arc.",
    performance: "The rider still and relaxed, a small, calm input on the bars; the face is never visible.",
    lighting: SUN,
    sfx: "A steady, powerful parallel-twin note with tyre hum and wind.",
    seconds: 6.5,
  },
  { ...s3[11], seconds: 5, movement: "Locked-off tripod. The camera does not move." },
];

(async () => {
  const footage = footageSeconds(v3.brief);
  const shotCuts = fitShotCuts(specs.map((s) => s.seconds), footage);
  const shots = specs.map((spec) => ({ description: composeShot(spec), spec, assetNames: ["Torvik R7"] }));
  console.log({ footage, shotCuts, clips: shotCuts.map(clipSecondsFor) });

  const { data: v1 } = await supabase.from("storyboards").select("project_id, creative_brief").eq("id", V1).single();
  const { data: p1 } = await supabase.from("projects").select("user_id, product_id").eq("id", v1!.project_id).single();
  const old = v1!.creative_brief;
  const refUrl = await uploadPoster(`torvik-r7-badge-ref-${Date.now()}`, readFileSync(join(homedir(), "Desktop", "torvik", "bike-ref-badge-2.png")));
  const project = await createProject(p1!.user_id, "Torvik R7 — launch film v4", "video", p1!.product_id);
  const storyboard = await createStoryboard(project.id, v3.concept, shots.length, 6, {
    aspectRatio: "16:9",
    referenceImageUrl: null,
    referenceImageRole: null,
    lookSheet: v3.script.lookSheet,
    creativeBrief: {
      ...v3.brief,
      // The approved v1 sound: the score bed and the German whisper over the end card.
      audio: { musicPrompt: v3.script.musicPrompt, voiceoverScript: null, voiceoverDirection: old.audio?.voiceoverDirection ?? null, voiceoverLines: shots.map(() => null), musicUrl: old.audio?.musicUrl ?? null },
      voiceCast: old.voiceCast ?? null,
      voiceTakes: (old.voiceTakes ?? []).map((t: { url: string; offset?: number }) => ({ ...t, shot: shots.length })),
      voiceBassDb: old.voiceBassDb ?? 8,
      exclusions: v3.script.look.exclusions,
      endCardTagline: "Ride with the wind",
      soundDesign: { ambience: v3.script.soundAmbience, cues: specs.map((s) => s.sfx) },
      shotCuts,
    },
    status: "drafting",
  });
  const rows = await createShots(storyboard.id, shots.map((s) => ({ description: s.description, assetNames: s.assetNames, screenUrl: null })));
  await createAssets(storyboard.id, [{ kind: "product", name: "Torvik R7", description: BIKE, imageUrl: refUrl, source: "uploaded" }]);
  await enqueueShotChoices(rows[0].id);
  writeFileSync(join(__dirname, "out", "torvik-v4.json"), JSON.stringify({ storyboardId: storyboard.id, projectId: project.id, shotCuts, specs }, null, 2));
  console.log(JSON.stringify({ storyboardId: storyboard.id, projectId: project.id }));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
