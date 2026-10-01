# 3-Step Workflow To Make Ultra-Realistic AI Ads
Higgsfield AI · https://www.youtube.com/watch?v=3rDs6FhFoUQ

Here are the concrete, reusable techniques from the transcript.

### 1. Workflow (the steps, in order)
*   **Step 1: Asset Generation.** Create and test all product shots, characters, locations, and props. (Gemini)
*   **Step 2: Shot List Prompting.** Use a large language model to turn a script and the generated assets into a structured shot list of video prompts. (Gemini)
*   **Step 3: Scene Generation & Iteration.** Generate video clips, identify failures, and refine the prompts to fix them, pulling the best seconds from multiple takes. (Veo)
*   **A/B Test Assets:** Generate multiple options for key assets (character, location). Test them with the *exact same simple motion prompt*, changing only one asset at a time to see which performs best in motion. (Veo)
*   **Composite Edit:** The final ad is not from single video clips. It is a "keeper" edit, stitched together from the best few seconds of many different generated clips.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)
*   **Product Sheet:** Use a source image and prompt: `"Make a product sheet with front and 3/4 views of the headphones from image one."` (Gemini)
*   **Character Sheet Structure:** Prompt for `"...a character sheet... two panels, close-up and full body, front and back on a gray background."` The close-up locks the face; the full body locks the build. (Gemini)
*   **Use a Gray Background:** For character sheets, a neutral gray background improves the success rate by eliminating competing visual information. (Gemini)
*   **Location Angles:** Generate locations at a `"three-quarter angle"` to give the scene more depth for the video model to use during camera moves. (Gemini)
*   **Location/Prop Editing:** Use precise in-painting style commands: `"clear everything off the kitchen island so the top is empty. On the left counter, add gas stove. On the right wall, remove the TV, put a door there instead."` (Gemini)
*   **Outfit Generation:** Provide the character image and prompt: `"give me 10 casual outfit ideas for this character, write each as a prompt."` (Gemini)
*   **Outfit Combination:** Combine elements from different generations: `"take the shirt from the second look, make it pink, and keep the jeans from the first. Combine them into one prompt."` (Gemini)
*   **Schematic Maps for Layout:** To lock object positions, generate a map: `"Make a schematic. Mark the fire hydrant and lock the sky dancer to its right. It should be two times a person's height located on the same line."` Attach this map to the video prompt. (Gemini)

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)
*   **Global Style Prefix:** Use a "style prefix" block (lighting, camera, color) that is applied to every prompt in the shot list for a consistent look. E.g., `"soft even daylight from the camera side, bright and clean."` (Gemini for prompt structure, Veo for execution)
*   **Scene-Specific Overrides:** If a scene needs a different look, override the global prefix for that prompt only: `"For scene two only, override the prefix lighting. Bright, genuinely sunny midday. Strong, direct sun... Saturated color."` (Veo)
*   **Choreograph All Motion:** Do not use generic terms like "dance." Spell out the motion beat-by-beat: `"Add dance moves... two head nods, shoulder rolling one at a time, a knee dip, a finger snap, quarter spin at the door."` (Veo)
*   **Describe Dance Styles:** Use specific style names to guide motion: `"locking style, arms snapping into frozen geometric poses"`, `"hip-hop dance"`, `"loose full-body wave dance"`. (Veo)
*   **Specify Camera Moves:** Use clear, descriptive language for camera motion:
    *   `"shot open behind him and ease around to profile as he walks"`
    *   `"single body rig snorricam locked on the right ear cup. Camera bolted to his body... Everything behind him whipping past in motion blur."`
    *   `"worm's eye view right from the track level where he sprints straight over the lens"`
    *   `"drop the camera low and tilt up"` (Veo)
*   **Control Direction:** Explicitly state the direction of movement relative to the scene: `"Hero moves left to right dancing. Road on his left. And the brick building on the right. Camera following."` (Veo)

### 4. Product & character consistency (how they keep the product identical across shots)
*   **Multi-Angle Product Sheets:** Provide the model with front, back, and 3/4 views of the product to prevent hallucination. (Gemini)
*   **Single Face Reference:** On character sheets with multiple poses (close-up, full body), erase the face from the full-body shot. This gives the video model one unambiguous face to lock onto, preventing drift. Prompt: `"Erase the face from the full body shot on the right panel."` (Gemini)
*   **Compositing for Quality:** To maintain high-fidelity details (like skin texture) after an edit (like changing an outfit), composite the images. In a photo editor, place the high-quality original shot on top of the lower-quality edited version. Mask out the part you want to change (e.g., the old outfit) on the top layer to reveal the new element from the layer below. (Any photo editor)
*   **Separate Reference for State Changes:** If a character's state changes significantly (e.g., dry to sweaty), create a second, separate character sheet for the new state. Do not rely on a text prompt to make the change in the video model. (Gemini)
*   **Lock Assets in Prompt:** After generating reference images for props (e.g., a specific coffee mug), add them as image inputs to the video prompt and explicitly state to use them: `"lock moka cream and mug cream as exact references."` (Veo)
*   **Use a Schematic Map:** To maintain the position and scale of background elements across shots, provide a simple top-down map as an image input. (Gemini for map creation, Veo for execution)

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)
*   **One Action Per Prompt:** Avoid overloading a single prompt with too many actions. Break complex sequences (like making coffee) into their own dedicated shots and prompts.
*   **Use Montages:** For process-oriented sequences, create a fast-cut montage. Prompt for a variety of specific angles: `"fast cut montage, high angle close-up, straight down on the moka... worm's eye from the burner... tight on the pour"`.
*   **Match Cut on Action:** To create seamless transitions between scenes, end one shot and begin the next with the exact same action. Prompt: `"Match the opening tap to the closing tap of [previous scene] exactly. Same hand, same motion."`
*   **Vary Shot Types:** Mix wide, medium, and close-up shots for visual interest, e.g., `"broadcast style wides from the stands"`, `"Tight tracking shots of his legs driving"`.

### 6. Music & sound (how they score, SFX, voice, mixing)
*   **Music as a Motion Input:** To synchronize dance moves to the music, provide the audio track as an input to the video generation model. Prompt: `"Add the music track as an input, and have the hero dance in time with its beat."` (Veo with Lyria track)
*   **Voiceover:** The ad includes a simple voiceover line: `"I'm on my way."` (Gemini TTS)

### 7. Common failures and fixes
*   **Failure:** A character face looks good in a still image but "falls apart" or "vanishes" in motion.
    *   **Fix:** Test all character and location assets with a simple motion prompt before locking them in. Choose brighter locations.
*   **Failure:** The video model gets confused and "drifts" between faces when a character sheet shows multiple faces.
    *   **Fix:** Edit the character sheet to contain only one clear face.
*   **Failure:** Editing an asset (e.g., adding an outfit) degrades the image quality, leading to a "flat, plastic, AI slop look."
    *   **Fix:** Composite the edited portion onto the original high-quality image in a photo editor.
*   **Failure:** Props or background elements change size, shape, or position between takes.
    *   **Fix:** Create a clean reference image for the prop and/or a schematic map for the layout and include it as an input in the video prompt.
*   **Failure:** A generic prompt like "he dances" results in "loose and mushy" motion.
    *   **Fix:** Choreograph the scene by describing specific moves sequentially in the prompt.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)
*   `"Create a prompt for a character sheet of a young man with an expressive face, two panels, close-up and full body, front and back on a gray background."` (Gemini)
*   `"Erase the face from the full body shot on the right panel."` (Gemini)
*   `"Change the style prefix for the whole shot list... soft even daylight from the camera side, bright and clean. Apply to every prompt."` (Gemini for prompt structure)
*   `"Rewrite prompt 1C, the exit... Add dance moves... two head nods, shoulder rolling one at a time, a knee dip, a finger snap, quarter spin at the door."` (Veo)
*   `"Add the music track as an input, and have the hero dance in time with its beat."` (Veo)