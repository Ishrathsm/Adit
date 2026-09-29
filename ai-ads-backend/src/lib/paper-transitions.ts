// Paper-cut transitions for the stop-motion look, built in the edit as ffmpeg xfade custom masks:
// a torn edge, a straight paper-layer edge, a card folding shut, a paper iris. Each moves in a few
// held steps (like the animation on twos) and draws a thin white paper edge along the cut, so the
// incoming shot reads as a sheet laid over the outgoing one. Veo is never asked to perform them.

export const PAPER_TRANSITIONS = ["tear-right", "tear-diagonal", "wipe-right", "wipe-left", "wipe-down", "wipe-up", "fold", "iris", "cut"] as const;
export type PaperTransition = (typeof PAPER_TRANSITIONS)[number];

// Held steps across the transition — at 0.5s that's a new position every other frame at 24fps.
const STEPS = 6;
// xfade's P runs 1 → 0 across the transition; q is the stepped progress 0 → 1.
const Q = `(floor((1-P)*${STEPS})/${STEPS})`;
// Paper edge width, as a fraction of the frame.
const EDGE = 0.012;
const PAPER = "if(eq(PLANE,0),238,128)";
// Irregular torn profile along the cut (normalized units): a few low-frequency waves plus fibre.
const torn = (v: string) => `(0.022*sin(${v}*9)+0.011*sin(${v}*29+1.3)+0.005*sin(${v}*83+2.1)+0.0025*sin(${v}*233+0.4))`;

// Pixel rule for a boundary value d (distance past the cut): the incoming shot where d < -EDGE,
// paper along the edge, the outgoing shot beyond.
const byDistance = (d: string) => `if(lt(${d},-${EDGE}),B,if(lt(${d},0),${PAPER},A))`;

// The ffmpeg xfade custom expression for a paper transition, or null for a plain cut.
export function paperTransitionExpr(kind: PaperTransition): string | null {
  const x = "(X/W)";
  const y = "(Y/H)";
  switch (kind) {
    case "tear-right":
      return byDistance(`(${x}-(${Q}*1.12-0.06+${torn(y)}))`);
    case "tear-diagonal":
      // The tear runs from top-left to bottom-right: distance along the diagonal.
      return byDistance(`((${x}+${y})/2-(${Q}*1.12-0.06+${torn(`((${x}-${y})/2)`)}))`);
    case "wipe-right":
      return byDistance(`(${x}-(${Q}*1.04-0.02))`);
    case "wipe-left":
      return byDistance(`((1-${x})-(${Q}*1.04-0.02))`);
    case "wipe-down":
      return byDistance(`(${y}-(${Q}*1.04-0.02))`);
    case "wipe-up":
      return byDistance(`((1-${y})-(${Q}*1.04-0.02))`);
    case "fold": {
      // The outgoing shot shrinks to a card in the centre and folds away, revealing the next one.
      const r = `((1-${Q})*0.52)`;
      const d = `(max(abs(${x}-0.5),abs(${y}-0.5))-${r})`;
      return `if(lt(${d},0),A,if(lt(${d},${EDGE}),${PAPER},B))`;
    }
    case "iris": {
      // The incoming shot opens from the centre as a growing paper circle (aspect-corrected).
      const d = `(hypot((${x}-0.5)*W/H,${y}-0.5)-${Q}*1.05)`;
      return byDistance(d);
    }
    case "cut":
      return null;
  }
}

// Maps the director's written transition ("a torn-paper edge rips diagonally…") to a kind.
export function parsePaperTransition(text: string | null | undefined): PaperTransition {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return "tear-right";
  if (/\bcut\b/.test(t) && !/cutout|cut-out|paper-cut|paper cut/.test(t)) return "cut";
  if (/iris|circle|circular/.test(t)) return "iris";
  if (/fold|box|card|closes/.test(t)) return "fold";
  if (/tear|torn|rip/.test(t)) return /diagonal|corner/.test(t) ? "tear-diagonal" : "tear-right";
  if (/upward|upwards|\bup\b|from the bottom|bottom of/.test(t)) return "wipe-up";
  if (/down|from the top|top of/.test(t)) return "wipe-down";
  if (/right to left|from the right|right side/.test(t)) return "wipe-left";
  return "wipe-right";
}
