# A $1,000,000 AD Using Just 2 tools | Full AI Workflow
Higgsfield AI · https://www.youtube.com/watch?v=AdjllfZuqYM (watched, no captions)

Here are the concrete, reusable techniques for making AI video ads from the tutorial, based on the tools Nano Banana Pro (for images) and Kling 2.6 (for video) on the Higgsfield platform.

### 1. Workflow Steps
*   **Brainstorming:** Start with a simple, playful idea (e.g., Santa can't find his reindeer).
*   **Keyframe Generation (Image):** Create foundational still images for each scene using an image model (Nano Banana Pro).
*   **Image Iteration & Editing:** Use in-painting and image-to-image to refine details, fix errors, or change elements (like removing characters or changing text on a product) without regenerating the entire scene.
*   **Video Generation:** Animate the finalized keyframes using a video model (Kling 2.6), applying motion and camera movement with prompts.
*   **Assembly & Post-Production:** Import all video clips into an editing timeline. Reorder shots for storytelling, add music, apply speed adjustments (speed ramping), and crop to hide minor imperfections.

### 2. Keyframe/Image Prompting (Nano Banana Pro)
*   **Cinematic Keywords:** Add terms like `commercial shot`, `shot on arri`, and `anamorphic shot` to prompts to achieve a professional, film-like aesthetic.
*   **Aspect Ratio:** Use a **21:9 aspect ratio** to get the best cinematic composition by default.
*   **In-painting/Editing:** Use simple, direct language to modify parts of an existing image. For example, to remove background characters, use the prompt: `get rid of the reindeer in the back, but keep the rigs`.
*   **Text Generation:** The model can render text accurately on objects. To change a label, prompt the change directly: `just the exact same scene, but the candies are called Crush Candy's`.
*   **Multi-Image Referencing:** Combine elements from different images into one new image. For example: `a close up of the table on image 1, the jar from image 2 is on top the table`.

### 3. Video/Motion Prompting (Kling 2.6)
*   **Combine Action & Camera Movement:** In a single prompt, describe what the character is doing and how the camera should move. Example: `Santa is yelling angrily, dolly in`.
*   **Create Complex Motion:** Describe character-to-character interactions and specific movements. Example: `one reindeer spinning the other one at a very high speed`.
*   **Direct Simple Motion:** For straightforward animations, use just a few words. Example: `reindeer dancing`.
*   **Control the Pace:** Specify the speed of the action directly in the prompt. Example: `the reindeer in the background are jumping in fast tempo`.

### 4. Product & Character Consistency
*   **Image-to-Video Workflow:** Generate video *from* a finalized still image (keyframe) to maintain the character's style, clothing, and overall scene aesthetic. This prevents the video model from "hallucinating" a different character.
*   **Preserve Logos:** When modifying an image with a product, explicitly instruct the AI to keep the branding. Example: `Save the logo of the jar on the candy`.

### 5. Shot Design & Editing
*   **Build Intrigue:** Start with an action or reaction shot (e.g., the reindeer DJing) before revealing the cause (e.g., Santa's anger) to make the story more engaging.
*   **Use a Pack Shot:** End the commercial with a clean, well-lit shot that features the product prominently, with characters and action in the background to reinforce the story's theme.
*   **Speed Ramping:** If a generated clip's motion is too slow, speed it up in post-production to match the music's tempo and energy.
*   **Crop to Fix:** Hide minor AI-generated imperfections (like a weird camera pull on a disco ball) by slightly cropping the frame during the edit.
*   **Highlight the Product:** Use editing techniques like a quick zoom-in during a key action (like Santa taking a bite of the candy) to draw the viewer's attention to the product.

### 6. Music & Sound
*   **Select Music to Match the Vibe:** Choose a royalty-free track with a beat that matches the chaotic, high-energy feeling of the scenes.
*   **Edit to the Beat:** Cut and time the video clips to sync with the kick drum and key moments in the soundtrack.
*   **Generate Without Audio:** Turn off the audio generation feature in the AI tool if you plan to add your own separate music track, giving you more control.

### 7. Failures and Fixes
*   **Problem:** An initial "over-the-shoulder" party shot was visually cluttered and unappealing.
    *   **Fix:** Pivoted to a more dynamic, low-angle "close-up shot of the DJ" to create a more intriguing and energetic scene.
*   **Problem:** An animated clip of dancing reindeer moved too slowly for a high-energy party scene.
    *   **Fix:** Planned to use "speed-ramping" in the final edit to accelerate the motion and sync it with the fast-paced music.
*   **Problem:** A generated clip had a minor, distracting camera movement (a pull on a disco light).
    *   **Fix:** Planned to crop the shot slightly in post-production to hide the unwanted motion.

### 8. Verbatim Prompts
1.  **Nano Banana Pro (Image):** `a Santa Claus holding a jar of candies in his hand, commercial shot, shot on arri, anamorphic shot`
2.  **Nano Banana Pro (Image Edit):** `get rid of the reindeer in the back, but keep the rigs`
3.  **Kling 2.6 (Video):** `Santa is yelling angrily, dolly in`
4.  **Nano Banana Pro (Image):** `A close-up shot of the DJ, there are more reindeer on the dance floor, dancing on two feet like humans.`
5.  **Kling 2.6 (Video):** `one reindeer spinning the other one at a very high speed`