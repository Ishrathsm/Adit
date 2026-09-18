import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Concatenates same-codec Veo clips (all generated with the same model/aspect ratio) into one
// final video, in the given order. Uses ffmpeg's concat demuxer with stream copy — fast, no
// re-encoding, since all clips share the same codec/resolution.
export async function stitchVideos(clipBuffers: Buffer[]): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "ai-ads-stitch-"));
  const outputPath = join(dir, "output.mp4");
  const listPath = join(dir, "list.txt");

  try {
    const clipPaths = await Promise.all(
      clipBuffers.map(async (buffer, index) => {
        const path = join(dir, `clip-${index}.mp4`);
        await writeFile(path, buffer);
        return path;
      }),
    );

    await writeFile(listPath, clipPaths.map((path) => `file '${path}'`).join("\n"));

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => { stderr += chunk; });
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      });
    });

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
