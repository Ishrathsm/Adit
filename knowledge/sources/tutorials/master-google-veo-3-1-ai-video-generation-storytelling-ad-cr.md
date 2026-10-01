# Master Google VEO 3.1- AI Video Generation, Storytelling & Ad Creation Guide
Rourke Heath · https://www.youtube.com/watch?v=O8-vsMM8hSI

Based on the provided transcript, here are the concrete, reusable techniques for an AI video-ad pipeline.

### 1. Workflow (the steps, in order)

*   **Full Character Rotation for Consistency:**
    1.  Generate a character headshot/bust. (Tool: CAdream)
    2.  Upload the headshot and prompt for a "full body shot of this character on a white background" to create a master reference image.
    3.  Upload the full-body image to a video model. (Tool: Cling 2.5 mentioned, but applicable to Veo)
    4.  Prompt for a 10-second, 360-degree rotation of the character.
    5.  Take screenshots from the resulting video (e.g., side profile, back) to use as reference images for consistent angles in subsequent shots.
*   **"Ingredients" Feature Combining Elements:** (Tool: Veo 3.1 on Higgsville)
    1.  Prepare three separate images: one for the character, one for the location, and one for a specific object (e.g., a product).
    2.  Upload all three into the "ingredients" slots.
    3.  Write a single prompt describing how all three elements interact in the scene.
*   **"First and Last Frame" for Product Transitions:** (Tool: Veo 3.1)
    1.  Create a "start frame" image (e.g., product close-up).
    2.  Create an "end frame" image (e.g., product in a different position with effects).
    3.  Upload them into the `start frame` and `end frame` slots.
    4.  Write a prompt describing the motion *between* the two frames.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)

*   **For unique characters:** Describe physical attributes and background simply.
    *   `"their head is a television screen and they're wearing abstract clothing on a white background"` (Tool: CAdream/Higgsville Soul)
*   **For locations/backgrounds:** Use camera position and details to define the scene.
    *   `"an image of a car and the camera is positioned outside of the front of the windshield and it's looking into the car so we can see the passenger seat and the driver's seat and there is nobody driving the car. So the car is empty and it is nighttime..."` (Tool: Nano Banana)
*   **For product shots:** Specify the background, lighting, and desired environment.
    *   `"on a black hue background with slight tint of orange, I would like you to add this product floating in space... and give it a 3D depth environment"` (Tool: Nano Banana)
*   **Tool selection:** Use image models like Nano Banana for products with text for better coherence.
*   **Control composition:** Explicitly state the desired aspect ratio, e.g., `"adjust the aspect ratio of this to be portrait"`.

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)

*   **For character rotation:** Be direct and descriptive.
    *   `"The character spins on a full 360. So we see all angles of the character. He moves around in a full rotation."`
*   **For First/Last Frame transitions:** Describe the camera and object movement.
    *   `"The serial is floating in the air, and the camera slowly moves around the box. The box slants ever so slightly as it's floating in the air and orange particles starts to circle around the box..."`
*   **To include dialogue/sound:** Write it directly into the prompt.
    *   `"...he then says, 'Damn, this is a hard day's work.'"`
    *   `"in the background, we can hear his girlfriend talking on the phone and then he's replying..."`
*   **Prompt assistance:** Use an LLM (Gemini, Claude) by uploading start/end images and asking it to write a Veo 3.1-optimized transition prompt.
*   **Negative Prompts (by Omission):** The model may refuse to generate content that depicts unsafe behavior (e.g., driving while on the phone) or contains swear words.

### 4. Product & character consistency (how they keep the product identical across shots)

*   **360 Rotation Method:** Generate a video of the character rotating 360 degrees, then screenshot specific angles (back, side) to use as reference images for new shots.
*   **Ingredients Feature:** Use the Veo 3.1 "ingredients" feature by uploading a consistent character image, a location image, and a product image to combine them in one video.
*   **High-Quality Source Images:** Use crisp, high-resolution source images with lots of detail for the video model to "attach to," which improves consistency and output quality.

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)

*   **Automated Multi-Shot:** Use the "Multi-shot mode" (on Higgsville) which automatically interprets a narrative prompt and converts it into a timed shot list.
*   **Example Auto-Generated Shot List (8 seconds):**
    *   `0-2s: medium shot`
    *   `2-3s: quick cut to a closeup`
    *   `3-5s: slow zoom`
    *   `5-7s: medium shot, pulls back`
    *   `7-8s: final shot lingers`
*   **Manual Cuts:** Prompt for cuts directly if you disable the "Multi-shot" feature, e.g., `"the camera cuts to a side profile of the character..."`.
*   **Shot Lengths:** Use 10-second generations for simple, single-action shots like a character rotation.

### 6. Music & sound (how they score, SFX, voice, mixing)

*   **In-Prompt Audio:** Include descriptions of sounds, dialogue, and voice-over directly in the text prompt for Veo 3.1 to generate.
*   **Improved Voice Quality:** Veo 3.1 produces significantly better, less "tiny" voice outputs compared to previous versions.

### 7. Common failures and fixes

*   **Problem:** Generation fails or is blocked.
    *   **Fix:** Remove swear words (e.g., "Damn") or any other terms that might trigger safety filters.
*   **Problem:** Output video looks "AI generated," plasticky, or has washed-out skin tones.
    *   **Fix 1:** Start with very high-quality, detailed, or upscaled source images. Avoid low-resolution (e.g., 1000x1000px) inputs.
    *   **Fix 2:** Avoid upscaling to 1080p within the Veo 3.1 model, as this can cause the washed-out effect. Sticking to 720p may preserve more detail.
*   **Problem:** The automated "Multi-shot" feature adds unwanted camera moves or details.
    *   **Fix:** Disable the feature and prompt for specific cuts and camera moves manually.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)

1.  **Multi-Shot Story Prompt:** `"a man who is working on cleaning an engine inside of a car. The camera cuts to a closeup of him wiping the sweat off of his brow. He then says, 'Damn, this is a hard day's work.'"` (Note: The word "Damn" had to be removed to fix a generation error).
2.  **Character Creation:** `"their head is a television screen and they're wearing abstract clothing on a white background."`
3.  **Character Consistency Shot:** `"The character spins on a full 360. So we see all angles of the character. He moves around in a full rotation."`
4.  **Combining "Ingredients":** `"The character who has the TV as the head is sat inside the car... He has one hand on the wheel and he's holding an iPhone up to his ear... the light on the TV monitor flickers to visually represent each time he's talking."`
5.  **First-to-Last Frame Transition:** `"The serial is floating in the air, and the camera slowly moves around the box. The box slants ever so slightly as it's floating in the air and orange particles starts to circle around the box..."`