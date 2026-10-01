# The 5 Most Common (Commercial) Composing Mistakes 😬  [And How to Fix Them] 🤩
Tommy Zee · https://www.youtube.com/watch?v=fwWjUKeF3wM

Here are the concrete, reusable techniques for an AI video-ad pipeline, extracted from the transcript.

### 1. Workflow (the steps, in order)
*   **The "Quincy Jones Method"**:
    1.  **Chalk (Structure):** First, map out the ad's structure. Do not generate any assets yet. Use a timeline or shot list to define distinct sections with specific timings (e.g., 0-5s Intro, 5-10s Build, 10-15s Climax, 15-20s Outro). (General)
    2.  **Watercolors (Emotion):** Assign a specific emotional goal and energy level to each structural block. (General)
    3.  **Oil (Details):** Generate the actual assets (keyframes, motion, music) for each block, then perform fine-tuning (e.g., color correction, audio mixing). (Gemini, Veo, Lyria)
*   **Set Tempo First:** Before generating any motion or music, determine the core tempo (BPM) of the ad. Play the visual concept and tap out a rhythm to find a pace that matches the desired cutting speed. (Veo, Lyria)

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)
*   **Contextual Integrity:** Ensure all prompt keywords support the core story and setting. For a nature-themed ad, use prompts with `organic, natural, farming, slow motion, hands through wheat, beautiful shots of the field`. Avoid contradictory terms like `electronic, artificial, futuristic`. (Gemini)
*   **Deconstruct References:** Analyze the client's visual reference. Identify and use its specific attributes in your prompts: `cinematic lighting, warm golden hour tones, shallow depth of field, color palette of earth tones`. (Gemini)

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)
*   **Section-Specific Motion:** Prompt motion changes for each structural block. Do not use one generic motion prompt for the entire ad. (Veo)
*   **Energy Level Prompting:**
    *   For a climax, explicitly prompt for high energy: `bursting with energy, dynamic fast-paced motion, anthemic, incredible strength`.
    *   Over-prompt for energy initially; it's easier to reduce intensity later than to add it. (Veo)
*   **Sync to Beat:** To align cuts and movement, prompt motion to follow the predetermined tempo: `motion synchronized to a 130 bpm beat`, `camera moves land on the beat`. (Veo)
*   **Avoid Drastic Panning:** Since final mixes are checked in mono, avoid extreme camera moves that won't translate well. Use negative prompts like `- (extreme camera pan)` to maintain a centered focus. (Veo)

### 4. Product & character consistency (how they keep the product identical across shots)
*   **Reference Image Pinning:** Use a source image of the product/character and instruct the model to maintain its appearance across all shots. (Gemini)
*   **Verbatim Descriptions:** Reuse the exact same detailed character description prompt for every keyframe generation to ensure consistency. (Gemini)
*   **Adherence to Brand Vibe:** Do not deviate from the core feeling or "vibe" established by the client's reference materials. The goal is to support the brand's established identity, not invent a new one. (General)

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)
*   **Block-Based Structure:** Design the ad in timed, named blocks before generating content. Example: `[0-5s: Intro], [5-10s: Beat Kicks In], [10-15s: Climax], [15-20s: Outro with Logo]`. (General)
*   **Programmatic Pauses:** To build anticipation for a climax, intentionally create a "pause" block with minimal motion or sound just before the high-energy section. (Veo, Lyria)
*   **Rhythmic Cutting:** Ensure shot changes align with the tempo/beat of the music for a more cohesive feel. (Veo)
*   **The "Magic Moment" Section:** Intentionally create an empty 8 or 16-beat section in the middle of the ad's structure. Prompt this section with something unexpected or different to create a standout moment. (Veo, Lyria)

### 6. Music & sound (how they score, SFX, voice, mixing)
*   **Instrumentation Matching:** Prompt for instruments that match the ad's context. For a farmer, use `organic acoustic guitar, natural strings, folk percussion`; avoid `808 bass, synthesizers, heavily processed sounds`. (Lyria)
*   **Emotion via Reference:** Instead of single-word prompts like `happy`, use specific artist or genre references: `Pharrell-style happy funk` or `Katy Perry-style pop anthem`. (Lyria)
*   **Replicate Reference Blueprint:** When given a reference track, prompt the AI to analyze and replicate its key elements: `mimic the chord progression, instrumentation, and scale of the reference track, but generate an original melody`. (Lyria)
*   **Mix for Small Speakers:** To ensure bass is audible on laptops/phones, instruct the mix to include mid-range harmonics for the bassline. (Audio Post-Production)
*   **Check in Mono:** All final audio should be checked for compatibility in mono. Avoid hard-panning instruments or SFX in prompts. (Lyria, Audio Post-Production)
*   **Prompt for "Contemporary" Sounds:** Use keywords like `fresh, contemporary, cutting-edge sound library, modern strings` to avoid dated-sounding instruments. (Lyria)

### 7. Common failures and fixes
*   **Failure:** Music/visuals are flat and repetitive.
    *   **Fix:** Structure the ad in distinct, timed blocks (intro, build, climax). Generate assets for each block individually to force variation.
*   **Failure:** The final mix sounds weak on a laptop or phone.
    *   **Fix:** Check the mix in mono. Add mid-range harmonic layers to sub-bass elements so they are audible without subwoofers.
*   **Failure:** The emotional tone is wrong, despite using the right keywords (e.g., `happy`).
    *   **Fix:** Stop using single words. Use specific artist/genre reference tracks to communicate emotion (e.g., "Is this the kind of 'happy' you mean?").
*   **Failure:** The energy at the climax feels underwhelming.
    *   **Fix:** Intentionally prompt for *more* energy than you think is needed (`bursting with energy, anthemic, blow up the track`). It is easier to reduce energy in the edit than to add it after generation.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)
*   (On workflow) "First you draw the structure [Chalk], then you fill in the emotion [Watercolors], and then you use oil last [Details]."
*   (On structure) "...from 0 to 5 seconds I'm going to do this, from 5 to 10 seconds I'm going to do this, from 10 to 15 seconds I'm going to do this."
*   (On emotional specificity) "What kind of happy do you mean? Like Pharrell happy? Do you mean like Katy Perry happy?"
*   (On creating standout moments) "Carve an empty space in the middle of your composition... for 8 beats or so... I'm gonna inject something totally different."
*   (On avoiding outdated sounds) "Reverse engineer it, dissect it, see what kind of sounds are being used, trace it back to the library or to the VST..."