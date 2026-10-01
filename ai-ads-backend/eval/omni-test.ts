// One shot through Gemini Omni Flash for a side-by-side with Veo: same keyframe, same refined
// motion prompt, same style line and negatives as the pipeline's Veo call.
// Usage: npx tsx eval/omni-test.ts <shotId> <out.mp4> [modelId]
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { directionText, FOLK_VIDEO_STYLE, VIDEO_ARTIFACT_NEGATIVES } from "../src/lib/creative-brief";
import { env } from "../src/lib/env";
import { getProjectById } from "../src/lib/projects";
import { getProductById, toBrandContext } from "../src/lib/products";
import { refineShotVideoPrompt, splitNegativePrompt } from "../src/lib/prompt-refiner";
import { getShot, getStoryboardById } from "../src/lib/storyboards";

const [shotId, out, model = "gemini-omni-flash"] = process.argv.slice(2);
(async () => {
  const shot = (await getShot(shotId))!;
  const sb = (await getStoryboardById(shot.storyboard_id))!;
  const project = await getProjectById(sb.project_id);
  const brand = toBrandContext(project?.product_id ? await getProductById(project.product_id) : null);
  const img = Buffer.from(await (await fetch(shot.choice_urls![shot.selected_choice!])).arrayBuffer()).toString("base64");
  const refined = await refineShotVideoPrompt(shot.description, sb.concept, shot.shot_index, sb.shot_count, sb.shot_duration_seconds, sb.aspect_ratio, brand, sb.look_sheet, directionText(sb.creative_brief), { imageBytes: img, mimeType: "image/png" }, true);
  const { prompt, negativePrompt } = splitNegativePrompt(refined);
  const avoid = [negativePrompt, sb.creative_brief?.avoid, sb.creative_brief?.exclusions, VIDEO_ARTIFACT_NEGATIVES, "3D rendering, CGI, shading, photorealism, blur, camera movement, uneven outlines, text, lettering, standing on hind legs, raised arms"].filter(Boolean).join(", ");
  const text = `Animate this image as one continuous ${sb.shot_duration_seconds}-second silent shot.\n\n${prompt}\n\n${FOLK_VIDEO_STYLE}\n\nAvoid: ${avoid}.`;
  const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: process.env.OMNI_LOCATION ?? "us-central1" });
  const started = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interaction: any = await (ai as any).interactions.create({
    model,
    input: [{ type: "image", data: img, mime_type: "image/png" }, { type: "text", text }],
    response_format: { type: "video", aspect_ratio: "16:9", resolution: "720p" },
  });
  console.log("seconds:", Math.round((Date.now() - started) / 1000), "keys:", Object.keys(interaction ?? {}).join(","));
  const data = interaction?.output_video?.data ?? interaction?.outputs?.find?.((o: { type?: string }) => o.type === "video")?.data;
  if (!data) { console.log(JSON.stringify(interaction).slice(0, 1500)); process.exit(1); }
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log("wrote", out);
  process.exit(0);
})();
