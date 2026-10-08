// Overlays for the Swastea v3 cut (2026-10-08), made by the effects artist (src/lib/effects.ts):
// - the golden mandala, turning slowly (user: "a circulating mandala showing relief") for the sip;
//   the edit keys it onto the wall behind his head only;
// - the logo reveal with the tagline over the right half of the hero shot (no white end card).
// `npx tsx eval/swastea-overlays-v3.ts` → ~/Desktop/swastea/edit-v3/{mandala,logo-reveal}.mov
import { homedir } from "node:os";
import { join } from "node:path";
import { renderLogoReveal, renderMandala } from "../src/lib/effects";

const d = join(homedir(), "Desktop", "swastea");
(async () => {
  if (!process.argv.includes("logo")) await renderMandala(join(d, "mandala.png"), join(d, "edit-v3", "mandala.mov"), 1280, 720, 3.2, 0.57, 0.34, 600, undefined, 14);
  console.log("mandala");
  await renderLogoReveal(join(d, "logo-transparent.png"), "Roj piyo, swasth raho.", join(d, "edit-v3", "logo-reveal.mov"), 1280, 720, 4.0, 0.72, 0.35, 270,
    { font: "Karla", weight: 700, size: 42, color: "#0b2a15" }, false);
  console.log("logo reveal");
})().catch((e) => { console.error(e); process.exit(1); });
