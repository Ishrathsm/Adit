#!/usr/bin/env bash
# Swastea score draft 2 (user, 2026-10-08: "make it happier and sparser"). Raag Pahadi stems
# (music/stems-v2, plan in eval/out/swastea-team/stems-plan-v2.json), cut on waveform phrase boundaries
# and placed to the spotting plan:
# - 0–6.5s: silence.
# - 6.5–11.5s: a sparse bed.
# - 9.3s: the motif.
# - 11.5–12s: a hush.
# - 12–16.5s: the bloom with the women's "dhi-re-naaa".
# - 16.5–23.5s: the sparse bed again.
# - 24–29.5s: the button, ringing out.
# Each part is rendered to its own 30s track first (adelay's padding was lost in the WAV), as exact
# silence + the clip, then the six tracks are mixed.
# `bash eval/swastea-score-v2.sh` → ~/Desktop/swastea/music/score-draft-2.wav
set -e
cd ~/Desktop/swastea/music
S=stems-v2; T=score-v2-parts; mkdir -p $T
part() { # name src filters delay_ms — silence of the exact delay, then the clip, padded to 30s
  ffmpeg -loglevel error -y -i "$2" -filter_complex "[0]aresample=48000,aformat=channel_layouts=stereo,$3[c];anullsrc=r=48000:cl=stereo,atrim=0:$(python3 -c "print($4/1000)")[s];[s][c]concat=n=2:v=0:a=1,apad=whole_dur=30" $T/$1.wav
}
EQ="equalizer=f=750:t=o:w=1.2:g=-8"
part bedA   $S/bed-2.wav    "atrim=4.6:9.6,asetpts=PTS-STARTPTS,$EQ,volume=0.22,afade=t=in:d=1.5,afade=t=out:st=3.6:d=1.4" 6500
part bedB   $S/bed-2.wav    "atrim=15.0:22.0,asetpts=PTS-STARTPTS,$EQ,volume=0.2,afade=t=in:d=1.5,afade=t=out:st=5.4:d=1.6" 16500
part motif  $S/motif-1.wav  "atrim=28.05:31.25,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=2.6:d=0.6,volume=0.7" 9300
part bloom  $S/bloom-1.wav  "atrim=10.0:15.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=3.4:d=1.6,volume=0.7" 12000
part chorus ../trio-cuts/chorus-b-reverb.wav "afade=t=in:d=0.8,volume=0.5" 12300
part button $S/button-1.wav "atrim=21.45:26.95,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=4.6:d=0.9,volume=0.85" 24000
ffmpeg -loglevel error -y -i $T/bedA.wav -i $T/bedB.wav -i $T/motif.wav -i $T/bloom.wav -i $T/chorus.wav -i $T/button.wav \
  -filter_complex "amix=inputs=6:normalize=0,loudnorm=I=-20:TP=-2,aresample=48000" score-draft-2.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 score-draft-2.wav
