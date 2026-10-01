// One storyboard shot through several Veo models with the identical prompt, keyframe and negatives
// (built once, the same way the worker builds them), one take each, for a side-by-side.
// Usage: [PROMPT_FILE=<tag>-prompt.txt] npx tsx eval/veo-compare.ts <storyboardId> <shotIndex> <model> [model...]
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { directionText, FOLK_VIDEO_STYLE, STOP_MOTION_VIDEO_STYLE, VIDEO_ARTIFACT_NEGATIVES } from "../src/lib/creative-brief";
import { env } from "../src/lib/env";
import { getProductById, toBrandContext } from "../src/lib/products";
import { getProjectById } from "../src/lib/projects";
import { refineShotVideoPrompt, splitNegativePrompt } from "../src/lib/prompt-refiner";
import { supabase } from "../src/lib/supabase";

const [storyboardId, shotIndex, ...models] = process.argv.slice(2);
const genAI = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const outDir = join(__dirname, "out", "veo-compare");
mkdirSync(outDir, { recursive: true });

(async () => {
  const { data: sb, error } = await supabase.from("storyboards").select().eq("id", storyboardId).single();
  if (error) throw error;
  const { data: shot, error: shotError } = await supabase.from("storyboard_shots").select().eq("storyboard_id", storyboardId).eq("shot_index", Number(shotIndex)).single();
  if (shotError) throw shotError;
  const project = await getProjectById(sb.project_id);
  const brand = toBrandContext(project?.product_id ? await getProductById(project.product_id) : null);
  const imageBytes = Buffer.from(await (await fetch(shot.choice_urls[shot.selected_choice])).arrayBuffer()).toString("base64");
  // PROMPT_FILE reuses a saved <tag>-prompt.txt so a later model gets exactly the same text.
  const saved = process.env.PROMPT_FILE ? readFileSync(process.env.PROMPT_FILE, "utf8").split("\n\nNEGATIVE: ") : null;
  const refined = saved ? "" : await refineShotVideoPrompt(shot.description, sb.concept, shot.shot_index, sb.shot_count, sb.shot_duration_seconds, sb.aspect_ratio, brand, sb.look_sheet, directionText(sb.creative_brief), { imageBytes, mimeType: "image/png" }, true);
  const { prompt: motion, negativePrompt: refinedNegative } = splitNegativePrompt(refined);
  const look = sb.creative_brief?.look;
  const prompt = saved ? saved[0] : look === "stopmotion" ? `${motion}\n\n${STOP_MOTION_VIDEO_STYLE}` : look === "folkpuppet" ? `${motion}\n\n${FOLK_VIDEO_STYLE}` : motion;
  const negativePrompt = saved ? saved[1].trim() : [
    refinedNegative, sb.creative_brief?.avoid, sb.creative_brief?.exclusions, VIDEO_ARTIFACT_NEGATIVES,
    look === "folkpuppet" ? "3D rendering, CGI, shading, gradients, photorealism, blur, depth of field, camera movement, uneven outlines, text, lettering" : null,
  ].filter(Boolean).join(", ");
  const tag = `shot${shotIndex}`;
  if (!saved) writeFileSync(join(outDir, `${tag}-prompt.txt`), `${prompt}\n\nNEGATIVE: ${negativePrompt}\n`);
  writeFileSync(join(outDir, `${tag}-keyframe.png`), Buffer.from(imageBytes, "base64"));

  await Promise.all(models.map(async (model) => {
    const started = Date.now();
    try {
      let op = await genAI.models.generateVideos({
        model,
        source: { prompt, image: { imageBytes, mimeType: "image/png" } },
        config: { numberOfVideos: 1, aspectRatio: sb.aspect_ratio, durationSeconds: sb.shot_duration_seconds, generateAudio: false, negativePrompt },
      });
      while (!op.done) {
        await new Promise((r) => setTimeout(r, 10_000));
        op = await genAI.operations.getVideosOperation({ operation: op });
      }
      if (op.error) throw new Error(JSON.stringify(op.error));
      const bytes = op.response?.generatedVideos?.[0]?.video?.videoBytes;
      if (!bytes) throw new Error(`no video bytes: ${JSON.stringify(op.response).slice(0, 500)}`);
      const file = join(outDir, `${tag}-${model}.mp4`);
      writeFileSync(file, Buffer.from(bytes, "base64"));
      console.log(`${model}: ${Math.round((Date.now() - started) / 1000)}s -> ${file}`);
    } catch (err) {
      console.log(`${model}: FAILED after ${Math.round((Date.now() - started) / 1000)}s — ${err instanceof Error ? err.message : err}`);
    }
  }));
  process.exit(0);
})();
