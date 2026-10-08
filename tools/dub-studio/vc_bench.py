# Dub Studio engine benchmark (user, 2026-10-08: "check any good models which can do and try that").
# Converts the user's real takes with each candidate engine, applies the same word-level alignment, and
# scores every output on the same measures:
# - pronunciation: MMS aligner confidence that each script word is said (mean, 0–1);
# - voice match: CAM++ speaker similarity to the character's own voice, and to the user (leakage);
# - pitch: median F0 vs the character's;
# - lip sync: mouth-motion vs voice-loudness correlation, where a mouth is measurable;
# - time per conversion on this CPU.
# Run: ~/Desktop/Adit/tools/seed-vc/.venv/bin/python vc_bench.py → ~/Desktop/swastea/adr/bench/report.md
import glob, json, os, shutil, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEEDVC = HERE.parent / "seed-vc"
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(SEEDVC))
os.chdir(SEEDVC)
import numpy as np, librosa, soundfile as sf, torch, torchaudio
import align
from syncscore import score as sync_score

ADR = Path.home() / "Desktop" / "swastea" / "adr"
OUT = ADR / "bench"; OUT.mkdir(exist_ok=True)
LINES = {
    "l1": ("Aunty, thodi adrak milegi?", "man", (520, 185, 610, 235)),
    "l2": ("Lagta hai zukaam hai.", "aunty", (390, 190, 460, 240)),
    "l5": ("bilkul maa ke haath jaisi.", "man", None),
}
PY = sys.executable

# ---- engines -------------------------------------------------------------------------------------
def seedvc_v1(src, ref, out, steps="20"):
    tmp = OUT / "tmp"; shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
    subprocess.run([PY, "inference.py", "--source", src, "--target", ref, "--output", str(tmp), "--diffusion-steps", steps, "--length-adjust", "1.0",
                    "--inference-cfg-rate", "0.7", "--f0-condition", "True", "--auto-f0-adjust", "True", "--fp16", "False"], check=True, capture_output=True)
    shutil.move(str(next(tmp.glob("*.wav"))), out)

def seedvc_v2(style):
    def f(src, ref, out):
        tmp = OUT / "tmp"; shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
        subprocess.run([PY, "inference_v2.py", "--source", src, "--target", ref, "--output", str(tmp), "--diffusion-steps", "30", "--length-adjust", "1.0",
                        "--convert-style", "true" if style else "false"], check=True, capture_output=True)
        shutil.move(str(next(tmp.glob("*.wav"))), out)
    return f

_ov = {}
def openvoice(src, ref, out):
    # Seed-VC's bundled OpenVoice takes tensors: extract_se(waves, lengths) → [N, 256]; convert(...) → audio
    if not _ov:
        from modules.openvoice.api import ToneColorConverter
        ck = SEEDVC / "modules/openvoice/checkpoints_v2_dl/converter"
        c = ToneColorConverter(str(ck / "config.json"), device="cpu"); c.load_ckpt(str(ck / "checkpoint.pth"))
        _ov["c"] = c
    c = _ov["c"]
    sr = c.hps.data.sampling_rate
    s_t = torch.tensor(librosa.load(src, sr=sr)[0]); r_t = torch.tensor(librosa.load(ref, sr=sr)[0])
    src_se = c.extract_se([s_t], [len(s_t)]); tgt_se = c.extract_se([r_t], [len(r_t)])
    audio = c.convert(s_t[None], torch.tensor([len(s_t)]), src_se, tgt_se, tau=0.3)
    sf.write(out, audio.squeeze().cpu().numpy(), sr)

ENGINES = {"seedvc-v1 (current)": seedvc_v1, "seedvc-v1 40 steps": lambda s_, r, o: seedvc_v1(s_, r, o, "40"), "seedvc-v2 timbre": seedvc_v2(False), "seedvc-v2 style+accent": seedvc_v2(True), "openvoice-v2": openvoice}

# ---- measures ------------------------------------------------------------------------------------
_cam = {}
def embed(path):
    if not _cam:
        from modules.campplus.DTDNN import CAMPPlus
        m = CAMPPlus(feat_dim=80, embedding_size=192); m.load_state_dict(torch.load(str(SEEDVC / "campplus_cn_common.bin"), map_location="cpu")); m.eval()
        _cam["m"] = m
    y, _ = librosa.load(path, sr=16000)
    feat = torchaudio.compliance.kaldi.fbank(torch.tensor(y)[None], num_mel_bins=80, dither=0, sample_frequency=16000)
    feat = feat - feat.mean(dim=0, keepdim=True)
    with torch.no_grad():
        e = _cam["m"](feat[None])[0].numpy()
    return e / np.linalg.norm(e)

def f0_median(path):
    y, _ = librosa.load(path, sr=16000)
    f0, _, _ = librosa.pyin(y, fmin=60, fmax=500, sr=16000)
    f0 = f0[~np.isnan(f0)]
    return float(np.median(f0)) if len(f0) else 0.0

def pronunciation(path, text):
    y = align.load16(path)
    return float(np.mean([c for *_, c in align.word_spans(y, text)]))

def clip_voice(l):
    t = OUT / f"{l}-orig.wav"
    if not t.exists():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(HERE / "media" / f"{l}.mp4"), "-vn", "-ac", "1", "-ar", "16000", str(t)], check=True)
    return align.load16(str(t))

# BENCH_ONLY="l1:seedvc-v2 timbre,l2:openvoice-v2" re-runs just those pairs (rows go to report-extra.md)
ONLY = [x.split(":", 1) for x in os.environ.get("BENCH_ONLY", "").split(",") if x]
rows = []
for l, (text, refname, box) in LINES.items():
    if ONLY and l not in {a for a, _ in ONLY}:
        continue
    raw = sorted([p for p in glob.glob(str(ADR / "takes" / l / "take-*.wav")) if not any(k in p for k in ("-vc", "aligned", "sync", "words"))], key=os.path.getmtime)[-1]
    ref = str(ADR / "refs" / f"{refname}.wav")
    e_ref, e_user, f_ref = embed(ref), embed(raw), f0_median(ref)
    clip = str(HERE / "media" / f"{l}.mp4")
    base = {"line": l, "engine": "your raw take", "pron": pronunciation(raw, text), "spk": float(e_ref @ e_user), "leak": 1.0, "f0": f0_median(raw), "f0_ref": f_ref,
            "sync": sync_score(clip, raw, box)[0] if box else None, "secs": 0}
    rows.append(base); print(json.dumps(base), flush=True)
    for name, fn in ENGINES.items():
        if ONLY and [l, name] not in ONLY:
            continue
        out = str(OUT / f"{l}-{name.split()[0]}{'-style' if 'style' in name else ''}.wav")
        t0 = time.time()
        try:
            fn(raw, ref, out)
        except Exception as e:
            print(f"{l} {name} FAILED: {str(getattr(e, 'stderr', b'') or e)[-300:]}", flush=True); continue
        secs = time.time() - t0
        aligned = out.replace(".wav", "-aligned.wav")
        align.align_take(raw, clip_voice(l), text, aligned, apply_to=out)
        e = embed(aligned)
        r = {"line": l, "engine": name, "pron": pronunciation(aligned, text), "spk": float(e_ref @ e), "leak": float(e_user @ e), "f0": f0_median(aligned), "f0_ref": f_ref,
             "sync": sync_score(clip, aligned, box)[0] if box else None, "secs": round(secs)}
        rows.append(r); print(json.dumps(r), flush=True)

md = ["| line | engine | pronunciation ↑ | voice match ↑ | sounds like you ↓ | pitch Hz (target) | lip sync ↑ | time |", "|---|---|---|---|---|---|---|---|"]
for r in rows:
    md.append(f"| {r['line']} | {r['engine']} | {r['pron']:.2f} | {r['spk']:.2f} | {r['leak']:.2f} | {r['f0']:.0f} ({r['f0_ref']:.0f}) | {'' if r['sync'] is None else f'{r[chr(115)+chr(121)+chr(110)+chr(99)]:.2f}'} | {r['secs']}s |")
(OUT / ("report-extra.md" if ONLY else "report.md")).write_text("\n".join(md) + "\n")
print("\n".join(md))
