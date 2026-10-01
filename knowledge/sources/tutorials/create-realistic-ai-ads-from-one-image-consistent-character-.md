# Create Realistic AI Ads from One Image (Consistent Character + Products)
Speel · https://www.youtube.com/watch?v=vMzwO1kRX70

### 1. Workflow (the steps, in order)

*   **Character Creation:** Generate a single, high-quality "brand hero" source image. (Ideogram)
*   **Shot List Generation:** Input the source image and ad concept into a custom GPT to generate a list of varied shot prompts.
*   **Keyframe Generation:** In Spiel, upload the source image and product image. Use the prompts from the GPT to generate multiple static keyframe images.
*   **Video Generation:**
    *   Switch to "UGC builder" mode. (Spiel)
    *   Upload a generated keyframe.
    *   Select "Easy mode" for fast generation (~2 minutes).
    *   Paste your script.
    *   Write a motion prompt in the "directing" box.
    *   Generate the video clip. (Spiel)
*   **Audio Enhancement:**
    *   Extract the audio from the generated video. (e.g., CapCut, Premiere Pro)
    *   Record yourself reading the script with human intonation and upload to 11 Labs. Use the "voice changing" feature to apply an AI voice to your performance.
    *   Generate subtle background ambiance audio. (11 Labs)
*   **Final Assembly:** Combine the AI video (muted), the new voice track, and the background ambiance in an editor.

### 2. Keyframe / image prompting (exact phrasing, structure, what to include)

*   Use search terms like `realistic influencer` to find inspiration or base prompts. (Ideogram)
*   To generate variations from a source image, use prompts that change the setting and action. (Custom GPT for Spiel)
    *   `wide shot outdoors with the product in hand`
    *   `same model in the passenger seat of a car`
    *   `lifestyle shot in a kitchen holding a coffee cup`
*   To include a product, upload a product image and add instructions like `instruct the avatar to hold it` to the prompt. (Spiel)

### 3. Video / motion prompting (exact phrasing; camera moves; how to keep motion believable; negative prompts)

*   Use the "directing" text box to script character actions. (Spiel)
*   Describe actions sequentially, including timing.
*   Example: `she speaks directly to the camera whilst presenting the bottle. At the end of the video, she takes a drink from the bottle.` (Spiel)

### 4. Product & character consistency (how they keep the product identical across shots)

*   Use one single source image ("brand hero") as the reference for all subsequent character image generations. (Spiel)
*   For product consistency, upload one specific product image and reference it in prompts for all shots where it appears. (Spiel)

### 5. Shot design & editing (shot lengths, cuts, pacing, structure of the ad)

*   Generate a variety of shots (e.g., wide, close-up, different backgrounds) to create a "shot list" before generating video.
*   Stitch together multiple short video clips to create a more engaging final ad.

### 6. Music & sound (how they score, SFX, voice, mixing)

*   **Humanize AI Voice:** To fix robotic intonation, record your own voice performance, upload it to 11 Labs, and use the "Voice Changing" feature to apply a target AI voice. The AI will adopt your pacing and intonation.
*   **Add Ambiance:** Generate subtle background soundscapes to eliminate unnatural silence. (11 Labs)
*   **SFX Prompt:** `light indoor ambiance with faint room echo, subtle movement sounds, and natural background tones.` (11 Labs)

### 7. Common failures and fixes

*   **Failure:** AI voice sounds "tinny" or lacks human intonation.
*   **Fix:** Use the 11 Labs voice-changing workflow to map a human-read performance onto the AI voice.
*   **Failure:** The video has an unnaturally silent background behind the dialogue.
*   **Fix:** Generate and mix in subtle environmental ambiance from 11 Labs.

### 8. Quotes worth keeping (verbatim prompt examples, max 5)

*   **Image Prompt:** `realistic influencer` (Ideogram)
*   **Image Prompt:** `wide shot outdoors with the product in hand` (Custom GPT for Spiel)
*   **Motion Prompt:** `she speaks directly to the camera whilst presenting the bottle. At the end of the video, she takes a drink from the bottle.` (Spiel)
*   **SFX Prompt:** `light indoor ambiance with faint room echo, subtle movement sounds, and natural background tones.` (11 Labs)