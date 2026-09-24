// The user's creative brief for a video ad. One house style doesn't fit every brand (a school's
// admissions ad and a sneaker drop need opposite treatments), so the brief steers the director
// script, the shot count and cut length, the color grade, and the end card line.

export const AD_LENGTHS = [15, 20, 30] as const;
export const TONES = ["premium", "warm", "bold", "playful", "trustworthy"] as const;
export const LOOKS = ["photoreal", "cinematic", "surreal"] as const;
export const PACINGS = ["calm", "balanced", "fast"] as const;
export const VOICEOVER_LANGUAGES = ["en", "hi", "te", "ta"] as const;
export const VOICE_GENDERS = ["female", "male"] as const;

export type AdLength = (typeof AD_LENGTHS)[number];
export type Tone = (typeof TONES)[number];
export type Look = (typeof LOOKS)[number];
export type Pacing = (typeof PACINGS)[number];
export type VoiceoverLanguage = (typeof VOICEOVER_LANGUAGES)[number];
export type VoiceGender = (typeof VOICE_GENDERS)[number];

export const VOICEOVER_LANGUAGE_NAMES: Record<VoiceoverLanguage, string> = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil" };

export interface CreativeBrief {
  lengthSeconds: AdLength;
  tone: Tone;
  look: Look;
  pacing: Pacing;
  audience: string | null;
  keyMessage: string | null;
  mustShow: string | null;
  // Shown on the end card; falls back to the project's brand kit name.
  brandName: string | null;
  // Address / phone / website line on the end card.
  contactLine: string | null;
  // Things the film must not show or do — fed to the director and to Veo's negative prompt.
  avoid: string | null;
  // User-supplied lines shown as text over the footage (the only text in the film besides the end
  // card) — typeset in the edit, never generated into the images.
  onScreenText: string[];
  // Spoken narration only when the user asks for it — otherwise the ad is music only.
  voiceover: boolean;
  voiceoverLanguage: VoiceoverLanguage;
  voiceGender: VoiceGender;
  // The user's own narration, used verbatim; when empty the director writes one.
  voiceoverScript: string | null;
  // Written by the director step (not user input): the music brief and, if voiceover is on, the
  // narration script. Kept with the brief so the stitch step (a later queue task) can use them.
  audio?: { musicPrompt: string; voiceoverScript: string | null };
}

export const DEFAULT_BRIEF: CreativeBrief = {
  lengthSeconds: 20,
  tone: "premium",
  look: "photoreal",
  pacing: "balanced",
  audience: null,
  keyMessage: null,
  mustShow: null,
  brandName: null,
  contactLine: null,
  avoid: null,
  onScreenText: [],
  voiceover: false,
  voiceoverLanguage: "en",
  voiceGender: "female",
  voiceoverScript: null,
};

export const MAX_ON_SCREEN_LINES = 4;
const MAX_ON_SCREEN_CHARS = 60;
// Spoken pace used both to size a written voiceover and to reject a pasted one that can't fit.
export const VOICEOVER_WORDS_PER_SECOND = 2.3;

const MAX_TEXT = 300;

function pick<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T, field: string): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (!allowed.includes(value as T)) throw new Error(`${field} must be one of ${allowed.join(", ")}`);
  return value as T;
}

function text(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT) throw new Error(`${field} must be at most ${MAX_TEXT} characters`);
  return trimmed || null;
}

// Validates a request body's brief, filling defaults; throws with a user-facing message.
export function parseCreativeBrief(raw: unknown): CreativeBrief {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    lengthSeconds: pick(b.lengthSeconds, AD_LENGTHS, DEFAULT_BRIEF.lengthSeconds, "lengthSeconds"),
    tone: pick(b.tone, TONES, DEFAULT_BRIEF.tone, "tone"),
    look: pick(b.look, LOOKS, DEFAULT_BRIEF.look, "look"),
    pacing: pick(b.pacing, PACINGS, DEFAULT_BRIEF.pacing, "pacing"),
    audience: text(b.audience, "audience"),
    keyMessage: text(b.keyMessage, "keyMessage"),
    mustShow: text(b.mustShow, "mustShow"),
    brandName: text(b.brandName, "brandName"),
    contactLine: text(b.contactLine, "contactLine"),
    avoid: text(b.avoid, "avoid"),
    onScreenText: onScreenLines(b.onScreenText),
    voiceover: b.voiceover === true,
    voiceoverLanguage: pick(b.voiceoverLanguage, VOICEOVER_LANGUAGES, DEFAULT_BRIEF.voiceoverLanguage, "voiceoverLanguage"),
    voiceGender: pick(b.voiceGender, VOICE_GENDERS, DEFAULT_BRIEF.voiceGender, "voiceGender"),
    voiceoverScript: voiceoverScriptFor(b),
  };
}

function onScreenLines(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((l) => typeof l !== "string")) throw new Error("onScreenText must be a list of strings");
  const lines = (value as string[]).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_ON_SCREEN_LINES) throw new Error(`onScreenText allows at most ${MAX_ON_SCREEN_LINES} lines`);
  if (lines.some((l) => l.length > MAX_ON_SCREEN_CHARS)) throw new Error(`each on-screen text line must be at most ${MAX_ON_SCREEN_CHARS} characters`);
  return lines;
}

// A pasted script must fit the spoken time available, or the narration would run past the end.
function voiceoverScriptFor(b: Record<string, unknown>): string | null {
  if (b.voiceover !== true || b.voiceoverScript === undefined || b.voiceoverScript === null) return null;
  if (typeof b.voiceoverScript !== "string") throw new Error("voiceoverScript must be a string");
  const script = b.voiceoverScript.trim();
  if (!script) return null;
  const length = pick(b.lengthSeconds, AD_LENGTHS, DEFAULT_BRIEF.lengthSeconds, "lengthSeconds");
  const maxWords = Math.floor((length - END_CARD_SECONDS) * VOICEOVER_WORDS_PER_SECOND * 1.1);
  const words = script.split(/\s+/).length;
  if (words > maxWords) throw new Error(`voiceover script is ${words} words — a ${length}s ad fits about ${maxWords}. Shorten it or pick a longer ad.`);
  return script;
}

// ---------- edit plan ----------

export const END_CARD_SECONDS = 2.5;
const TARGET_CUT_SECONDS: Record<Pacing, number> = { calm: 4.2, balanced: 3, fast: 2.4 };
const VEO_DURATIONS = [4, 6, 8] as const;

export interface ShotPlan {
  shotCount: number;
  // Length of each shot in the final edit.
  cutSeconds: number;
  // What Veo generates per shot — longer than the cut, so the edit can keep the best stretch.
  clipSeconds: (typeof VEO_DURATIONS)[number];
}

// Real ads cut every 2-4 seconds; Veo's shortest clip is 4s. So generate a little longer than
// each cut needs and trim in the edit, with shot count set by length and pacing.
export function planShots(brief: CreativeBrief): ShotPlan {
  const footage = brief.lengthSeconds - END_CARD_SECONDS;
  const shotCount = Math.min(8, Math.max(3, Math.round(footage / TARGET_CUT_SECONDS[brief.pacing])));
  const cutSeconds = footage / shotCount;
  const clipSeconds = VEO_DURATIONS.find((d) => d >= cutSeconds + 0.8) ?? 8;
  return { shotCount, cutSeconds, clipSeconds };
}

// Dissolve length between shots — soft cuts keep separately generated shots from reading as
// stitched jump cuts. Shorter when the pacing is fast.
export const TRANSITION_SECONDS: Record<Pacing, number> = { calm: 0.5, balanced: 0.35, fast: 0.22 };

// ---------- direction ----------

// Each tone maps to a proven ad format and a concrete camera/light/performance language, so the
// director writes in that register instead of defaulting to spectacle.
export const TONE_DIRECTION: Record<Tone, string> = {
  premium:
    "PREMIUM & MINIMAL — format: product hero film. Restrained and elegant: generous negative space, slow deliberate camera moves (slow push-ins, gentle dollies, locked-off frames), macro details of materials and craftsmanship, soft directional light with rich shadow, a cool-neutral palette. Confidence through restraint — nothing busy.",
  warm:
    "WARM & EMOTIONAL — format: slice-of-life story with a small emotional turn. Human story first: real, relatable people with genuine expressions and natural interactions, intimate close-ups on faces and hands, soft natural daylight with true-to-life, balanced color (the warmth comes from the people and the moment, not an orange or golden tint), gentle handheld-feeling movement. The product appears as a natural part of the moment, not staged.",
  bold:
    "BOLD & ENERGETIC — format: rhythmic action montage. Motion in every frame, dynamic low and wide angles, tracking shots that move with the subject, punchy contrast, vivid but natural color. Energy comes from real physical action and camera movement, not effects.",
  playful:
    "PLAYFUL & FUN — format: light-hearted vignette with a small surprise. Bright, colorful, sunny; bouncy, lively movement; charming everyday humor and expressive people; a plausible, delightful little twist rather than slapstick or effects.",
  trustworthy:
    "CALM & TRUSTWORTHY — format: reassuring real-world portrait. Steady, composed framing, clean bright natural light, real people shown competent and at ease, authentic environments, clarity over flash. The feeling is: you are in good hands.",
};

export const LOOK_DIRECTION: Record<Look, string> = {
  photoreal:
    "PHOTOREAL LIVE-ACTION: everything must be physically plausible and filmable with a real camera. No magical effects, glowing energy, particles bursting, lightning, shockwaves, transformations, or CGI spectacle. No smoke, fog, haze, mist, dust clouds, floating particles, light rays, or sudden atmospheric changes unless the brief explicitly asks for them — they read as AI artifacts. Impact comes from light, composition, performance, and real motion (fabric, hair, water, reflections).",
  cinematic:
    "STYLIZED CINEMATIC: live-action but heightened — dramatic motivated lighting, bold grading, slow motion, shallow depth of field and lens character are welcome. Still no fantasy effects, glowing energy, or transformations.",
  surreal:
    "SURREAL / EFFECTS ALLOWED: at most ONE clear, elegant visual effect idea may run through the film where it serves the concept — restrained, consistent, and never cluttered; everything else stays photoreal.",
};

// ffmpeg filters giving every shot (and the end card) one shared finish per tone. Contrast and
// saturation only — no color shifts: a warm/orange cast on top of already warm footage made a whole
// test ad look filtered. The palette itself comes from the direction and look sheet.
export const TONE_GRADE: Record<Tone, string> = {
  premium: "eq=contrast=1.05:saturation=0.92",
  warm: "eq=contrast=1.03:saturation=1.03",
  bold: "eq=contrast=1.1:saturation=1.1",
  playful: "eq=contrast=1.02:saturation=1.08",
  trustworthy: "eq=contrast=1.02:saturation=0.98",
};

// Always sent to Veo's negative prompt for photoreal/cinematic looks: sudden unmotivated effects
// Veo likes to add while animating (a smoke puff appeared mid-shot in testing).
export const VIDEO_ARTIFACT_NEGATIVES =
  "smoke, fog, haze, mist, dust clouds, floating particles, sparks, sudden flashes, light leaks, morphing, warping, flickering";

// Tone + look direction as one block for the shot prompt refiners.
export function directionText(brief: CreativeBrief | null): string | null {
  if (!brief) return null;
  return [TONE_DIRECTION[brief.tone], LOOK_DIRECTION[brief.look], brief.avoid && `MUST AVOID anywhere in the frame: ${brief.avoid}`]
    .filter(Boolean)
    .join("\n");
}

// End-card typeface per tone (Google Fonts, loaded by font-cache.ts) — used unless the brand kit
// sets its own font, so the card matches the film's vibe instead of one generic sans.
export const TONE_FONT: Record<Tone, string> = {
  premium: "Montserrat",
  warm: "Lora",
  bold: "Anton",
  playful: "Fredoka",
  trustworthy: "Nunito Sans",
};

// Music direction per tone, handed to the director to turn into the film's actual music prompt.
export const TONE_MUSIC: Record<Tone, string> = {
  premium: "minimal, elegant, modern — sparse piano or soft synth pads, subtle pulse, lots of space",
  warm: "warm and heartfelt — acoustic guitar, soft piano, gentle strings, a hopeful swell toward the end",
  bold: "driving and energetic — punchy drums, bass, rising build, confident hits on the cuts",
  playful: "bright and bouncy — plucky ukulele or marimba, claps, whistles, light and cheerful",
  trustworthy: "calm and reassuring — soft piano and light strings, steady and optimistic",
};
