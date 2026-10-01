# We had 3 composers re-score the same commercial
Ryan Leach · https://www.youtube.com/watch?v=C76lApYgtOM

### 1. Workflow (the steps, in order)
*   Define the brand identity first (e.g., Audi = "Sports Performance and elegance").
*   Create the voiceover script and a rough visual cut/storyboard.
*   Generate keyframe images (Gemini) based on the script and brand identity.
*   Generate video clips from keyframes (Veo), ensuring motion matches the pacing of the script.
*   Score the music (Lyria) to the locked picture and voiceover.
*   Mix voiceover, music, and any sound effects, ensuring the music supports the VO and never overpowers it.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)
*   **Gemini:** Include brand identity keywords in every prompt: "elegant," "sophisticated," "refinement," "inspirational engineering," "performance."
*   **Gemini:** Use concepts from the voiceover as the core subject. For "we see beautiful lines," prompt: `cinematic extreme close-up on the beautiful, flowing lines of a luxury sports car, capturing elegant reflections of light, sophisticated macro photography.`
*   **Gemini:** For "we see progress," prompt: `a sophisticated designer sketching a futuristic car concept on a transparent glowing screen, elegant, clean, high-tech environment.`

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)
*   **Veo:** To create a feeling of "propelling forward," use motion-centric prompts: `car smoothly accelerating on a winding road`, `scenery blurring past`, `rolling wheels on wet asphalt, kicking up spray`.
*   **Veo:** Match the motion's intensity to the ad's narrative arc. Use calm, slow moves for the beginning (`slow, elegant camera pan along the car's body`) and more dynamic moves for the climax.
*   **Veo:** Motion should be motivated by the story, not just for effect. An "exuberant" or "wild" camera move is wrong for an "elegant" brand unless the action justifies it.
*   **Veo Negative Prompts:** `-static, -still image, -frozen` to avoid sapping energy. `-jerky motion, -video game physics, -overly dramatic motion` to maintain brand sophistication.

### 5. Shot design & editing (shot lengths, pacing, structure of the ad)
*   **Structure:** Follow a classic narrative arc: "start small, go into first gear, second, third, have a change, a climax, and then end coming back home."
*   **Pacing:** Start with longer, "hypnotizing" shots that build intrigue. Don't reveal everything at once.
*   **Pacing:** Increase the pace and motion intensity past the midpoint (e.g., at the 1-minute mark) to match concepts like "progress" and "new era."
*   **Editing:** Use the sparse voiceover as a guide. The long gaps between words are where visuals and music must carry the story forward.

### 6. Music & sound (how they score, SFX, voice, mixing)
*   **Lyria (Opening):** Prompt for music that is `simple but not shallow, intriguing, solo piano, slow harmonic rhythm, elegant, sophisticated`.
*   **Lyria (Build-up):** To add momentum for the climax, prompt: `add rhythmic staccato strings, propulsive arpeggios, percussion that sounds like rolling wheels.`
*   **Lyria (Style):** Use brand-specific prompts: `Epic and grand like Hans Zimmer, but with the elegance and refinement of a luxury performance brand.`
*   **Lyria (Negative Prompts):** `NO sustained string pads during the climax, NO music that draws attention to itself, NO exuberant fanfares, NO video game music, NO sad or melancholic melodies.`
*   **Gemini TTS (Voiceover):** Prompt for a delivery that matches the sparse script: `calm, confident, sophisticated, thoughtful tone, deliberate pacing.`

### 7. Common failures and fixes
*   **Failure:** The ad's opening is too dramatic or complex.
    *   **Fix:** Start simple and small to leave room for the story to build.
*   **Failure:** The music or motion is too interesting and distracts from the product/message.
    *   **Fix:** Simplify. Ensure all elements serve the single, unified story. A component is a problem if you notice it more than the whole.
*   **Failure:** The energy drops during the climax.
    *   **Fix (Veo/Lyria):** Use rhythmic, propulsive, and forward-moving elements. Avoid static sounds (sustained notes) and static shots.
*   **Failure:** The ending's emotion is wrong (e.g., sad, ambiguous).
    *   **Fix (Lyria):** Ensure the final music resolves to an uplifting, positive, or inspiring mood that makes the customer want the product.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)
*   "Start small which makes me think this story is going to unfold, but you have not started in a boring way."
*   "The more you add right at the outset, the less room you have to go."
*   "There is nothing to sap energy out of something that's supposed to propel forward like a sustained string over the top."
*   "The music Drew too much attention to itself... I've noticed just like one part instead of being engrossed by the whole."
*   "You start small... go into first gear, second, third, have some kind of a change, you have the climax, and then you end coming back home."