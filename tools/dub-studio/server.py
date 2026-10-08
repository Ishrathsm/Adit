# Dub Studio (user, 2026-10-08): "make an interface like streamlit... where at live it will record my
# speech like karaoke". The user records each line over its clip (words light up in time); the take is
# converted into the character's voice with Seed-VC (its CLI, ~1 min per line on this CPU), previewed over the clip, and
# approved. Approved lines land in ~/Desktop/swastea/adr/final/<line>.wav for the edit.
# Since 2026-10-08 ("it should be able to adjust that to the original audio... or if i read the script
# first..."), every take is aligned word by word to the actor's original audio before conversion
# (align.py: MMS forced alignment + WSOLA), so a take read at any pace, even without the clip, lands on
# the lips. The page shows each word's timing, re-read flags and the measured lip sync.
# Run: ~/Desktop/Adit/tools/seed-vc/.venv/bin/python ~/Desktop/Adit/tools/dub-studio/server.py
#      then open http://localhost:8765
import json, os, shutil, subprocess, sys, threading, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEEDVC = HERE.parent / "seed-vc"
sys.path.insert(0, str(SEEDVC))
sys.path.insert(0, str(HERE))
os.chdir(SEEDVC)  # the wrapper loads its configs and checkpoints relative to its own folder

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ADR = Path.home() / "Desktop" / "swastea" / "adr"
TAKES, FINAL, REFS = ADR / "takes", ADR / "final", ADR / "refs"
for d in (TAKES, FINAL):
    d.mkdir(parents=True, exist_ok=True)

# Each line: the clip (cut exactly as in cut 2), the voice to convert to, and when the words are said
# in the clip (seconds), which drives the karaoke highlight.
LINES = [
    {"id": "l1", "who": "Young man", "mood": "a little shy, blocked nose", "ref": "man", "text": "Aunty, thodi adrak milegi?", "windows": [[0.4, 0.8], [1.9, 2.8]]},
    {"id": "l2", "who": "Aunty", "mood": "gentle, concerned", "ref": "aunty", "text": "Lagta hai zukaam hai.", "windows": [[0.2, 1.1], [2.2, 3.2]]},
    {"id": "l3", "who": "Aunty", "mood": "warm, inviting", "ref": "aunty", "text": "Andar aao, beta.", "windows": [[0.0, 1.9]]},
    {"id": "l4", "who": "Young man", "mood": "soft, eyes closed, relief", "ref": "man", "text": "Aah… kitna aaram mila.", "windows": [[3.4, 3.9], [5.2, 6.4]]},
    {"id": "l5", "who": "Young man", "mood": "grateful, a little homesick", "ref": "man", "text": "bilkul maa ke haath jaisi.", "windows": [[0.7, 2.1]]},
    {"id": "l6", "who": "Aunty (off-screen)", "mood": "warm, simple", "ref": "aunty", "text": "Adrak, ashwagandha aur tulsi se bani hai.", "windows": [[0.4, 1.0], [1.6, 2.5], [3.1, 4.4]]},
    {"id": "l7", "who": "End voice-over", "mood": "soft, sweet, smiling", "ref": "vo", "text": "SWAS-tea. Roj piyo, swasth raho.", "windows": [[0.6, 1.5], [1.8, 3.5]]},
]
BY_ID = {l["id"]: l for l in LINES}
# Mouth boxes for the lip-sync meter (clip pixels); only where a mouth is clearly visible and still.
MOUTH = {"l1": (520, 185, 610, 235), "l2": (390, 190, 460, 240), "l5": (380, 190, 450, 240)}


def clip_voice(line_id):
    import librosa
    t = TAKES / f".{line_id}-orig.wav"
    if not t.exists():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(HERE / "media" / f"{line_id}.mp4"), "-vn", "-ac", "1", "-ar", "16000", str(t)], check=True)
    return librosa.load(str(t), sr=16000)[0]

_model, _model_lock, _jobs = None, threading.Lock(), {}


def model():
    global _model
    with _model_lock:
        if _model is None:
            from seed_vc_wrapper import SeedVCWrapper
            _model = SeedVCWrapper()
    return _model


def convert(job_id, line, take_wav, out_wav):
    # 1. convert the raw take into the character's voice (Seed-VC CLI, pitch-aware: a man's reading lands
    #    at Aunty's pitch), 2. warp it onto the original's words using the raw take's word map (skipped for
    #    the end voice-over, which has no lips), 3. preview over the clip, 4. measure lip sync.
    # The CLI, not the in-process wrapper: that ran ~60x slower on this CPU.
    try:
        import align
        from syncscore import score
        report = {}
        _jobs[job_id] = {"state": "converting the voice (about 2 min)"}
        tmp = take_wav.parent / f"vc-{take_wav.stem}"
        tmp.mkdir(exist_ok=True)
        subprocess.run([sys.executable, "inference.py", "--source", str(take_wav), "--target", str(REFS / f"{line['ref']}.wav"),
                        "--output", str(tmp), "--diffusion-steps", "20", "--length-adjust", "1.0", "--inference-cfg-rate", "0.7",
                        "--f0-condition", "True", "--auto-f0-adjust", "True", "--fp16", "False"], check=True, capture_output=True, cwd=SEEDVC)
        converted = take_wav.with_name(take_wav.stem + "-unaligned.wav")
        shutil.move(str(next(tmp.glob("vc_*.wav"))), converted)
        shutil.rmtree(tmp, ignore_errors=True)
        if line["ref"] != "vo":
            # align AFTER converting: the word map is read from the raw take and applied to the converted voice
            _jobs[job_id] = {"state": "aligning to the original's words"}
            report = align.align_take(str(take_wav), clip_voice(line["id"]), line["text"], str(out_wav), apply_to=str(converted))
        else:
            shutil.copy(converted, out_wav)
        clip = HERE / "media" / f"{line['id']}.mp4"
        preview = out_wav.with_suffix(".mp4")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(clip), "-i", str(out_wav), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", str(preview)], check=True)
        if line["id"] in MOUTH:
            box = MOUTH[line["id"]]
            report["sync"] = {"original": round(score(str(clip), str(clip), box)[0], 2), "yours": round(score(str(clip), str(out_wav), box)[0], 2)}
        (out_wav.with_suffix(".json")).write_text(json.dumps(report))
        _jobs[job_id] = {"state": "done", "audio": f"/takes/{line['id']}/{out_wav.name}", "preview": f"/takes/{line['id']}/{preview.name}", "report": report}
    except Exception as e:  # surface the failure in the UI
        _jobs[job_id] = {"state": "error", "message": str(getattr(e, "stderr", b"") or e)[-300:]}


app = FastAPI()
app.mount("/media", StaticFiles(directory=HERE / "media"), name="media")
app.mount("/takes", StaticFiles(directory=TAKES), name="takes")


@app.get("/")
def index():
    return FileResponse(HERE / "index.html")


@app.get("/api/lines")
def lines():
    approved = {p.stem for p in FINAL.glob("*.wav")}
    out = []
    for l in LINES:
        d = TAKES / l["id"]
        takes = sorted(p.stem for p in d.glob("take-*.wav") if "-vc" not in p.stem and "-aligned" not in p.stem and "-unaligned" not in p.stem) if d.exists() else []
        out.append({**l, "takes": takes, "approved": l["id"] in approved})
    return out


@app.post("/api/take/{line_id}")
async def take(line_id: str, request: Request):
    line = BY_ID.get(line_id) or (_ for _ in ()).throw(HTTPException(404))
    d = TAKES / line_id
    d.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%H%M%S")
    raw = d / f"take-{stamp}.webm"
    raw.write_bytes(await request.body())
    wav = d / f"take-{stamp}.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "44100", str(wav)], check=True)
    return {"take": wav.stem, "audio": f"/takes/{line_id}/{wav.name}"}


@app.post("/api/convert/{line_id}/{take}")
def start_convert(line_id: str, take: str):
    line = BY_ID[line_id]
    wav = TAKES / line_id / f"{take}.wav"
    if not wav.exists():
        raise HTTPException(404)
    job_id = f"{line_id}-{take}"
    _jobs[job_id] = {"state": "queued"}
    threading.Thread(target=convert, args=(job_id, line, wav, TAKES / line_id / f"{take}-vc.wav"), daemon=True).start()
    return {"job": job_id}


@app.get("/api/job/{job_id}")
def job(job_id: str):
    return _jobs.get(job_id, {"state": "unknown"})


@app.post("/api/approve/{line_id}/{take}")
def approve(line_id: str, take: str):
    src = TAKES / line_id / f"{take}-vc.wav"
    if not src.exists():
        raise HTTPException(404, "convert the take first")
    shutil.copy(src, FINAL / f"{line_id}.wav")
    meta = FINAL / "approved.json"
    data = json.loads(meta.read_text()) if meta.exists() else {}
    data[line_id] = take
    meta.write_text(json.dumps(data, indent=2))
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
