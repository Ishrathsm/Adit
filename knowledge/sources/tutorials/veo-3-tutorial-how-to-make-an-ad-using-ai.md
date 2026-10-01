# Veo 3 Tutorial: How to Make an Ad Using AI
Artlist · https://www.youtube.com/watch?v=CAgjP0qyygU

### 1. Workflow
*   Generate 5-10 variations for each shot.
*   Pick the best elements from the variations and re-engineer a final prompt.
*   Incorporate audio prompts (dialogue, SFX, music) early in the video generation process. (Veo 3.1)
*   Treat generated video clips as raw footage for a full post-production process (editing, color grade, sound mix, VFX).
*   Maintain a "prompt log book" of descriptors that produce desired results to ensure consistency and speed up future work.

### 2. Keyframe / image prompting
*   **Structure:** Start prompts with `cinematic shot of [subject]`. (Gemini)
*   **Cinematic Keywords:** Include terms like `haze` (for dust clouds), `focal length`, and `depth of field`.
*   **Specifics:** Use precise focal lengths, e.g., `18 mm`. (Gemini)
*   **Scene Descriptors:** Use consistent, specific scene descriptions (e.g., `Viking Coastline`) to maintain the look across multiple shots. (Gemini)
*   **Image Editing:** Use an image editor to make small changes to a generated keyframe while keeping the rest of the image consistent (e.g., changing a caterpillar to an ant). (Nano Banana)

### 3. Video / motion prompting
*   **Method 1:** Generate video from a text prompt. (Veo 3.1)
*   **Method 2:** Generate video from a still reference image. (Veo 3.1)
*   **Keywords:** Include `camera movements` in the prompt. (Veo 3.1)
*   **Audio:** Directly include dialogue lines and sound effects in the prompt, e.g., `wind rushing`. (Veo 3.1)

### 4. Product & character consistency
*   Use highly specific, recurring scene descriptions in prompts (e.g., `Viking Coastline`).
*   Generate one master still image, then use an image editor to create variations with different camera angles from that same source image. (Gemini + Nano Banana)
*   Explicitly prompt recurring characters or elements into the background of scenes to link them, e.g., `...with the Vikings in the background, lifting up the inflatables with joy`.

### 5. Shot design & editing
*   **Texture:** Overlay film grain on all clips to mask AI artifacts, increase perceived sharpness, and create a more realistic texture.
*   **Lens Effects:** Add subtle chromatic aberration across all footage to simulate real lens distortion.
*   **Camera Motion (Post):** Manually add zooms, reframing, and camera shake in the edit to refine motion.
*   **Color Grade:** Apply a single, consistent color grade (e.g., using LUTs) across all shots to unify them.
*   **Transitions:** Use visual or conceptual match cuts to connect disparate scenes (e.g., cut from a rising train to a skydiver; cut from a leaf to a shot about a tree).

### 6. Music & sound
*   **In-Video Generation:** Prompt for audio directly within the video generator by specifying sound effects (`wind rushing`) or music style (`cinematic orchestral score`). (Veo 3.1)
*   **Voiceover:** If the generated dialogue or voice is unsatisfactory, replace or polish it using a separate text-to-speech tool. (Gemini TTS)
*   **Post-Production:** Treat sound as 70-80% of the experience. Use professional sound design and mixing on the final edit.

### 7. Common failures and fixes
*   **Failure:** Prompts produce a "video game" or overly "hyperrealistic" look.
    *   **Fix:** Remove the term `hyperrealistic` from the prompt.
*   **Failure:** AI footage has a noticeable, unnatural "weird AI texture."
    *   **Fix:** Overlay film grain in post-production.
*   **Failure:** Generated shots lack visual continuity.
    *   **Fix:** Use an existing still image as the source for new shots with different camera angles.
*   **Failure:** Generated dialogue is incorrect or the voice is wrong.
    *   **Fix:** Regenerate the dialogue with a dedicated AI voiceover tool and replace the audio in the edit. (Gemini TTS)

### 8. Quotes worth keeping
*   `cinematic shot of [subject], 18 mm, subtle haze`
*   `Viking Coastline` (as a scene descriptor for consistency)
*   `...with the Vikings in the background, lifting up the inflatables with joy.`
*   (Dialogue Prompt): `Live, laugh, love.`
*   (Audio Prompt): `cinematic orchestral score`