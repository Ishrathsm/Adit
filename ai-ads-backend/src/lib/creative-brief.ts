import type { PackInsert } from "./video-stitch";

// The user's creative brief for a video ad. One house style doesn't fit every brand (a school's
// admissions ad and a sneaker drop need opposite treatments), so the brief steers the director
// script, the shot count and cut length, the color grade, and the end card line.

export const AD_LENGTHS = [15, 20, 30] as const;
// "ad": a multi-shot film (length + pacing). "single": one continuous shot of 4/6/8s — the old
// quick Text -> Video, now through the same pipeline (checks, music, end card).
export const FORMATS = ["ad", "single"] as const;
export const SINGLE_SHOT_SECONDS = [4, 6, 8] as const;
// Multi-shot ads can also be planned directly as N shots x S seconds (e.g. 2 x 6s = 12s) — the
// ad length is then always an even number of seconds, before the end card.
export const SHOT_SECONDS = [4, 6, 8] as const;
export const MIN_SHOTS = 2;
export const MAX_SHOTS = 8;
export const MAX_FOOTAGE_SECONDS = 32;
export const TONES = ["premium", "warm", "bold", "playful", "trustworthy"] as const;
export const LOOKS = ["photoreal", "cinematic", "surreal", "stopmotion", "puppet", "folkpuppet"] as const;
export const PACINGS = ["calm", "balanced", "fast"] as const;
export const VOICEOVER_LANGUAGES = ["en", "hi", "te", "ta"] as const;
export const VOICE_GENDERS = ["female", "male"] as const;

export type AdLength = (typeof AD_LENGTHS)[number];
export type Format = (typeof FORMATS)[number];
export type SingleShotSeconds = (typeof SINGLE_SHOT_SECONDS)[number];
export type ShotSeconds = (typeof SHOT_SECONDS)[number];
export type Tone = (typeof TONES)[number];
export type Look = (typeof LOOKS)[number];
export type Pacing = (typeof PACINGS)[number];
export type VoiceoverLanguage = (typeof VOICEOVER_LANGUAGES)[number];
export type VoiceGender = (typeof VOICE_GENDERS)[number];

export const VOICEOVER_LANGUAGE_NAMES: Record<VoiceoverLanguage, string> = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil" };

export interface CreativeBrief {
  format: Format;
  // Only for the "single" format.
  singleSeconds: SingleShotSeconds;
  lengthSeconds: AdLength;
  // Explicit plan (both set, or both null): shotCount shots of shotSeconds each. Overrides
  // lengthSeconds + pacing, which remain for older briefs.
  shotCount: number | null;
  shotSeconds: ShotSeconds | null;
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
  // A software product's real screens (uploaded screenshots of its UI). When present, the director
  // may show the product on screen through screen-insert shots built from these images.
  screens: ProductScreen[];
  // Written by the director step (not user input): the music brief and, if voiceover is on, the
  // narration script. Kept with the brief so the stitch step (a later queue task) can use them.
  audio?: {
    musicPrompt: string;
    voiceoverScript: string | null;
    voiceoverDirection?: string | null;
    // The narration split by shot (index = shot index, null = no line on that shot), so each line
    // lands on its own picture. Absent on older storyboards and when the client wrote the VO.
    voiceoverLines?: (string | null)[];
  };
  // Also written by the director: things this film must never show, added to the video model's
  // negative prompt (never the image prompt, which paints what it reads).
  exclusions?: string | null;
  // Also written by the director: the end card's supporting line under the brand name.
  endCardTagline?: string | null;
  // Also written by the director (stop-motion look): how each shot hands to the next — a paper tear,
  // fold, slide-in, or cut on motion — built in the edit, never generated into the footage.
  transitions?: (string | null)[];
  // The client's real pack (a transparent cutout) composited into the listed shots in the edit,
  // so packaging is never AI-drawn. Set per storyboard at production, not by the director.
  pack?: { url: string; inserts: PackInsert[] } | null;
  // Voices for a film with characters: the narrator and each speaking character (keyed by the
  // upper-case name used in the vo lines, e.g. "DRAGON: …"). `voice` is a Gemini TTS prebuilt voice;
  // `persona` is who is speaking, in plain words. Absent = one narrator voice from voiceGender.
  voiceCast?: Record<string, { voice: string; persona: string }> | null;
  // Approved voice takes (WAV URLs by shot index) used as-is in the edit instead of new reads —
  // for when takes were cast and checked by ear before the render.
  voiceTakes?: { shot: number; url: string }[] | null;
  // Also written by the director: sound design notes (ambience and per-shot effects) for the edit.
  soundDesign?: { ambience: string; cues: (string | null)[] } | null;
}

export interface ProductScreen {
  url: string;
  // What the screen shows, so the director knows which moment it fits (e.g. "AI Tutor answering a
  // question about linear equations").
  description: string | null;
  // Optional: the part of the screen that is the product's response (top and bottom, as fractions
  // of the image height). It streams in top to bottom during the shot, so the product visibly
  // answers instead of sitting still.
  reveal?: { from: number; to: number } | null;
}

export const MAX_SCREENS = 4;

export const DEFAULT_BRIEF: CreativeBrief = {
  format: "ad",
  singleSeconds: 8,
  lengthSeconds: 20,
  shotCount: null,
  shotSeconds: null,
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
  screens: [],
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
    format: pick(b.format, FORMATS, DEFAULT_BRIEF.format, "format"),
    singleSeconds: pick(b.singleSeconds, SINGLE_SHOT_SECONDS, DEFAULT_BRIEF.singleSeconds, "singleSeconds"),
    lengthSeconds: pick(b.lengthSeconds, AD_LENGTHS, DEFAULT_BRIEF.lengthSeconds, "lengthSeconds"),
    ...shotPlanFor(b),
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
    screens: screensFor(b.screens),
  };
}

function screensFor(raw: unknown): ProductScreen[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("screens must be a list");
  if (raw.length > MAX_SCREENS) throw new Error(`at most ${MAX_SCREENS} product screens`);
  return raw.map((item, i) => {
    const s = (item ?? {}) as Record<string, unknown>;
    if (typeof s.url !== "string" || !/^https:\/\//.test(s.url)) throw new Error(`screens[${i}].url must be an https URL`);
    const r = s.reveal as { from?: unknown; to?: unknown } | null | undefined;
    const reveal =
      r && typeof r.from === "number" && typeof r.to === "number" && r.from >= 0 && r.to <= 1 && r.to - r.from >= 0.05 ? { from: r.from, to: r.to } : null;
    return { url: s.url, description: text(s.description, `screens[${i}].description`), reveal };
  });
}

// Validates an explicit "N shots x S seconds" plan; both fields must come together.
function shotPlanFor(b: Record<string, unknown>): { shotCount: number | null; shotSeconds: ShotSeconds | null } {
  if ((b.shotCount === undefined || b.shotCount === null) && (b.shotSeconds === undefined || b.shotSeconds === null)) {
    return { shotCount: null, shotSeconds: null };
  }
  const count = b.shotCount;
  if (typeof count !== "number" || !Number.isInteger(count) || count < MIN_SHOTS || count > MAX_SHOTS) {
    throw new Error(`shotCount must be a whole number from ${MIN_SHOTS} to ${MAX_SHOTS}`);
  }
  const seconds = pick(b.shotSeconds, SHOT_SECONDS, 6, "shotSeconds");
  if (count * seconds > MAX_FOOTAGE_SECONDS) throw new Error(`${count} x ${seconds}s is ${count * seconds}s — keep the ad to ${MAX_FOOTAGE_SECONDS}s or less`);
  return { shotCount: count, shotSeconds: seconds };
}

// Seconds of footage before the end card.
export function footageSeconds(brief: Pick<CreativeBrief, "format" | "singleSeconds" | "lengthSeconds" | "shotCount" | "shotSeconds">): number {
  if (brief.format === "single") return brief.singleSeconds;
  if (brief.shotCount && brief.shotSeconds) return brief.shotCount * brief.shotSeconds;
  return brief.lengthSeconds - END_CARD_SECONDS;
}

// An explicit plan implies its pacing (shot length sets the rhythm); older briefs chose it.
export function effectivePacing(brief: Pick<CreativeBrief, "pacing" | "shotSeconds" | "format">): Pacing {
  if (brief.format === "ad" && brief.shotSeconds) return brief.shotSeconds === 4 ? "fast" : brief.shotSeconds === 8 ? "calm" : "balanced";
  return brief.pacing;
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
  const footage = footageSeconds({
    format: b.format === "single" ? "single" : "ad",
    singleSeconds: pick(b.singleSeconds, SINGLE_SHOT_SECONDS, DEFAULT_BRIEF.singleSeconds, "singleSeconds"),
    lengthSeconds: pick(b.lengthSeconds, AD_LENGTHS, DEFAULT_BRIEF.lengthSeconds, "lengthSeconds"),
    ...shotPlanFor(b),
  });
  const maxWords = Math.floor(footage * VOICEOVER_WORDS_PER_SECOND * 1.1);
  const words = script.split(/\s+/).length;
  if (words > maxWords) throw new Error(`voiceover script is ${words} words — ${Math.round(footage)}s of footage fits about ${maxWords}. Shorten it or pick a longer ad.`);
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
  if (brief.format === "single") return { shotCount: 1, cutSeconds: brief.singleSeconds, clipSeconds: brief.singleSeconds };
  if (brief.shotCount && brief.shotSeconds) {
    // Exactly what the user picked; clips are still generated a little longer where Veo allows.
    const clipSeconds = VEO_DURATIONS.find((d) => d >= brief.shotSeconds! + 0.8) ?? 8;
    return { shotCount: brief.shotCount, cutSeconds: brief.shotSeconds, clipSeconds };
  }
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
  stopmotion:
    "STOP-MOTION PAPER COLLAGE: a handmade tabletop world shot frame by frame — everything is cut paper, card, and printed-photo cutouts with visible scissor-cut and torn edges, paper grain, layered depth, and small real drop shadows between layers, on a real tabletop set lit like a miniature. Objects move in small stepped jumps (animated on twos, 12 frames a second): they hop, slide, pop up, fold open, and wobble with charm, never smooth CGI motion. Hero objects the brand supplies (the real pack) stay photographic and exact; the world around them is paper. Clean, bright and graphic; no smoke, glow, particles, or digital effects — every effect is a paper effect (a torn-paper burst, cut-paper confetti, a fold-out pop-up). No people and no hands in frame — the objects are the characters.",
  puppet:
    "STOP-MOTION PUPPET FILM: a real handmade miniature world shot frame by frame, like a Laika or Aardman feature — sculpted puppets with painted faces, glass-bead eyes and real fabric costumes; miniature sets built from carved wood, clay, plaster, felt, real stone and moss; tiny practical lights (lanterns, oil lamps, fire) lighting the set like a real film. It must feel tactile and real: fingerprints in the clay, fabric weave, wood grain, slight hand-made imperfection. Characters move in small stepped poses (animated on twos, 12 frames a second) with clear, readable acting — expressive faces and gestures, never lip-synced dialogue (the narration tells the story). Hero objects the brand supplies (the real pack) stay photographic and exact. No CGI gloss, no digital particles; smoke, fire and magic are practical miniature effects (cotton-wool smoke, cellophane flame). Never real humans or animators' hands.",
  folkpuppet:
    "TELUGU FOLK-ART CUT-OUT PUPPET SHOW: a flat, hand-painted 2D world in the style of Cheriyal scroll paintings and Kalamkari — one uniform black outline of the same medium weight around every element (characters, props, architecture, borders, clouds), never bold in one place and thin in another; flat rich colour (Cheriyal red grounds, ochre, indigo, leaf green, turmeric), ornate patterned borders and floors, stylised trees, forts and houses built from decorative motifs, figures mostly in profile with large expressive almond eyes. Every character is a jointed flat cut-out puppet like Tholu Bommalata: separate painted pieces pinned at neck, shoulders, elbows and knees, moving in stepped poses (animated on twos, 12 frames a second) — limbs swing from their pins, heads tilt, bodies slide and bob; never smooth 3D turns. The scene is layered flat planes with slight depth and soft shadows between them, with a faint hand-painted cloth and leather texture. No 3D shading, no CGI, no photographic elements except the brand's real pack, which stays photographic and exact. Effects are painted too (painted flames, painted smoke curls, painted stars).",
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
  "smoke, fog, haze, mist, dust clouds, floating particles, glitter, sparks, sudden flashes, light leaks, morphing, warping, flickering, iris wipes, circular masks, transitions, jump cuts, people talking, lip movement, deformed hands, extra fingers, warped objects, changing faces, plastic skin, camera shake, lens flare, light leaks, bokeh ghosts";

// Stop-motion: appended to every keyframe and Veo prompt as-is. The look direction alone let the
// image model slip back to photography on food (real liquid chutney, a real dipped stick) — food
// pulls hardest toward photoreal — so the paper medium is restated as a binding final line.
export const STOP_MOTION_IMAGE_STYLE =
  "Rendering style, binding for every object in the frame: a handmade stop-motion paper-craft miniature. Every object — snacks, bowls, sauces, chutney, leaves, chillies — is built from cut and folded coloured paper, crepe paper, and card, with visible cut edges, paper grain, and layered paper depth; nothing is real food or a photographic object. Sauces and chutneys are layered, torn green paper shapes, never liquid. Only the objects this shot describes are in frame, and none of them has a face, eyes, arms, or legs.";
// Folk cut-out puppets: same idea — the medium restated as a binding last line, since image and video
// models drift toward 3D shading and uneven, brush-weight outlines.
export const FOLK_IMAGE_STYLE =
  "Rendering style, binding for the whole frame: a flat, hand-painted Telugu folk-art illustration in the Cheriyal scroll and Kalamkari tradition — flat colour fills with no 3D shading, no gradients and no photographic texture; every single element outlined in one uniform black line of the same medium weight everywhere (never bolder in one place and thinner in another); figures are flat jointed cut-out puppets; ornate patterned borders; a faint cloth texture over everything. Everything — foreground and background — is in the same crisp sharp focus with no blur and no depth of field (ignore any lens or focus wording); faces and bodies are flat colour with no painted shading or highlights; every figure, near or far, has exactly the same outline weight. People have natural warm brown skin tones (never green, blue or yellow faces). No gods, deities, temple idols or religious figures anywhere — only ordinary villagers. The dragon, whenever it appears, is KoriKey red.";
export const FOLK_VIDEO_STYLE =
  "Everything stays a flat hand-painted folk-art illustration for the whole clip, with the same uniform black outlines. The characters are flat jointed cut-out puppets: they move in small stepped poses — limbs swinging from their pins, heads tilting, bodies sliding and bobbing — and never turn in 3D. The camera and the painted set never change.";
export const STOP_MOTION_VIDEO_STYLE =
  "Everything stays handmade paper craft for the whole clip — cut paper, crepe paper and card, never real food or liquid. Objects move like stop-motion puppets: small deliberate hops, slides and wobbles, then they hold still; the camera and the set never change. Every object keeps its exact shape from the first frame — it never grows faces, eyes, mouths, arms, legs, or feet, and never bends or melts; its personality comes only from how it hops and tilts.";

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
