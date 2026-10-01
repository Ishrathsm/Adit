# Creative dials

The dials are also in code, in `ai-ads-backend/src/lib/dials.ts`. The code decides; keep this file in step with it.

The playbooks state rules as single lines ("humour is strongest", "minimal copy"). Real briefs need them as **dials** whose setting depends on the brand's context. This file is what the strategist and creative director read to set them for one ad. The playbooks and `sources/` remain the evidence; this file says how far to turn each knob and when.

Each setting is tagged:
- **[E]** evidence from our sources (the dataset, the research or reference ads, named);
- **[J]** our judgement, extrapolated from the evidence. Treat it as a default to argue with, not a fact.

## How to use it

1. **Read the context** from the brief: category, brand position, price tier, audience, goal and length (§1). If one is missing, the strategist infers it and says so.
2. **Start every dial at its genre default** (§3).
3. **Apply the modifiers** in this order: goal, then price tier, then brand position, then audience. Moves add up. When two modifiers pull opposite ways, the earlier one in that order wins. Clamp each dial to 0–4 and to its limit.
4. **Check the rails** (§2). No dial setting may break one.
5. **Write the settings down** with a one-line reason for each dial that moved from the genre default. The creative director signs these off before the script is written, and the copywriter, art director, director and composer all work from them.

## 1. Context inputs

| Input | Values |
|---|---|
| **Category** | automotive · food-beverage · tech-electronics · beauty-fashion-luxury (sub-genre: grooming, sportswear, self-esteem, luxury) · apps-services-education |
| **Brand position** | **famous**: an incumbent whose assets people already know · **challenger**: known but smaller than the leader, needs to be chosen over it · **new**: an unknown brand, including every fictional brand we make |
| **Price tier** | value · mid · premium · luxury |
| **Audience** | youth (16–24) · young adults (25–34) · family/parents · professionals/business · mature (50+) |
| **Goal** | **launch**: introduce the brand or product · **feature**: sell one specific advantage · **brand**: build feeling and memory for an already-known brand · **offer**: drive action now (sale, price, sign-up) |
| **Length** | 15 · 20 · 30s |

## 2. Rails (never move)

1. **One proposition.** A stranger can finish "I should buy X because…" after one viewing. [E: Pitt top ads in every genre; Ehrenberg-Bass]
2. **Show it, don't say it,** through a demonstration, metaphor, story, humour or honesty. [E: ABCD; famous-brand cases]
3. **Tone serves the proposition.** Humour, excitement and emotion are fuel, not the engine; a funny or exciting ad that doesn't land a reason is weak. [E: Aston Martin exciting 1.0 / eff 2; GoPro "Owl" funny / eff 3; Squarespace]
4. **One scene unfolds, not a montage.** Pace can be fast, but within one place and story. [E: System1 *Lemon*; Ogilvy]
5. **The real product, pack and UI are composited, never AI-drawn.** Text and logos go in the edit. [E: our KoriKey, Turito and Torvik runs]
6. **Realistic motion:** the camera is coupled to the subject or locked; straight paths; no location change inside a shot. [E: reference-ad study, Torvik v1]
7. **Brand-safe:** no real maker's design cues and no imitation of a real brand's assets.

## 3. The dials

Each dial runs 0–4. The genre table gives the default; the modifier tables move it.

### D1 Humour
0 none · 1 a light smile (wit in a line) · 2 a warm comic situation · 3 a committed joke that carries the ad · 4 surreal or absurd

**Off (0) unless the user explicitly asks for humour.** Humour is make-or-break: a joke that misses damages the brand more than a straight ad would. [user rule, 2026-10-01] Never infer it from the genre, the position or the audience. When the user does ask, the genre value below is the **ceiling**, and the modifiers move it down from there.

| Genre ceiling (only when humour is asked for) | |
|---|---|
| food-beverage | **3** [E: eff-5 funny 0.79 vs weak 0.67; dominant sentiment *amused*] |
| beauty: grooming | **4** [E: Old Spice and Axe funny 0.8–1.0] |
| apps-services-education | **2** [E: eff-5 funny 0.61 but weak ads equally funny, so humour must *be* the benefit (Mastercard "Elephant")] |
| tech-electronics | **1** [E: joke works only when it reveals the proposition (ASUS); otherwise weak] |
| automotive | **1** [E: humour works for VW, Kia and Audi "Green Police", not for performance brands] |
| beauty: sportswear, self-esteem, luxury | **0** [E: Nike excitement, Dove emotion, Chanel restraint] |

| Modifier | Move |
|---|---|
| tier premium | −1 · luxury → **0** [J, from luxury grammar: "doesn't over-explain"] |
| audience mature | −1 [J] |
| **Limit** | At 3 or more, the joke must deliver the proposition: "if you can lift the joke out and the ad still works, the joke is a parasite". A half-joke is worse than none, so pick 0 or commit to ≥ 2, never a hesitant 1. [E: tech and food analyses; Carlton Draught] |

### D2 Emotion ↔ reason
0 pure function: specs, demonstration · 2 a functional message inside an appealing story · 4 pure feeling: identity, memory, transformation

| Genre default | |
|---|---|
| beauty: luxury, self-esteem | **4** [E: Chanel; Dove 5/5 with low funny/exciting] · sportswear **3** · grooming **2** [J] |
| food-beverage | **3** [E: emotional transformation is one of three winning lanes; Coca-Cola, Folgers] |
| automotive | **2** [E: "show the cause of the feeling", VW Polo dog; BMW "Bullet" with one idea] |
| apps-services-education | **2** [E: empowerment beats fear; Google "Parisian Love"] |
| tech-electronics | **1** [E: demonstration strongest; GoPro, Samsung] |

| Modifier | Move |
|---|---|
| goal brand | +1 [E: Binet & Field, emotion wins long-term for known brands] |
| goal feature or offer | −1 [E: ABCD, tangible functional message works across the funnel] |
| position new | −1 [J: an unknown brand must first say what it is; Squarespace shows the cost] |
| position famous | +1 [E: Apple identity, Cadbury "Gorilla"] |
| tier luxury | +1 [E: luxury sells status and feeling] |
| **Limit** | At 4 the film must still attach one feeling the viewer can name ("confidence to be successful"); a "moving lookbook" with no feeling fails. [E: Gucci best vs weak] At 0 a human benefit must still be stated (Havells: "your daughter is safe", not the wire spec). [E] |

### D3 Brand reveal
0 brand in the first second and throughout (watermark, badge in every shot) · 2 brand within 5s and at the end · 4 held to the end as a reveal

| Genre default | **1** for all genres [E: ABCD brand in first 5s; all three reference bike ads used a persistent watermark] |
|---|---|

| Modifier | Move |
|---|---|
| position new | → **0 or 1**, never higher [E: viewers credit unknown brands' ads to competitors] |
| position famous **and** goal brand | up to **4** allowed [E: Honda "Cog", Cadbury "Gorilla"; works only with known assets] |
| goal offer | → **0** [J] |
| tier luxury | +1 [J: luxury holds the name back, but the product is on screen throughout] |
| **Limit** | Product on screen early is not the same as brand: a 3–4 still needs the product or a known asset visible early. |

### D4 Voice-over density
0 no voice · 1 end-card line only (brand + tagline) · 2 sparse, about 1 word/s · 3 conversational, about 2.3 words/s · 4 brisk, 3+ words/s

| Genre default | |
|---|---|
| automotive, beauty | **1** [E: references picture-led; faceless genres: picture carries the story] |
| tech-electronics | **1** [E: GoPro "Durability" no VO; Apple minimal copy] |
| food-beverage | **2** [J: picture and sound sell appetite; a line lands the benefit] |
| apps-services-education | **3** [E: services are invisible; "say what you offer, plainly"] |

| Modifier | Move |
|---|---|
| goal offer | +1 [E: CTA heard and seen (ABCD)] |
| goal brand | −1 [J] |
| tier luxury | → at most **1**, read at about 2 words/s [E: luxury read 20% slower] |
| audience youth | the read may be brisk at its setting [E: brisk youth read 3+ w/s] |
| the user did not opt in to VO | → at most **1** (end-card voice only if asked) [user's standing rule] |
| **Limit** | Supers match the VO word for word. [E: Ogilvy] Never time-stretch a read. [user rule] |

### D5 On-screen copy
0 none until the end card · 1 one super for the key claim · 2 a line every other shot · 3 copy on most shots (offer, features)

| Genre default | **1** for all genres; **2** for apps-services-education [E: text is part of the design in services; Wood: obtrusive text is a left-brain feature] |
|---|---|

| Modifier | Move |
|---|---|
| goal offer | +1 (price, "limited", CTA) [E: ABCD] |
| goal feature, in tech-electronics | +1 for the one spec viewers should repeat (the battery at 38 days) [E] |
| tier luxury | → **0** [E: Chanel: the bottle, the name and almost nothing else] |
| **Limit** | Never 4; at most 4 lines (MAX_ON_SCREEN_LINES). [code] |

### D6 Cut pace
0 contemplative, shots 3s+ · 1 calm, about 2.5s median · 2 balanced, about 1.5–2s · 3 quick, about 1–1.5s · 4 rapid, under 1s

| Genre default | |
|---|---|
| automotive | **3** [E: Pulsar and Triumph median about 1–1.5s; Freedom 125 about 2.5s] |
| food-beverage, tech-electronics | **2** [J] |
| apps-services-education | **1** [J: screens need reading time; Turito's calm cut was liked] |
| beauty: luxury | **0** [E: slow, deliberate moves] · sportswear **3** [J] |

| Modifier | Move |
|---|---|
| audience youth | +1 [J] · mature −1 [J] |
| tier premium and luxury, automotive | −1 (Triumph is slower than Pulsar) [E: reference study] |
| tier value, automotive | the commuter-value reference (Freedom 125) cut at about 2.5s [E] |
| **Limit** | Never 4 as a montage (rail 4). Setups stay under about 3s except a hero or end card. [E: references] Variable cut lengths in every case: quick details, a longer hero. |

### D7 Camera energy
0 locked off; motion in the light only · 1 slow push or slide that stops · 2 coupled tracking at the subject's speed · 3 vehicle-mounted coupling with a fast background · 4 handheld, drone, free orbit, pass-by close

| Genre default | |
|---|---|
| tech-electronics, beauty: luxury | **0–1** [E: the Apple hero reveal: still product, moving light; ideal for AI] |
| food-beverage | **1** [E: moving light across a static plate is reliable] |
| apps-services-education | **1** [J] |
| automotive | **2** [E: 72% of moving reference shots are coupled] |

| Modifier | Move |
|---|---|
| audience youth, automotive or sportswear | +1 [J] |
| tier luxury | −1 [E: luxury grammar] |
| **Limit** | **Cap at 3.** Level 4 moves fail on Veo (difficulty 4.2–4.7 of 5; Torvik v1). [E] Static and detail shots are the backbone in every genre. |

### D8 Grade and colour
0 muted, filmic (brightness about 79/255, saturation about 6) · 2 natural · 4 saturated, bright, high-key

| Genre default | |
|---|---|
| automotive, beauty: luxury | **0** [E: reference bike ads 79 ±25, saturation 6; luxury: muted, rich grade] |
| tech-electronics | **1** [J: clean, controlled contrast] |
| apps-services-education | **2** [J] |
| food-beverage | **3** [E: saturated but true colour; warm 2700–3500K for comfort food, cool 5000K+ for fresh] |

| Modifier | Move |
|---|---|
| audience youth or family, food or apps | +1 [J] |
| tier premium and luxury | −1 [J] |
| **Limit** | One grade, time of day and light direction for the whole film. [E: rail 6, Torvik v1] Neutral colour, no orange-teal push. [user quality bar] |

### D9 Music energy
0 none or an ambient bed · 1 calm and warm · 2 a steady pulse · 3 driving · 4 peak, anthemic

Stated as **open → peak**: the arc is built in the edit from separate Lyria pieces. [E: Lyria can't follow a timeline]

| Genre default | |
|---|---|
| automotive | **2 → 4** [E: propel with rhythm; the user wanted energy from the first second] |
| beauty: sportswear | **3 → 4** [E] · luxury **1 → 2**, a solo instrument [E] |
| food-beverage | **2 → 3** [J] |
| tech-electronics | **1 → 3**, minimal and modern [E] |
| apps-services-education | **1 → 2** [J; Turito liked] |

| Modifier | Move |
|---|---|
| goal brand | the peak +1 at the logo "magic moment" [E: composer interviews] |
| tier premium and luxury | the open −1 [J: "would the brand, as a person, be that exuberant?"] |
| D4 ≥ 3 (busy VO) | the peak −1; the music ducks under the voice but stays audible [user rule] |
| **Limit** | End uplifting, never sad; music never draws attention to itself. [E] |

### D10 Sound design
0 music only · 1 a few cues (the click, the pour) · 2 a layered scene sound throughout · 3 sound leads; music is a bed

| Genre default | |
|---|---|
| automotive | **3** [E: the engine is the personality; Veo audio rated 7–9/10] |
| food-beverage | **2** [E: "sound design is half the appetite": crunch, fizz, sizzle] |
| beauty, tech | **1** [E: intimate or precise foley] |
| apps-services-education | **0–1** [J] |

| Modifier | Move |
|---|---|
| Veo audio not approved (it doubles the Veo cost) | at most **1**: procedural cues only, never engines [E: procedural engines rated 1–6/10] |
| **Limit** | At most about two whooshes per 30s. [user feedback] |

### D11 Specificity of claim
0 attitude or identity only · 2 one benefit in human terms · 4 a hard fact, number or spec viewers can list back

| Genre default | |
|---|---|
| tech-electronics, apps-services-education | **3** [E: ASUS battery; E*Trade "saves me money on fees"] |
| automotive, food-beverage | **2** [E: "reliable", "more beef"] |
| beauty | **2**; luxury **0** [E: Fabletics specificity vs Chanel] |

| Modifier | Move |
|---|---|
| tier value, or goal offer | +1 [E: Scion "features for the price"; viewers list them back] |
| tier luxury, or goal brand | −1 [E] |
| position challenger | +1 (prove superiority) [E: Wendy's, Samsung vs Apple] |

### D12 Combativeness
0 no rival in view · 1 an old way or a problem as the enemy · 2 an implied rival · 3 a named comparison

| Default | **0** for all genres |
|---|---|

| Modifier | Move |
|---|---|
| position challenger | → **1–2** [E: VW "Think Small"; Burger King; Verizon "iDon't"] |
| position new | at most **1** [J: an unknown brand attacking a leader reads as noise] |
| tier premium and luxury | at most **1** [J: a sophisticated brand doesn't pick fights; the enemy is at most the old way] |
| **Limit** | **Never 3 in our pipeline.** Naming or depicting a real competitor is a legal and brand-safety risk (rail 7). |

### D13 Urgency
0 none · 1 an invitation ("Book a test ride") · 2 an offer with a deadline ("limited") · 3 hard sell

| Default | **1** for all genres; the CTA is always specific and single [E: ABCD] |
|---|---|

| Modifier | Move |
|---|---|
| goal offer, with a real offer in the brief | → **2** [E] |
| tier luxury | → **0** (the name is the CTA) [J] |
| **Limit** | Never claim "limited" or a price that isn't in the brief. Never 3. [J] |

## 4. The device choice

This is not a dial, but it's chosen with them. Pick **one** device to show the proposition. The weights below say how often each wins in a genre, in our sources.

| Genre | First choice | Also strong | Rarely right |
|---|---|---|---|
| automotive | demonstration (Volvo "Epic Split") | metaphor (BMW "Bullet") · character (Kia) | celebrity without meaning |
| food-beverage | humour or a tiny story (Snickers, "Mikey") | demonstration in motion (Knorr) · mascot | abstract mood |
| tech-electronics | demonstration (GoPro, Samsung) | metaphor (Sony "Balls") | a joke that doesn't reveal the feature |
| beauty | by sub-genre: absurd humour (grooming) · performance (sport) · truth (self-esteem) · sensory cinema (luxury) | — | the moving lookbook |
| apps-services-education | dramatised benefit (Mastercard "Elephant") | the product *is* the story (Google "Parisian Love") · real UI demo | stylish but vague (Squarespace) |

Humour is a device only when the user asked for it (D1); then, at D1 ≥ 3, it is the device. When the brand is **new**, prefer the devices that explain the product (demonstration, a real UI demo), because nobody yet knows what it is. [J]

**Fluent device.** For every new brand, propose one recurring asset (a character, a sound, a shot or a line) that the next ad reuses. [E: System1]

## 5. Worked settings for our three brands

These are sanity checks of the method, not approvals.

### Torvik R7: automotive · new · premium performance · young adults (25–34) · launch · 30s

| Dial | Setting | Why it moved from the genre default |
|---|---|---|
| D1 Humour | 0 | not asked for |
| D2 Emotion | 1 | new −1: an unknown bike must first give a tangible reason; the ride feeling carries it |
| D3 Brand | 1 | new: never held back; badge in shots or a watermark early (v1 had it only on the end card) |
| D4 VO | 1 | end-card voice only, as the user chose |
| D5 Copy | 1 | |
| D6 Pace | 2 | premium −1 (the Triumph pattern) |
| D7 Camera | 2 | |
| D8 Grade | 0 | |
| D9 Music | 1 → 4 | premium: open −1. **The user overrode this** (energy from the first second), so v1 ran 2 → 4; the user's call beats the dial |
| D10 Sound | 3 | Veo audio approved for v1 |
| D11 Claim | 2 | |
| D12 Combat | 0 | |
| D13 Urgency | 1 | "Book a test ride" |

### Turito: apps-services-education · challenger · premium (sophisticated, elegant) · family/parents · feature · 30s

| Dial | Setting | Why |
|---|---|---|
| D1 Humour | 0 | not asked for |
| D2 Emotion | 1 | feature −1 |
| D3 Brand | 1 | |
| D4 VO | 3 | if the user opts in to VO; otherwise 1 |
| D5 Copy | 2 | |
| D6 Pace | 1 | |
| D7 Camera | 1 | |
| D8 Grade | 2 | premium −1, family +1 |
| D9 Music | 0 → 1 | premium: open −1; busy VO: peak −1. An ambient start that stays calm under the voice |
| D10 Sound | 0–1 | |
| D11 Claim | 4 | challenger +1 |
| D12 Combat | 1 | challenger, capped by premium: the old way of studying is the enemy, never a rival |
| D13 Urgency | 1 | |

This matches the approved Turito film (2026-09-25): calm, sincere, elegant.

### KoriKey: food-beverage · new · value · family · launch · 30s (the folk-tale film)

| Dial | Setting | Why |
|---|---|---|
| D1 Humour | 0 | not asked for (the folk tale's charm is story, not jokes) |
| D2 Emotion | 2 | new −1 |
| D3 Brand | 0–1 | new |
| D4 VO | 2 | the user opted in (romanized Telugu) |
| D5 Copy | 1 | |
| D6 Pace | 2 | |
| D7 Camera | 1 | |
| D8 Grade | 4 | family +1 |
| D9 Music | 2 → 3 | |
| D10 Sound | 1 | no Veo audio: a few handmade cues only |
| D11 Claim | 3 | value +1 |
| D12 Combat | 0 | |
| D13 Urgency | 1 | |

## 6. What this file doesn't know yet

- Most audience and tier modifiers are **[J]**. The Pitt data has no audience or price labels, so these need our own A/B reviews to confirm.
- The modifier order (goal > tier > position > audience) is a judgement call.
- Indian-market specifics (regional language, festival timing, cricket and film references) aren't in the evidence yet, though the Pitt set includes Tata, Mahindra, Airtel, Havells and ICICI ads.
