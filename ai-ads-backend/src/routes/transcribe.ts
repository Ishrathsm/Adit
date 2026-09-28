import express, { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import type { AuthedRequest } from "../middleware/auth";
import { env } from "../lib/env";
import { withRateLimitRetry } from "../lib/rate-limit-retry";

// Dictation fallback for browsers without built-in speech recognition (Firefox): the page records
// a short clip and this turns it into text. Gemini handles Indian English, Hindi, Telugu, Tamil
// and code-mixed speech, which is how people actually describe their ads.
export const transcribeRouter = Router();

const genAI = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;

// About a minute of opus audio is well under this; anything bigger isn't a prompt.
const MAX_BASE64 = 6 * 1024 * 1024;
const MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

transcribeRouter.post("/", express.json({ limit: "8mb" }), async (req: AuthedRequest, res) => {
  const { audio, mimeType } = req.body ?? {};
  const baseMime = typeof mimeType === "string" ? mimeType.split(";")[0] : "";
  if (typeof audio !== "string" || !audio || audio.length > MAX_BASE64) {
    return void res.status(400).json({ error: "audio must be a base64 recording under about a minute" });
  }
  if (!MIME_TYPES.includes(baseMime)) return void res.status(400).json({ error: "unsupported audio format" });
  if (!genAI) return void res.status(503).json({ error: "transcription is not configured" });

  try {
    const response = await withRateLimitRetry("transcribe", () =>
      genAI.models.generateContent({
        model: env.imageCheckModel,
        contents: [
          { inlineData: { data: audio, mimeType: baseMime } },
          "Transcribe exactly what the speaker says, as clean written text with normal punctuation. Keep their words and language (write Hindi, Telugu or Tamil words in their own script, English in English). Remove filler sounds like um and uh. Return only the transcript — no quotes, labels, or notes. If nothing is said, return an empty response.",
        ],
      }),
    );
    res.json({ text: response.text?.trim() ?? "" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
