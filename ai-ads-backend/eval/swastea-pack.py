# Swastea real-pack insert (user, 2026-10-08): image models garble the pack's text ("SWASTRA",
# "HERAAL TAB"), so each visible face of the user's pack.png is perspective-warped onto the
# generated box, colour-matched to the frame's light, with skin (her thumb in s6) kept in front.
# `python3 eval/swastea-pack.py` → ~/Desktop/swastea/frames/<name>.png (originals in frames-raw/)
import os, shutil
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath, ImageStat

DIR = os.path.expanduser("~/Desktop/swastea")
PACK = Image.open(os.path.join(DIR, "pack.png")).convert("RGB")

# Faces of pack.png, corners TL, TR, BR, BL (measured on a zoomed grid).
FRONT = [(457, 230), (1300, 171), (1296, 935), (460, 984)]
SIDE = [(222, 104), (457, 230), (460, 984), (231, 880)]

# Per frame: the faces' corners in the generated frame, how soft the frame is there, and whether a
# hand overlaps the box.
FRAMES = {
    "end-plate": {"faces": [(FRONT, [(499, 350), (834, 352), (834, 640), (500, 637)])], "blur": 0.4, "skin": False},
    "s6-pack": {"faces": [(FRONT, [(672, 400), (757, 400), (760, 469), (674, 470)])], "blur": 0.8, "skin": True},
    "s3-kitchen": {"faces": [(FRONT, [(410, 562), (580, 548), (580, 710), (410, 728)]), (SIDE, [(360, 537), (410, 562), (410, 728), (363, 698)])], "blur": 0.6, "skin": False},
}
# Plan v3 keyframes (frames-v3/), `python3 eval/swastea-pack.py v3`. s4a's box is deep out of focus at the
# frame edge, so it is left as is.
FRAMES_V3 = {
    "s7-pack": {"faces": [(FRONT, [(770, 195), (1010, 256), (942, 476), (702, 415)]), (SIDE, [(1010, 256), (1058, 283), (990, 503), (942, 476)])], "blur": 0.5, "skin": True},
}
SS = 3  # supersampling for clean edges


def solve(a, b):
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] for i in range(n)]


def coeffs(dst, src):
    # PIL's PERSPECTIVE maps output (dst) points to input (src) points.
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return solve(a, b)


def face(frame, src, dst, skin, blur):
    W, H = frame.size
    big = [(x * SS, y * SS) for x, y in dst]
    warped = PACK.transform((W * SS, H * SS), Image.PERSPECTIVE, coeffs(big, src), Image.BICUBIC).resize((W, H), Image.LANCZOS)
    mask = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(mask).polygon(big, fill=255)
    mask = mask.resize((W, H), Image.LANCZOS)
    if skin:  # keep fingers in front: red clearly above green means skin, never the green box
        r, g, _ = frame.split()
        hand = ImageMath.eval("convert((r - g > 25) * 255, 'L')", r=r, g=g).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1))
        mask = ImageChops.subtract(mask, hand)
    core = mask.point(lambda v: 255 if v > 250 else 0)
    # Match each channel's level and contrast to the generated box, so the pack takes the scene's light.
    bands = []
    for wb, fb in zip(warped.split(), frame.split()):
        ws, fs = ImageStat.Stat(wb, core), ImageStat.Stat(fb, core)
        gain = min(1.25, max(0.8, fs.stddev[0] / max(ws.stddev[0], 1)))
        off = fs.mean[0] - ws.mean[0] * gain
        bands.append(wb.point(lambda v, g=gain, o=off: max(0, min(255, v * g + o))))
    matched = Image.merge("RGB", bands)
    # Carry the frame's light falloff across the face (large-radius luminance ratio).
    fl = frame.convert("L").filter(ImageFilter.GaussianBlur(25))
    ml = matched.convert("L").filter(ImageFilter.GaussianBlur(25))
    ratio = ImageMath.eval("float(a) / (float(b) + 1)", a=fl, b=ml)
    lit = Image.merge("RGB", [ImageMath.eval("convert(min(max(float(c) * min(max(r, 0.85), 1.15), 0), 255), 'L')", c=c, r=ratio) for c in matched.split()])
    return Image.composite(lit.filter(ImageFilter.GaussianBlur(blur)), frame, mask)


import sys
V3 = len(sys.argv) > 1 and sys.argv[1] == "v3"
FDIR = "frames-v3" if V3 else "frames"
raw = os.path.join(DIR, FDIR + "-raw")
os.makedirs(raw, exist_ok=True)
for name, spec in (FRAMES_V3 if V3 else FRAMES).items():
    out = os.path.join(DIR, FDIR, f"{name}.png")
    src = os.path.join(raw, f"{name}.png")
    if not os.path.exists(src):
        shutil.copy(out, src)
    frame = Image.open(src).convert("RGB")
    for pack_face, dst in spec["faces"]:
        frame = face(frame, pack_face, dst, spec["skin"], spec["blur"])
    frame.save(out)
    print(name)
