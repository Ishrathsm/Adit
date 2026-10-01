# ALL Camera Movement Prompts for AI Filmmaking Explained
Dan Kieft · https://www.youtube.com/watch?v=7GWd4PV3hoA

### 1. Workflow
_(The transcript describes a library of shots, not a sequential pipeline workflow)_

### 2. Keyframe / Image Prompting (for Gemini)
*   **Framing:** Use standard cinematography terms: `close-up`, `medium shot`, `wide shot`, `extreme close-up`.
*   **Composition for Motion:** To set up a `push past` shot, include foreground obstructions in the prompt. Example: "...view of a mechanic's garage, **seen past hanging cables and tools**."
*   **Lens Effects:** To create a miniaturized look, use `tilt shift` which "blurs the top and the bottom of the frame."

### 3. Video / Motion Prompting (for Veo)
*   **Static & Tripod-Based Motion:**
    *   `static shot`
    *   `pan left`, `pan right`
    *   `whip pan` (a very fast pan)
    *   `tilt up`, `tilt down`
*   **Lens-Based Motion (Zoom):**
    *   `slow zoom in` / `slow zoom out`
    *   `fast zoom in` / `fast zoom out`
    *   `crash zoom in` / `crash zoom out` (extremely fast, often for comedic or shock effect)
*   **Camera-Based Motion (Dolly/Physical):**
    *   `dolly in` / `dolly out` (camera moves, lens is fixed)
    *   `truck shot` (camera moves physically sideways, parallel to the scene)
    *   `pedestal up` / `pedestal down` (camera moves vertically up/down without tilting)
    *   `slider shot` (short, controlled slide from left to right)
    *   `arc shot` (camera moves in a semi-circle around a subject)
    *   `orbit shot` (camera moves a full 360 degrees around a subject)
*   **Subject-Following Motion (Tracking):**
    *   `tracking shot` (camera moves to keep up with a subject)
    *   `follow shot over the shoulder`
    *   `reverse tracking` (camera moves backward in front of a character walking forward)
    *   `side tracking` (camera is parallel to a subject, traveling sideways with them)
    *   `low tracking shot` (camera is pointed below the belt, e.g., tracking a character's boots)
    *   `vehicle tracking`
    *   `chase shot` (use modifiers like `aggressive`, `messy`, `shaky`, `frantic` to describe the motion)
*   **Realistic / Human Motion:**
    *   `handheld shot`, `slight shakiness` (makes the shot feel more raw and realistic)
    *   `body mounted camera` or `snorricam` (camera locked to actor's torso, background shakes violently)
*   **Large-Scale Motion (Aerial/Crane):**
    *   `crane up` / `crane down`
    *   `drone shot` (can be combined with other moves: `drone orbit`, `drone push in`)
    *   `helicopter shot` (described as more gradual and steady than a drone shot)
*   **Special Effects Motion:**
    *   `first-person view` or `FPV`
    *   `infinite zoom` (a continuous, never-ending zoom inward)
    *   `earth zoom out` (camera rapidly moves from a close-up subject upward to a view of the planet)
    *   `time lapse`

### 7. Common Failures and Fixes
*   **Failure:** Generated video feels "robotic or almost too smooth."
*   **Fix:** Use `handheld shot` or `human camera movement` prompts to introduce natural, slight shakiness and a more realistic feel.

### 8. Quotes Worth Keeping
1.  **Snorricam:** "body mounted camera... snapped directly to the actor's chest, straight back at their face... their head stays completely frozen in the center of the screen, while the entire background shakes violently around them."
2.  **Reverse Tracking:** "reverse tracking, camera moving backwards, it takes the same pace as the character that walks forward and the camera is locked to the facial expression"
3.  **Low Angle Tracking:** "low tracking shot, camera is pointed to below the belt and is usually not focused on the eyes"
4.  **Push Past:** (Example logic) "a mechanic works in a garage and the camera is pushing forward past the cables."
5.  **Crash Zoom Out:** (Example logic) "you have a guy in a suit, then [crash zoom] out and see that he's not even wearing pants."