import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { ffmpeg } from "./ffmpeg-bin";
import { generateMusic } from "./music";
import { withRateLimitRetry } from "./rate-limit-retry";

// An ad score built from parts by role, placed on the edit's own timeline (knowledge/music-scoring-for-ads.md).
// A single Lyria track is a song: a continuous melody on its own clock that fights the lines and ignores
// the cuts. Swastea (2026-10-08) was scored this way instead, and the user heard the difference:
// - bed: a sparse texture with no melody, under the dialogue;
// - motif: one short phrase in a gap;
// - bloom: the swell on the emotional peak, after a short hush;
// - button: a short resolving phrase on the end card, ringing out by the last frame.
// Each part is its own Lyria take; the best phrase in it is found on the waveform (the AI listener's
// timestamps are unreliable). The stitcher places the parts on the real shot starts (assembleScore).

const genAI = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;

const LESSON = (() => {
  const f = [join(__dirname, "../../../knowledge/music-scoring-for-ads.md"), join(__dirname, "../../knowledge/music-scoring-for-ads.md")].find(existsSync);
  return f ? readFileSync(f, "utf8") : "";
})();

export type ScoreRole = "bed" | "motif" | "bloom" | "button";

export interface ScorePlan {
  key: string; // e.g. "Raag Pahadi, tonic D" or "D major"
  peakShot: number; // the shot the bloom lands on (0-based)
  bedFromShot: number; // the bed enters at this shot; shots before it are silent (natural sound only)
  prompts: Record<ScoreRole, string>;
}

// Already-cut phrases, ready to place.
export interface ScoreParts {
  plan: ScorePlan;
  bed?: Buffer;
  motif?: Buffer;
  bloom?: Buffer;
  button?: Buffer;
}

export interface ScoreShot {
  seconds: number;
  spoken: boolean; // dialogue or a voice line over this shot
  note?: string; // what happens, if known
}

// The music director, taught the scoring lesson, writes one prompt per role and picks the sync points.
export async function planScore(concept: string, musicIdea: string, tone: string, shots: ScoreShot[], hasEndCard: boolean): Promise<ScorePlan> {
  if (!genAI) throw new Error("Score planning is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  const res = await withRateLimitRetry("score-plan", () =>
    genAI.models.generateContent({
      model: env.textModel,
      contents: `You are the music director on an ad film. Follow this lesson on how ads are scored exactly:\n\n${LESSON}\n\nTHE AD: ${concept}\nTONE: ${tone}\nTHE DIRECTOR'S MUSIC IDEA: ${musicIdea}\nSHOTS (0-based):\n${shots.map((s, i) => `${i}. ${s.seconds.toFixed(1)}s${s.spoken ? " · someone speaks" : ""}${s.note ? ` · ${s.note}` : ""}`).join("\n")}${hasEndCard ? `\n${shots.length}. end card (logo)` : ""}

Plan the score as four parts by role, all in one key, each with its own prompt for an AI music model (40–70 words: instrument(s), key, mood, exactly what to play and what not to play; never a named song, composer or artist; no vocals unless the idea asks for them):
- bed: a sparse texture with NO melody, to sit under the dialogue;
- motif: ONE short 3–5 note phrase followed by silence, repeated with gaps, so a clean phrase can be lifted;
- bloom: one gentle swell that rises and releases, for the emotional peak;
- button: a short, clean phrase that resolves on the tonic and rings out (the sonic logo).
Choose peakShot (the shot with the emotional turn, where the bloom lands) and bedFromShot (where the music enters; shots before it carry only natural sound — often 0 when nobody speaks in shot 0, later when the opening carries dialogue).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING },
            peakShot: { type: Type.INTEGER },
            bedFromShot: { type: Type.INTEGER },
            bed: { type: Type.STRING },
            motif: { type: Type.STRING },
            bloom: { type: Type.STRING },
            button: { type: Type.STRING },
          },
          required: ["key", "peakShot", "bedFromShot", "bed", "motif", "bloom", "button"],
        },
      },
    }),
  );
  const p = JSON.parse(res.text ?? "{}");
  const clamp = (n: number) => Math.max(0, Math.min(shots.length - 1, Math.round(n || 0)));
  return { key: p.key, peakShot: clamp(p.peakShot), bedFromShot: clamp(p.bedFromShot), prompts: { bed: p.bed, motif: p.motif, bloom: p.bloom, button: p.button } };
}

// Loudness every 0.1s (dBFS), from ffmpeg's astats.
async function rmsProfile(path: string): Promise<number[]> {
  const { stderr } = await ffmpeg(["-nostats", "-i", path, "-af", "aresample=16000,asetnsamples=n=1600:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"]);
  return [...stderr.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -120 : Number(m[1])));
}

// Phrases: runs of sound between quiet gaps (≥0.3s at 20 dB under the loudest moment).
function phrases(db: number[]): [number, number][] {
  const floor = Math.max(...db) - 20;
  const out: [number, number][] = [];
  let start = -1, quiet = 0;
  db.forEach((v, i) => {
    if (v > floor) {
      if (start < 0) start = i;
      quiet = 0;
    } else if (start >= 0 && ++quiet >= 3) {
      out.push([start / 10, (i - quiet + 1) / 10]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start / 10, db.length / 10]);
  return out;
}

// The window [start, end] (seconds) to keep from a part's take, chosen on the waveform for its role.
export function pickWindow(role: ScoreRole, db: number[]): [number, number] {
  const total = db.length / 10;
  const ph = phrases(db);
  if (role === "motif") {
    const m = ph.find(([a, b]) => b - a >= 1.2 && b - a <= 3.5);
    if (m) return [Math.max(0, m[0] - 0.05), Math.min(total, m[1] + 0.4)];
    return [1, Math.min(total, 3.5)];
  }
  if (role === "button") {
    // the last phrase that is followed by a decay or the end of the take
    const b = [...ph].reverse().find(([a, e]) => e - a >= 1.5 && e - a <= 6);
    if (b) return [Math.max(0, b[0] - 0.05), Math.min(total, b[1] + 1.2)];
    return [Math.max(0, total - 4.5), total];
  }
  if (role === "bloom") {
    // the 5s window with the most energy, starting ~1.5s before its loudest moment (a rise and a release)
    let best = 0, at = 0;
    for (let i = 0; i + 50 <= db.length; i++) {
      const s = db.slice(i, i + 50).reduce((a, v) => a + Math.pow(10, v / 20), 0);
      if (s > best) [best, at] = [s, i];
    }
    const peak = at + db.slice(at, at + 50).indexOf(Math.max(...db.slice(at, at + 50)));
    const start = Math.max(0, peak / 10 - 1.5);
    return [start, Math.min(total, start + 5)];
  }
  return [Math.min(1, total / 4), total]; // bed: skip the attack, keep the rest
}

async function cut(wav: Buffer, [a, b]: [number, number]): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "score-"));
  try {
    await writeFile(join(dir, "in.wav"), wav);
    await ffmpeg(["-loglevel", "error", "-y", "-i", join(dir, "in.wav"), "-ss", b > a ? a.toFixed(2) : "0", "-to", b.toFixed(2), "-af", "aresample=48000,aformat=channel_layouts=stereo", join(dir, "out.wav")]);
    return await readFile(join(dir, "out.wav"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const NEGATIVE: Record<ScoreRole, string> = {
  bed: "melody, song, drums, beat, percussion, vocals, synth, sad, gloomy, fast",
  motif: "drums, beat, vocals, synth, continuous melody, song, sad",
  bloom: "drums, beat, vocals, synth, sad, gloomy, harsh",
  button: "drums, beat, vocals, synth, sad, long melody",
};

// Generates the four parts and cuts the right phrase from each. A part that fails is left out; the
// assembler places whatever it gets.
export async function generateScoreParts(plan: ScorePlan): Promise<ScoreParts> {
  const roles: ScoreRole[] = ["bed", "motif", "bloom", "button"];
  const parts: ScoreParts = { plan };
  await Promise.all(
    roles.map(async (role) => {
      try {
        const wav = await generateMusic(plan.prompts[role], undefined, NEGATIVE[role]);
        const dir = await mkdtemp(join(tmpdir(), "score-"));
        try {
          await writeFile(join(dir, "take.wav"), wav);
          parts[role] = await cut(wav, pickWindow(role, await rmsProfile(join(dir, "take.wav"))));
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      } catch (err) {
        console.warn(`[score] ${role} failed, leaving it out:`, err instanceof Error ? err.message : err);
      }
    }),
  );
  return parts;
}

// Lays the parts on the edit's timeline (segment start times from the stitcher):
// - silence before bedFromShot;
// - the bed from there to the end card, EQ'd out of the voice range;
// - the motif in the shot before the peak;
// - a hush, then the bloom on the peak shot;
// - the bed again;
// - the button on the end card (or the last shot), ringing out by the end.
// Each part is rendered to its own full-length track (exact silence + the phrase) and the tracks are mixed;
// adelay's padding was lost in WAV output, and mixed sample rates broke amix.
export async function assembleScore(parts: ScoreParts, starts: number[], total: number, endCardStart: number | null): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "score-"));
  try {
    const { plan } = parts;
    const peakAt = starts[plan.peakShot] ?? total * 0.45;
    const bedAt = starts[plan.bedFromShot] ?? 0;
    const buttonAt = (endCardStart ?? starts[starts.length - 1] ?? total - 5) + 0.1;
    const EQ = "equalizer=f=750:t=o:w=1.2:g=-8";
    const tracks: string[] = [];
    const place = async (name: string, buf: Buffer | undefined, at: number, len: number, chain: string) => {
      if (!buf || len < 0.4 || at >= total) return;
      len = Math.min(len, total - at);
      const src = join(dir, `${name}.wav`), out = join(dir, `${name}-track.wav`);
      await writeFile(src, buf);
      const fadeOut = Math.min(1.5, len / 3);
      await ffmpeg(["-loglevel", "error", "-y", "-i", src, "-filter_complex",
        `[0]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${len.toFixed(3)},${chain},afade=t=out:st=${(len - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}[c];anullsrc=r=48000:cl=stereo,atrim=0:${Math.max(0.001, at).toFixed(3)}[s];[s][c]concat=n=2:v=0:a=1,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)}`,
        out]);
      tracks.push(out);
    };
    const hush = 0.5;
    await place("bedA", parts.bed, bedAt, peakAt - hush - bedAt, `${EQ},volume=0.22,afade=t=in:d=1.5`);
    await place("bedB", parts.bed, peakAt + 4.5, buttonAt - (peakAt + 4.5) - 0.2, `${EQ},volume=0.2,afade=t=in:d=1.2`);
    const motifShot = Math.max(plan.bedFromShot, plan.peakShot - 1);
    if (motifShot < plan.peakShot) await place("motif", parts.motif, (starts[motifShot] ?? bedAt) + 0.3, Math.min(3.5, peakAt - hush - (starts[motifShot] ?? bedAt) - 0.3), "afade=t=in:d=0.03,volume=0.7");
    await place("bloom", parts.bloom, peakAt, 5, "afade=t=in:d=0.8,volume=0.7");
    await place("button", parts.button, buttonAt, total - buttonAt - 0.05, "afade=t=in:d=0.05,volume=0.85");
    if (!tracks.length) throw new Error("no score parts to place");
    const out = join(dir, "score.wav");
    await ffmpeg(["-loglevel", "error", "-y", ...tracks.flatMap((t) => ["-i", t]), "-filter_complex",
      `${tracks.map((_, i) => `[${i}]`).join("")}amix=inputs=${tracks.length}:normalize=0,loudnorm=I=-20:TP=-2,aresample=48000`, out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
