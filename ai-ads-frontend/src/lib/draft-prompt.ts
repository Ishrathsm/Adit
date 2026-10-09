// Client-side, same-tab hand-off for the landing page's functional hero prompt.
// Deliberately sessionStorage-only — never carried in a URL param, since a user's
// ad prompt can contain sensitive business info. Best-effort: a confirmation-email
// link opened in a new tab won't have this, and that's an accepted, honest gap.

export type DraftProjectType = "poster" | "video";

export interface DraftPrompt {
  prompt: string;
  projectType: DraftProjectType;
  // Only meaningful when projectType is "video" — storyboard is a way of building
  // a video (shot by shot), not a separate output format alongside poster/video.
  storyboard: boolean;
  ts: number;
}

const DRAFT_KEY = "adit:draft-prompt";

export function saveDraftPrompt(draft: Omit<DraftPrompt, "ts">) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, ts: Date.now() }));
  } catch {
    /* sessionStorage unavailable (private mode, etc.) — hand-off just won't carry through */
  }
}

export function peekDraftPrompt(): DraftPrompt | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftPrompt) : null;
  } catch {
    return null;
  }
}

export function clearDraftPrompt() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// Short-lived relay from the moment a project is created for a draft, to the one
// project detail page that should prefill it — scoped by project id so a later,
// unrelated visit to any project page never picks up someone else's stale draft.
export function savePrefillForProject(projectId: string, prompt: string) {
  try {
    sessionStorage.setItem(`adit:prefill-${projectId}`, prompt);
  } catch {
    /* ignore */
  }
}

export function consumePrefillForProject(projectId: string): string | null {
  try {
    const key = `adit:prefill-${projectId}`;
    const value = sessionStorage.getItem(key);
    if (value) sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

// Settings and files picked in the prompt composer, handed to the project page it opens. Kept in
// memory (the composer navigates client-side), since files can't go through sessionStorage; a
// reload simply drops them and the page starts from its defaults.
export interface ComposerHandoff {
  aspectRatio?: string;
  // Video: one quick shot of `singleSeconds`, or a shot-by-shot ad.
  format?: "single" | "ad";
  singleSeconds?: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  enhance?: boolean;
  // Video: the picture the first shot starts from.
  startImage?: File | null;
  references?: { file: File; kind: "product" | "character" | "location" }[];
}

const handoffs = new Map<string, ComposerHandoff>();

export function saveHandoffForProject(projectId: string, handoff: ComposerHandoff) {
  handoffs.set(projectId, handoff);
}

export function takeHandoffForProject(projectId: string): ComposerHandoff | null {
  const handoff = handoffs.get(projectId) ?? null;
  handoffs.delete(projectId);
  return handoff;
}
