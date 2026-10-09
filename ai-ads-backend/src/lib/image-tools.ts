import sharp from "sharp";
import { nearestAspectRatio, type AspectRatio } from "./aspect-ratio";
import { type GeneratedImage, generateImage } from "./image-gen";

// One-step edits of an existing picture with Gemini's image model, each a fixed instruction that
// keeps everything the user didn't ask to change. "expand" fills a new frame shape around the
// untouched original; "upscale" redraws the same picture at 2K or 4K.
export const IMAGE_TOOLS = ["upscale", "background", "expand", "restyle", "relight", "remove"] as const;
export type ImageTool = (typeof IMAGE_TOOLS)[number];

// Tools that need the user's words (what background, which style, what light, what to remove).
export const NEEDS_INSTRUCTION: Record<ImageTool, boolean> = {
  upscale: false,
  background: true,
  expand: false,
  restyle: true,
  relight: true,
  remove: true,
};

const KEEP = "Keep everything else exactly as it is: the same subject, product, label and text, shapes, colours and composition.";

function instructionFor(tool: ImageTool, words: string | null, ratio: AspectRatio): string {
  switch (tool) {
    case "upscale":
      return `Reproduce this exact image at a higher resolution: identical composition, subject, colours, lettering and every detail, only sharper and cleaner, with finer texture and no noise or artefacts. Change nothing, add nothing, remove nothing.`;
    case "background":
      return `Keep the main subject exactly as it is (its shape, colours, label, position and size). Replace only the background with: ${words}. Match the light direction and colour of the new background on the subject's edges, and give it a natural contact shadow so it sits in the scene.`;
    case "expand":
      return `Extend this image outward to fill a ${ratio} frame. The original picture stays unchanged in the middle; continue its scene, surfaces, light and background naturally beyond its edges, so the result looks like one wider photograph. Do not crop, stretch, squash or redraw the original content, and do not add new subjects.`;
    case "restyle":
      return `Redraw this image in this style: ${words}. Keep the same composition, subject, layout and framing; only the visual style changes. Keep any lettering spelled exactly as it is.`;
    case "relight":
      return `Relight this scene: ${words}. Only the lighting changes: light direction, colour temperature, shadows and highlights. ${KEEP}`;
    case "remove":
      return `Remove ${words} from the image and fill that area naturally with what would be behind it, so it looks like it was never there. ${KEEP}`;
  }
}

export interface ImageToolInput {
  tool: ImageTool;
  image: Buffer;
  // What the tool should do, in the user's words; required where NEEDS_INSTRUCTION says so.
  instruction: string | null;
  // "expand" only: the new frame shape. Other tools keep the picture's own shape.
  aspectRatio?: AspectRatio;
  // "upscale" only.
  size?: "2K" | "4K";
}

export async function runImageTool(input: ImageToolInput): Promise<GeneratedImage & { aspectRatio: AspectRatio }> {
  const { width, height } = await sharp(input.image).metadata();
  if (!width || !height) throw new Error("could not read the image");
  const ratio = input.tool === "expand" && input.aspectRatio ? input.aspectRatio : nearestAspectRatio(width, height);
  const png = await sharp(input.image).png().toBuffer();
  const result = await generateImage(
    instructionFor(input.tool, input.instruction, ratio),
    ratio,
    [{ imageBytes: png.toString("base64"), mimeType: "image/png" }],
    input.tool === "upscale" ? (input.size ?? "2K") : undefined,
  );
  return { ...result, aspectRatio: ratio };
}
