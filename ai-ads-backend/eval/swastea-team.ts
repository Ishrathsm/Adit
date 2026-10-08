// Swastea replan (user, 2026-10-08), after cut 1 was rejected: "not film like", "cuts are very
// amateurish", words not pronounced clearly, the brand said wrong, camera and direction weak, music
// should use santoor, the dhirena "starting and ending abruptly", pace "sometimes fast and sometimes
// laggy". Every role works from the user's notes and the researcher's findings; the supervisor
// critiques the combined plan; the director revises. Text only, no generation.
// `npx tsx eval/swastea-team.ts` → eval/out/swastea-team/*.md + plan.json
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const out = join(__dirname, "out", "swastea-team");

const STORY = `Swastea: a herbal tea powder of ginger (adrak), ashwagandha and tulsi. Fictional brand, 30-second Indian TV film, 16:9, Hinglish. The user's own story: a young bachelor with a cold, living alone in a rented flat, knocks on the elderly couple next door: "Aunty, thodi adrak milegi?" and sneezes. Aunty: "Lagta hai zukaam hai. Andar aao, beta." In her kitchen she makes chai with Swastea. He sips, eyes closed, and feels relief and comfort ("Aah… kitna aaram mila"), then, a little homesick: "Aunty… bilkul maa ke haath jaisi." Aunty shows the pack: made with adrak, ashwagandha and tulsi. End line: "Swastea. Roj piyo, swasth raho." Cast is fixed: the bachelor (navy hoodie over grey t-shirt, messy hair, stubble), Aunty (grey bun, red bindi, maroon cotton saree, reading glasses on a chain), Uncle (grey moustache, rimless glasses, cream kurta, brown sweater vest). A bright, colourful, cared-for middle-class flat, sunny morning. Tone: sincere and warm, NO humour.`;

const USER_NOTES = `The user's notes on cut 1, verbatim and in full:
"its swastea - like tea is spelled as .. and the shots they are not film like ..and cuts are very ameturish and they are not pronouncing words clealry take care of that and camera and directions they are also net to be improved , use santoor music instrument ,,, that dhirena is bad too just starting and ending abruptly , the video is not smoothly written , sometimes its fast and sometimes its laggy ... replan it again and redo this with meticuluosly diacussing with all the team"
Meaning:
- The brand is said "Swas-TEA": "swas" then the English word "tea". Cut 1 had "Swaas-tik" and "Swasthya".
- Shots looked like flat, static TV frames, not cinema.
- The cuts were amateurish.
- Words were not clearly pronounced.
- The camera work and direction need to improve.
- The score should be santoor-led.
- The women's "dhi-re-naaa" chorus on the sip started and ended abruptly.
- The rhythm was uneven, sometimes rushed and sometimes dragging: cut 1 sped dialogue clips 1.15x but left the sip at 1.0x, and had long dead pauses inside lines.
Standing preferences:
- No humour.
- Brisk, natural speech, never slow.
- About 7–8 shots of 2.5–4s in 30s for storytelling.
- Soft dissolves are fine, with no flashy effects, smoke or sparkles.
- Neutral, natural colour.
- Motion must be physically believable.
- The faint "dhi-re-naaa" women's chorus plays ONLY while he drinks, softly in the background.`;

const CONSTRAINTS = `Production constraints (be practical):
- Each shot is made by an image model (keyframe) and then Veo 3.1 (image-to-video, 8s max, 720p 24fps, with native audio: the people's voices with lip sync).
- Veo does well with ONE clear action and ONE simple camera move per clip (slow dolly-in, slow push, gentle pan, rack focus, locked-off). It does badly with complex choreography, two speakers in one clip, long lines and fast moves. It mumbles or drifts on words it doesn't know: brand names, rare words.
- Veo keeps wardrobe only if the keyframe shows it; people entering frame can arrive in the wrong clothes.
- Veo added its own music and narrators when not told otherwise.
- At most ~8–10 words per clip of speech, one speaker per clip.
- Music: Google Lyria makes ~30s instrumental pieces from a prompt (it can sing wordless vocals but not exact words).
- Gemini TTS gives a clean, controllable female voice for any voice-over.
- The edit is done with ffmpeg: cuts, dissolves, J/L-cuts, audio fades, grading LUT-style colour, film grain and supers are all possible. Speed changes on dialogue look and sound wrong.`;

async function ask(role: string, prompt: string, search = false): Promise<string> {
  const r = await withRateLimitRetry(role, () =>
    ai.models.generateContent({ model: env.textModel, contents: prompt, ...(search ? { config: { tools: [{ googleSearch: {} }] } } : {}) }),
  );
  const text = r.text?.trim() ?? "";
  writeFileSync(join(out, `${role}.md`), text);
  console.log(`--- ${role} done (${text.length} chars)`);
  return text;
}

(async () => {
  mkdirSync(out, { recursive: true });
  const base = `${STORY}\n\n${USER_NOTES}\n\n${CONSTRAINTS}`;

  // 1. Researcher: how the best Indian tea films are shot, cut, scored and voiced.
  const research = await ask("1-researcher", `You are the agency researcher. ${base}

Using Google Search, study how the best-loved Indian tea and chai TV commercials are made: Brooke Bond Red Label (e.g. "Swad Apnepan Ka", neighbour/stranger stories), Tata Tea ("Jaago Re", Tata Tea Premium), Wagh Bakri, Taj Mahal Tea, Society Tea, Girnar. Also look at what makes Indian neighbour/kindness films emotionally work.
Report concrete, usable craft findings:
(a) Cinematography: lenses, depth of field, camera movement, light, colour.
(b) Coverage and shot sizes per scene.
(c) Editing rhythm: average shot length, cutting on action, J/L-cuts, where they hold.
(d) Music: santoor and other instruments, how the score builds to the emotional beat and resolves on the pack.
(e) Dialogue delivery: how lines are kept short and clear.
(f) How the brand name is spoken and shown at the end.
Cite ads by name. Finish with the 10 most important rules for this film.`, true);

  // 2. The craft heads, in parallel, each from the research.
  const brief = `${base}\n\nRESEARCH (from the researcher):\n${research}`;
  const [director, writer, editor, music] = await Promise.all([
    ask("2-director-dop", `You are the film director working with the director of photography. ${brief}

Design the film as cinema, not TV. Give a shot list of 7–9 shots totalling 30s. For each shot give:
- Number, duration and purpose (the story beat).
- Shot size and lens (mm), camera height and angle.
- ONE camera move with speed. Each move must be achievable by Veo from a single keyframe.
- Blocking: who is where and doing what, with one action only.
- Light: motivated source, direction, quality.
- Depth of field and focus.
- Who speaks, if anyone.
- How it cuts into the next shot.
- What the KEYFRAME image must show, so that wardrobe and continuity hold. Never have a person enter frame unseen; everyone must be in the keyframe.
Also define:
- A consistent visual grammar for the whole film: lens family, eye-line rules, the 180° line in the corridor and living room, and screen direction.
- The colour/grade intent.
- How to make the sip the emotional peak: a slow push-in, shallow focus, steam in backlight.
Also fix cut 1's problems: the static frames, the young man's wardrobe changing, Uncle waving at camera, and the posed final two-shot where the young man vanished. Keep him in the story to the end.`),
    ask("3-dialogue-writer", `You are the dialogue writer and voice director. ${brief}

Rewrite the lines for perfect clarity in an AI voice model, keeping the user's story and meaning.
- Use short phrases, common words and open vowels, and avoid tongue-twisters.
- Keep each line to 8 words or fewer and give each to one speaker in one shot.
- Keep the user's key lines ("Aunty, thodi adrak milegi?", "Lagta hai zukaam hai. Andar aao, beta.", "Aah… kitna aaram mila.", "Aunty… bilkul maa ke haath jaisi.", the end line "Swastea. Roj piyo, swasth raho.") unless clarity truly needs a tweak; say why for each change.
For each line give:
- the exact text in romanised Hindi;
- how to write it in the Veo prompt so it is pronounced right (phonetic hints in brackets);
- the delivery: pace (brisk and natural), emotion, volume;
- the risky words to check after generation.
Decide how the brand name "Swastea" (said "swas-TEA", like the English word tea) should be voiced so it is ALWAYS right. Compare these options and recommend one:
- (a) Aunty on camera, which Veo got wrong twice;
- (b) Aunty's line staged with her face off camera or turned away, using a controlled TTS voice that matches her;
- (c) a warm female voice-over on the pack/end card;
- (d) anything better.
Also write any on-screen supers. Never use self-labels such as best, premium or natural, and never make medical claims.`),
    ask("4-editor", `You are the film editor. ${brief}

Plan the cut before the shoot, so the director shoots for it.
- Give target shot durations that add up to 30.0s with an even, flowing rhythm: no speed changes on dialogue, and no dead air inside lines (trim pauses by cutting to a reaction or a cutaway, never by jump cuts).
- For each cut: the cut point and why (on action, on look, on line end), and whether it is a straight cut, J-cut, L-cut or soft dissolve. Dissolves only where time passes.
- Say where to hold for emotion (the sip).
- Say what extra footage (handles, reactions, inserts such as hands on the cup, the spoon into chai, steam) the director must generate so the edit can breathe.
- Describe the audio edit: room tone under every cut so it never drops to silence; music edited to picture so it never starts or stops abruptly; the women's chorus swelling in and fading out over the sip.
- Describe the finishing: a consistent grade across shots, subtle film grain, and the end card design and timing.
Name the mistakes in cut 1's editing and how this plan avoids each.`),
    ask("5-music-sound", `You are the music director with the sound designer and mixer. ${brief}

Design the score and the soundtrack.
- The score is santoor-led, with tanpura or soft strings and maybe bansuri. Choose the raga or mood (e.g. a morning raga, warm and hopeful) and justify it.
- Plan the music to picture: where it enters, how it builds through the kitchen, how it opens up at the sip, and how it resolves on the pack and end card. Give the timings.
- The women's "dhi-re-naaa" chorus: the user found it abrupt. It must sound musically part of the score, in the same key and tempo, not pasted on: soft entry, rise, gentle release. Say whether to generate score and chorus together in one Lyria piece, or separately and layer them; recommend one, with exact Lyria prompts.
- Sound design per shot: knock, sneeze, door, boil, spoon, pour, sip and breath, birds.
- Mix levels in dB: dialogue, music under dialogue, music in gaps, chorus, sfx.
- How to keep Veo's own invented music out of the dialogue.`),
  ]);

  // 3. Supervisor / creative director: critique the combined plan against the user's notes.
  const team = `DIRECTOR+DOP:\n${director}\n\nDIALOGUE WRITER:\n${writer}\n\nEDITOR:\n${editor}\n\nMUSIC+SOUND:\n${music}`;
  const critique = await ask("6-supervisor-critique", `You are the creative director and production supervisor. ${base}\n\nThe team's proposals:\n${team}

Critique hard. Check every one of the user's notes and say whether the plan truly fixes it, and if not, exactly what to change.
Find conflicts between departments, for example:
- shot durations vs the editor's;
- lines too long for their shot;
- camera moves Veo can't do;
- wardrobe or continuity risks;
- music timings vs picture.
Flag anything that risks: humour; slow speech; unclear words; the brand being mispronounced; abrupt music; uneven pace; a "TV" look.
End with a numbered list of required changes.`);

  // 4. Director revises into one final plan everyone signs.
  const final = await ask("7-final-plan", `You are the director, writing the FINAL production plan after the creative director's critique. ${base}\n\nTeam proposals:\n${team}\n\nCREATIVE DIRECTOR'S CRITIQUE:\n${critique}

Resolve every required change. Output ONLY JSON:
{
 "logline": string,
 "visualGrammar": string,
 "grade": string,
 "brandVoicing": string,
 "shots": [{
   "n": number, "seconds": number, "beat": string, "size": string, "lens": string,
   "camera": string, "blocking": string, "light": string, "focus": string,
   "speaker": string|null, "line": string|null, "linePrompt": string|null,
   "delivery": string|null, "sfx": string, "cut": string,
   "keyframe": string, "veoPrompt": string
 }],
 "inserts": [{ "name": string, "seconds": number, "keyframe": string, "veoPrompt": string }],
 "music": { "concept": string, "lyriaPrompts": string[], "timeline": string, "chorus": string },
 "mix": string,
 "supers": string,
 "endCard": string,
 "editPlan": string,
 "risksAndChecks": string[],
 "howEachNoteIsFixed": [{ "note": string, "fix": string }]
}
Rules:
- Durations sum to exactly 30.
- Veo prompts are full and self-contained: describe each person's wardrobe and the setting, give one action and one camera move, and include "No music." and how the line is spoken.
- At most one speaker per shot, at most 8 words.`);
  const json = final.replace(/^```json\s*|```\s*$/g, "");
  writeFileSync(join(out, "plan.json"), json);
  try {
    const p = JSON.parse(json);
    console.log(`\nPLAN: ${p.shots.length} shots, ${p.shots.reduce((s: number, x: { seconds: number }) => s + x.seconds, 0)}s, ${p.inserts?.length ?? 0} inserts`);
  } catch {
    console.log("\nPLAN: final JSON did not parse; see 7-final-plan.md");
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
