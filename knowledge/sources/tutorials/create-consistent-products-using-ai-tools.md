# Create Consistent Products Using AI Tools
Curious Refuge · https://www.youtube.com/watch?v=CnjdhAxcXu8

### 1. Workflow
*   **(Kive AI) Image Generation:**
    1.  Go to `Product Shots` > `New AI Model`. Select `Object`.
    2.  Upload multiple product photos from various angles and in different lighting.
    3.  Name the model (e.g., `bath oil`).
    4.  Once trained, click `Use Model`.
    5.  Set aspect ratio (e.g., 16x9).
    6.  Select a specific angle from your trained assets, then scale and position it in the frame.
    7.  Write your image prompt using the model name (e.g., `at bath oil`).
    8.  Generate the image.
    9.  (Optional) Upscale to 4K.
*   **(RenderNet) Image Generation:**
    1.  Go to `Studio` > `Product Photo`.
    2.  Upload a single product image.
    3.  Select a preset scene/person.
    4.  Manually scale and position your product onto the scene (e.g., into the person's hand).
    5.  Generate the photo.
*   **(RenderNet) Video Generation:**
    1.  After generating an image, click `Convert to Video`.
    2.  Crop to a 16x9 or 9x16 aspect ratio.
    3.  Write a video prompt for the action.
    4.  Specify a camera move in the prompt.
    5.  Select a video model (e.g., `Google V2`).
    6.  Generate the video.

### 2. Keyframe / Image Prompting
*   **(Kive)** Use the syntax `a photo of at [model name] [scene description]`.
*   **(Kive)** Include specific lighting, environment, and mood descriptors: `on the beach at golden hour` or `in the desert, golden sand dunes at sunset, dramatic shadows, clear blue sky with wispy clouds`.
*   **(Kive)** For a studio look, use phrases like: `in a professional editorial photo shoot with professional lighting, intense shadows, and a moody atmosphere`.

### 3. Video / Motion Prompting
*   **(Kive)** Use the built-in camera movement controls, e.g., select `orbit to the left`.
*   **(RenderNet)** Combine an action prompt with a camera movement prompt: `The man smiles as he holds the product` and `the camera slowly zooms in`.
*   **(RenderNet)** Select a specific video generation model, like `Google V2`.

### 4. Product & Character Consistency
*   **(Kive)** Train a custom "Object" model by uploading 5+ photos of your product. For best results, use shots with `different angles in different lighting scenarios`.
*   **(Kive)** The tool isolates the product from your uploads, allowing you to select a specific pre-trained angle and place it in the composition before generating the new scene around it.
*   **(RenderNet)** Upload a single product photo. Manually place and scale this reference image onto a stock background/character before generation to control its size and position.

### 5. Shot Design & Editing
*   **(Kive)** Set the aspect ratio (e.g., `16x9`) before generation.
*   **(Kive)** Manually position the product for composition before generating, e.g., `frame it up a little to the left`.
*   **(Kive)** Use the built-in `erase`, `replace`, `relight`, and `background removal` tools for post-generation adjustments.

### 7. Common Failures and Fixes
*   **Problem:** Warped or illegible text on products in AI video. (Observed in Kive's native image-to-video).
*   **Fix:** Take the high-quality static image and use a different, more robust video tool. The tutorial found better text fidelity with **Cling** and **Runway Gen 4**.
*   **Problem:** Unrealistic physics in generated images (e.g., a bottle balanced impossibly).
*   **Fix:** Generate multiple variations and choose the most physically plausible option.
*   **Problem:** Low-quality object replacement. (Observed in Kive's "replace" feature).
*   **Fix:** No direct fix offered; implies this feature is unreliable and should be used with caution.

### 8. Quotes Worth Keeping
*   **(Kive Image Prompt)** `a photo of Acme Serum in the desert, golden sand dunes at sunset, dramatic shadows, clear blue sky with wispy clouds.`
*   **(Kive Image Prompt)** `in a professional editorial photo shoot with professional lighting, intense shadows, and a moody atmosphere.`
*   **(Kive Image Prompt)** `a photo of at bath oil on the beach at golden hour.`
*   **(RenderNet Video Prompt)** `the man smiles as he holds the product`
*   **(RenderNet Camera Move)** `the camera slowly zooms in.`