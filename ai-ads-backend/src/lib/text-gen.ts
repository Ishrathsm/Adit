import { GoogleGenAI, Type } from "@google/genai";
import { type CreativeBrief, LOOK_DIRECTION, type ShotPlan, TONE_DIRECTION, TONE_MUSIC, VOICEOVER_LANGUAGE_NAMES, VOICEOVER_WORDS_PER_SECOND } from "./creative-brief";
import { env } from "./env";
import type { BrandContext } from "./prompt-refiner";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({
      vertexai: true,
      project: env.googleCloudProjectId,
      location: env.googleCloudLocation,
    })
  : null;

export interface AdScript {
  // Fixed visual bible every shot's prompts repeat verbatim — separately generated shots only read
  // as one film if the product, people, place, palette, light, and lens are described identically
  // each time (Google's own Veo 3.1 guidance for multi-shot consistency).
  lookSheet: string;
  // Each shot's description plus the names of the reference assets (characters / product /
  // location) visible in it, so each keyframe is generated with just those references.
  shots: { description: string; assetNames: string[] }[];
  // Recurring people to generate a character sheet for (only when requested).
  characters: { name: string; description: string }[];
  // Instrumental score description for the music model, matched to the film's arc and tone.
  musicPrompt: string;
  // Narration, only when the brief asked for a voiceover.
  voiceoverScript: string | null;
}

// Real reference images the client uploaded (Pro) — described so the director can build the film
// around them.
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
}

const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    look_sheet: { type: Type.STRING },
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          assets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["description", "assets"],
      },
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
        required: ["name", "description"],
      },
    },
    music_prompt: { type: Type.STRING },
    voiceover_script: { type: Type.STRING, nullable: true },
  },
  required: ["look_sheet", "shots", "music_prompt"],
};

// Each shot's job in a short ad, by position — hook the scroll, build, land on the product.
function beatFor(index: number, count: number): string {
  if (index === 0) return "HOOK — an arresting first image that stops the scroll within a second";
  if (index === count - 1) return "PAYOFF — resolves the idea and ENDS on a hero shot of the product itself (clearly visible, filling much of the frame)";
  return index === count - 2 ? "TURN — the key moment of the idea, the benefit felt" : "BUILD — develops the idea, one new piece of the story";
}

// The single brief shared by the writing and critique passes, so both judge against the same
// direction.
function directionBrief(concept: string, brief: CreativeBrief, plan: ShotPlan, options: ScriptOptions): string {
  const { brand, assets = [] } = options;
  const hasProductAsset = assets.some((a) => a.kind === "product");
  const lines = [
    `Client concept: "${concept}"`,
    `Length: ${brief.lengthSeconds}s total — ${plan.shotCount} shots of ~${plan.cutSeconds.toFixed(1)}s each in the final edit, then a branded end card (logo + key message) is added automatically, so the shots must not attempt one.`,
    `Tone: ${TONE_DIRECTION[brief.tone]}`,
    `Look: ${LOOK_DIRECTION[brief.look]}`,
    brief.audience && `Audience: ${brief.audience} — cast, setting, and emotional angle should feel true to them.`,
    brief.keyMessage && `Key message the film must make the viewer feel (it appears as text on the end card only): ${brief.keyMessage}`,
    brief.mustShow && `MUST SHOW (include these concretely across the shots): ${brief.mustShow}`,
    brief.avoid && `MUST AVOID (the client explicitly does not want any of this anywhere in the film): ${brief.avoid}`,
    brief.onScreenText.length > 0 &&
      `On-screen text the editor will typeset over the footage (one line per shot, starting with shot 2): ${brief.onScreenText.map((l) => `"${l}"`).join(", ")} — those shots need calm, uncluttered areas where a line of text can sit, and their visuals should support what the line says.`,
    brief.voiceoverScript && `FIXED NARRATION (the client's own voiceover, spoken over the film — the visuals must follow and support it, beat by beat): "${brief.voiceoverScript}"`,
    brand?.productName && `Brand (context only — never write this name anywhere): ${brand.productName}`,
    brand?.primaryColor && `Brand colors to echo subtly in the palette: ${[brand.primaryColor, brand.secondaryColor].filter(Boolean).join(", ")}`,
    brand?.brandRules && `MANDATORY brand rules: ${brand.brandRules}`,
    assets.length > 0 &&
      `REFERENCE ASSETS — real photos the client supplied; every shot that shows one must match it exactly (its images are attached to those shots):\n${assets
        .map((a) => `- ${a.kind} "${a.name}"${a.description ? `: ${a.description}` : ""}`)
        .join("\n")}`,
    options.characterSheet &&
      "CHARACTER SHEET: every recurring person who is not already a reference asset must be listed in `characters` — a reference image is generated for each before shooting, so the same face, hair, and wardrobe carry through every shot.",
  ].filter(Boolean);

  const beats = Array.from({ length: plan.shotCount }, (_, i) => `Shot ${i + 1}: ${beatFor(i, plan.shotCount)}`).join("\n");

  return `${lines.join("\n")}

Shot structure:
${beats}

Hard rules:
- Each shot is ONE simple, clear action that reads in ~${plan.cutSeconds.toFixed(1)}s (the AI video model renders ${plan.clipSeconds}s and the edit keeps the best part) — no multi-step choreography, no crowds doing complex things.
- Consecutive shots must cut together as one film: same people, same product, same location, time of day, and weather; vary shot sizes (wide / medium / close / macro) and cut on motion like a real editor.
- Nothing written or printed may appear on screen: no text, titles, labels, signage, screens with words, packaging copy, or numbers — express everything visually.
- ${hasProductAsset ? "The product is the client's real product (see REFERENCE ASSETS) — keep its genuine design and branding exactly; no other brand names or logos anywhere." : "No brand names, logos, or real products' signature designs."}
- The shots are silent footage: nobody speaks on camera, no lip-synced dialogue. Music${brief.voiceover ? " and a voiceover are" : " is"} added in the edit.`;
}

// Roughly 2.3 spoken words per second leaves room to breathe; narration starts just after the
// first shot lands and ends before the end card's last beat.
function voiceoverSpec(brief: CreativeBrief, plan: ShotPlan): string {
  if (!brief.voiceover) return "4. voiceover_script: null (no voiceover for this ad — music only).";
  if (brief.voiceoverScript) return "4. voiceover_script: null (the client supplied the narration above; it is used as-is).";
  const words = Math.round(plan.shotCount * plan.cutSeconds * VOICEOVER_WORDS_PER_SECOND);
  return `4. voiceover_script: the narration, written in ${VOICEOVER_LANGUAGE_NAMES[brief.voiceoverLanguage]}${brief.voiceoverLanguage === "en" ? "" : " (native script, natural everyday phrasing — not a stiff translation)"}, at most ${words} words, spoken over the whole film in the tone above; it should land the key message by the end. No stage directions, speaker names, or quotes — only the words to be spoken.`;
}

async function generateJson(contents: string): Promise<AdScript> {
  const response = await genAI!.models.generateContent({
    model: env.textModel,
    contents,
    config: { responseMimeType: "application/json", responseSchema: SCRIPT_SCHEMA },
  });
  const text = response.text;
  if (!text) throw new Error("Ad script returned no text");
  const parsed = JSON.parse(text) as {
    look_sheet: string;
    shots: { description: string; assets?: string[] }[];
    characters?: { name: string; description: string }[];
    music_prompt: string;
    voiceover_script?: string | null;
  };
  return {
    lookSheet: parsed.look_sheet,
    shots: (parsed.shots ?? []).map((shot) => ({ description: shot.description, assetNames: shot.assets ?? [] })),
    characters: parsed.characters ?? [],
    musicPrompt: parsed.music_prompt,
    voiceoverScript: parsed.voiceover_script?.trim() || null,
  };
}

// Director step for the Text -> Storyboard -> Video flow: writes a look sheet plus shot list in the
// brief's tone and look, then a second pass critiques it against the brief and rewrites — the
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
  const outputSpec = `Write:
1. look_sheet (~500 characters): the fixed visual bible — the exact product/subject design (form, materials, colors; an original unbranded design with plain unmarked surfaces), every recurring person (age, ethnicity, build, hair, wardrobe — identical every shot), the location, time of day and weather, the color palette, lighting character (natural, true-to-life color unless the brief asks otherwise — no heavy orange/golden or teal casts), and lens/film look. Precise and concrete; it is repeated verbatim into every shot.
2. shots: exactly ${plan.shotCount} shots in order. For each: "description" (~250 characters: shot size and camera move, the one action, and the setting detail — visual only, no sound) and "assets" (the exact names of the reference assets and characters visible in that shot${assetNames.length ? `, from: ${assetNames.join(", ")}${options.characterSheet ? " plus your characters" : ""}` : options.characterSheet ? ", i.e. your character names" : " — an empty list when there are none"}).
${options.characterSheet ? `2b. characters: each recurring person not already a reference asset — "name" (a short first name) and "description" (~250 characters: age, ethnicity, build, face, hair, and exact wardrobe; identical to how the look sheet describes them).` : "2b. characters: an empty list."}
3. music_prompt (~250 characters): an instrumental score for exactly this film — genre, instruments, tempo, and how it moves with the arc (e.g. starts sparse, swells at the turn, resolves on the payoff). Style direction for this tone: ${TONE_MUSIC[brief.tone]}. Instrumental only, no vocals.
${voiceoverSpec(brief, plan)}`;

  const draft = await generateJson(`You are an award-winning commercial director known for ads that feel real, crafted, and true to the brand — never generic AI spectacle. Plan this ad.

${direction}

${outputSpec}`);

  const reviewed = await generateJson(`You are a demanding executive creative director reviewing a director's plan for an AI-generated ad before anything is shot. Check it against the brief, then return the corrected plan in the same JSON shape (rewrite freely; keep what works).

${direction}

Review checklist — fix every failure:
- Does every shot honor the TONE and LOOK above? Remove any effect, glow, particle, transformation, or spectacle the Look does not allow.
- Is there a clear single idea and emotional arc, or is it a generic montage? Sharpen it.
- If people appear, do we see real faces and genuine expressions at least once (not only hands/legs)?
- Any smoke, haze, dust, particles, light rays, or heavy color cast the brief didn't ask for? Remove it.
- Is every shot one simple action that reads in ~${plan.cutSeconds.toFixed(1)}s and that an AI video model can render believably?
- Do the shots cut together (same people, product, place, time of day; varied shot sizes)?
- Does the last shot end on a clear hero shot of the product? Is every MUST SHOW item actually included, and is every MUST AVOID item absent?
- Any on-screen text, signage, screens with words, brand names, or on-camera dialogue? Remove it.
- Does the music prompt fit the tone and the film's arc?${brief.voiceover && !brief.voiceoverScript ? " Is the voiceover natural, within the word limit, and does it land the key message?" : " Is voiceover_script null?"}
- Is the look sheet concrete enough that two separately generated shots would match?
- Does every shot's "assets" list name exactly the reference assets/characters visible in it (spelled exactly as given)?

${outputSpec}

Director's plan to review:
${JSON.stringify({ look_sheet: draft.lookSheet, shots: draft.shots.map((s) => ({ description: s.description, assets: s.assetNames })), characters: draft.characters, music_prompt: draft.musicPrompt, voiceover_script: draft.voiceoverScript }, null, 2)}`);

  const script = reviewed.shots?.length === plan.shotCount && reviewed.lookSheet && reviewed.musicPrompt ? reviewed : draft;
  // The user's own narration always wins over anything the model wrote; none when not requested.
  script.voiceoverScript = brief.voiceover ? brief.voiceoverScript ?? script.voiceoverScript : null;
  if (!options.characterSheet) script.characters = [];
  // Asset names must match real assets/characters, or the shot would silently lose its references.
  const known = new Set([...(options.assets ?? []).map((a) => a.name), ...script.characters.map((c) => c.name)]);
  script.shots = script.shots.map((shot) => ({ ...shot, assetNames: shot.assetNames.filter((n) => known.has(n)) }));
  if (!Array.isArray(script.shots) || script.shots.length !== plan.shotCount) {
    throw new Error(`Expected ${plan.shotCount} shots, got ${script.shots?.length ?? 0}`);
  }
  return script;
}
