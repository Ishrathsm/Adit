// Hand edits to the Torvik v3 script after the user's ABS call (static detail) and the supervisor's
// last-round leftovers. Writes eval/out/torvik-script-v3-final.json.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { composeShot, type ShotSpec } from "../src/lib/text-gen";

const file = join(__dirname, "out", "torvik-script-v3.json");
const data = JSON.parse(readFileSync(file, "utf8"));
const shots: { description: string; spec: ShotSpec; assetNames: string[] }[] = data.script.shots;
const edit = (n: number, patch: Partial<ShotSpec>) => {
  const shot = shots[n - 1];
  shot.spec = { ...shot.spec, ...patch };
  shot.description = composeShot(shot.spec);
};

edit(2, {
  framing: "Close-up of the parallel-twin engine's brushed-aluminium covers, with the lower edge of the fuel tank and its copper TORVIK badge fully visible across the top of the frame.",
  action: "The engine block visibly shudders as it fires and settles into a deep, steady idle. The copper TORVIK badge on the tank above is sharp and fully readable.",
  lighting: "Dark garage, lit by spill from the bike's headlight (now on) from camera-right, raking across the engine fins and catching the copper badge.",
});
edit(3, {
  purpose: "BUILD / Dual-Channel ABS: the copper caliper and ABS ring revealed as the garage wakes up.",
  framing: "Locked macro of the front brake: the copper-anodised caliper gripping the disc and the toothed ABS sensor ring beside it, filling the frame; calm dark space in the upper third for the callout.",
  lens: "100mm macro, shallow depth of field on the caliper.",
  movement: "Locked-off. The camera does not move.",
  action: "The bike stands still. As the garage door rolls up out of frame, a band of warm golden light sweeps slowly across the caliper from right to left, revealing its copper finish and the ABS ring. Nothing else moves.",
  performance: null,
  lighting: "Dark garage; a soft-edged band of low golden sunlight from camera-right travels across the brake as the door opens.",
  sfx: "The rattle of the rolling garage door, low and distant.",
  seconds: 1.5,
});
edit(5, {
  purpose: "BUILD: confident control on the road, the front wheel and copper caliper at a steady speed.",
  action: "On the ghat road, the bike holds a constant, controlled speed on a straight approach to a bend. The camera, locked to the front axle, keeps the wheel and copper caliper sharp as the road streams past.",
});
edit(11, {
  framing: "Close-up from behind and slightly low, on the bike's slim tail section, LED tail light and rear wheel as they lean into the arc; the rider's back at the top of frame.",
});

data.script.audit = [...(data.script.audit ?? []), []];
writeFileSync(join(__dirname, "out", "torvik-script-v3-final.json"), JSON.stringify(data, null, 2));
shots.forEach((s, i) => console.log(`${i + 1}. [${s.spec.seconds}s] ${s.spec.purpose}`));
