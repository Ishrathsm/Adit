# Create Cinematic AI Ads With Nano Banana Pro + Kling AI - Full Guide
Dan Kieft · https://www.youtube.com/watch?v=P7pH_1zFKbE

### 1. Workflow
*   **Ideation:** Use an LLM (e.g., ChatGPT) to break down a core concept into scenes and a shot list. (ChatGPT)
*   **Keyframe Generation:** Generate all still images (keyframes) for the entire ad first. (Nano Banana Pro)
    *   Start with a main character portrait.
    -   Use the first successful character image as a reference image for all subsequent shots of that character to ensure consistency.
    -   Generate a sequence of shots: wide/body shot, extreme close-up on eyes, medium shot with product (ball), close-up on product. Repeat for all characters/scenes.
*   **Animation:** Animate the generated keyframes in batches based on complexity. (Kling AI)
    1.  **Simple static shots:** Animate close-ups (e.g., eye blinks, breathing). Use the "start frame" only feature.
    2.  **Action shots:** Animate character movements (e.g., shooting a ball). Use the "start frame" only feature.
    3.  **Transitions:** Animate morphs between scenes. Use the "start and end frame" feature, with a keyframe from the first scene as the start and a keyframe from the second scene as the end.
*   **Editing:** Take a screenshot of the last frame of a generated video clip to use as the start frame for the next sequential clip, ensuring continuity.

### 2. Keyframe / image prompting
*   **Structure:** Start with the subject and action, add clothing/scenery details, and end with specific camera and lens information for a cinematic look. (Nano Banana Pro)
*   **Camera Details:** Add technical camera/lens descriptions to the end of the prompt. Use an LLM to generate these if needed (e.g., ask "What is a good lens to describe the shot that I want?"). (ChatGPT for prompt help)
    *   Example: `...shot on a Sony A7R... rich bokeh... captures the crisp facial detail... dark moody aesthetic... deep contrast.`
*   **Shot-specific Phrasing:**
    *   **Eye Close-up:** `An extreme close-up of [character]'s eyes locked in focus... The sweat is glistening on his skin. Arena lights sharply reflected on his pupils. Ultra shallow depth of field isolating the eyes with a creamy bokeh.`
    *   **Object/Product Shot:** `A medium close-up shot from the waist only and he has a basketball firmly in his hands.`

### 3. Video / motion prompting
*   **Static Motion:** Describe subtle micro-movements. Instruct the camera to be nearly still. (Kling AI)
    *   Example: `Focused eyes, blinking once, looking at the same place. Sweat is like dripping down from one eye... very subtle skin shimmer... Keep the camera almost still with a slight natural handheld motion.`
    *   Add character-specific actions: `...added in some heavy breathing.`
*   **Action Motion:** Describe the specific start and end of a physical movement. (Kling AI)
    *   Example: `Animate the player lifting the ball slightly higher and releasing it in a smooth controlled shooting motion.`
*   **Transition Motion (Start & End Frame):** Focus the prompt on the object's path and camera behavior. (Kling AI)
    *   Example: `The camera's constantly following the ball and it keeps it centered.`
*   **Negative Prompting (Fixes):** Add explicit instructions for what the AI should *not* do, especially for transitions.
    *   Example: `...not let the ball go left or backwards and to keep the motion smooth and steady.`

### 4. Product & character consistency
*   **Celebrity Recognition:** Name the specific famous person in the prompt; the model may not require a reference image for the first generation. (Nano Banana Pro)
*   **Reference Image Chaining:** Use the initial successful character image as an image reference for all subsequent keyframes of that same character. (Nano Banana Pro)

### 5. Shot design & editing
*   **Shot List Structure (per scene):**
    1.  Body shot, character locked in.
    2.  Extreme close-up of eyes.
    3.  Medium close-up showing character with the key object (ball).
    4.  Close-up on the object itself.
*   **Pacing:** Use very short clips. The creator notes a successful shot is "perfect if you make some cuts to your video," implying an assembly of multiple short, dynamic generations.
*   **Transitions:** Use a shared object (e.g., a ball) as a visual anchor that morphs from one type to another to bridge different scenes.

### 7. Common failures and fixes
*   **Failure:** Unwanted or unrealistic character motion.
    *   **Fix:** Reroll the generation multiple times. If that fails, simplify the requested motion (e.g., instead of a complex kick, prompt "walking backwards like he's actually going to take the free kick").
*   **Failure:** Video generation glitches or has artifacts (e.g., a ball misses its target but the morphing effect is good).
    *   **Fix:** Use the successful part of the glitched clip. Take a screenshot of the last good frame and use it as the starting point for the next video generation to continue the sequence.
*   **Failure:** Transition movement is erratic or unnatural.
    *   **Fix:** Add explicit negative prompts to constrain the motion (e.g., `...not let the ball go left or backwards`) and positive constraints for the camera (`...keeps it centered`).

### 8. Quotes worth keeping
*   **Image (Portrait):** "A dramatic front angle portrait of LeBron James during a focused free throw... shot on a Sony A7R... rich bokeh... dark moody aesthetic... deep contrast."
*   **Image (Detail):** "An extreme close-up of LeBron James' eyes locked in focus... Arena lights sharply reflected on his pupils. Ultra shallow depth of field isolating the eyes with a creamy bokeh."
*   **Video (Subtle Motion):** "Focused eyes, blinking once... Keep the camera almost still with a slight natural handheld motion."
*   **Video (Action):** "Animate the player lifting the ball slightly higher and releasing it in a smooth controlled shooting motion."
*   **Video (Transition Control):** "The camera's constantly following the ball and it keeps it centered... not let the ball go left or backwards and to keep the motion smooth and steady."