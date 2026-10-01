// Shot-by-shot study of reference ads: Gemini watches each shot clip (picture + sound) and fills a
// fixed checklist, so the patterns can be counted rather than guessed.
// Usage: npx tsx eval/ref-shots.ts <refsDir> <key>... (reads <refsDir>/<key>/clips/shotNN.mp4, writes <key>/shots.json)
import "../src/lib/gcp-credentials-bootstrap";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../src/lib/env";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const S = { type: Type.STRING };
const B = { type: Type.BOOLEAN };
const E = (values: string[]) => ({ type: Type.STRING, enum: values });
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    content: S,
    shot_size: E(["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"]),
    angle: E(["ground", "low", "eye", "high", "overhead"]),
    subject: E(["bike_detail", "bike_whole", "bike_and_rider", "rider_only", "person_face", "environment", "text_graphic", "other"]),
    template: E(["static_frame", "camera_move_on_static_subject", "coupled_tracking", "locked_camera_passby", "pan_follow", "pov", "drone", "handheld", "graphic", "other"]),
    camera_motion: S,
    camera_speed: E(["none", "slow", "medium", "fast"]),
    bike_motion: E(["none", "static", "straight", "single_arc", "complex"]),
    bike_fixed_in_frame: B,
    background_motion: E(["none", "slow", "streaking"]),
    location_changes_within_shot: B,
    lens: E(["wide", "normal", "tele", "macro"]),
    depth_of_field: E(["deep", "shallow"]),
    lighting: S,
    time_of_day: E(["day", "golden_hour", "blue_hour", "night", "interior", "studio", "unclear"]),
    speed_effect: E(["none", "slow_motion", "speed_ramp", "fast_forward"]),
    text_on_screen: { type: Type.STRING, nullable: true },
    sound: S,
    hit_on_cut: B,
    ai_difficulty: { type: Type.INTEGER },
    ai_difficulty_reason: S,
  },
  required: ["content", "shot_size", "angle", "subject", "template", "camera_motion", "camera_speed", "bike_motion", "bike_fixed_in_frame", "background_motion", "location_changes_within_shot", "lens", "depth_of_field", "lighting", "time_of_day", "speed_effect", "sound", "hit_on_cut", "ai_difficulty", "ai_difficulty_reason"],
};
const PROMPT = `This is ONE shot from a motorcycle commercial. Watch it with sound and fill the checklist precisely.
- template: static_frame (nothing moves but small details), camera_move_on_static_subject (slow push/pan/orbit on a parked bike or detail), coupled_tracking (camera moves with the moving bike at matching speed), locked_camera_passby (camera fixed or barely panning while the bike moves through), pan_follow (camera pans to follow a passing bike), pov (rider's view), drone, handheld, graphic.
- bike_fixed_in_frame: true if the moving bike stays at about the same place in the frame.
- camera_motion: direction and type in a few words, e.g. "tracks alongside right-to-left at bike speed".
- sound: what is heard on this shot (music, engine, whoosh, click, voice...).
- hit_on_cut: true if a distinct sound hit/beat lands at the start of the shot.
- ai_difficulty 1-5: how hard this shot would be for an AI video model to render believably from a first frame, and why.`;

async function analyse(file: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: readFileSync(file).toString("base64") } }, { text: PROMPT }] }],
        config: { responseMimeType: "application/json", responseSchema: SCHEMA },
      });
      return JSON.parse(r.text ?? "{}");
    } catch (err) {
      if (attempt === 3) return { error: err instanceof Error ? err.message.slice(0, 200) : String(err) };
      await new Promise((res) => setTimeout(res, 5000 * attempt));
    }
  }
}

(async () => {
  const [dir, ...keys] = process.argv.slice(2);
  for (const key of keys) {
    const clips = readdirSync(join(dir, key, "clips")).filter((f) => f.endsWith(".mp4")).sort();
    const timing = readFileSync(join(dir, key, "shots.txt"), "utf8").trim().split("\n").map((l) => l.split("\t").map(Number));
    const results: unknown[] = new Array(clips.length);
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < clips.length) {
        const i = next++;
        results[i] = { shot: i + 1, start: timing[i][1], length: timing[i][2], ...(await analyse(join(dir, key, "clips", clips[i]))) };
      }
    }));
    writeFileSync(join(dir, key, "shots.json"), JSON.stringify(results, null, 1));
    console.log(key, "done", results.filter((r) => (r as { error?: string }).error).length, "errors");
  }
  process.exit(0);
})();
