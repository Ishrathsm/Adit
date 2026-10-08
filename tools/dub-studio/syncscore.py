# Objective lip-sync check for Dub Studio (no AI judge): how strongly does mouth motion (frame-to-frame
# change in a box around the mouth) follow the voice's loudness, and at what offset?
# python syncscore.py <clip.mp4> <audio.wav|clip> x0 y0 x1 y1  → best correlation and lag (s)
import subprocess, sys, tempfile
import librosa, numpy as np

def mouth_motion(clip, box, fps=24):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", clip, "-vf", f"crop={w}:{h}:{x0}:{y0},format=gray,fps={fps}", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    return np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))

def envelope(src, n, fps=24):
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", t.name], check=True)
        y, _ = librosa.load(t.name, sr=16000)
    r = librosa.feature.rms(y=y, frame_length=1024, hop_length=int(16000 / fps))[0]
    r = np.abs(np.diff(r))  # changes in loudness, like the mouth opening and closing
    return np.pad(r, (0, max(0, n - len(r))))[:n]

def score(clip, audio, box):
    m = mouth_motion(clip, box)
    e = envelope(audio, len(m))
    best = (-1.0, 0.0)
    for lag in range(-10, 11):  # ±0.42 s
        a, b = (m[lag:], e[: len(e) - lag]) if lag >= 0 else (m[:lag], e[-lag:])
        c = float(np.corrcoef(a, b)[0, 1])
        if c > best[0]:
            best = (c, lag / 24)
    return best

if __name__ == "__main__":
    c, lag = score(sys.argv[1], sys.argv[2], tuple(map(int, sys.argv[3:7])))
    print(f"sync {c:.2f} at {lag:+.2f}s")
