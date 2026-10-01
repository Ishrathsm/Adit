"""Procedural sound effects for the Torvik R7 film, timed to the shot boundaries.

No effects library or generator is available (ElevenLabs needs a paid plan), so the effects are
synthesised: whooshes (swept filtered noise), clicks and gear shifts (short transients), wind and tyre
hiss (filtered noise), cooling-metal ticks, and a parallel-twin engine (a firing-pulse train whose
rate follows a rev curve, soft-clipped). The engine is a guide track, not a recording.
Usage: python3 torvik_sfx.py <out.wav> <boundaries comma-separated> <total seconds>
"""
import array, math, random, sys, wave

SR = 48000
random.seed(11)
# The synthesised engine sits low in the mix: it is a placeholder for real engine audio.
ENGINE_GAIN = 0.5


class Track:
    def __init__(self, seconds):
        self.buf = [0.0] * int(seconds * SR)

    def add(self, t, samples, gain=1.0):
        i0 = int(t * SR)
        for k, v in enumerate(samples):
            i = i0 + k
            if 0 <= i < len(self.buf):
                self.buf[i] += v * gain


def lowpass(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y, out = 0.0, []
    for v in x:
        y = (1 - a) * v + a * y
        out.append(y)
    return out


def highpass(x, cutoff):
    lp = lowpass(x, cutoff)
    return [a - b for a, b in zip(x, lp)]


def noise(n):
    return [random.uniform(-1, 1) for _ in range(n)]


def env(n, attack, release):
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    return [min(1.0, k / a) * min(1.0, (n - k) / r) for k in range(n)]


def whoosh(length, lo=300, hi=3000, peak=0.6):
    """Band-limited noise whose brightness and level sweep up to a peak and fall away."""
    n = int(length * SR)
    src = noise(n)
    out, y1, y2 = [], 0.0, 0.0
    for k, v in enumerate(src):
        p = k / n
        shape = math.sin(math.pi * min(1, p / peak if p < peak else 1 - (p - peak) / (1 - peak)) / 2) ** 2
        fc = lo + (hi - lo) * shape
        a = math.exp(-2 * math.pi * fc / SR)
        y1 = (1 - a) * v + a * y1
        y2 = (1 - a) * y1 + a * y2
        out.append((y1 - y2) * 3.0 * shape)
    return out


def click(bright=True):
    n = int(0.012 * SR)
    burst = [v * math.exp(-k / (0.0015 * SR)) for k, v in enumerate(noise(n))]
    thump = [0.5 * math.sin(2 * math.pi * 180 * k / SR) * math.exp(-k / (0.004 * SR)) for k in range(n)]
    x = [a + b for a, b in zip(highpass(burst, 2500) if bright else burst, thump)]
    return x


def gear_shift():
    """A mechanical clunk: low thump plus a short metallic click."""
    n = int(0.08 * SR)
    thump = [0.9 * math.sin(2 * math.pi * 70 * k / SR) * math.exp(-k / (0.02 * SR)) for k in range(n)]
    c = click() + [0.0] * (n - len(click()))
    return [a + 0.6 * b for a, b in zip(thump, c)]


def hum(length, f=100, level=0.08):
    n = int(length * SR)
    e = env(n, 0.02, 0.3)
    return [level * e[k] * (math.sin(2 * math.pi * f * k / SR) + 0.3 * math.sin(2 * math.pi * 2 * f * k / SR)) for k in range(n)]


def wind(length, level, gust=0.25):
    n = int(length * SR)
    x = lowpass(lowpass(noise(n), 700), 900)
    e = env(n, 0.8, 0.8)
    return [level * 6 * e[k] * v * (1 + gust * math.sin(2 * math.pi * 0.35 * k / SR + 1.3)) for k, v in enumerate(x)]


def hiss(length, level):
    n = int(length * SR)
    e = env(n, 0.3, 0.4)
    return [level * e[k] * v for k, v in enumerate(highpass(noise(n), 4000))]


def ticks(length, count, level=0.25):
    out = [0.0] * int(length * SR)
    for _ in range(count):
        t = random.uniform(0.1, length - 0.05)
        c = click(bright=True)
        i0 = int(t * SR)
        for k, v in enumerate(c):
            if i0 + k < len(out):
                out[i0 + k] += v * level * random.uniform(0.5, 1)
    return out


def engine(curve, length, level=0.5, grit=0.12, tone=1400):
    """Parallel-twin engine: firing pulses at a rate set by `curve(t)` (Hz), each a short decaying
    low-frequency burst; body resonance and soft clipping give the growl."""
    n = int(length * SR)
    out = [0.0] * n
    phase, t = 0.0, 0.0
    pulse_len = int(0.03 * SR)
    pulse = [math.sin(2 * math.pi * 55 * k / SR) * math.exp(-k / (0.012 * SR)) + grit * random.uniform(-1, 1) * math.exp(-k / (0.003 * SR)) for k in range(pulse_len)]
    for i in range(n):
        f = curve(i / SR)
        phase += f / SR
        if phase >= 1.0:
            phase -= 1.0
            amp = random.uniform(0.85, 1.15)
            for k in range(pulse_len):
                if i + k < n:
                    out[i + k] += pulse[k] * amp
    body = lowpass(lowpass(out, tone), tone * 1.5)
    return [ENGINE_GAIN * level * math.tanh(2.2 * v) for v in body]


def ramp(points):
    """Piecewise-linear curve through (time, value) points."""
    def f(t):
        if t <= points[0][0]:
            return points[0][1]
        for (t0, v0), (t1, v1) in zip(points, points[1:]):
            if t0 <= t <= t1:
                return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
        return points[-1][1]
    return f


def build(boundaries, total):
    b = boundaries
    tr = Track(total)
    # 1 · tank macro: garage room tone, cooling ticks
    tr.add(0, wind(b[1] + 0.5, 0.05, 0.1))
    tr.add(0.2, ticks(b[1], 3, 0.18))
    # 2 · headlight: click and electric hum
    tr.add(b[1] + 0.05, click(), 0.9)
    tr.add(b[1] + 0.08, hum(b[2] - b[1] + 0.3, level=0.04))
    # 3 · rider: key click, starter whirr, the engine fires and settles
    tr.add(b[2] + 0.3, click(bright=False), 0.5)
    starter_len = 0.45
    tr.add(b[2] + 0.6, engine(ramp([(0, 16), (starter_len, 22)]), starter_len, 0.12, grit=0.04, tone=700))
    fire = b[2] + 0.6 + starter_len
    # It fires with a blip, then settles into a smooth idle (slow pulses read as crackle).
    idle = engine(ramp([(0, 34), (0.25, 70), (0.7, 40), (1.2, 34), (b[3] - fire, 36)]), b[3] - fire + 0.4, 0.5, grit=0.04, tone=900)
    tr.add(fire, idle)
    # Whooshes kept to two (the user found one on every cut too many): a soft one as the bike rolls
    # out onto the street, and the pass-by on the corner below.
    tr.add(b[3] - 0.3, whoosh(0.8), 0.3)
    # 4 · city: cruise, tyre hiss, light wind
    tr.add(b[3], engine(ramp([(0, 38), (1.0, 48), (b[4] - b[3], 52)]), b[4] - b[3] + 0.3, 0.45, grit=0.06))
    tr.add(b[3], hiss(b[4] - b[3], 0.05))
    tr.add(b[3], wind(b[4] - b[3], 0.07))
    # 5 · engine close-up: revs climb, a gear shift
    L5 = b[5] - b[4]
    tr.add(b[4], engine(ramp([(0, 52), (L5 * 0.45, 92), (L5 * 0.5, 64), (L5, 86)]), L5 + 0.3, 0.55))
    tr.add(b[4] + L5 * 0.47, gear_shift(), 0.8)
    # 6 · onto the ghat road: throttle opens, gear change, wind rising
    L6 = b[6] - b[5]
    tr.add(b[5], engine(ramp([(0, 70), (L6 * 0.4, 112), (L6 * 0.45, 78), (L6, 108)]), L6 + 0.3, 0.55))
    tr.add(b[5] + L6 * 0.42, gear_shift(), 0.8)
    tr.add(b[5], wind(L6, 0.13))
    # 7 · the corner: revs into the bend, a pass-by past the camera, a downshift blip, strong wind
    L7 = b[7] - b[6]
    pb = L7 * 0.45
    tr.add(b[6], engine(ramp([(0, 96), (pb - 0.3, 118), (pb, 128), (pb + 0.35, 96), (L7 * 0.75, 88), (L7 * 0.8, 115), (L7 * 0.88, 80), (L7, 58)]), L7 + 0.3, 0.6))
    tr.add(b[6] + pb - 0.6, whoosh(1.3, 200, 4200, 0.45), 0.9)
    tr.add(b[6] + L7 * 0.79, gear_shift(), 0.7)
    tr.add(b[6], wind(L7, 0.17, 0.3))
    # 8 · hero: the engine dies away, cooling ticks, a gentle breeze
    # (The engine simply stops here — a synthesised die-away warbled.)
    tr.add(b[7] + 0.6, ticks(b[8] - b[7] - 0.6, 6, 0.22))
    tr.add(b[7], wind(total - b[7], 0.08, 0.3))
    return tr.buf


if __name__ == "__main__":
    out, bounds, total = sys.argv[1], [float(x) for x in sys.argv[2].split(",")], float(sys.argv[3])
    buf = build(bounds, total)
    peak = max(1e-9, max(abs(v) for v in buf))
    scale = 0.89 / peak
    pcm = array.array("h", (int(max(-1, min(1, v * scale)) * 32767) for v in buf))
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(out, total, "s")
