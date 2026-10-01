import { GoogleGenAI, Type } from "@google/genai";
import { type CreativeBrief, endCardSeconds, footageSeconds, MAX_CUT_SECONDS, MIN_CUT_SECONDS, LOOK_DIRECTION, type ShotPlan, TONE_DIRECTION, TONE_MUSIC, VOICEOVER_LANGUAGE_NAMES, VOICEOVER_WORDS_PER_SECOND } from "./creative-brief";
import { CATEGORY_PLAYBOOKS, CRAFT_RULES } from "./ad-craft";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";
import { checkScriptAgainstDials } from "./dials";
import { type AdStrategy, auditScript, strategyDirection } from "./strategy";
import { type BrandContext, colorName } from "./prompt-refiner";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({
      vertexai: true,
      project: env.googleCloudProjectId,
      location: env.textLocation,
    })
  : null;

// One shot as a production treatment: every field a cinematographer, performer, and gaffer would
// need, so the image and video prompts describe a real, deliberate commercial shot rather than a
// one-line idea.
export interface ShotSpec {
  // The shot's job in the story (e.g. "problem: the overwhelm of choosing a college").
  purpose: string;
  // Shot size, camera height and angle, subject placement, and where the negative space sits.
  framing: string;
  // Focal length and depth of field.
  lens: string;
  // Rig, direction, speed, and when the move starts — or "locked-off" for a static frame.
  movement: string;
  // The one visible action, with the setting detail in frame.
  action: string;
  // Emotion beat, eyes, posture, hands, and small natural movements; null when nobody is in frame.
  performance: string | null;
  // This shot's light, consistent with the film's lighting setup.
  lighting: string;
  // Narration spoken over this shot; null when it has none (or the ad has no voiceover).
  voLine: string | null;
  // Stop-motion look: how this shot hands to the next in the edit (paper tear, fold, slide-in).
  transition?: string | null;
  // Screen-insert shot: index of the client's product screen shown full-frame instead of generated
  // footage; null for every live-action shot.
  screen: number | null;
  // Sound effect for the edit (e.g. "soft trackpad click"); null when the shot has none.
  sfx: string | null;
  // Variable-length ads: this shot's length in the edit, timed to its action by the director.
  seconds?: number | null;
}

// The film's fixed visual bible, split by department so nothing is left vague.
export interface LookSheet {
  productionDesign: string;
  characters: string;
  props: string;
  environment: string;
  lighting: string;
  grade: string;
  // Things that must never appear (sent to the video model's negative prompt, never the image
  // prompt — image models paint what they read).
  exclusions: string;
}

// What must stay identical from shot to shot — separately generated shots drift without it.
export interface Continuity {
  characters: string;
  props: string;
  environment: string;
}

export interface AdScript {
  // The single idea or human insight the film is built on.
  idea: string;
  look: LookSheet;
  // The look sheet flattened for the prompt refiners, which repeat it into every shot.
  lookSheet: string;
  continuity: Continuity;
  // Room tone under the whole film (the per-shot effects are in each shot's spec).
  soundAmbience: string;
  // The end card's supporting line under the brand name.
  endCardTagline: string | null;
  // Each shot's composed description (what the refiners read), its treatment, and the names of the
  // reference assets (characters / product / location) visible in it.
  shots: { description: string; spec: ShotSpec; assetNames: string[] }[];
  // With a strategy: each supervisor round's failures (the last round is empty when it passed).
  audit?: string[][];
  // Recurring people to generate a character sheet for (only when requested).
  characters: { name: string; description: string }[];
  // Instrumental score description for the music model, matched to the film's arc and tone.
  musicPrompt: string;
  // Narration (the shots' VO lines in order), only when the brief asked for a voiceover.
  voiceoverScript: string | null;
  // How the narration is performed: voice age, accent, pace, energy, pauses, emphasis.
  voiceoverDirection: string | null;
}

export interface ScriptAsset {
  kind: "character" | "product" | "location";
  name: string;
  description: string | null;
}

export interface ScriptOptions {
  brand?: BrandContext;
  assets?: ScriptAsset[];
  // Pro: define every recurring person so a character sheet can be generated before the shots.
  characterSheet?: boolean;
  // The ad direction team's signed-off strategy (proposition, device, dials); absent = the
  // director works from the brief alone.
  strategy?: AdStrategy;
}

const STRING = { type: Type.STRING };
const NULLABLE_STRING = { type: Type.STRING, nullable: true };

const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    idea: STRING,
    look_sheet: {
      type: Type.OBJECT,
      properties: {
        production_design: STRING,
        characters: STRING,
        props: STRING,
        environment: STRING,
        lighting: STRING,
        grade: STRING,
        exclusions: STRING,
      },
      required: ["production_design", "characters", "props", "environment", "lighting", "grade", "exclusions"],
    },
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          purpose: STRING,
          framing: STRING,
          lens: STRING,
          movement: STRING,
          action: STRING,
          performance: NULLABLE_STRING,
          lighting: STRING,
          vo_line: NULLABLE_STRING,
          screen: { type: Type.INTEGER, nullable: true },
          sfx: NULLABLE_STRING,
          transition: NULLABLE_STRING,
          seconds: { type: Type.NUMBER, nullable: true },
          assets: { type: Type.ARRAY, items: STRING },
        },
        required: ["purpose", "framing", "lens", "movement", "action", "lighting", "assets"],
      },
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: STRING, description: STRING },
        required: ["name", "description"],
      },
    },
    continuity: {
      type: Type.OBJECT,
      properties: { characters: STRING, props: STRING, environment: STRING },
      required: ["characters", "props", "environment"],
    },
    sound_ambience: STRING,
    end_card_tagline: STRING,
    music_prompt: STRING,
    voiceover_direction: NULLABLE_STRING,
  },
  required: ["idea", "look_sheet", "continuity", "shots", "sound_ambience", "end_card_tagline", "music_prompt"],
};

// What the prompt refiners read for a shot: the treatment as one paragraph, camera first (Veo
// weights the start of a prompt most).
const sentence = (s: string) => s.trim().replace(/[.\s]+$/, "") + ".";

export function composeShot(spec: ShotSpec): string {
  if (spec.screen !== null) return `SCREEN INSERT — the product's real screen, full frame. ${sentence(spec.framing)} ${sentence(spec.movement)} ${spec.action}`;
  return [
    `${sentence(spec.framing)} ${sentence(spec.lens)} ${sentence(spec.movement)}`,
    spec.action,
    spec.performance && `Performance: ${spec.performance}`,
    `Light: ${spec.lighting}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function composeLookSheet(look: LookSheet, continuity: Continuity): string {
  return [
    `Set: ${look.productionDesign}`,
    `People: ${look.characters}`,
    `Props: ${look.props}`,
    `Environment: ${look.environment}`,
    `Lighting setup: ${look.lighting}`,
    `Grade: ${look.grade}`,
    `Continuity — keep identical in every shot: ${continuity.characters}; ${continuity.props}; ${continuity.environment}`,
  ].join("\n");
}

// Each shot's job in a short ad, by position — hook the scroll, build, land on the product.
function beatFor(index: number, count: number): string {
  if (count === 1) return "SINGLE SHOT — one continuous shot that hooks immediately and ENDS on a clear hero shot of the product";
  if (index === 0) return "HOOK — an arresting first image that stops the scroll within a second";
  if (index === count - 1) return "PAYOFF — resolves the idea and ENDS on the product's payoff: a hero shot of the product itself when it is a physical product (clearly visible, filling much of the frame), or the person living the result when it is software or a service";
  return index === count - 2 ? "TURN — the key moment of the idea, the benefit felt" : "BUILD — develops the idea, one new piece of the story";
}

// The single brief shared by the writing and critique passes, so both judge against the same
// direction.
function directionBrief(concept: string, brief: CreativeBrief, plan: ShotPlan, options: ScriptOptions): string {
  const { brand, assets = [] } = options;
  const hasProductAsset = assets.some((a) => a.kind === "product");
  const lines = [
    `Client concept: "${concept}"`,
    brief.format === "single"
      ? `Length: ONE continuous ${plan.clipSeconds}s shot (no cuts), then a branded end card (logo + key message) is added automatically, so the shot must not attempt one.`
      : brief.variableShots
      ? `Length: ${Math.round(footageSeconds(brief) + endCardSeconds(brief))}s total — ${plan.shotCount} shots totalling ${footageSeconds(brief).toFixed(1)}s in the final edit, each as long as its action needs (${MIN_CUT_SECONDS}–${MAX_CUT_SECONDS}s: a quick detail ~2s, a reveal or a move through space 4–6s), then a branded end card (logo + key message) is added automatically, so the shots must not attempt one.`
      : `Length: ${Math.round(footageSeconds(brief) + endCardSeconds(brief))}s total — ${plan.shotCount} shots of ~${plan.cutSeconds.toFixed(1)}s each in the final edit, then a branded end card (logo + key message) is added automatically, so the shots must not attempt one.`,
    `Tone: ${TONE_DIRECTION[brief.tone]}`,
    `Look: ${LOOK_DIRECTION[brief.look]}`,
    brief.audience && `Audience: ${brief.audience} — cast, setting, and emotional angle should feel true to them.`,
    brief.keyMessage && `Key message the film must make the viewer feel (it appears as text on the end card only): ${brief.keyMessage}`,
    brief.mustShow && `MUST SHOW (include these concretely across the shots): ${brief.mustShow}`,
    brief.avoid && `MUST AVOID (the client explicitly does not want any of this anywhere in the film): ${brief.avoid}`,
    brief.onScreenText.length > 0 &&
      `On-screen text the editor will typeset over the footage (${brief.format === "single" ? "one line after another over the shot" : "one line per shot, starting with shot 2"}): ${brief.onScreenText.map((l) => `"${l}"`).join(", ")} — ${brief.format === "single" ? "the shot needs a calm, uncluttered area in its lower third" : "those shots need a calm, uncluttered area in the lower third, and their visuals should support what the line says"} — describe that area only as plain, uncluttered space; never mention text, words, titles, or copy in a shot, since the image model paints whatever lettering it reads about.`,
    brief.voiceoverScript && `FIXED NARRATION (the client's own voiceover, spoken over the film — the visuals must follow and support it, beat by beat): "${brief.voiceoverScript}"`,
    brand?.productName && `Brand (context only — never write this name anywhere): ${brand.productName}`,
    brand?.primaryColor && `Brand colors to echo subtly in the palette: ${[brand.primaryColor, brand.secondaryColor].filter((c): c is string => Boolean(c)).map(colorName).join(", ")}`,
    brand?.brandRules && `MANDATORY brand rules: ${brand.brandRules}`,
    assets.length > 0 &&
      `REFERENCE ASSETS — real photos the client supplied; every shot that shows one must match it exactly (its images are attached to those shots):\n${assets
        .map((a) => `- ${a.kind} "${a.name}"${a.description ? `: ${a.description}` : ""}`)
        .join("\n")}`,
    brief.screens.length > 0 &&
      `PRODUCT SCREENS — the product is software, and these are its real screens (supplied images, shown full-frame and never regenerated):\n${brief.screens
        .map((sc, i) => `- screen ${i}: ${sc.description ?? "product screen"}`)
        .join("\n")}\nUse one screen-insert shot (two at most) to show the product visibly doing its job at the moment the person turns to it — after they reach for it, before the change it causes. Never the first or the last shot (the last shot is the person, living the result). In live shots the device's screen stays angled away.`,
    options.characterSheet &&
      "CHARACTER SHEET: every recurring person who is not already a reference asset must be listed in `characters` — a reference image is generated for each before shooting, so the same face, hair, and wardrobe carry through every shot.",
  ].filter(Boolean);

  const beats = Array.from({ length: plan.shotCount }, (_, i) => `Shot ${i + 1}: ${beatFor(i, plan.shotCount)}`).join("\n");

  return `${lines.join("\n")}

Shot structure:
${beats}

Hard rules:
- ${brief.variableShots
    ? `Each shot is ONE simple, clear action, and its length (seconds) is what that action needs to read — vary the rhythm like a real editor (quick detail cuts, longer hero moments). The AI video model renders a little longer than each cut and the edit keeps the best part — no multi-step choreography, no crowds doing complex things.`
    : `Each shot is ONE simple, clear action that reads in ~${plan.cutSeconds.toFixed(1)}s (the AI video model renders ${plan.clipSeconds}s and the edit keeps the best part) — no multi-step choreography, no crowds doing complex things.`}
- Consecutive shots must cut together as one film: same people, same product, same location, time of day, and weather; vary shot sizes (wide / medium / close / macro) and cut on motion like a real editor.
- Nothing written or printed may appear in the generated footage: no text, titles, labels, signage, screens with words, packaging copy, or numbers — express everything visually.${brief.screens.length ? " The one exception is SCREEN INSERT shots, which show the client's real product screens (see PRODUCT SCREENS) — the only place the interface ever appears." : ""}
- ${hasProductAsset ? "The product is the client's real product (see REFERENCE ASSETS) — keep its genuine design and branding exactly; no other brand names or logos anywhere." : "No brand names, logos, or real products' signature designs."}
- The shots are silent footage: nobody speaks on camera, no lip-synced dialogue. Music${brief.voiceover ? " and a voiceover are" : " is"} added in the edit.

${CRAFT_RULES}

${CATEGORY_PLAYBOOKS}${options.strategy ? `\n\n${strategyDirection(options.strategy)}` : ""}`;
}

// Roughly 2.3 spoken words per second leaves room to breathe. The narration is written per shot
// (vo_line) so each line lands on its picture; the lines together end before the end card.
function voiceoverSpec(brief: CreativeBrief, plan: ShotPlan): string {
  if (!brief.voiceover) return "- vo_line: null on every shot, and voiceover_direction: null (no voiceover for this ad — music only).";
  if (brief.voiceoverScript) return "- vo_line: null on every shot (the client supplied the narration above; it is used as-is). voiceover_direction: how that narration should be performed (voice age, accent, pace, energy, pauses, which words to lean on).";
  const words = Math.round(plan.shotCount * plan.cutSeconds * VOICEOVER_WORDS_PER_SECOND);
  const perShot = Math.max(3, Math.round(plan.cutSeconds * VOICEOVER_WORDS_PER_SECOND));
  return `- vo_line: the narration spoken over that shot, in ${VOICEOVER_LANGUAGE_NAMES[brief.voiceoverLanguage]}${brief.voiceoverLanguage === "en" ? "" : " (native script, natural everyday phrasing — not a stiff translation)"}, at most ~${perShot} words so it fits the shot; null where the picture should breathe (the first shot usually lands silent). All lines together: at most ${words} words, read as one flowing piece, landing the key message by the last line. Only the words to be spoken — no stage directions or quotes; when the client concept gives characters their own spoken lines, write each such line as "NAME: line" (e.g. "DRAGON: …") so it can be voiced by that character, and narration without a prefix.
- voiceover_direction (~150 characters): how the narration is performed — voice age, accent, pace (words per minute), energy, where to pause, which words to lean on. Conversational, never announcer-like.`;
}

async function generateJson(contents: string): Promise<AdScript> {
  const response = await withRateLimitRetry("ad-script", () =>
    genAI!.models.generateContent({
      model: env.textModel,
      contents,
      config: { responseMimeType: "application/json", responseSchema: SCRIPT_SCHEMA },
    }),
  );
  const text = response.text;
  if (!text) throw new Error("Ad script returned no text");
  const parsed = JSON.parse(text) as {
    idea: string;
    look_sheet: { production_design: string; characters: string; props: string; environment: string; lighting: string; grade: string; exclusions: string };
    shots: { purpose: string; framing: string; lens: string; movement: string; action: string; performance?: string | null; lighting: string; vo_line?: string | null; screen?: number | null; sfx?: string | null; transition?: string | null; seconds?: number | null; assets?: string[] }[];
    continuity: { characters: string; props: string; environment: string };
    sound_ambience: string;
    end_card_tagline?: string | null;
    characters?: { name: string; description: string }[];
    music_prompt: string;
    voiceover_direction?: string | null;
  };
  const l = parsed.look_sheet;
  const look: LookSheet = {
    productionDesign: l.production_design,
    characters: l.characters,
    props: l.props,
    environment: l.environment,
    lighting: l.lighting,
    grade: l.grade,
    exclusions: l.exclusions,
  };
  const shots = (parsed.shots ?? []).map((shot) => {
    const spec: ShotSpec = {
      purpose: shot.purpose,
      framing: shot.framing,
      lens: shot.lens,
      movement: shot.movement,
      action: shot.action,
      performance: shot.performance?.trim() || null,
      lighting: shot.lighting,
      voLine: shot.vo_line?.trim() || null,
      screen: typeof shot.screen === "number" ? shot.screen : null,
      sfx: shot.sfx?.trim() || null,
      transition: shot.transition?.trim() || null,
      seconds: typeof shot.seconds === "number" ? shot.seconds : null,
    };
    return { description: composeShot(spec), spec, assetNames: shot.assets ?? [] };
  });
  const voLines = shots.map((s) => s.spec.voLine).filter((line): line is string => Boolean(line));
  const continuity: Continuity = parsed.continuity ?? { characters: "", props: "", environment: "" };
  return {
    idea: parsed.idea,
    look,
    lookSheet: composeLookSheet(look, continuity),
    continuity,
    soundAmbience: parsed.sound_ambience ?? "",
    endCardTagline: parsed.end_card_tagline?.trim() || null,
    shots,
    characters: parsed.characters ?? [],
    musicPrompt: parsed.music_prompt,
    voiceoverScript: voLines.length ? voLines.join(" ") : null,
    voiceoverDirection: parsed.voiceover_direction?.trim() || null,
  };
}

// The JSON handed back to the reviewer: the same shape the model wrote.
function toScriptJson(script: AdScript) {
  const l = script.look;
  return {
    idea: script.idea,
    look_sheet: { production_design: l.productionDesign, characters: l.characters, props: l.props, environment: l.environment, lighting: l.lighting, grade: l.grade, exclusions: l.exclusions },
    shots: script.shots.map(({ spec, assetNames }) => ({
      purpose: spec.purpose, framing: spec.framing, lens: spec.lens, movement: spec.movement, action: spec.action,
      performance: spec.performance, lighting: spec.lighting, vo_line: spec.voLine, screen: spec.screen, sfx: spec.sfx, transition: spec.transition ?? null, seconds: spec.seconds ?? null, assets: assetNames,
    })),
    continuity: script.continuity,
    sound_ambience: script.soundAmbience,
    end_card_tagline: script.endCardTagline,
    characters: script.characters,
    music_prompt: script.musicPrompt,
    voiceover_direction: script.voiceoverDirection,
  };
}

// Treatments written per ad before the judge picks one.
const SCRIPT_CANDIDATES = Number(process.env.SCRIPT_CANDIDATES ?? 3);

// The judge: which candidate treatment best meets the brief and the checklist. Falls back to the
// first candidate if the judge fails.
async function pickBestTreatment(candidates: AdScript[], direction: string, checklist: string): Promise<number> {
  try {
    const response = await withRateLimitRetry("ad-script-judge", () =>
      genAI!.models.generateContent({
        model: env.textModel,
        contents: `You are the executive creative director choosing which of ${candidates.length} production treatments for the same ad goes into production. Judge each against the brief and the checklist; the winner is the one with the fewest and least serious failures, and among equals the strongest idea and payoff.

${direction}

Checklist:
${checklist}

${candidates.map((c, i) => `CANDIDATE ${i}:\n${JSON.stringify(toScriptJson(c), null, 2)}`).join("\n\n")}

Return the winning candidate's number and one sentence on why.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.OBJECT, properties: { best: { type: Type.INTEGER }, reason: { type: Type.STRING } }, required: ["best"] },
        },
      }),
    );
    const { best, reason } = JSON.parse(response.text ?? "{}") as { best?: number; reason?: string };
    if (typeof best === "number" && best >= 0 && best < candidates.length) {
      console.log(`[ad-script] judge picked candidate ${best} of ${candidates.length}: ${reason ?? ""}`);
      return best;
    }
  } catch (err) {
    console.warn("[ad-script] judge failed, keeping the first candidate:", err instanceof Error ? err.message : err);
  }
  return 0;
}

// Director step for the Text -> Storyboard -> Video flow: writes a production treatment (look sheet
// by department, and per shot its purpose, camera, performance, light, and VO line) in the brief's
// tone and look, then a second pass critiques it against the brief and rewrites — the
// first draft reliably drifts toward spectacle and generic "AI ad" choices.
export async function generateAdScript(
  concept: string,
  brief: CreativeBrief,
  plan: ShotPlan,
  options: ScriptOptions = {},
): Promise<AdScript> {
  if (!genAI) {
    throw new Error("Text generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const direction = directionBrief(concept, brief, plan, options);
  const assetNames = (options.assets ?? []).map((a) => `"${a.name}"`);
  const stopMotion = brief.look === "stopmotion";
  const puppet = brief.look === "puppet";
  const folk = brief.look === "folkpuppet";
  const outputSpec = `Write a production treatment as JSON:
- idea (one sentence): the single idea or human insight the film turns on — not a feature list.
- look_sheet — the fixed visual bible, repeated into every shot, so be concrete (materials, colors, sizes), never generic ("modern", "minimal" alone mean nothing):
  - production_design (~300 chars): the set — surfaces and materials, furniture, wall and floor, windows and blinds, the few deliberate objects in frame, how much of the space is visible; an original unbranded product design with plain unmarked surfaces.
  - characters (~300 chars): every recurring person — age, ethnicity, build, face, hair, exact wardrobe and accessories; identical in every shot.
  - props (~200 chars): every recurring object (device, bottle, book, cup…) — model, size, color, finish, orientation; screens always angled away from camera or dark, never showing an interface.
  - environment (~250 chars): location, architecture style, landscaping, time of day, weather, how many people in the background and what they are doing; generic architecture, never an identifiable real institution.
  - lighting (~250 chars): the lighting setup — key light direction and size, fill level, rim or back light, practicals and window light, shadow hardness, color temperature; motivated by a real source.
  - grade (~150 chars): contrast, saturation, skin-tone treatment, shadow and highlight temperature, how the brand color reads — natural, true-to-life color unless the brief asks otherwise (no orange/golden or teal casts).
  - exclusions (~200 chars): comma-separated things that must never appear in this film — readable signage, crests, logos, clutter, cables, props that don't belong, plus this film's specific risks.
- shots: exactly ${plan.shotCount} shots in order, each:
  - purpose: the shot's job in the story plus the person's inner thought, e.g. "problem — 'I don't know how to do this'", "turn — 'oh, now I get it'", "payoff — 'I can do this myself'".
  - framing: shot size, camera height and angle, where the subject sits in frame and where the negative space is.
  - lens: focal length (24/35/50/85mm or macro) and depth of field.
  - movement: rig (locked-off tripod, slider, dolly, gimbal), direction, speed, and when it starts (e.g. "holds, then a slow 1-foot push-in"). Motivated by the action; one move per shot at most.
  - action (~200 chars): the one simple visible action and the setting detail in frame — visual only, no sound.
  - performance: the emotion beat written as observable behavior — where the eyes go, brow and mouth, posture, hands, breath and small natural movements (not emotion words alone); genuine, never posing to camera. null when nobody is in frame.
  - lighting: this shot's light within the setup above (e.g. "window key camera-left, soft screen glow on her face").
  ${voiceoverSpec(brief, plan).split("\n").join("\n  ")}
  - screen: ${brief.screens.length ? "for a SCREEN INSERT shot, the number of the PRODUCT SCREEN it shows (its framing is \"full-frame screen insert\", its movement a slow push-in, its action what the screen shows happening, performance null, lens and lighting \"n/a\"); null for every live shot" : "null on every shot"}.
  - sfx: ${folk
    ? "one crisp, characterful sound the picture motivates (a thavil thud for the dragon's step, a morsing twang, a crowd gasp, a clay pot clink, a huge real crunch), or null — rooted in a South Indian village soundscape, never digital whooshes."
    : puppet
    ? "one tactile foley effect the picture motivates, like a real miniature set recorded up close (a wooden door creak, a clay pot set down, wings beating like leather flaps, a crowd murmur, a big real crunch), or null — handmade and warm, never digital whooshes."
    : stopMotion
    ? "one playful foley effect the picture motivates, crisp and tactile (a paper rustle, a card flap, a pop-up snapping open, a real crunch, a tabla tap on a hop), or null — handmade sounds, never digital whooshes."
    : "one subtle sound effect for the edit that the picture motivates (a pen set down on wood, a soft trackpad click, a page turn), or null — intimate and quiet, never techy whooshes."}
  - transition: ${folk
    ? "how this shot hands to the next in the edit, like a painted scroll being unrolled in a storyteller's performance (\"the next painted panel slides in from the right\", \"a painted border closes in like an iris\", \"cut on the action\"); mostly cuts on action, with one or two scroll moves where time or place jumps; null on the last shot. Never ask the shot itself to perform the transition."
    : puppet
    ? "how this shot hands to the next in the edit, like a classic storybook film (\"cut on the action\", \"a soft dissolve\", \"an iris closes to black like an old picture book\", \"the lantern light fades down\"); mostly cuts on action, with one or two storybook moves where time or place jumps; null on the last shot. Never ask the shot itself to perform the transition."
    : stopMotion
    ? "how this shot hands to the next in the edit, as a paper-cut move built from the two shots (e.g. \"a torn-paper edge rips across left to right revealing the next shot\", \"the frame folds shut like a card\", \"the next scene slides in as a paper layer from the top\", or \"cut on the hop\"); vary them across the film; null on the last shot. Never ask the shot itself to perform the transition."
    : "null on every shot."}
  - seconds: ${brief.variableShots ? `this shot's length in the final edit, ${MIN_CUT_SECONDS}–${MAX_CUT_SECONDS}, timed to its action; all shots together total ${footageSeconds(brief).toFixed(1)}.` : "null on every shot."}
  - assets: the exact names of the reference assets and characters visible in the shot${assetNames.length ? `, from: ${assetNames.join(", ")}${options.characterSheet ? " plus your characters" : ""}` : options.characterSheet ? ", i.e. your character names" : " — an empty list when there are none"}.
- continuity — what must stay identical across shots, as short comma-separated lists: characters (face, hair, wardrobe, accessories — and nothing added), props (each object's model, color, position), environment (the same room or place, light direction, time of day, weather).
- sound_ambience (~120 chars): the room tone under the whole film (a quiet apartment with faint city hum, a busy kitchen through a wall).
- end_card_tagline (at most 8 words): the supporting line shown under the brand name on the end card — the product in one phrase, using the client's words where possible (e.g. "Your personal AI tutor"). The key message is shown separately below it.
${options.characterSheet ? `- characters: each recurring person not already a reference asset — "name" (a short first name) and "description" (~250 characters: age, ethnicity, build, face, hair, and exact wardrobe; identical to the look sheet).` : "- characters: an empty list."}
- music_prompt (~250 characters): an instrumental score for exactly this film — genre, instruments, tempo, and how it moves with the arc (starts sparse, swells at the turn, resolves on the payoff), ending on one clean resolved final chord or motif that lands as the end card appears (the brand sting). Style direction for this tone: ${TONE_MUSIC[brief.tone]} — but if the client concept names a music style or instruments, that wins. Instrumental only, no vocals.`;

  const checklist = `${options.strategy ? `- Does the film deliver the CREATIVE STRATEGY: would a stranger repeat its proposition after one viewing, is it shown through its device, does every shot, cut, line and the music sit at its dial settings (humour, pace, camera energy, grade, copy, VO, music, sound), and is every concept conflict fixed as it says? Where the strategy and anything below disagree, the strategy wins.\n` : ""}- Does the first shot hook within 1–2 seconds (tight on a face or one striking image, brand color present), and does the treatment follow the CRAFT RULES and the matching CATEGORY PLAYBOOK?
- Is there one clear idea, and does every shot have a purpose that moves the story (problem → turn → payoff), or is it a generic montage of the person, the room and the product? Sharpen it.
- Would a viewer who has never heard of the brand understand what the product is and what it does for them by the end? If the brief has a voiceover, does at least one line state the product's real scope using the client concept's own words (e.g. "from school academics to SAT prep and college applications", not a paraphrase like "every subject and test"), and is every phrase concrete ("your first-choice university", not "your first choice")?
- Is the product shown as what it really is? A software, app or service product must never become an invented device or gadget — only the laptop or phone people already use. Does the product appear before the change it causes, and does the person make the final move themselves?
- Does the film serve the brief's GOAL, not just its tone? Read the client concept for what the ad must make people do (visit the restaurant, download the app, book a site visit, start a trial) and check the story leads there — e.g. a restaurant ad is set in or clearly about the restaurant, not a home kitchen.
- Is every person, place, and moment the client concept or brand rules explicitly name present, or deliberately and sensibly replaced? Don't silently drop them.
- Does the last shot pay off with the product's value made visible — the dish, the place, the outcome the service creates — rather than a closed device or an empty object? No text-like marks on any prop (equations, diagrams, handwriting, labels), since AI video renders them as garbled text.
- ${brief.screens.length ? "Is there exactly one (at most two) SCREEN INSERT shot, placed where the person turns to the product and before the change it causes — never first or last — with its screen number valid? " : ""}Does every prop earn its place (it is used, or it carries the story or the brand color on purpose)? Remove props that just sit there.
- Is the last shot distinctive — a new place or a new moment, not a repeat of an earlier setup? If the client concept or brand rules name where the product leads (a top global university, a first home, a finish line), the payoff shows the person there or visibly on the way (generic architecture, never a real institution's identifiable buildings or crests).
- Does the setting fit the person's life and the audience — e.g. a 17-year-old studies at home or at school, not inside a university library? Aspiration can live in the background or the final shot.
- Does the hero get the screen time its CATEGORY PLAYBOOK calls for (e.g. food for at least half the film)?
- Do the exclusions agree with the shots and the playbook? Nothing excluded may be something a shot uses (a screen glow the lighting relies on) or the category's signature detail (steam rising off hot food, a serum drop). Remove those from the exclusions.
- Does every shot honor the TONE and LOOK above? Remove any effect, glow, particle, transformation, or spectacle the Look does not allow.
- Is every field concrete enough to shoot — a real lens, a real move with a speed and a start, a lighting direction — or is anything vague ("cinematic", "modern", "soft light")? Make it specific.
- If people appear, is there a readable emotional arc across the shots, and do we see real faces and genuine expressions at least once (not only hands)?
- Is every shot one simple action that reads in ${brief.variableShots ? "its seconds" : `~${plan.cutSeconds.toFixed(1)}s`} and that an AI video model can render believably (no fast complex motion, crowds, hands doing fine work in close-up, or anyone talking)?
- Do the shots cut together — same people, wardrobe, props, place, time of day and light direction; varied shot sizes?${brief.variableShots ? `
- Do the shot lengths follow the action — short for a detail or a beat, longer for a reveal or a move — with a real rhythm (not all the same), and do they total ${footageSeconds(brief).toFixed(1)}s?` : ""}
- Does the last shot land the product's promise — the physical product as hero, or for software and services the person living the result? Is every MUST SHOW item included and every MUST AVOID item absent?
- Any readable text, signage, crests or logos (including real universities or companies), screens showing an interface${brief.screens.length ? " outside the SCREEN INSERT shots" : ""}, brand names, or on-camera dialogue? Remove it and make sure the exclusions cover it.
${folk ? `- FOLK CUT-OUT: does every shot read as a flat hand-painted Cheriyal/Kalamkari world with jointed cut-out puppets moving in stepped poses — never 3D, never CGI, never photographic (except the real pack)? Is each shot one clear puppet action with readable gesture and expression? Does the narration (and any character line) fit its shot's picture and length, in natural spoken Telugu? Is the real pack photographic and exact wherever it appears?
` : ""}${puppet ? `- PUPPET FILM: does every shot read as a real handmade miniature set with sculpted puppets (clay, wood, felt, fabric, practical lights), animated in stepped poses — never CGI, never real humans or animators' hands? Does every puppet act with a clear, readable face and gesture per shot, and does the story work with the sound off (no one lip-syncs)? Does the narration read as one warm story told aloud, fitting each shot's picture and length? Is the real pack photographic and exact wherever it appears (never sculpted or redrawn)?
` : ""}${stopMotion ? `- STOP-MOTION: is every shot a handmade paper-collage tabletop set (cut paper, card, printed cutouts, visible cut edges and layer shadows) with stepped object animation, and are there no people or hands anywhere? Do the objects perform — hop, slide, fold, pop up — with a clear gag or beat per shot? Is the real pack photographic and exact wherever it appears (never redrawn in paper)? Does every shot but the last have a transition, varied across the film? Are sfx handmade and playful?
` : ""}- Does the music prompt fit the tone and the arc, and follow any music the client concept names?${brief.voiceover && !brief.voiceoverScript ? " Does each vo_line fit its shot's length and picture, and does the narration read as one natural piece that lands the key message?" : ""}
- Does every shot's "assets" list name exactly the reference assets/characters visible in it (spelled exactly as given)?`;

  // One director draft plus the creative director's rewrite.
  const writeTreatment = async (): Promise<AdScript> => {
    const draft = await generateJson(`${folk
      ? "You are an award-winning Indian animation director known for folk-art cut-out films that bring Cheriyal scrolls, Kalamkari and Tholu Bommalata puppetry to the screen — witty, emotional and deeply Telugu, never generic AI spectacle. Write the production treatment as you would hand it to the illustrators, puppet riggers, animators, and editor; the 'performance' field is each puppet's gesture and expression."
      : puppet
      ? "You are an award-winning stop-motion puppet film director (think Laika, Aardman, Wes Anderson's Fantastic Mr Fox) known for emotional, handmade brand films that feel crafted and true to the brand — never generic AI spectacle. Write the production treatment as you would hand it to the puppet makers, set builders, animators, and editor; the 'performance' field is each puppet's acting — face, eyes, posture, gesture."
      : stopMotion
      ? "You are an award-winning stop-motion and paper-craft animation director known for witty, handmade product films that feel crafted and true to the brand — never generic AI spectacle. Write the production treatment for this ad as you would hand it to the set builder, animator, and editor; the 'performance' field is how the animated objects behave (null only when nothing in frame moves)."
      : "You are an award-winning commercial director known for ads that feel real, crafted, and true to the brand — never generic AI spectacle. Write the production treatment for this ad as a director would hand it to the cinematographer, performers, and editor."}

${direction}

${outputSpec}`);
    const reviewed = await generateJson(`You are a demanding executive creative director reviewing a director's treatment for an AI-generated ad before anything is shot. Check it against the brief, then return the corrected treatment in the same JSON shape (rewrite freely; keep what works).

${direction}

Review checklist — fix every failure:
${checklist}

${outputSpec}

Director's treatment to review:
${JSON.stringify(toScriptJson(draft), null, 2)}`);
    return reviewed.shots?.length === plan.shotCount && reviewed.look?.productionDesign && reviewed.musicPrompt ? reviewed : draft;
  };

  // Each writing run is a fresh draw that can drop a detail the last one got right, so several are
  // written in parallel and a judge keeps the one that best meets the brief and the checklist.
  const settled = await Promise.allSettled(Array.from({ length: SCRIPT_CANDIDATES }, writeTreatment));
  const candidates = settled.flatMap((r) => (r.status === "fulfilled" && r.value.shots.length === plan.shotCount ? [r.value] : []));
  if (!candidates.length) throw settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason ?? new Error("No usable ad script");
  let script = candidates.length === 1 ? candidates[0] : candidates[await pickBestTreatment(candidates, direction, checklist)];
  // With a strategy, the winner goes to the checks — the dials in code, then the script
  // supervisor — and back to the director with every failure, until it passes (two rewrites at most).
  if (options.strategy) {
    const strategy = options.strategy;
    const audit: string[][] = [];
    script.audit = audit;
    for (let round = 0; round < 3; round++) {
      const failures = [
        ...checkScriptAgainstDials(strategy.dials, script.shots.map((sh) => ({ seconds: sh.spec.seconds ?? null, movement: sh.spec.movement }))),
        ...(await auditScript(strategy, brief, toScriptJson(script)).catch((err) => {
          console.warn("[ad-script] audit failed:", err instanceof Error ? err.message : err);
          return [];
        })),
      ];
      audit.push(failures);
      console.log(`[ad-script] audit round ${round + 1}: ${failures.length} failure(s)`);
      if (!failures.length || round === 2) break;
      const fixed = await generateJson(`You are the director. The script supervisor and the dial checks failed your treatment. Fix EVERY failure below and return the whole corrected treatment in the same JSON shape; keep everything that passed.

${direction}

Failures to fix:
${failures.map((f) => `- ${f}`).join("\n")}

${outputSpec}

Your treatment:
${JSON.stringify(toScriptJson(script), null, 2)}`).catch(() => null);
      if (!fixed || fixed.shots.length !== plan.shotCount) break;
      script = fixed;
      script.audit = audit;
    }
  }
  // The user's own narration always wins over anything the model wrote; none when not requested.
  script.voiceoverScript = brief.voiceover ? brief.voiceoverScript ?? script.voiceoverScript : null;
  if (!brief.voiceover) script.voiceoverDirection = null;
  if (!options.characterSheet) script.characters = [];
  if (options.strategy) script.endCardTagline = options.strategy.tagline;
  // Asset names must match real assets/characters, or the shot would silently lose its references.
  const known = new Set([...(options.assets ?? []).map((a) => a.name), ...script.characters.map((c) => c.name)]);
  script.shots = script.shots.map((shot, i) => {
    // A screen insert needs a real supplied screen, and never opens or closes the film.
    const validScreen = shot.spec.screen !== null && shot.spec.screen >= 0 && shot.spec.screen < brief.screens.length && i > 0 && i < script.shots.length - 1;
    const spec = validScreen ? shot.spec : { ...shot.spec, screen: null };
    return { ...shot, spec, description: validScreen ? shot.description : composeShot(spec), assetNames: validScreen ? [] : shot.assetNames.filter((n) => known.has(n)) };
  });
  if (!Array.isArray(script.shots) || script.shots.length !== plan.shotCount) {
    throw new Error(`Expected ${plan.shotCount} shots, got ${script.shots?.length ?? 0}`);
  }
  return script;
}
