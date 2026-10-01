# My 3-Step Workflow For Ultra-Realistic AI Ads
Thomas Lundström · https://www.youtube.com/watch?v=y9mjc-x_KO0

### 1. Workflow
*   **Step 1: Asset Creation.** Create all characters, products, props, and locations as distinct, referenceable assets. (Gemini)
*   **Step 2: Prompt Scripting.** Feed asset images and names to an LLM. Provide the ad concept and have the LLM use a "shot list director" skill/template to generate a structured shot list with detailed prompts for each scene. (Gemini/Claude)
*   **Step 3: Video Generation.** Generate video clips scene-by-scene using the prompts from Step 2. Iterate on failed shots before moving on. (Google Veo)
*   **Cost Management:** Generate initial drafts in 1080p to conserve credits/resources before committing to 4K. Asset generation is cheap; video generation is expensive.

### 2. Keyframe / image prompting
*   Create a "product card" using a screenshot of the product to establish a master reference. (Gemini)
*   Use a consistent prompt template to generate character options. (Gemini)
*   To change an element on a character, use direct instructions like "change it into a bathrobe." (Gemini)
*   Use a "cinematic locations" feature or prompt style to generate environments (e.g., "interior of Grandpa's apartment," "the hill he will roll down"). (Gemini)
*   Feed the LLM a screenshot of your asset library's file names so it learns how to correctly tag them in prompts. (Gemini/Claude)

### 3. Video / motion prompting
*   Prompts should have an extremely detailed structure, specifying colors, acting, lighting, etc., from the start. (Gemini/Claude for prompt writing)
*   Generate clips *without* music but *with* sound effects by including that instruction in the prompt template. (Google Veo)
*   For a successful complex shot: "a guy jumps over an older man, and then a super slow motion shot of the jump against the sun" was generated on the first try. (Google Veo)

### 4. Product & character consistency
*   **Critical:** On full-length character reference sheets, **remove the face**. This prevents the video model from getting confused and improves facial consistency in close-ups. (Gemini)
*   Create separate character sheets for the same character wearing different outfits. Do not try to describe clothing changes in the video prompt. (Gemini)
*   Make key props (e.g., a package) and locations (e.g., a specific apartment interior) into their own distinct assets at the beginning of the workflow to ensure they are identical across all shots.

### 5. Shot design & editing
*   Limit each 15-second generation to a maximum of 3-4 cuts (or shots) to maintain high quality and prevent the model from getting confused.
*   Do not expect every 15-second clip to be perfect. The goal is to salvage usable shorter shots from multiple generated clips.
*   The final edit is a "basic gluing together of the best moments" from all generations.
*   A realistic success rate: 14 out of 20 generated clips contained usable footage.
*   If a complex camera move fails (e.g., a long zoom out), replace it with a simpler, successful shot (e.g., a static product close-up).

### 6. Music & sound
*   Use the AI-generated sound effects that come with the clips (when prompted for SFX only).
*   Add a separate music track during video editing.
*   Time the music to the edit, so the track's conclusion aligns with the end of the ad.
*   Add extra, layered sound effects in post-production to build tension (e.g., "build-up sound effects as he loses control").
*   Animate text overlays in a video editor, not in the AI video generator.

### 7. Common failures and fixes
*   **Problem:** Character appears in the wrong location (e.g., outside an apartment instead of inside).
    *   **Fix 1:** Go back to the LLM, explain what went wrong, and have it regenerate the prompt.
    *   **Fix 2 (Preventative):** Define the location (e.g., "apartment interior") as a specific, locked asset from the start.
*   **Problem:** A specific camera movement consistently fails (e.g., "zoom out on him while he was lying on the floor").
    *   **Fix:** Abandon the shot and substitute it with a different, simpler shot that the model can execute well. Add any necessary text/titles in post-production.

### 8. Quotes worth keeping
*   "remove the face from the full-length reference on the character sheet, as this way the video models wouldn't get confused about which face to use..."
*   "create your character in different clothes on separate sheets."
*   "for each 15-second generation, they do a maximum of three or four editing splices, which ensures that [the model] doesn't get tangled and the quality stays high."
*   "...it was worth creating the apartment interior as a separate location, and the box as a separate prop... they would have been the same in every frame."
*   "[Prompts] initially have an extremely detailed structure with all the colors, acting, lighting, and everything you can imagine."