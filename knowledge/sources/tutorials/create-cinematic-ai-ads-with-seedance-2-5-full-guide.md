# Create Cinematic AI Ads with Seedance 2.5 - Full guide
Dan Kieft · https://www.youtube.com/watch?v=kGku3TTiYO8

### 1. Workflow
*   Collect reference images for the desired visual style into a lookbook (using Pinterest, Shotdeck, film.ai).
*   Upload lookbook images to an LLM to generate a "visual style reference prompt" defining the lighting, color, and mood. (`Claude`)
*   Create a "detailed product sheet" from a single product photo to define its 3D form, textures, and details. (`GPT image`, `Seedrem 5.0 Pro`)
*   Generate a separate, clean close-up image of the product label with perfect text.
*   Generate video shots using prompts that combine:
    1.  The action/scene description.
    2.  The "visual style reference prompt".
    3.  The product sheet image.
    4.  The character sheet image.
    5.  The label text close-up image.
*   To create variations of a successful ad, use an ad multiplier tool to swap character or product sheets. (`Higgsfield MCP` in `Claude`)

### 2. Keyframe / image prompting
*   To generate a style guide: Upload reference images and ask the LLM to "analyze these images, to focus on the lighting, the colors, and also to generate a prompt based upon the style of this." (`Claude`)
*   To fix illegible text on a product: Generate a dedicated reference image with a prompt like "create a close-up of the labels fresh zesty lime bold chili kick and crunchy potato chips." (Image Generator)
*   To create a product sheet: Use a prompt that asks the model to create a multi-view sheet showing front, back, side, functional use, logo close-ups, and texture details from a single product image. (`GPT image`)

### 3. Video / motion prompting
*   Structure the action with a timeline prompt, "explaining what's happening when."
*   Example scene prompt: "one single continuous 8-second live-action shot. The man is sitting on the toilet. He's eating a bag of Zesta Crisps, and then there is a horse head smashing through the door on the side wall." (`Higgsfield`)

### 4. Product & character consistency
*   **Visual Style:** Use a consistent "visual style reference prompt" (generated from a lookbook) in every single prompt to maintain color and lighting.
*   **Character:** Include a "character sheet" (an image of the character) in the generation prompt. (`Higgsfield`)
*   **Product Geometry:** Use a "detailed product sheet" image in prompts to maintain the product's shape, size, and proportions.
*   **Product Text:** In the prompt, designate a specific reference image as the authority for text: "image 2 corresponds with the close-ups of the front label. Use this as the authority for the exact wording, typeface, weight, color, line breaks, and the layout of the front label." (`Higgsfield`)

### 5. Shot design & editing
*   Create a "scroll stopper" hook within the first 5 seconds with a surprising or random event.
*   Example shot length for a hook: "8-second live-action shot."

### 7. Common failures and fixes
*   **Failure:** Visual style is inconsistent between shots.
*   **Fix:** Generate a "visual style prompt" from a curated lookbook and include it in every generation prompt. (`Claude`)
*   **Failure:** Gibberish or incorrect text on product labels.
*   **Fix:** Generate a separate close-up image of the label with correct text and explicitly tell the model in the prompt to use that image as the "authority" for all text attributes.
*   **Failure:** Product shape and size are inconsistent.
*   **Fix:** Create and use a multi-view "product sheet" as a reference image in all prompts.

### 8. Quotes worth keeping
*   **For creating a text reference image:** "create a close-up of the labels fresh zesty lime bold chili kick and crunchy potato chips."
*   **For enforcing text accuracy:** "image 2 corresponds with the close-ups of the front label. Use this as the authority for the exact wording, typeface, weight, color, line breaks, and the layout of the front label."
*   **For a video scene description:** "one single continuous 8-second live-action shot. The man is sitting on the toilet. He's eating a bag of Zesta Crisps, and then there is a horse head smashing through the door on the side wall."
*   **For generating a style guide from images:** "analyze these images, to focus on the lighting, the colors, and also to generate a prompt based upon the style of this."
*   **For creating ad variations:** "Use the Hixfeld MCP. I want to duplicate my ad with three different other flavors of the chips. I will upload two references of each flavor and one is the product sheet and the other is the close-up of the labels."