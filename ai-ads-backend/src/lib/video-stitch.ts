import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { END_CARD_SECONDS } from "./creative-brief";

const FPS = 24; // Veo's output frame rate
// Older storyboards keep each shot's native audio: short fades at every cut so each reads as an
// edit rather than a pop, since those tracks are generated independently.
const AUDIO_FADE_IN = 0.06;
const AUDIO_FADE_OUT = 0.18;

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

interface ClipInfo { width: number; height: number; duration: number; hasAudio: boolean }

async function probe(path: string): Promise<ClipInfo> {
  const out = JSON.parse(await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path])) as {
    streams: { codec_type: string; width?: number; height?: number }[];
    format: { duration: string };
  };
  const video = out.streams.find((s) => s.codec_type === "video");
  return {
    width: video?.width ?? 1280,
    height: video?.height ?? 720,
    duration: Number(out.format.duration),
    hasAudio: out.streams.some((s) => s.codec_type === "audio"),
  };
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "ai-ads-stitch-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Final frame of a clip as a PNG — the base image for the branded end card.
export async function extractLastFrame(clip: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const input = join(dir, "clip.mp4");
    const output = join(dir, "last.png");
    await writeFile(input, clip);
    await run("ffmpeg", ["-y", "-sseof", "-0.2", "-i", input, "-update", "1", "-frames:v", "1", output]);
    return readFile(output);
  });
}

// A few frames spread across a clip (as PNGs) — for checking generated video, not just its keyframe,
// for text/logos the video model painted in while animating.
export async function sampleFrames(clip: Buffer, fractions = [0.2, 0.5, 0.85]): Promise<Buffer[]> {
  return withTempDir(async (dir) => {
    const input = join(dir, "clip.mp4");
    await writeFile(input, clip);
    const { duration } = await probe(input);
    return Promise.all(
      fractions.map(async (f, i) => {
        const output = join(dir, `frame-${i}.png`);
        await run("ffmpeg", ["-y", "-ss", (duration * f).toFixed(3), "-i", input, "-frames:v", "1", output]);
        return readFile(output);
      }),
    );
  });
}

export interface StitchOptions {
  // Still image held at the end with a slow push-in (logo + tagline card).
  endCard?: Buffer;
  // Trim every clip to this length — clips are generated longer than the cut so the edit keeps
  // the best stretch. Omit to keep full clips.
  cutSeconds?: number;
  // Dissolve between shots (and into the end card) instead of hard cuts. 0/omitted = hard cuts.
  transitionSeconds?: number;
  // ffmpeg filter chain applied to every shot and the end card (a shared color grade).
  grade?: string;
  // Full-frame transparent PNGs of on-screen text; supers[i] is shown over shot i + 1.
  supers?: Buffer[];
  // Soundtrack for the whole edit. When music or a voiceover is given, the clips' own audio is
  // dropped; otherwise the clips' audio is kept (older storyboards).
  music?: Buffer;
  voiceover?: Buffer;
}

// Which stretch of a clip to keep: image-to-video starts on the (static) keyframe and the motion
// develops, so take the window just before the middle; the last shot keeps its ending, where the
// product hero moment lands.
function trimWindow(duration: number, cut: number, isLast: boolean): { start: number; length: number } {
  if (cut >= duration) return { start: 0, length: duration };
  const start = isLast ? duration - cut : (duration - cut) * 0.4;
  return { start, length: cut };
}

const f3 = (n: number) => n.toFixed(3);

// Assembles the finished ad: every clip trimmed to its cut, normalized to the first clip's size at
// 24fps with a shared grade, joined by dissolves (or hard cuts), an end card with a slow push-in,
// on-screen text faded in over its shot, and a soundtrack (music, with the voiceover ducking it)
// laid across the whole film. Re-encodes — at ~20-30s of footage that takes seconds.
export async function stitchVideos(clipBuffers: Buffer[], options: StitchOptions = {}): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const write = async (name: string, buf: Buffer) => {
      const path = join(dir, name);
      await writeFile(path, buf);
      return path;
    };
    const clipPaths = await Promise.all(clipBuffers.map((buf, i) => write(`clip-${i}.mp4`, buf)));
    const infos = await Promise.all(clipPaths.map(probe));
    const { width, height } = infos[0];
    const T = options.transitionSeconds ?? 0;
    const soundtrack = Boolean(options.music || options.voiceover);

    const args = ["-y"];
    const filters: string[] = [];
    let input = 0;
    const addInput = (...inputArgs: string[]) => {
      args.push(...inputArgs);
      return input++;
    };
    const videoNorm = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${FPS}${options.grade ? `,${options.grade}` : ""},format=yuv420p,setsar=1`;
    const audioNorm = "aresample=48000,aformat=channel_layouts=stereo";

    // ---- video segments: each clip's kept window (+ the dissolve overlap), then the end card ----
    const segments: { label: string; length: number }[] = [];
    const clipWindows = infos.map((info, i) => {
      const want = options.cutSeconds !== undefined ? options.cutSeconds + T : info.duration;
      return trimWindow(info.duration, want, i === infos.length - 1);
    });
    clipPaths.forEach((path, i) => {
      const idx = addInput("-i", path);
      const { start, length } = clipWindows[i];
      filters.push(`[${idx}:v]trim=start=${f3(start)}:end=${f3(start + length)},setpts=PTS-STARTPTS,${videoNorm}[v${i}]`);
      segments.push({ label: `v${i}`, length });
    });
    if (options.endCard) {
      const idx = addInput("-i", await write("end-card.png", options.endCard));
      const frames = Math.round(END_CARD_SECONDS * FPS);
      // A single still in (no -loop): zoompan emits `d` frames per input frame, so looping the
      // image would multiply the work. Upscale 2x first so the slow 4% push-in doesn't jitter.
      filters.push(
        `[${idx}:v]scale=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0007,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${FPS},${videoNorm}[vend]`,
      );
      segments.push({ label: "vend", length: END_CARD_SECONDS });
    }

    // Segment start times on the final timeline (each dissolve overlaps the previous segment by T).
    const starts: number[] = [];
    segments.reduce((t, seg, i) => {
      starts.push(t);
      return t + seg.length - (i < segments.length - 1 ? T : 0);
    }, 0);
    const total = starts[starts.length - 1] + segments[segments.length - 1].length;

    let joined: string;
    if (T > 0 && segments.length > 1) {
      joined = segments[0].label;
      for (let k = 1; k < segments.length; k++) {
        const out = k === segments.length - 1 ? "vjoined" : `x${k}`;
        filters.push(`[${joined}][${segments[k].label}]xfade=transition=fade:duration=${f3(T)}:offset=${f3(starts[k])}[${out}]`);
        joined = out;
      }
    } else {
      filters.push(`${segments.map((s) => `[${s.label}]`).join("")}concat=n=${segments.length}:v=1:a=0[vjoined]`);
      joined = "vjoined";
    }

    // ---- on-screen text: super i over shot i + 1, fading in after the dissolve settles ----
    let video = joined;
    const supers = options.supers ?? [];
    supers.forEach((png, i) => {
      let a: number, b: number;
      if (clipPaths.length === 1) {
        // Single-shot video: the lines take turns within the one shot.
        const slot = (segments[0].length - 0.4) / supers.length;
        a = 0.3 + i * slot;
        b = a + slot - 0.15;
      } else {
        const shot = i + 1;
        if (shot >= clipPaths.length) return;
        a = starts[shot] + T * 0.6 + 0.1;
        b = (starts[shot + 1] ?? total) - 0.1;
      }
      if (b - a < 0.8) return;
      const fade = 0.3;
      const idx = addInput("-loop", "1", "-framerate", String(FPS), "-t", f3(total), "-i", `${dir}/super-${i}.png`);
      filters.push(`[${idx}:v]format=rgba,fade=t=in:st=${f3(a)}:d=${fade}:alpha=1,fade=t=out:st=${f3(b - fade)}:d=${fade}:alpha=1[s${i}]`);
      filters.push(`[${video}][s${i}]overlay=0:0:enable='between(t,${f3(a)},${f3(b)})'[vs${i}]`);
      video = `vs${i}`;
    });
    await Promise.all((options.supers ?? []).map((png, i) => write(`super-${i}.png`, png)));
    filters.push(`[${video}]fade=t=in:st=0:d=0.25,fade=t=out:st=${f3(Math.max(0, total - 0.4))}:d=0.4,format=yuv420p[outv]`);

    // ---- audio ----
    if (soundtrack) {
      const parts: string[] = [];
      if (options.music) {
        const idx = addInput("-i", await write("music.wav", options.music));
        filters.push(
          `[${idx}:a]${audioNorm},atrim=0:${f3(total)},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=${f3(Math.max(0, total - 1.8))}:d=1.8[mus]`,
        );
      }
      if (options.voiceover) {
        const idx = addInput("-i", await write("voiceover.wav", options.voiceover));
        // Narration enters just after the opening image lands.
        filters.push(`[${idx}:a]${audioNorm},adelay=700|700,apad,atrim=0:${f3(total)},afade=t=out:st=${f3(Math.max(0, total - 0.3))}:d=0.3[vo]`);
      }
      if (options.music && options.voiceover) {
        // Music ducks under the voice (sidechain), then both are mixed.
        filters.push(`[vo]asplit=2[vo1][vosc]`);
        filters.push(`[mus]volume=0.8[mus2]`);
        filters.push(`[mus2][vosc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[duck]`);
        filters.push(`[duck][vo1]amix=inputs=2:duration=first:normalize=0[mix]`);
        parts.push("mix");
      } else {
        parts.push(options.music ? "mus" : "vo");
      }
      filters.push(`[${parts[0]}]loudnorm=I=-16:TP=-1.5:LRA=11,${audioNorm}[outa]`);
    } else if (T > 0) {
      filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${f3(total)}[outa]`);
    } else {
      // Older storyboards: keep each clip's own audio, loudness-matched and faded at every cut.
      const audioLabels = clipPaths.map((_, i) => {
        const { start, length } = clipWindows[i];
        filters.push(
          infos[i].hasAudio
            ? `[${i}:a]atrim=start=${f3(start)}:end=${f3(start + length)},asetpts=PTS-STARTPTS,${audioNorm},loudnorm=I=-16:TP=-1.5:LRA=11,${audioNorm},afade=t=in:d=${AUDIO_FADE_IN},afade=t=out:st=${f3(Math.max(0, length - AUDIO_FADE_OUT))}:d=${AUDIO_FADE_OUT}[a${i}]`
            : `anullsrc=r=48000:cl=stereo,atrim=duration=${f3(length)}[a${i}]`,
        );
        return `[a${i}]`;
      });
      if (options.endCard) {
        filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${END_CARD_SECONDS}[aend]`);
        audioLabels.push("[aend]");
      }
      filters.push(`${audioLabels.join("")}concat=n=${audioLabels.length}:v=0:a=1[outa]`);
    }

    const outputPath = join(dir, "output.mp4");
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[outv]", "-map", "[outa]",
      "-t", f3(total),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      outputPath,
    );
    await run("ffmpeg", args);
    return readFile(outputPath);
  });
}
