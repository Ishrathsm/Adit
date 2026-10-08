import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

// The npm-bundled ffmpeg (Railway has no system ffmpeg), falling back to PATH. Resolves with stdout and
// stderr, since loudness and volume measurements report on stderr.
export const FFMPEG = ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg";

export function ffmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args);
    let stdout = "", stderr = "";
    proc.stdout.on("data", (c) => { stdout += c; });
    proc.stderr.on("data", (c) => { stderr += c; });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`))));
  });
}
