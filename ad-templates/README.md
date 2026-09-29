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
- **Portrait 2:3** (e.g. 1024×1536), PNG or JPG, under 8 MB.
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
- `type` is `"poster"`. Video templates aren't supported yet.

### `prompt.txt`
- **Write it as a reusable template, never for one brand.** Every piece of content is a `[Placeholder]`, e.g. `[Main Headline]`, `[Offer / Price]`, `[Featured Food / Dish]`, `[Call to Action]`, `[Website / Contact]`. Use clear, descriptive names; the filling step reads them like a copywriter would.
- **Describe the design system, not one poster.** Cover the format and visual flow, the hero visual, the headline treatment, badges, icon or feature rows, typography hierarchy, colour, lighting, background and CTA style. The existing prompts are ~3,500–5,000 characters, and that level of detail is what makes results match the template.
- **Always include `[Brand Logo]` and say where it goes** (e.g. top-left). Adit keeps that spot empty and places the real logo there.
- **Never hard-code facts.** Prices, discounts, dates, phone numbers, websites, addresses, awards and statistics must be placeholders. If the user doesn't give them, Adit leaves them off the poster. It never invents them.
- **Don't paste a chat conversation.** The file should contain only the prompt. `_drafts/product-offer-prompt.txt` shows a chat transcript rewritten as a proper template.
- The importer rejects a prompt that has no `[Placeholders]` or is too short.

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
