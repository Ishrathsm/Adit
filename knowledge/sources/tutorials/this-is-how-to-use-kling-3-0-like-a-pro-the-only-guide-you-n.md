# This Is How To Use Kling 3.0 Like A PRO (The Only Guide You Need)
Sebastien Jefferies · https://www.youtube.com/watch?v=HTBfxEqDCdU

### 1. Workflow (the steps, in order)

*   **Simple Multi-Shot Video:**
    1.  `[Tool: Higsfield/Kling]` Drag a starting image into the `start frame`.
    2.  `[Tool: Higsfield/Kling]` Enable `multi-shot` and add the desired number of shots (up to 6).
    3.  `[Tool: Higsfield/Kling]` Write a simple prompt for each shot describing the action, camera angle, and dialogue (e.g., `change angle to side profile and man says...`).
    4.  `[Tool: Higsfield/Kling]` Set video duration (optional; the model analyzes text length to time cuts).
*   **Complex Multi-Shot Video with Consistent Characters:**
    1.  `[Tool: Gemini/Nana Banana Pro]` Generate multiple angles of your character (close-up, full body, side profile). Use the `Angles 2.0` app to auto-generate 12 angles from one image.
    2.  `[Tool: Veo/Kling]` Create an `Element` for each character by uploading these source images. Give it a short name (e.g., "Seb").
    3.  `[Tool: Higsfield/Kling]` Drag in a starting frame that includes the characters.
    4.  `[Tool: Higsfield/Kling]` Enable `multi-shot`. In prompts, use `@element_name says [dialogue]` to assign dialogue and lock character identity.
    5.  `[Tool: ChatGPT]` To set shot timings, paste the script into ChatGPT and ask: "How long do you think each sentence will be?"
*   **Video-to-Video Style Transfer (Omniedit):**
    1.  `[Tool: Veo/Kling Omniedit]` Select the `Omniedit` model and upload the source video.
    2.  `[Tool: Gemini/Nana Banana Pro]` (Optional) Generate a target style image for the new background or lighting.
    3.  `[Tool: Veo/Kling Omniedit]` Prompt the change using `@video` and `@image` references. Example: `restyle @video with the style of @image`.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)

*   `[Tool: Gemini/Nana Banana Pro]` **Generate multiple angles:** Use a base image with the "Angles 2.0" app and click `Generate from 12 best angles`.
*   `[Tool: Gemini/Nana Banana Pro]` **Combine characters:** `combine character one and character 2 in the same environment and have Deadpool as the wedding officient.`
*   `[Tool: Gemini/Nana Banana Pro]` **Swap a person into a scene:** `take the framing and start from image one and replace the man to be the one from image two`.
*   `[Tool: Gemini/Nana Banana Pro]` **Change background, keep subject:** `Use this image as the base, but keep the composition the same... but change the background and now give me backgrounds where I'm on a movie set and also give me one where I'm on a battlefield.`
*   `[Tool: Custom GPT]` Use a specialized GPT ("Nano Banana Pro prompt creator") by providing a reference image and a text goal, e.g., `Give me a prompt to recreate this exact same image, but change the woman to Margot Robbie.`

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)

*   `[Tool: Veo/Kling]` **Camera Moves:** Explicitly state camera changes in multi-shot prompts.
    *   `change angle to side profile`
    *   `front closeup of the man`
    *   `pans back to @Deadpool`
*   `[Tool: Veo/Kling]` **Dialogue Structure:** Use the format `[character/element] says [dialogue]`.
    *   Simple: `man says "Hollywood is officially cooked."`
    *   With Elements: `@Seb says with an irrepressible smile "because clink 3.0 can generate multi-shot scenes in one go."`
*   `[Tool: Veo/Kling]` **Style Transfer (Omniedit):** Use `@` references for source and style.
    *   `restyle @video but change the background to be a snowy mountain.`
    *   `restyle @video with the with the style of @image.`
*   `[Tool: Veo/Kling]` **Believable Motion:** For realistic camera movement, use the `Elements` feature. Providing multiple character angles gives the model more data to generate motion that feels shot on a real camera.

### 4. Product & character consistency (how they keep the product identical across shots)

*   `[Tool: Veo/Kling]` **Use the `Elements` feature.** This is the primary method for character consistency.
*   `[Tool: Veo/Kling]` To create an `Element`, upload multiple images of the character.
*   `[Tool: Gemini/Nana Banana Pro]` The best source images for an `Element` are a **close-up**, a **full body shot**, and a **side profile**.
*   `[Tool: Veo/Kling]` In prompts, reference the character using its element name prefixed with `@` (e.g., `@Seb`, `@Marot`).
*   `[Tool: Veo/Kling]` For iconic, well-known figures, you can often just use `@CharacterName` (e.g., `@Deadpool`) without creating a custom element.

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)

*   `[Tool: Higsfield/Kling]` The `multi-shot` feature supports up to **6 shots** per generation.
*   `[Tool: Veo/Kling]` The model automatically times cuts based on dialogue length if durations aren't specified.
*   `[Tool: General]` To manually time shots, say the dialogue aloud to estimate duration.
*   `[Tool: ChatGPT]` To automate timing, paste the script into ChatGPT and ask it to estimate the duration of each line.
*   `[Tool: Veo/Kling]` Example timing from the video: 4-second first shot, 3-second second shot, 2-second third shot.

### 6. Music & sound (how they score, SFX, voice, mixing)

*   `[Tool: Veo/Kling]` The model has **native audio generation**, creating lip-synced dialogue directly from the prompt text.
*   `[Tool: Veo/Kling]` It automatically identifies who is speaking based on `@element_name` tags in a multi-shot prompt.

### 7. Common failures and fixes

*   **Failure:** Inconsistent character appearance or unrealistic camera movement in a video.
*   **Fix:** `[Tool: Veo/Kling]` Use the `Elements` feature with multiple character angles (close-up, full body, side profile) instead of just a single start frame.
*   **Failure:** Not knowing what prompts to write.
*   **Fix:** `[Tool: Custom GPT]` Use specialized GPTs for image prompting ("Nano Banana Pro") and video prompting ("Kling 3.0 prompt generator").
*   **Failure:** Difficulty creating multiple consistent angles of a character for an `Element`.
*   **Fix:** `[Tool: Higsfield Apps]` Use the `Angles 2.0` app to automatically generate 12 different angles from a single base image.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)

1.  `[Image Prompt]` `take the framing and start from image one and replace the man to be the one from image two`
2.  `[Video Prompt]` `change angle to side profile and man says because now you can have multi-shot videos`
3.  `[Video Prompt]` `@Seb says with an irrepressible smile "because clink 3.0 can generate multi-shot scenes in one go."`
4.  `[Video Prompt]` `pans back to @Deadpool saying, "Guys, come on. I don't have all day."`
5.  `[Video Prompt]` `restyle @video with the with the style of @image.`