#!/usr/bin/env bash
# Builds Swastea's sip hook (user, 2026-10-08): "dhirena" exactly FIVE times, fast, sung by a chorus
# of women. Four Gemini TTS singers (eval/swastea-chorus.ts) each sang five sung "dhi-re-na"s; every
# dhirena is cut at its silence (silencedetect), rubberband-fitted onto one fast grid (pitch kept),
# and the four singers are layered and spread left/right as a group.
# Usage: swastea-chorus.sh <unit_s> <last_s> <out.wav>
set -e
cd ~/Desktop/swastea/chorus
UNIT=$1; LAST=$2; OUT=$3
# start-end of each dhirena per singer (seconds in <voice>-trim.wav)
declare -A CUTS=(
  [Zephyr]="0.00-1.03 1.17-2.16 2.32-3.28 3.44-4.42 4.60-6.40"
  [Kore]="0.00-1.03 1.14-2.06 2.15-3.08 3.17-4.19 4.27-5.74"
  [Aoede]="0.00-1.03 1.12-2.11 2.22-3.17 3.30-4.27 4.33-6.67"
  [Despina]="0.00-1.25 1.50-2.70 2.95-4.13 4.41-5.61 5.82-7.02"
)
for v in "${!CUTS[@]}"; do
  i=0; parts=()
  for c in ${CUTS[$v]}; do
    s=${c%-*}; e=${c#*-}; len=$(python3 -c "print(round($e-$s,3))"); want=$([ $i = 4 ] && echo $LAST || echo $UNIT)
    ffmpeg -loglevel error -y -ss $s -t $len -i $v-trim.wav \
      -af "rubberband=tempo=$(python3 -c "print(round($len/$want,4))"):transients=crisp:detector=percussive:formant=preserved,apad=whole_len=$(python3 -c "print(int($want*24000))"),atrim=0:$want,afade=t=in:d=0.008,afade=t=out:st=$(python3 -c "print(round($want-0.03,3))"):d=0.03" $v-u$i.wav
    parts+=(-i $v-u$i.wav); i=$((i+1))
  done
  ffmpeg -loglevel error -y "${parts[@]}" -filter_complex "[0][1][2][3][4]concat=n=5:v=0:a=1,aresample=48000,loudnorm=I=-20" lead-$v.wav
done
# Zephyr leads in the centre; the others sit a touch behind (a few ms late) and spread left/right.
ffmpeg -loglevel error -y -i lead-Zephyr.wav -i lead-Kore.wav -i lead-Aoede.wav -i lead-Despina.wav -filter_complex "\
[0]pan=stereo|c0=c0|c1=c0[z];\
[1]adelay=14,volume=0.8,pan=stereo|c0=0.95*c0|c1=0.35*c0[k];\
[2]adelay=22,volume=0.8,pan=stereo|c0=0.35*c0|c1=0.95*c0[a];\
[3]adelay=9,volume=0.7,pan=stereo|c0=0.6*c0|c1=0.6*c0[d];\
[z][k][a][d]amix=inputs=4:normalize=0,chorus=0.7:0.85:35|50:0.3|0.25:0.25|0.35:2|1.5,aecho=0.8:0.5:70:0.12,loudnorm=I=-16:TP=-1.5" "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
