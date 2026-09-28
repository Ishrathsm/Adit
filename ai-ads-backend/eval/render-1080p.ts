import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { directionText, VIDEO_ARTIFACT_NEGATIVES } from "../src/lib/creative-brief";
import { env } from "../src/lib/env";
import { getProductById, toBrandContext } from "../src/lib/products";
import { getProjectById } from "../src/lib/projects";
import { refineShotVideoPrompt, splitNegativePrompt } from "../src/lib/prompt-refiner";
import { supabase } from "../src/lib/supabase";

// Upscale test: re-renders existing storyboard shots at native 1080p (same keyframe, same prompt
// path as the worker) to compare against 720p + upscaling. Usage:
//   npx tsx eval/render-1080p.ts <storyboardId> <shotIndex> [shotIndex...]
const [storyboardId, ...indexes] = process.argv.slice(2);
const genAI = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });

(async () => {
  const { data: storyboard, error } = await supabase.from("storyboards").select().eq("id", storyboardId).single();
  if (error) throw error;
  const project = await getProjectById(storyboard.project_id);
  const product = project?.product_id ? await getProductById(project.product_id) : null;
  const brand = product ? toBrandContext(product) : undefined;

  await Promise.all(
    indexes.map(async (i) => {
      const { data: shot, error: shotError } = await supabase.from("storyboard_shots").select().eq("storyboard_id", storyboardId).eq("shot_index", Number(i)).single();
      if (shotError) throw shotError;
      const imageBytes = Buffer.from(await (await fetch(shot.choice_urls[shot.selected_choice])).arrayBuffer()).toString("base64");
      const refined = await refineShotVideoPrompt(
        shot.description,
        storyboard.concept,
        shot.shot_index,
        storyboard.shot_count,
        storyboard.shot_duration_seconds,
        storyboard.aspect_ratio,
        brand,
        storyboard.look_sheet,
        directionText(storyboard.creative_brief),
        { imageBytes, mimeType: "image/png" },
        false,
      );
      const { prompt, negativePrompt } = splitNegativePrompt(refined);
      let operation = await genAI.models.generateVideos({
        model: env.veoModel,
        source: { prompt, image: { imageBytes, mimeType: "image/png" } },
        config: {
          numberOfVideos: 1,
          aspectRatio: storyboard.aspect_ratio,
          durationSeconds: storyboard.shot_duration_seconds,
          generateAudio: false,
          resolution: "1080p",
          negativePrompt: [negativePrompt, storyboard.creative_brief?.avoid, VIDEO_ARTIFACT_NEGATIVES].filter(Boolean).join(", "),
        },
      });
      while (!operation.done) {
        await new Promise((r) => setTimeout(r, 10_000));
        operation = await genAI.operations.getVideosOperation({ operation });
      }
      const bytes = operation.response?.generatedVideos?.[0]?.video?.videoBytes;
      if (!bytes) throw new Error(`shot ${i}: no video ${JSON.stringify(operation.error ?? {})}`);
      const file = join(outDir, `shot-${i}-native-1080p.mp4`);
      writeFileSync(file, Buffer.from(bytes, "base64"));
      console.log("wrote", file);
    }),
  );
})();
