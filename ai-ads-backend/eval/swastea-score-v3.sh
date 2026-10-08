#!/usr/bin/env bash
# Swastea score draft 3 (user, 2026-10-08: "dont just fix on santoor... use traditional ones"). Raag
# Pahadi stems on traditional instruments (music/stems-v3: a sitar/santoor bed, a santoor motif, a
# tanpura+santoor bloom, a santoor button; plan in eval/out/swastea-team/stems-plan-v3.json), cut on waveform phrase boundaries
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
# Timings can be moved to fit a cut: T_BLOOM, T_ACCENT, T_BEDB, B_END, B_FADE, T_BUTTON (ms / s).
# `bash eval/swastea-score-v2.sh` → ~/Desktop/swastea/music/${OUT:-score-draft-3.wav}
set -e
cd ~/Desktop/swastea/music
S=stems-v3; T=score-v3-parts; mkdir -p $T
part() { # name src filters delay_ms — silence of the exact delay, then the clip, padded to 30s
  ffmpeg -loglevel error -y -i "$2" -filter_complex "[0]aresample=48000,aformat=channel_layouts=stereo,$3[c];anullsrc=r=48000:cl=stereo,atrim=0:$(python3 -c "print($4/1000)")[s];[s][c]concat=n=2:v=0:a=1,apad=whole_dur=30" $T/$1.wav
}
EQ="equalizer=f=750:t=o:w=1.2:g=-8"
part bedA   $S/bed-1.wav    "atrim=0.5:8.5,asetpts=PTS-STARTPTS,$EQ,volume=0.22,afade=t=in:d=1.5,afade=t=out:st=7.0:d=1.0" 3500
part bedB   $S/bed-1.wav    "atrim=12.0:${B_END:-19.5},asetpts=PTS-STARTPTS,$EQ,volume=0.2,afade=t=in:d=1.2,afade=t=out:st=${B_FADE:-6.0}:d=1.5" ${T_BEDB:-16500}
part motif  $S/motif-2.wav  "atrim=0.0:1.6,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=1.2:d=0.4,volume=0.7" 9600
part bloom  $S/bloom-2.wav  "atrim=5.0:10.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=3.4:d=1.6,volume=0.6" ${T_BLOOM:-12000}
# The sip accent replaced the women's "dhi-re-naaa" (user: "dhirena is very loud and its not suiting...
# replace something captivating"): ACCENT=name:start:end from music/accent/, softer, blooming in and out.
if [ -n "$ACCENT" ]; then
  IFS=: read -r AN AS AE <<< "$ACCENT"; AL=$(python3 -c "print(round($AE-$AS,2))")
  part chorus accent/$AN.wav "atrim=$AS:$AE,asetpts=PTS-STARTPTS,afade=t=in:d=1.0,afade=t=out:st=$(python3 -c "print(round($AL-1.6,2))"):d=1.6,volume=0.38" ${T_ACCENT:-12100}
else
  part chorus ../trio-cuts/chorus-b-reverb.wav "afade=t=in:d=0.8,volume=0.5" 12300
fi
part button $S/button-2.wav "atrim=25.4:29.15,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=3.0:d=0.75,volume=0.85" ${T_BUTTON:-24000}
ffmpeg -loglevel error -y -i $T/bedA.wav -i $T/bedB.wav -i $T/motif.wav -i $T/bloom.wav -i $T/chorus.wav -i $T/button.wav \
  -filter_complex "amix=inputs=6:normalize=0,loudnorm=I=-20:TP=-2,aresample=48000" ${OUT:-score-draft-3.wav}
ffprobe -v error -show_entries format=duration -of csv=p=0 ${OUT:-score-draft-3.wav}
