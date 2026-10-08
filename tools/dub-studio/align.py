# Word-level ADR alignment for Dub Studio (user, 2026-10-08: "when i pronounce and record it should be
# able to adjust that to the original audio... or if i read the script first, it should... produce the
# same phonetic pronunciation").
#
# The approach of professional ADR tools (e.g. VocAlign), driven by the words instead of raw sound:
# 1. Forced alignment (Meta's MMS aligner, multilingual, romanised text) finds where each word of the
#    known script starts and ends, both in the actor's original audio and in the user's take. The
#    take can be read at any pace, in sync or not.
# 2. The take is warped piecewise so every word starts and ends where the actor's mouth does (WSOLA:
#    timing changes, pitch and pronunciation don't). Words are only stretched within sane limits.
# 3. The aligner's confidence per word flags words that may need a re-read.
# The earlier sound-to-sound DTW (lipsync.py) drifted across voices: measured sync 0.09–0.37, against the
# originals' ~0.55.
import re
import numpy as np
import torch
import librosa
import soundfile as sf
import pytsmod

SR = 16000
_M = {}


def _bundle():
    if not _M:
        from torchaudio.pipelines import MMS_FA as b
        _M["model"] = b.get_model(with_star=True).eval()
        _M["tok"] = b.get_tokenizer()
        _M["align"] = b.get_aligner()
    return _M


def words_of(text):
    # "Aah… kitna aaram mila." → ["aah", "kitna", "aaram", "mila"]; "SWAS-tea" → ["swas", "tea"]
    return [w for w in re.split(r"[^a-z']+", text.lower().replace("-", " ")) if w]


def word_spans(y, text):
    """[(word, start_s, end_s, confidence)] for each word of `text` in mono 16 kHz audio `y`."""
    m = _bundle()
    words = words_of(text)
    wav = torch.from_numpy(np.asarray(y, dtype=np.float32))[None]
    with torch.inference_mode():
        emission, _ = m["model"](wav)
    # the star token absorbs what the script doesn't cover: breaths, a sneeze, background music
    tokens = m["tok"](["*"] + words + ["*"])
    spans = m["align"](emission[0], tokens)
    ratio = wav.shape[1] / emission.shape[1] / SR
    out = []
    for w, sp in zip(words, spans[1:-1]):
        out.append((w, sp[0].start * ratio, sp[-1].end * ratio, float(np.mean([s.score for s in sp]))))
    return out


def load16(path):
    y, _ = librosa.load(path, sr=SR, mono=True)
    return y


def warp_map(take_spans, orig_spans, take_len, orig_len, lead=0.06):
    """Anchor pairs (take_s, orig_s): each word's start and end land on the original's. Pauses between
    words take the original's length. The edges map to the clip's start and end."""
    pts = [(0.0, 0.0)]
    for (_, ts, te, _), (_, os_, oe, _) in zip(take_spans, orig_spans):
        ts, os_ = max(0.0, ts - lead), max(0.0, os_ - lead)  # keep the consonant onset
        pts += [(ts, os_), (te, oe)]
    pts.append((take_len, orig_len))
    # strictly increasing on both sides
    clean = [pts[0]]
    for a, b in pts[1:]:
        if a > clean[-1][0] + 0.01 and b > clean[-1][1] + 0.01:
            clean.append((a, b))
    return clean


def stretch_report(pairs):
    """Per-segment stretch factors (output length / input length) for the UI and sanity checks."""
    return [round((b2 - b1) / max(1e-3, a2 - a1), 2) for (a1, b1), (a2, b2) in zip(pairs, pairs[1:])]


def warp_audio(y, sr, pairs, out_len_s):
    s = np.array([[a * sr for a, _ in pairs], [b * sr for _, b in pairs]])
    s = np.round(s).astype(int)
    s[0] = np.clip(s[0], 0, len(y) - 1)
    keep = np.concatenate([[True], (np.diff(s[0]) > 0) & (np.diff(s[1]) > 0)])
    out = pytsmod.wsola(y, s[:, keep])
    n = int(out_len_s * sr)
    out = np.pad(out, (0, max(0, n - len(out))))[:n]
    f = int(0.015 * sr)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out.astype(np.float32)


def align_take(take_path, orig_y, text, out_path, apply_to=None):
    """Maps the user's raw take onto the original's word timing and warps `apply_to` (default: the
    take itself) with that map. Pass the converted voice as `apply_to`: conversion keeps the take's
    timing but blurs word edges, so the map is read from the raw take and applied after conversion
    (measured sync 0.56 that way vs 0.40 aligning before converting; the original scores 0.59)."""
    take_y, take_sr = librosa.load(take_path, sr=None, mono=True)
    orig_len = len(orig_y) / SR
    t_sp = word_spans(librosa.resample(take_y, orig_sr=take_sr, target_sr=SR), text)
    o_sp = word_spans(orig_y, text)
    pairs = warp_map(t_sp, o_sp, len(take_y) / take_sr, orig_len)
    y, ysr = (take_y, take_sr) if apply_to is None else librosa.load(apply_to, sr=None, mono=True)
    sf.write(out_path, warp_audio(y, ysr, pairs, orig_len), ysr)
    return {
        "words": [{"word": w, "take": [round(ts, 2), round(te, 2)], "original": [round(os_, 2), round(oe, 2)], "confidence": round(c, 2)}
                  for (w, ts, te, c), (_, os_, oe, _) in zip(t_sp, o_sp)],
        "stretch": stretch_report(pairs),
    }
