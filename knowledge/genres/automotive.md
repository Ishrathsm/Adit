# Genre: Automotive and two-wheelers

**Evidence:**
- 59 famous-brand car ads in the Pitt dataset (VW, Hyundai, Toyota, Audi, BMW, Tata, Mahindra, Kia and others), each rated by about 5 viewers;
- our shot-by-shot study of the Pulsar N160, Triumph and Freedom 125 ads;
- case studies: Honda "Cog", Volvo "Epic Split", VW "Think Small", Audi "Vorsprung durch Technik".

Full analysis: `../sources/genre-datasets/automotive-dataset-analysis.md`. Shooting rules: `../ai-ad-production-playbook.md`.

## What wins

- **One message per ad.** Chevy's "My Truck" said only "longest lasting" and was rated 5/5. Hyundai's "EON Trendsetter" gave no reason to buy and was rated 1/5.
- **The reasons viewers repeat back:** reliable; safe (VW "Like", with its four-star crash rating); fast and precise (BMW "Bullet"); confidence (VW Polo's singing dog); tough and unbreakable (Toyota Hilux); cares about society (Toyota "Saving Sight"); heritage or made-here (Chrysler and Clint Eastwood); features for the price (Scion); easy to park (Smart).
- **Dramatise the benefit through a device:**
  - a **metaphor** (BMW "Bullet");
  - a **demonstration** (Volvo "Epic Split" showed steering precision, with 40M views in 9 days; a VW Beetle floats);
  - a **character** (Kia's hamsters, a "fluent device" rivals can't copy);
  - **humour that lands the point** (Audi "Green Police" for clean diesel).
- **Excitement alone doesn't sell.** Aston Martin scored exciting 1.0 but effective 2: viewers only learned "beautiful fast car", which they already knew. BMW "Bullet" used excitement to dramatise one specific idea.
- **Brand platforms endure.** BMW has "The Ultimate Driving Machine" (the driving feeling). Audi has "Vorsprung durch Technik", progress through technology: its market share grew fivefold, growing 7.6× faster than the UK market. Honda has "Isn't it nice when things just… work?" (Cog: 606 takes, a 28% sales lift, and the brand shown only at the end).

## Rules

1. **Write "I should buy it because…" first:** one tangible reason.
2. **Show "fast", "tough" or "safe"; never just say it.** Use a visual metaphor or a demonstration.
3. **If you sell a feeling, show its cause.** A smooth ride gives the dog confidence.
4. **A celebrity must embody the message** (Clint Eastwood is grit, resilience and American manufacturing), never be a random face.
5. **For the value choice, be specific** so viewers can list the features back.
6. **Build an ownable platform or character** and reuse it (Kia's hamsters, Audi's Vorsprung).
7. **Show the brand early:** a badge on the vehicle in every shot, or a watermark. Torvik v1 had it only on the end card.
8. **For a challenger brand, pick an enemy or a truth.** VW made "small" a virtue in "Think Small".

## Craft (from the reference ads and our tests)

- **Shots:** a coupled camera car with the bike fixed in frame; a locked camera with the bike riding straight through; static details lit by a moving light; a static hero. One place and one time of day.
- **Structure (Triumph pattern):** details and prep, then the **engine start** as the big transition, then the ride, then a hero shot, then the logo.
- **Sound:** a layered engine, tyres and air; one or two pass-by whooshes, not one per cut; music as a bed; the engine start as the sound hit. Veo's own audio gives good engine sound (≈ ₹35/s).
- **Avoid:** independent camera and vehicle motion, S-bends, location changes within a shot, real makers' design cues (the model drifts toward famous bikes), and dissolves.

## How to do it faceless with our pipeline

A helmeted rider with the visor down, or no rider at all. The product sheet has front, three-quarter and side views plus details, with a badge-text authority image if the bike carries a logo. Every clip is checked for design drift against the product sheet.
