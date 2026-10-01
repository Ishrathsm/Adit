# How To Use Google VEO 3 JSON Prompting To Create $100k AI Ads
Dan Kieft · https://www.youtube.com/watch?v=afzbZYC6fCM

### 1. Workflow (the steps, in order)
*   Platform: Use OpenArt or Google Flow.
*   Select the "text to video" model. (VEO 3)
*   Set Model: `VEO 3`.
*   Set Resolution: `1080p`.
*   Set Video Mode: `fast` (cheaper) or `normal`.
*   Audio: Leave it `on` to get generated sound effects.
*   Enter a structured "JSON prompt" for the video.

### 2. Video / motion prompting
*   Use a "JSON prompting" format to structure the video's sequence and elements. (VEO 3)
*   Structure the prompt to describe the scene in order. Include keys for: `what's going on`, `what we want to happen`, `what type of camera`, `what type of lighting`, `what type of room`, `what type of elements`. (VEO 3)
*   To generate these complex JSON prompts, use a custom chatbot trained on the required format. (ChatGPT)
*   Avoid overly simplistic, short prompts like `"box unboxing explosion"`. They do not work well. (VEO 3)

### 3. Music & sound
*   In the video generation settings, leave the audio option `on` to automatically generate "cool sound effect with your video." (OpenArt / Google Flow)

### 4. Common failures and fixes
*   **Failure:** The model may not generate the desired result on the first try. The Starbucks ad took "a few tries" and the perfume ad took "four or five tries".
*   **Fix:** Regenerate the video multiple times until you get a good result.
*   **Failure:** The model may struggle to accurately generate new or niche IP/characters (e.g., "labubu"). The transcript offers no specific fix for this.

### 5. Quotes worth keeping
*   (Prompt for a custom GPT to generate a VEO prompt): `"give me a JSON FO3 prompt of a box opening room transformation in let's do Tom and Jerry style."`
*   (Prompt for a custom GPT to generate a VEO prompt): `"Generate a cinematic prompt for Samsung product launch"`
*   (Key elements to include in a JSON prompt): `"what's going on, what we want to happen, what type of camera, what type of lighting, what type of room, what type of elements."`