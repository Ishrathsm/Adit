# Ad templates

This folder is the source for Adit's **Templates** library, the cards on the Projects page. A user clicks a template, sees a large preview, and presses **Remix with this template**. Adit then makes their own ad in the same style: their product, their copy and their logo.

You add a template by adding a folder here, then running the import script (see below).

## How a remix works (why the rules below matter)

For each remix, Adit sends the image model four things:

1. **Your prompt** (`prompt.txt`), with every `[Placeholder]` filled in from what the user typed. Anything the user didn't give is removed.
2. **Your template image**, as a style reference. The model copies its layout, typography, colours and finish, but none of its words or products.
3. **The user's product photos**, if they uploaded any.
4. **The user's logo**, which is placed on the finished poster afterwards. The model never draws it.

A proofreader then checks every word on the result against the approved copy and regenerates if anything is wrong.

## Folder format

One folder per template. Use lowercase with dashes for the folder name:

```
ad-templates/
  food-restaurant-promotion/
    template.png     the finished example poster
    prompt.txt       the reusable prompt, with [Placeholders]
    meta.json        name, description, type
```

`food-restaurant-promotion/` is the reference example. Copy its structure.

Folders starting with `_` (like `_drafts/`) are ignored by the importer, so keep work-in-progress there.

### `template.png`
- A **finished, fully designed** poster, exactly the kind of result users should get.
- Use the template's own real design dimensions — don't crop or resize it to force a "clean" ratio. Any ratio Remix supports works: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9. PNG or JPG, under 8 MB.
- The importer reads this file's actual pixel dimensions and stores the nearest of those ratios as the template's own `aspect_ratio` — used only when generating a *new* remix (the image model only draws at a fixed set of ratios, so an exotic ratio still gets matched to its closest supported one for that step). The thumbnail itself is never cropped, stretched, or forced into a box — it always displays at its true, full, original shape.
- Placeholder text on it (`[Brand Logo]`, `[Website]`) is fine. The model is told never to copy the template's words.

### `meta.json`
```json
{
  "name": "Food & Restaurant Promotion",
  "description": "One sentence shown in the preview: what it looks like and who it's for.",
  "type": "poster"
}
```
- `name` must be unique. It's the card title, and the importer skips a name that already exists.
- `type` is `"poster"` (see [Video templates](#video-templates) for `"video"`).
- `aspectRatio` (optional): one of `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9`, `21:9`. Only set this if the template's intended ratio genuinely isn't what `template.png`'s own pixels say — normally omit it and let the importer derive it from the image.

### `prompt.txt`
- **Write it as a reusable template, never for one brand.** Every piece of content is a `[Placeholder]`, e.g. `[Main Headline]`, `[Offer / Price]`, `[Featured Food / Dish]`, `[Call to Action]`, `[Website / Contact]`. Use clear, descriptive names; the filling step reads them like a copywriter would.
- **Describe the design system, not one poster.** Cover the format and visual flow, the hero visual, the headline treatment, badges, icon or feature rows, typography hierarchy, colour, lighting, background and CTA style. The existing prompts are ~3,500–5,000 characters, and that level of detail is what makes results match the template.
- **Always include `[Brand Logo]` and say where it goes** (e.g. top-left). Adit keeps that spot empty and places the real logo there.
- **Never hard-code facts.** Prices, discounts, dates, phone numbers, websites, addresses, awards and statistics must be placeholders. If the user doesn't give them, Adit leaves them off the poster. It never invents them.
- **Don't paste a chat conversation.** The file should contain only the prompt. `_drafts/product-offer-prompt.txt` shows a chat transcript rewritten as a proper template.
- The importer rejects a prompt that has no `[Placeholders]` or is too short.

## Video templates

A video template is a proven ad recipe. The user watches its sample film, picks 15s or 30s, describes their own ad in the prompt bar, and lands on the video storyboard page with the template's settings filled in. The director follows the template's notes with the user's product and brand.

```
ad-templates/
  smooth-ride-vehicle-film/
    preview.mp4      the sample film (720p, under 15 MB; ~3–5 MB is plenty)
    prompt.txt       the director's notes: story structure, camera, edit, sound, things to avoid
    meta.json        name, description, type "video", ratio, recipe
```

`meta.json` for a video template:

```json
{
  "name": "Smooth Ride Vehicle Film",
  "description": "One sentence shown in the preview.",
  "type": "video",
  "aspectRatio": "16:9",
  "posterAt": 19,
  "hoverAt": 13,
  "recipe": {
    "tone": "bold",
    "look": "cinematic",
    "plans": [
      { "length": 15, "shotCount": 2, "shotSeconds": 6 },
      { "length": 30, "shotCount": 4, "shotSeconds": 6 }
    ],
    "voiceover": false,
    "sampleSeconds": 30,
    "provide": ["A clear photo of your vehicle (side view)", "Three features with one spec each"]
  }
}
```

- `aspectRatio` is `16:9` or `9:16` (the only ratios video supports).
- `posterAt` is the second of the sample used as the card's still; `hoverAt` is where the 5-second silent hover loop starts. The importer makes both.
- `recipe` is what the storyboard form starts from: `tone` and `look` use the form's values, and each plan is shots × seconds (4, 6 or 8) plus the end card, at most 32s of footage.
- `prompt.txt` is director's notes, not a poster prompt, so it needs no `[Placeholders]`. Describe the structure beat by beat and never name the sample's brand.

## Importing

From `ai-ads-backend/`, with the backend `.env` in place (it needs the Supabase and Google Cloud keys):

```bash
npx tsx scripts/import-templates.ts --dry-run          # check every folder, upload nothing
npx tsx scripts/import-templates.ts                    # import every new template
npx tsx scripts/import-templates.ts my-new-template    # import just one folder
```

Templates already in the library (same `name`) are skipped, so it's safe to re-run. To replace one, change its `name` or delete the old row from the `templates` table first.

## Testing a template before users see it

Every template should be remixed at least once before it goes live:

```bash
npx tsx eval/template-test.ts <templateId> "Paradise Spice, Hyderabadi biryani, 20% off this weekend. Order now." out.png
```

Check the result for:
- the layout, typography and finish of the template
- correct spelling
- no copied template text
- no invented contact details

Test with a request that leaves some details out (no phone or website) to confirm those elements disappear cleanly.
