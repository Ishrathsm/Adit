# Knowledge base

This is what we've learned about making AI video ads, kept with the code so every new ad starts from it. Read the playbook, the copy principles and the relevant genre file before scripting.

- **[ai-ad-production-playbook.md](ai-ad-production-playbook.md)** covers how to make it: realism rules, assets, shot types and prompts, Veo 3.1 specifics, generation strategy, editing, music, sound, voice, our failures, and open tests.
- **[copywriting-principles.md](copywriting-principles.md)** covers what to say: the proposition, structure, voice-over word budgets, brand assets and fluent devices, CTA, taglines, and a pre-script checklist. It draws on Google ABCD (5,000+ ads), System1 *Lemon*, IPA, Ehrenberg-Bass, Ogilvy and famous-brand data.
- **[music-scoring-for-ads.md](music-scoring-for-ads.md)** covers how ad music is scored: an underscore written to picture, not a song. It covers spotting, the 30s arc, staying out of the dialogue, sync points and the bloom, the button or sonic logo, and building stems by role with Lyria.
- **[dials.md](dials.md)** turns the rules into 13 dials (humour, emotion, brand reveal, VO, copy, pace, camera, grade, music, sound, claim, combativeness, urgency), each set by category, brand position, price tier, audience and goal. The strategist and creative director set them for every ad.
- **[genres/](genres/)** has one playbook per genre, mastered in this order:
  1. [Automotive and two-wheelers](genres/automotive.md)
  2. [Food and beverage](genres/food-beverage.md)
  3. [Tech and electronics](genres/tech-electronics.md)
  4. [Beauty, fashion and luxury](genres/beauty-fashion-luxury.md)
  5. [Apps, services and education](genres/apps-services-education.md)
- **`sources/`** holds the evidence:
  - `tutorials/`: 17 tutorial notes.
  - `reference-ads/`: the Pulsar, Triumph and Freedom shot data, and the Torvik v1 critique.
  - `genre-datasets/`: the analysis of 741 famous-brand ads from the Pitt ad dataset (human ratings and viewers' "why buy" answers).

Tools that produced these (in `ai-ads-backend/eval/`):
- `kb-extract.ts`: extracts techniques from transcripts.
- `ref-analyze.ts` and `ref-shots.ts`: break down reference ads, whole-ad and shot by shot.
- `clip-drift.ts`: finds when a Veo clip starts to break.
- `genre-learn.ts`: analyses a genre's dataset annotations.
