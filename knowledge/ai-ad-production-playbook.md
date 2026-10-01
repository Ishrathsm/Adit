# AI Ad Production Playbook

How to make a realistic AI video ad with our stack: Gemini images for keyframes, Veo 3.1 image-to-video, Lyria for music, and Gemini TTS for voice.

Built on 2026-09-30 from four sources:
- 17 tutorial videos, whose transcripts were read and extracted;
- a shot-by-shot study of 3 real motorcycle ads (71 shots);
- web guides on scripts, music briefs and sound design;
- our own failures on KoriKey and Torvik v1.

Sources are listed at the end. Per-video notes are in `sources/`.

The one-line version: **simple, coupled motion; one look; many takes, keep the best seconds; hard cuts on sound hits; a score built in blocks around the picture.**

---

## 1. What makes an AI ad look real

These rules come from the reference-ad study (`sources/reference-ads/`) and from why Torvik v1 failed. The user's verdict on v1 was "not at all realistic"; the critique scored its realism 3/10.

1. **Couple the camera to the subject.** When both the camera and the bike move, the camera travels at the bike's exact speed, so the bike stays fixed in frame and only the background moves. This held in 72% of the reference shots where both were moving. Otherwise the camera is locked and the bike passes through the frame. The camera and the subject never move independently: that is the "both moving at once" look the user rejected.
2. **Use one straight line, or one gentle arc, per shot.** Journeys are built by cutting simple shots together.
3. **Never change location within a shot.** Only a cut changes place. Dissolves between action shots read as ghostly morphs.
4. **Keep setups short, but build one scene, not a montage.** Real bike ads have a median shot of about 1–1.5s, and the slowest (Freedom 125) about 2.5s. No setup is held much past about 3s. The effectiveness research pulls the other way on pace: Orlando Wood (*Lemon*) counts "rhythmic rapid cuts, obtrusive text, disconnected scenes" as the less effective left-brain features, and Ogilvy found that too many scene changes lower brand preference. So cut quickly **within one unfolding scene** (one place, one story beat after another), never as a montage of unrelated places. See `copywriting-principles.md` §2.
5. **Keep one look.** Use one grade, one time of day and one light direction for the whole ad. The references were brightness about 79/255 ±25 and saturation 6 (muted and filmic). v1 was 93 ±52 and saturation 12.
6. **The kind of motion decides whether a clip holds, not its length.** Our static and coupled v1 clips stayed clean for their full 4–6s. Clips where the camera and bike moved independently broke from the first second, and one also changed the bike's design at 2s. The data is in `sources/reference-ads/torvik-v1-clip-drift.json`.
7. **Static and detail shots are the backbone,** and the easiest for AI (difficulty 2.8–3.1 of 5). Handheld, drone, pan-follow and pass-by shots are the hardest (4.2–4.7).

## 2. Pre-production

### Script (the AV format)
- Write it as a two-column table: picture on one side, sound on the other, with a running time per row. A 30s spot holds about 65–85 spoken words.
- **Structure:** a hook in the first 1–2s (Freedom and Triumph open on intrigue before the reveal), then build, turn, payoff, then a pack shot with the logo.
- **The Triumph pattern suits faceless product films:** details and prep first, then the engine start as the big transition, then the ride, then a static hero, then the logo.
- **Show the user** the script, brand, tagline, shot plan and costs in ₹ **before generating anything.** This is a standing rule.

### Shot list
- Every shot names its **type** (see §4), its length, its camera move, the subject's path and direction ("bike moves left to right, road on its left"), its sound cue and its hit point.
- **Use one connected shot list with a shared style block** (lighting, lens, colour, grade) that is glued to every prompt. Change the style block once and every shot updates. Override it per scene only on purpose.
- Keep **a maximum of 3–4 beats per generated clip.** Anything more confuses the model.

### Music brief
- Give it brand adjectives, reference tracks, "music in" and "music out" points, and **hit points** (the moments the music must accent, such as the engine start, the logo, a key action).
- Design the score **in time blocks before composing:** 0–5s intro, the beat drops at X, the next energy level at Y, a pause before the climax, the climax, the outro.

## 3. Assets (lock them before any video)

- **Product sheet:** front, three-quarter and side views, plus details, on a plain grey background, all from real photos when we have them. One image is not enough: the model invents the unseen sides, which is how Torvik shot 7 morphed into a different bike.
- **Text and logos:** make a separate close-up image of the label or logo and tell the model "image N is the authority for the exact wording, typeface and layout". Small text still warps in motion, so keep branding off moving surfaces or composite it in the edit (as with the KoriKey pack insert).
- **Character sheet:** two panels (a close-up face and a full body) on grey. **Erase the face from the full-body panel** so the video model has exactly one face to lock on to. For a new outfit or state (wet, muddy), make a **separate sheet** rather than describing the change in the prompt.
- **Locations:** generate them at a **three-quarter angle** (more depth for camera moves, a better success rate), bright and clean. Edit the set in the image (clear the counter, add a door) before animating.
- **Props** that repeat get their own reference sheet.
- **Test in motion before locking.** Run the same simple prompt on each candidate, changing one variable at a time; a still that looks great can fall apart when it moves.
- **Every edit softens an image.** Composite edited parts over the original to keep its texture, or you get the plastic AI look.

## 4. Shot types and how to prompt them

Use only these four types unless there's a reason not to.

| Type | Camera | Subject | Typical length | Prompt core |
|---|---|---|---|---|
| **Static detail** | locked, or a very slow push-in or slide | parked | 1–2s | "Locked-off macro of … The camera does not move." Put the motion in the light (a glint, a light snapping on), not the camera. |
| **Coupled tracking** | a camera car or vehicle mount at the bike's exact speed (side, front or rear three-quarter) | moving straight | 1.5–3s | "Tracking shot from a camera car driving alongside at exactly the bike's speed; the bike and rider stay fixed in the same place in the frame; only the road and background stream past; the bike moves in a straight line." |
| **Locked pass-by** | locked, or a very slight pan | rides straight through the frame | about 1s | "Locked-off camera at road level; the bike enters frame left and exits frame right in one straight line; the camera does not move." |
| **Static hero** | locked, or a slow push-in that stops | parked on its side stand | 2–3s | "Locked-off. The bike stands parked on its side stand … nothing moves except a light breeze in the grass." Use a last frame (§5) to stop the push-in running away. |

Prompting rules that apply to all four types:
- **Body or vehicle mount ("snorricam"):** the camera is bolted to the subject, so the subject stays frozen in frame while the background whips past. This forces coupling. For a bike: "camera rigidly mounted to the motorcycle".
- **Use positive and negative constraints together:** "the camera follows the bike and keeps it centred; the bike does not drift left, right or backwards; the motion is smooth and steady".
- **Spell actions out move by move.** Never write "dances" or "rides aggressively"; list each physical action.
- **Pin the geography:** give the direction of travel, fixed anchors in frame ("stays left of the tree"), or a **layout map image** showing positions and sizes. The Higgsfield workflow calls the layout map its number-one tip.
- **Know the vocabulary:** dolly (the camera moves) vs zoom (the lens changes), truck (sideways), pedestal (straight up or down), side, reverse and low tracking, vehicle tracking, and an arc (a partial orbit).
- **Useful keyframe keywords:** "commercial shot, shot on ARRI, anamorphic". Avoid "hyperrealistic", which reads as a video game.
- **Match cuts:** the closing pose of one shot is the opening pose of the next ("same hand, same motion").

## 5. Veo 3.1 specifics

- **Clip lengths are 4, 6 or 8s.** Keep 1–3s of each and render the shortest length that covers the cut. Veo 3.1 costs about ₹17.6/s silent and about ₹35/s with its own audio (Lite is about ₹4.4/s). Veo 3 is not available on our project.
- **First and last frame (`lastFrame`, image-to-video only):** give a start image and an end image, and Veo animates only the motion between them. This pins where the shot ends, which is the fix for runaway zooms, drift and end-of-shot morphs. **Not yet tested on our project.**
- **Reference images (`referenceImages`, type ASSET, up to 3):** the product, character and location go to Veo itself, not only into the keyframe. They **cannot be combined with a first frame** (it's a separate mode). **Not yet tested.**
- **`enhancePrompt`:** Veo rewrites the prompt by default, which may add moves we didn't ask for. Test with it off.
- **Audio:** Veo's own sound (`generateAudio`) produced good engine, tyre and click effects on Torvik (rated 7–9/10), with no voices. It still added music on 2 of 8 shots despite the prompt saying no music, and revved a parked bike. Prompt "only the real sound effects of the scene; no music, no voices" and check every clip.
- **Resolution:** reports say upscaling to 1080p inside the model can wash colours out. Compare with 720p.

## 6. Generation strategy

- **Many takes, keep the best seconds.** "The finished ad is the best few seconds out of 100 tries." A realistic yield is about 14 of 20 clips with usable footage. The pros splice keeper slices from several takes of the same shot. Budget roughly 2–3 takes per shot, not one.
- **Simplify a move that keeps failing.** Don't keep re-rolling a hard move; replace it with a simpler shot type.
- **Continue from the last good frame:** screenshot it and use it as the first frame of the next generation.
- **Check every clip in motion,** not from still frames. Check for coupling, a straight path, a location change, design drift against the product sheet, and added music or voices. Reject a clip before it reaches the edit. Tool: `ai-ads-backend/eval/clip-drift.ts`.

## 7. Edit

- **Hard cuts, each on a sound hit** (a rev, a click, a gear shift or a beat). There are no dissolves in action ads. Calm genres may still dissolve (the Turito film used them, per the user's quality bar).
- **Speed-ramp** slow motion to hit the tempo; **crop slightly** to hide edge glitches; add **film grain** to kill the AI texture. Text, supers and prices go in the edit, never into the generation.
- **End on a clean pack or hero shot** with the product prominent, then the logo.

## 8. Music

Lyria holds one mood per clip and **cannot follow a timeline**: a timed prompt came back as flat piano at energy 2–4. So **we build the arc in the edit** from separate Lyria pieces, each prompted for one energy, cut on shot boundaries, with a hit on the reveal. Tool: `eval/torvik-music.ts`, plus the arrangement in `eval/torvik-production.ts`.

- **Start small and build in gears** (first, second, third, a change, the climax, home). Leave room to grow. Tension against this: the user wanted energy from the first second, so open with a pulse or riff, not a quiet pad, but still build.
- **For vehicles, propel with rhythm.** Arpeggios and staccato strings "rolling like wheels" drive forward; a sustained string at the end drains energy.
- **Music must not draw attention to itself.** It serves the picture, voice and brand. Avoid fanfares and showy leaps; one motif with a slow chord change hypnotises. Ask whether the brand, as a person, would be that exuberant.
- **Interrupt the pattern about halfway, then return to it.** End uplifting, never sad.
- **Overdo the energy at the climax** (it's easier to dial back), and give it one **magic moment** at the key beat, for us the logo reveal.
- **Match sounds to the setting:** organic for nature, contemporary and electronic for tech. Avoid dated-sounding sample libraries.
- **Set the tempo from the cut** so beats land on cuts. We couldn't confirm a strict beat grid in the reference ads, so treat "cut on a hit" as the firmer rule.
- **Mix for laptop and phone speakers.** Check in mono, EQ the sub-bass so it's audible on small speakers, and avoid hard panning.
- **Agree the emotion with reference tracks,** not adjectives ("what kind of happy?").

## 9. Sound design

- **A pass-by is layered:** the engine core (the bike's personality), tyre and road texture, and air displacement (the whoosh). The whoosh supports the other layers and never dominates. Automate the volume to swell in, peak on the pass and fade.
- **Effects sit on top of the music at key moments:** the engine start, a rev on acceleration, a click on a switch, a thud on a landing.
- **Use whooshes sparingly.** The user found a whoosh on every cut "too many"; two per 30s worked.
- **Duck the music under voice (sidechain) but keep it audible.** Per the user, "when speaking keep music, but lower".
- **We have no effects library,** and ElevenLabs needs a paid plan. Procedural effects work for whooshes, clicks, wind and ticks, but not engines (rated 1–6/10). Veo's own audio is the real engine source (§5). Tool: `eval/sfx/torvik_sfx.py`.

## 10. Voice

- **Our voice is Gemini TTS.** A whisper needs strong wording ("a breathy stage whisper with no voiced tone"), and at quicker paces it often falls back to normal speech: 1 in 6 takes was a true whisper at about 95 words a minute. Always verify takes with Gemini (whispered? exact words?).
- **Never time-stretch a read to make it fit.** The user asked for this explicitly. Re-record at the right pace instead, and let the end card stretch to fit the line.
- **A cast voice can set an accent** (the `accent` field). A whisper tends to hide the accent.

## 11. Our own lessons

- **KoriKey (folk cut-out puppets on Veo 3.1 Lite, then 3.1).** Flat cut-out animation morphs; our own prompt wording ("chest puffs out, layer shifting, drop shadow") created a blob. The dragon went humanoid (rearing, human hands). A real rig, or simpler motion, is needed for that look.
- **Torvik v1 (a photoreal bike on Veo 3.1 with sound).**
  - The static details and the headlight snap-on worked.
  - The seated rider rolling out worked. The leg-swing mount was replaced before rendering because it was judged too risky.
  - The failures: independent camera and bike motion (city, corner), a morph into a real maker's design (corner), a runaway push-in (hero), dissolves reading as morphs, and inconsistent grade and time of day.
- **Review motion, not frames.** Still frames at 0.5s hid every motion problem, and I called v1 "the strongest thing we've made" before the user rightly rejected it.

## 12. To test next (each needs approval; costs in ₹)

1. Veo 3.1 **first and last frame** on one coupled-tracking shot and one hero shot (8s ≈ ₹140 each silent).
2. Veo 3.1 **reference images (ASSET)**, product sheet plus location, with no first frame (≈ ₹140).
3. `enhancePrompt: false` against the default, on the same shot (≈ ₹140 × 2).
4. A **product sheet** for Torvik (front, three-quarter, side, details) instead of one studio photo (images only, ≈ ₹30).
5. 2–3 takes per shot and keeping the best slice; measure the yield.

---

## Sources

**Tutorials** (notes in `sources/tutorials/`):
- Higgsfield: "3-Step Workflow To Make Ultra-Realistic AI Ads" https://www.youtube.com/watch?v=3rDs6FhFoUQ
- Higgsfield: "A $1,000,000 AD Using Just 2 tools" https://www.youtube.com/watch?v=AdjllfZuqYM (watched; no captions)
- Rourke Heath: "Master Google VEO 3.1" https://www.youtube.com/watch?v=O8-vsMM8hSI
- Dan Kieft:
  - "Veo 3 JSON prompting" https://www.youtube.com/watch?v=afzbZYC6fCM
  - "Nano Banana Pro + Kling" https://www.youtube.com/watch?v=P7pH_1zFKbE
  - "Seedance 2.5" https://www.youtube.com/watch?v=kGku3TTiYO8
  - "All camera movement prompts" https://www.youtube.com/watch?v=7GWd4PV3hoA
- Thomas Lundström: "3-Step Workflow" https://www.youtube.com/watch?v=y9mjc-x_KO0
- Curious Refuge: "Consistent products" https://www.youtube.com/watch?v=CnjdhAxcXu8
- Artlist: "Veo 3 ad tutorial" https://www.youtube.com/watch?v=CAgjP0qyygU
- Speel: "Realistic ads from one image" https://www.youtube.com/watch?v=vMzwO1kRX70
- Shreyas Raj: "AI product ads client workflow" https://www.youtube.com/watch?v=Gam7jPrMjuA
- Sebastien Jefferies: "Kling 3.0 like a pro" https://www.youtube.com/watch?v=HTBfxEqDCdU
- AI Shot Studio: "42 camera movements" https://www.youtube.com/watch?v=HOjCT6TxlHM
- Ryan Leach and Tommy Zee: "3 composers re-score the same commercial" https://www.youtube.com/watch?v=C76lApYgtOM
- Tommy Zee: "5 most common commercial composing mistakes" https://www.youtube.com/watch?v=fwWjUKeF3wM
- Jay Weigel: "Composing for commercials" https://www.youtube.com/watch?v=U1j3mWg__pY

**Reference ads** (analysis in `sources/reference-ads/`, video files in `~/Desktop/torvik/references/`):
- Bajaj Pulsar N160
- Triumph "For those who know the difference"
- Bajaj Freedom 125 CNG

**Web guides:**
- Scripts:
  - StudioBinder AV scripts https://www.studiobinder.com/blog/av-script-template/
  - Celtx https://blog.celtx.com/how-to-write-a-tv-commercial-script/
  - Boords https://boords.com/video-script-template/commercial
- Treatments:
  - Behance https://www.behance.net/search/projects/director's%20treatment
  - Robin Piree https://robinpiree.com/blog/how-to-write-a-directors-treatment-for-a-tv-commercial
- Music briefs:
  - Audiodraft https://www.audiodraft.com/blog/how-to-create-a-music-brief-for-your-production/
  - PRS for Music https://www.prsformusic.com/m-magazine/how-to/how-to-write-music-fit-for-commercials
  - iZotope https://www.izotope.com/en/learn/writing-music-to-picture-film-tv-beyond.html
- Sound design:
  - A Sound Effect https://www.asoundeffect.com/cinematic-car-commercial-sound-design/
  - SFX Engine https://sfxengine.com/blog/car-driving-by-sound-effect
