import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpegStatic from "ffmpeg-static";
import { END_CARD_SECONDS } from "./creative-brief";

// The Railway image has no system ffmpeg (every storyboard shot failed there with
// "spawn ffprobe ENOENT"), so use the npm-bundled binaries; fall back to PATH if a host's
// install step didn't fetch them.
const BINARIES: Record<string, string> = {
  ffmpeg: ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg",
  ffprobe: existsSync(ffprobeInstaller.path) ? ffprobeInstaller.path : "ffprobe",
};
console.log(`[video-stitch] ffmpeg: ${BINARIES.ffmpeg}, ffprobe: ${BINARIES.ffprobe}`);

const FPS = 24; // Veo's output frame rate
// Older storyboards keep each shot's native audio: short fades at every cut so each reads as an
// edit rather than a pop, since those tracks are generated independently.
const AUDIO_FADE_IN = 0.06;
const AUDIO_FADE_OUT = 0.18;
// Blur behind on-screen text, as a fraction of the short side — deliberately light: softens busy
// detail so the line reads, without looking like a frosted panel.
const SUPER_BLUR = 0.008;
// ...and washed 65% toward white, so the black on-screen type reads on any scene.
const SUPER_WASH = 0.65;

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(BINARIES[cmd] ?? cmd, args);
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
// Splits one narration take into `count` pieces at its longest pauses (the reader was asked to
// pause between lines), trimming the silence around each piece. Returns null when the take has
// fewer usable pauses than it needs.
export async function splitAudioAtPauses(wav: Buffer, count: number): Promise<Buffer[] | null> {
  if (count <= 1) return [wav];
  const dir = await mkdtemp(join(tmpdir(), "vo-split-"));
  try {
    const input = join(dir, "vo.wav");
    await writeFile(input, wav);
    const stderr = await new Promise<string>((resolve, reject) => {
      const proc = spawn(BINARIES.ffmpeg, ["-i", input, "-af", "silencedetect=noise=-38dB:d=0.35", "-f", "null", "-"]);
      let err = "";
      proc.stderr.on("data", (c) => { err += c; });
      proc.on("error", reject);
      proc.on("close", () => resolve(err));
    });
    const duration = (await probe(input)).duration;
    const silences: { start: number; end: number }[] = [];
    let open: number | null = null;
    for (const m of stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
      const t = Number(m[2]);
      if (m[1] === "start") open = t;
      else if (open !== null) { silences.push({ start: open, end: t }); open = null; }
    }
    // Only pauses between speech count (not leading or trailing silence).
    const inner = silences.filter((g) => g.start > 0.15 && g.end < duration - 0.15);
    if (inner.length < count - 1) return null;
    const cuts = inner
      .sort((a, b) => b.end - b.start - (a.end - a.start))
      .slice(0, count - 1)
      .sort((a, b) => a.start - b.start);
    const bounds = [
      { from: 0, to: cuts[0].start + 0.05 },
      ...cuts.slice(1).map((c, i) => ({ from: cuts[i].end - 0.05, to: c.start + 0.05 })),
      { from: cuts[cuts.length - 1].end - 0.05, to: duration },
    ];
    const pieces: Buffer[] = [];
    for (const [i, b] of bounds.entries()) {
      const out = join(dir, `piece-${i}.wav`);
      await run("ffmpeg", ["-y", "-i", input, "-af", `atrim=${f3(Math.max(0, b.from))}:${f3(b.to)},asetpts=PTS-STARTPTS,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse`, out]);
      pieces.push(await readFile(out));
    }
    return pieces;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

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
  // Full-frame transparent PNG (text + logo) laid over the end card unscaled and ungraded, so the
  // type stays crisp while the card behind it pushes in.
  endCardOverlay?: Buffer;
  // Trim every clip to this length — clips are generated longer than the cut so the edit keeps
  // the best stretch. Omit to keep full clips.
  cutSeconds?: number;
  // Dissolve between shots (and into the end card) instead of hard cuts. 0/omitted = hard cuts.
  transitionSeconds?: number;
  // ffmpeg filter chain applied to every shot and the end card (a shared color grade).
  grade?: string;
  // Shots that may carry on-screen text, in order; supers[i] goes over superShots[i]. Defaults to
  // every shot after the first. Screen inserts are left out — the product UI is never covered.
  superShots?: number[];
  // On-screen text; supers[i] is shown over shot i + 1 (or superShots[i]). `text` is a full-frame transparent PNG;
  // `mask` (white = blur) marks where the footage behind it is lightly blurred.
  supers?: { text: Buffer; mask: Buffer }[];
  // Soundtrack for the whole edit. When music or a voiceover is given, the clips' own audio is
  // dropped; otherwise the clips' audio is kept (older storyboards).
  music?: Buffer;
  voiceover?: Buffer;
  // Narration read per shot: each line enters just after its shot's dissolve settles. Takes
  // precedence over `voiceover`.
  voiceoverLines?: { shot: number; audio: Buffer }[];
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
    const voLines = (options.voiceoverLines ?? []).filter((l) => l.shot >= 0).sort((a, b) => a.shot - b.shot);
    const hasVoice = voLines.length > 0 || Boolean(options.voiceover);
    const soundtrack = Boolean(options.music || hasVoice);

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
        const shot = options.superShots ? options.superShots[i] : i + 1;
        if (shot === undefined || shot >= clipPaths.length) return;
        a = starts[shot] + T * 0.6 + 0.1;
        b = (starts[shot + 1] ?? total) - 0.1;
      }
      if (b - a < 0.8) return;
      const fade = 0.3;
      const fades = `fade=t=in:st=${f3(a)}:d=${fade}:alpha=1,fade=t=out:st=${f3(b - fade)}:d=${fade}:alpha=1`;
      const enable = `enable='between(t,${f3(a)},${f3(b)})'`;
      const still = (name: string) => addInput("-loop", "1", "-framerate", String(FPS), "-t", f3(total), "-i", `${dir}/${name}`);
      const textIdx = still(`super-${i}.png`);
      const maskIdx = still(`super-mask-${i}.png`);
      // A light blur of the footage washed toward white, shown only through the feathered mask
      // behind the (black) text — a frosted patch, no box.
      filters.push(`[${video}]split[sb${i}][sk${i}]`);
      filters.push(`[${maskIdx}:v]format=gray,scale=${width}:${height}[sm${i}]`);
      filters.push(`[sk${i}]gblur=sigma=${f3(SUPER_BLUR * Math.min(width, height))},lutrgb=r='val*${1 - SUPER_WASH}+${Math.round(255 * SUPER_WASH)}':g='val*${1 - SUPER_WASH}+${Math.round(255 * SUPER_WASH)}':b='val*${1 - SUPER_WASH}+${Math.round(255 * SUPER_WASH)}',format=rgba[sg${i}]`);
      filters.push(`[sg${i}][sm${i}]alphamerge,${fades}[sl${i}]`);
      filters.push(`[sb${i}][sl${i}]overlay=0:0:${enable}[sv${i}]`);
      filters.push(`[${textIdx}:v]format=rgba,${fades}[s${i}]`);
      filters.push(`[sv${i}][s${i}]overlay=0:0:${enable}[vs${i}]`);
      video = `vs${i}`;
    });
    await Promise.all(supers.flatMap((s, i) => [write(`super-${i}.png`, s.text), write(`super-mask-${i}.png`, s.mask)]));

    // ---- end card text + logo: static on top, fading in with the dissolve into the card ----
    if (options.endCard && options.endCardOverlay) {
      const a = starts[starts.length - 1];
      const fade = Math.max(T, 0.3);
      const idx = addInput("-loop", "1", "-framerate", String(FPS), "-t", f3(total), "-i", await write("end-card-overlay.png", options.endCardOverlay));
      filters.push(`[${idx}:v]format=rgba,fade=t=in:st=${f3(a)}:d=${f3(fade)}:alpha=1[eco]`);
      filters.push(`[${video}][eco]overlay=0:0:enable='gte(t,${f3(a)})'[veco]`);
      video = "veco";
    }
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
      if (voLines.length) {
        // Each line starts once its shot's dissolve has settled; a line that runs long is sped up a
        // little (at most 12%) and otherwise pushes the next line later rather than overlapping it.
        // The last line must end ~0.8s before the film does.
        const lead = T * 0.6 + 0.25, gap = 0.3, tail = 0.8;
        let prevEnd = 0;
        const labels: string[] = [];
        for (const [k, line] of voLines.entries()) {
          const path = await write(`vo-line-${k}.wav`, line.audio);
          const idx = addInput("-i", path);
          const length = (await probe(path)).duration;
          const desired = (starts[line.shot] ?? 0) + (line.shot === 0 ? 0.5 : lead);
          const at = Math.max(desired, prevEnd + gap);
          const nextDesired = k + 1 < voLines.length ? (starts[voLines[k + 1].shot] ?? total) + lead - gap : total - tail;
          const room = Math.max(0.5, nextDesired - at);
          const tempo = length > room ? Math.min(1.12, length / room) : 1;
          const fitted = length / tempo;
          const isLast = k === voLines.length - 1;
          const fade = isLast && at + fitted > total - tail ? `,afade=t=out:st=${f3(Math.max(0, total - tail - at - 0.5))}:d=0.5` : "";
          const ms = Math.round(at * 1000);
          filters.push(`[${idx}:a]${audioNorm}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""}${fade},adelay=${ms}|${ms},apad,atrim=0:${f3(total)}[vol${k}]`);
          labels.push(`[vol${k}]`);
          prevEnd = at + fitted;
        }
        filters.push(labels.length > 1 ? `${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0[vo]` : `${labels[0]}anull[vo]`);
      } else if (options.voiceover) {
        const voPath = await write("voiceover.wav", options.voiceover);
        const idx = addInput("-i", voPath);
        // Narration enters just after the opening image lands and must finish ~0.8s before the
        // end — it used to be cut at the last frame, chopping the CTA's final word. A slightly long
        // read is sped up (at most 15%, still natural); anything beyond that fades out softly.
        const start = 0.7, tail = 0.8;
        const window = Math.max(1, total - start - tail);
        const voLength = (await probe(voPath)).duration;
        const tempo = voLength > window ? Math.min(1.15, voLength / window) : 1;
        const fitted = voLength / tempo;
        const fade = fitted > window ? `,afade=t=out:st=${f3(start + window - 0.5)}:d=0.5` : "";
        filters.push(`[${idx}:a]${audioNorm}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""},adelay=700|700,apad,atrim=0:${f3(total)}${fade}[vo]`);
      }
      if (options.music && hasVoice) {
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
