# $5K/Month With AI Product Ads (Step‑By‑Step Client Workflow)
Shreyas Raj · https://www.youtube.com/watch?v=Gam7jPrMjuA

### 1. Workflow (the steps, in order)
*   **Reference Gathering:**
    *   Screenshot the product from the client's website.
    *   Search Pinterest for `[product type] cinematic photography` for inspiration.
    *   Find and download a reference video ad (using a tool like Clip Pin).
    *   Create a mood board with all assets.
*   **Analysis & Scripting:**
    *   (Gemini) Upload the reference ad video and use the prompt "describe the video in the most complete manner and in the most detailed manner" to get a shot-by-shot breakdown.
    *   (Perplexity) Use the shot breakdown and inspiration images to generate detailed image prompts and a voiceover script.
*   **Asset Generation:**
    *   (Freepik) Generate a consistent "face" for the brand (a model image).
    *   (Freepik) Generate keyframes using a Gemini-variant model ("Nano Banana 2"), providing the product screenshot and the model's face as reference images for every shot.
    *   (Freepik / Kling) Animate the keyframes into video clips using motion prompts.
    *   (ElevenLabs) Generate the voiceover audio using the `Eleven V3` model.
*   **Post-Production:**
    *   (Pixabay) Source background music by searching for `BGM chill commercials`.
    *   (DaVinci Resolve) Assemble all video clips, voiceover, and music into a final ad.
    *   (Diffusion Studio) Upscale and stylize the final video using a text prompt.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)
*   (Perplexity) To generate prompt ideas, role-play in the prompt: "You're a senior creative analyst and strategist and creative director at [Brand Name]...give me some elaborate super juicy...prompts to create these kinds of visuals...keeping that product as a hero product."
*   (Freepik) For multi-shot scenes from one reference, use the "Storyboard" feature with the prompt: `"create a vertical 9 by 16 beauty ad storyboard"`.
*   (Freepik) Settings: Set aspect ratio to `9:16` and resolution to `2K`.

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)
*   (Freepik/Kling) Set clip length to `10-second video` when generating.
*   (Freepik/Kling) Use simple, descriptive camera motion prompts, e.g., `"A close-up shot for the cheekbones...Slowly push the camera towards her."`
*   (Diffusion Studio) For upscaling and finishing, use a descriptive prompt: `"upscale this video to 8K. Make sure that the resolution is super high and...looks has super premium shot inside a studio with high-end gear. Do color changes if required and upscale the video drastically."`

### 4. Product & character consistency (how they keep the product identical across shots)
*   (Freepik) Generate one ideal "model" or "face" image for the campaign first.
*   (Freepik) In every subsequent keyframe generation, use two consistent reference images: 1) the original product screenshot from the website, and 2) the pre-generated model's face.

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)
*   **Shot Length:** Generate `10-second` clips to provide ample footage for editing.
*   **Pacing:** Edit the voiceover script to a target duration (e.g., "20-second read") to dictate the final ad's pace.
*   **Structure:** Open with a shot of the model's face, then introduce the product, then intercut between the model using/interacting with the product and beauty shots of the product.
*   **Selection:** Generate more shots and clips than needed, then shortlist the best ones for the final edit.

### 6. Music & sound (how they score, SFX, voice, mixing)
*   (ElevenLabs) Use the `Eleven V3` model for voiceover generation.
*   (ElevenLabs) Preview multiple voices to find one that matches the brand's desired tone (e.g., "soft, sultry" but not "too much").
*   (Pixabay) Search for `BGM chill commercials` to find royalty-free background music.

### 7. Common failures and fixes
*   **Unrealistic AI Images:** If the AI generates an image with an "AI-ish look" or incorrect textures (e.g., the cream looks "diabolical"), the fix is to generate multiple variations and cherry-pick the best ones. No in-tool fix was used, only re-rolling.
*   **Underwhelming LLM Output:** If an LLM (like Gemini) gives a basic output, simplify the prompt. The author noted adding more paragraphs to the prompt did not improve Gemini's video analysis.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)
*   **Video Analysis (Gemini):** "describe the video in the most complete manner and in the most detailed manner."
*   **Image Prompt Generation (Perplexity):** "You're a senior creative analyst and strategist and creative director at [Brand Name]...give me some elaborate super juicy...prompts to create these kinds of visuals...keeping that product as a hero product."
*   **Storyboard Prompt (Freepik):** "create a vertical 9 by 16 beauty ad storyboard"
*   **Motion Prompt (Freepik/Kling):** "A close-up shot for the cheekbones starting to provide the start of the model's face in the camera. Slowly push the camera towards her."
*   **Upscaling & Finishing (Diffusion Studio):** "upscale this video to 8K...make sure that the video looks has super premium shot inside a studio with high-end gear. Do color changes if required and upscale the video drastically."