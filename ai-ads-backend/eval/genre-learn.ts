// Learns what separates effective from weak famous-brand ads in a genre, from the Pitt ad dataset's
// human annotations (effectiveness 1-5, exciting, funny, sentiment, and 5 viewers' "what should I
// do / why" answers). Text only — no video is processed. Usage: npx tsx eval/genre-learn.ts <genre_famous.json> <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
type Row = { brand: string; title: string; effective: number; exciting: number; funny: number; sentiment: string | null; action: string[]; reason: string[] };

(async () => {
  const [file, out] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Row[]>;
  await Promise.all(Object.entries(data).map(async ([genre, rows]) => {
    const lines = rows.map((r) => `[eff ${r.effective} | exciting ${r.exciting.toFixed(1)} | funny ${r.funny.toFixed(1)} | ${r.sentiment ?? "-"}] ${r.brand} — "${r.title}" | viewers' why: ${r.reason.map((x) => x.trim()).join(" / ")}`).join("\n");
    const prompt = `Below are ${rows.length} real ads by famous brands in the "${genre}" genre, from an academic dataset. Each was rated by ~5 viewers for effectiveness (1-5), exciting and funny (0-1 share of viewers), dominant sentiment, and each viewer wrote why the ad says they should act ("viewers' why").

Analyse them like a head of strategy teaching a copywriter. Be concrete and cite brands/ad titles as evidence. Headings:
1. What the most effective ads (eff 5) have in common — propositions, devices (demo, metaphor, humour, celebrity, mascot, story, emotion), tone.
2. What the weakest (eff ≤ 3) do wrong.
3. The propositions viewers actually repeat back — list the 10 clearest "because…" reasons in this genre.
4. Do exciting / funny / particular sentiments help here? (use the numbers)
5. Brand-specific patterns worth copying (e.g. how McDonald's vs Burger King, Apple vs Samsung, Nike vs Dove differ).
6. 10 concrete rules for writing an ad in this genre (idea, proposition, VO/copy, tone, tagline), each backed by an example from the data.
Keep it tight. Note sample-size caveats.

DATA:
${lines}`;
    const r = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt });
    writeFileSync(join(out, `${genre}-dataset-analysis.md`), `# ${genre}: what separates effective famous-brand ads (Pitt dataset, n=${rows.length})\n\n${r.text ?? ""}`);
    console.log(genre, "done", (r.text ?? "").length);
  }));
  process.exit(0);
})();
