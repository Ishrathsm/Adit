# Lip-sync for Dub Studio (user, 2026-10-08: "the tones they should are not lip syncing"). The actors'
# lips follow Veo's original voice, so the dub is warped onto that timing:
# 1. DTW matches the user's raw take to the clip's original voice by WHAT is said (Whisper encoder
#    features, 20 ms); log-mel features failed across voices (sync 0.05–0.29 vs the original's 0.55+).
# 2. The path is thinned to anchors, kept monotonic and within a sane local speed range.
# 3. The converted voice (same timing as the raw take) is time-warped with WSOLA so every syllable lands
#    where the original's did. Pitch and pronunciation are kept.
# python lipsync.py <raw_take.wav> <converted.wav> <clip.mp4> <out.wav>
import subprocess, sys, tempfile
import librosa, numpy as np, pytsmod, soundfile as sf
import torch
from transformers import WhisperFeatureExtractor, WhisperModel

SR_F, HOP = 16000, 320  # Whisper encoder frames are 20 ms
_W = {}


def whisper_feats(y):
    # Speaker-independent "what is being said" features (Whisper's encoder, as Seed-VC uses), so a
    # man's reading and Aunty's original line line up by their sounds, not their voices.
    if not _W:
        _W["fe"] = WhisperFeatureExtractor.from_pretrained("openai/whisper-small")
        _W["enc"] = WhisperModel.from_pretrained("openai/whisper-small").encoder.eval()
    inp = _W["fe"](y, sampling_rate=SR_F, return_tensors="pt")
    with torch.no_grad():
        h = _W["enc"](inp.input_features).last_hidden_state[0].numpy()
    n = int(np.ceil(len(y) / HOP))
    h = h[:n].T
    return h / (np.linalg.norm(h, axis=0, keepdims=True) + 1e-6)


def feats(y):
    # speech band only, and everything >30 dB under the loudest frame floored to silence, so Veo's
    # faint background music reads as a pause instead of one long "word"
    m = librosa.feature.melspectrogram(y=y, sr=SR_F, n_fft=512, hop_length=HOP, n_mels=40, fmin=150, fmax=4000)
    lm = np.log(m + 1e-9)
    lm = np.maximum(lm, lm.max() - np.log(1e3))
    lm = (lm - lm.mean(axis=1, keepdims=True)) / (lm.std(axis=1, keepdims=True) + 1e-6)
    return lm


def clip_voice(clip):
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", clip, "-vn", "-ac", "1", "-ar", str(SR_F), t.name], check=True)
        y, _ = librosa.load(t.name, sr=SR_F)
    return y


def align(raw_take, converted, clip, out):
    ref = clip_voice(clip)
    raw, _ = librosa.load(raw_take, sr=SR_F)
    vc, sr = librosa.load(converted, sr=None)
    # The take was recorded from the clip's first frame; trim/pad it to the clip length plus a short tail.
    n_ref = len(ref)
    _, wp = librosa.sequence.dtw(X=whisper_feats(ref), Y=whisper_feats(raw[: int(n_ref * 1.25)]), metric="cosine")
    wp = wp[::-1]  # (ref_frame, take_frame), start → end
    # Anchors every 60 ms of the reference (3 Whisper frames), median take frame there; increasing.
    anchors = {}
    for r, t in wp:
        anchors.setdefault(r // 3, []).append(t)
    ref_pts = np.array(sorted(anchors)) * 3
    take_pts = np.array([np.median(anchors[k]) for k in sorted(anchors)])
    take_pts = np.maximum.accumulate(take_pts)
    # keep local speed within 0.55x–1.8x so no syllable is smeared or chipmunked
    for i in range(1, len(take_pts)):
        d_ref = ref_pts[i] - ref_pts[i - 1]
        lo, hi = take_pts[i - 1] + d_ref * 0.55, take_pts[i - 1] + d_ref * 1.8
        take_pts[i] = min(max(take_pts[i], lo), hi)
    sec = HOP / SR_F
    in_samples = np.clip(take_pts * sec * sr, 0, len(vc) - 1)
    out_samples = ref_pts * sec * sr
    s = np.vstack([np.concatenate([[0], in_samples, [len(vc) - 1]]), np.concatenate([[0], out_samples, [out_samples[-1] + (len(vc) - 1 - in_samples[-1])]])])
    s = np.round(s).astype(int)  # WSOLA wants whole-sample anchors
    keep = np.concatenate([[True], (np.diff(s[0]) > 0) & (np.diff(s[1]) > 0)])
    s = s[:, keep]
    y = pytsmod.wsola(vc, s)
    n_out = int(n_ref / SR_F * sr)
    y = np.pad(y, (0, max(0, n_out - len(y))))[:n_out]
    fade = int(0.02 * sr)
    y[-fade:] *= np.linspace(1, 0, fade)
    sf.write(out, y.astype(np.float32), sr)
    # how well the speech envelope now follows the original (1 = identical timing)
    env = lambda a, srr: librosa.feature.rms(y=librosa.resample(a, orig_sr=srr, target_sr=SR_F), hop_length=160)[0]
    e_ref, e_before, e_after = env(ref, SR_F), env(vc, sr), env(y, sr)
    n = min(len(e_ref), len(e_before), len(e_after))
    corr = lambda a, b: float(np.corrcoef(a[:n], b[:n])[0, 1])
    return corr(e_ref, e_before), corr(e_ref, e_after)


if __name__ == "__main__":
    before, after = align(*sys.argv[1:5])
    print(f"timing match with the original voice: before {before:.2f} → after {after:.2f}")
