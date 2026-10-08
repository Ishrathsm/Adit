# Scoring music for ads

An ad score is an **underscore**, not a song. A song is written to stand alone, so its melody takes the spotlight and runs on its own clock. An underscore is written *to the picture*. It sits under the dialogue, moves when the cut moves, and is built to land the brand. Swastea (2026-10-08) taught us this the hard way: every Lyria santoor take was "more like a song", a continuous melody that ignored the lines, the cuts and the sip.

Sources:
- Max Schad, ad composer: [5 tips on ad music](https://www.ilio.com/blog/5-simple-tips-from-an-ad-composer-on-breathing-life-into-ad-music/).
- Jorde Heys, scoring a 30s spot to a brief: [AFTRS](https://www.aftrs.edu.au/blog/mastering-the-score-jorde-heys-on-crafting-music-to-brief/).
- [How to underscore dialogue](https://thinkspace.ac.uk/blog/blog-how-to-underscore/), Thinkspace.
- [Underscoring vs song](https://www.soundverse.ai/blog/article/what-is-underscoring-in-film-music-0905), Soundverse.
- Indian jingle composers Vanraj Bhatia, Ram Sampath and Ehsaan Noorani ([Ram Sampath](https://en.wikipedia.org/wiki/Ram_Sampath); [India's finest composer](https://1minutestories.substack.com/p/indias-finest-composer)).

## 1. Spot it before writing a note
- **Study the locked cut first.** Learn its flow, tone and key moments before any musical idea ([Heys](https://www.aftrs.edu.au/blog/mastering-the-score-jorde-heys-on-crafting-music-to-brief/)).
- **Hold a spotting pass.** Decide where music starts and stops, what each cue must do, and which beats it should hit or **avoid**.
- **Ask whether the scene needs music at all.** If the actor's face already says it, music that repeats it is noise. Music should add what the performance doesn't ([Thinkspace](https://thinkspace.ac.uk/blog/blog-how-to-underscore/)).
- **Write a cue sheet against picture seconds**: hit points (cut, look, reveal, the sip, the logo), dialogue windows and silences.

## 2. Structure: a three-act arc squeezed into 30s
- **Problem, then product, then payoff** ([Schad](https://www.ilio.com/blog/5-simple-tips-from-an-ad-composer-on-breathing-life-into-ad-music/)).
  - A soft intro on one key instrument.
  - A middle that adds motion.
  - A payoff where the music makes its one statement.
- **Lock tempo, tempo shifts and hit points before melody**, so the music's pacing works *with*, or in counterpoint to, the edit ([Heys](https://www.aftrs.edu.au/blog/mastering-the-score-jorde-heys-on-crafting-music-to-brief/)).
- **Have moments to compose *to* and moments to compose *away from*.** Don't score every second the same.
- **The music ends at 29.5s, not 30.** Leave a clean tail for the cut.

## 3. Under dialogue: get out of the way
- **No melody under a line.** Use sustained textures, soft pads, held notes and gentle harmony with restrained movement ([Soundverse](https://www.soundverse.ai/blog/article/what-is-underscoring-in-film-music-0905)).
- **Melodies are short.** "Melody lines that require 2–4 bars of payoff make the music feel too busy" ([Schad](https://www.ilio.com/blog/5-simple-tips-from-an-ad-composer-on-breathing-life-into-ad-music/)). In an ad, the melody is a **motif of 3–5 notes**, stated in the gaps.
- **Frequency.** Voices live around 500 Hz–1 kHz. Keep the underscore low or high, or carve that band out with EQ under lines, so the voice cuts through and the music can still be heard ([Thinkspace](https://thinkspace.ac.uk/blog/blog-how-to-underscore/)).
- **Dynamic contouring.** Dip under key words, swell in the gaps, and place pauses so they fall under the important words.
- **Level.** The bed sits 18–22 dB under the voice, and comes up only where nobody speaks (our own Aurelle lesson).

## 4. Hit the beats, with restraint
- **Sync points.** Choose 2–3 per spot, no more:
  - an entrance;
  - the emotional turn (for Swastea, the sip);
  - the brand button.
  Hitting every cut sounds like Mickey-Mousing.
- **The bloom.** At the emotional peak the music may finally open: a brief phrase, a swell, a voice. A beat of **silence just before** makes it land.
- **Transitions.** Hide edits and changes of section with swells, reversed notes and textural risers rather than hard starts ([Schad](https://www.ilio.com/blog/5-simple-tips-from-an-ad-composer-on-breathing-life-into-ad-music/)). Music never starts or stops dead.

## 5. Land the brand
- **The button.** End on a short, clean musical stamp exactly as the logo lands. Over time it becomes the sonic logo. Examples: Britannia's "ting ting ti-ding", Airtel's five notes, Nescafé's "pa pa ra rum".
- **The hook is everything.** "In jingles you get only 10 or 15 seconds to make an impact, unlike film songs" (Vanraj Bhatia). "Learning how to compose good hooks" is the craft (Ehsaan Noorani).
- **The button can be the motif's last notes.** The motif heard earlier, now complete, plays under the logo.

## 6. Palette and arrangement
- **The palette decides the music.** Harmony and melody flow from instrument choices, and rhythm comes from the pacing of the cut ([Heys](https://www.aftrs.edu.au/blog/mastering-the-score-jorde-heys-on-crafting-music-to-brief/)).
- **One-instrument scores are fine, but the instrument plays *roles*:**
  - texture: held tremolo, drones and soft strokes under the lines;
  - motif: in the gaps;
  - bloom: at the peak;
  - button: at the logo.
- **Pads underneath fill space** without drawing the eye ([Schad](https://www.ilio.com/blog/5-simple-tips-from-an-ad-composer-on-breathing-life-into-ad-music/)).
- **Use keywords from the brief.** Translate words like "fresh", "warm" or "homely" into concrete harmonic and instrumental choices.

## 7. Building it with our tools (Lyria + ffmpeg)
- **Never ask Lyria for "a piece".** Lyria writes songs. Ask it for **stems by role**, each as its own take:
  1. **Bed or texture**: "sparse ambient underscore, sustained tremolo on the tonic and fifth, very few notes, no melody, leaves space for dialogue, no rhythm".
  2. **Motif**: a short phrase, then silence, repeated with gaps, so a clean 2–4s cut can be lifted.
  3. **Bloom or swell** for the peak, with a slow rise and a soft release.
  4. **Button**: one short, clean 3–5 note phrase that resolves on the tonic, then a ring-out.
- **Edit the stems to picture.**
  - The bed runs under the dialogue with an EQ dip at 500 Hz–1 kHz.
  - The motif sits in a dialogue gap.
  - The bloom lands on the peak after a short hush.
  - The button lands on the logo and ends by 29.5s.
  - Use crossfades of a second or more.
- **Keep every stem in one key.** Generate them with the same raga and tonic in the prompt, then check them, or pitch-shift one to match.
- **Screen every take**, with "underscore, not song" as the first check:
  - Is there a continuous melody? If so, reject it as a bed.
  - Instrument count.
  - Tempo.
  - Mood.
- **Natural sound comes from the shots** (Veo's own audio). Lyria can't make a clean ambience; it always adds music.

## 8. Checklist before showing a score
1. Can every line be heard clearly, with no melody under any word?
2. Are there no more than 3 sync points, and does each land on picture?
3. Is there one bloom at the emotional peak, with a hush before it?
4. Does the button land with the logo and end by 29.5s?
5. Does nothing start or stop dead?
6. Does it sound like a score for *this* film, not a song that happens to be playing?
