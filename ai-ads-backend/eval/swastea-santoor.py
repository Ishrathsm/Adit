# Swastea santoor score (user, 2026-10-08): happy but slow, santoor only, faint. The music director's
# melody (eval/out/swastea-team/music-final.json, Raag Desh on D, 72 bpm) plus a soft santoor
# accompaniment (low Sa/Pa strokes on the beat) so it plays as a real one-instrument piece. Held notes use
# santoor tremolo (rapid re-strikes). The one-beat hush before the sip bloom and the pack-read bar stay
# clear. Rendered with the GM hammered-dulcimer sample via fluidsynth.
# `python3 eval/swastea-santoor.py` → ~/Desktop/swastea/music/santoor-score.{mid,wav}
import json, os, random, struct, subprocess
random.seed(7)
HERE = os.path.dirname(__file__)
plan = json.load(open(os.path.join(HERE, "out", "swastea-team", "music-final.json")))
OUT = os.path.expanduser("~/Desktop/swastea/music")
BPM, TONIC = plan["bpm"], 62  # D4
SEMI = {"S": 0, "r": 1, "R": 2, "g": 3, "G": 4, "m": 5, "M": 6, "P": 7, "d": 8, "D": 9, "n": 10, "N": 11}
def pitch(s):
    oct_ = s.count("'") - s.count(".")
    return TONIC + SEMI[s.strip("'.")] + 12 * oct_
beat_s = 60 / BPM
notes = []  # (start_s, dur_s, midi, vel)
def strike(t, d, m, v, trem):
    if not trem:
        notes.append((t + random.uniform(-0.008, 0.008), d, m, v)); return
    step, k, x = 0.095, 0, t
    while x < t + d - 0.05:
        notes.append((x, step * 1.6, m, int(v * (0.95 if k == 0 else random.uniform(0.5, 0.72))))); x += step; k += 1
for e in plan["santoor"]:
    toks = e["sargam"].split()
    if all(t == "-" for t in toks): continue
    t0 = ((e["bar"] - 1) * 4 + (e["beat"] - 1)) * beat_s
    each = e["beats"] * beat_s / len(toks)
    for i, tok in enumerate(toks):
        if tok == "-": continue
        last = i == len(toks) - 1
        strike(t0 + i * each, each * (1.6 if last else 1.0), pitch(tok), int(e["velocity"] * 0.85), e["tremolo"] and last)
# accompaniment: soft low Sa / Pa strokes (S. on 1, P. on 3), skipping the hush before the bloom
# (bar 4 beats 1–3) and the pack-read bar (bar 8)
for bar in range(1, 10):
    if bar == 8: continue
    for beat, sw in ((1, "S."), (3, "P.")):
        if bar == 4: continue
        if bar == 9 and beat == 3: continue
        strike(((bar - 1) * 4 + beat - 1) * beat_s, beat_s * 1.8, pitch(sw), random.randint(34, 42), False)
    if bar in (5, 6):  # a little lift under the bloom: S on 2 and 4
        for beat in (2, 4):
            strike(((bar - 1) * 4 + beat - 1) * beat_s, beat_s, pitch("S"), random.randint(30, 36), False)
notes.sort()
# --- minimal MIDI writer (format 0, 480 ppq) ---
PPQ = 480
tick = lambda s: int(round(s / beat_s * PPQ))
def vlq(n):
    b = [n & 0x7F]; n >>= 7
    while n: b.insert(0, (n & 0x7F) | 0x80); n >>= 7
    return bytes(b)
ev = [(0, bytes([0xFF, 0x51, 3]) + struct.pack(">I", int(beat_s * 1e6))[1:]), (0, bytes([0xC0, 15]))]  # tempo, GM 16 Dulcimer
for s, d, m, v in notes:
    ev.append((tick(max(0, s)), bytes([0x90, m, max(1, min(127, v))])))
    ev.append((tick(max(0, s) + d), bytes([0x80, m, 0])))
ev.sort(key=lambda x: (x[0], x[1][0] == 0x90))
trk, last = b"", 0
for t, b in ev: trk += vlq(t - last) + b; last = t
trk += vlq(0) + bytes([0xFF, 0x2F, 0])
mid = os.path.join(OUT, "santoor-score.mid")
open(mid, "wb").write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQ) + b"MTrk" + struct.pack(">I", len(trk)) + trk)
raw = os.path.join(OUT, "santoor-raw.wav")
subprocess.run(["fluidsynth", "-ni", "-g", "0.9", "-r", "48000", "-R", "1", "-C", "0", "-o", "synth.reverb.room-size=0.55", "-o", "synth.reverb.level=0.45", "-F", raw, "/usr/share/sounds/sf2/FluidR3_GM.sf2", mid], check=True, capture_output=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "atrim=0:30.5,afade=t=out:st=29.3:d=1.2,highpass=f=90,loudnorm=I=-18:TP=-2", os.path.join(OUT, "santoor-score.wav")], check=True)
print(f"{len(notes)} strikes, {BPM} bpm, raga {plan['raga']} on D")
