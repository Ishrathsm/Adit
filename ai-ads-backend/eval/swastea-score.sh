#!/usr/bin/env bash
# Swastea score draft, built from stems to the spotting plan (eval/out/swastea-team/stems-plan.json,
# knowledge/music-scoring-for-ads.md):
# - 0–6.5s: silence; natural sound only.
# - 6.5s: a faint santoor bed fades in, EQ-dipped at 500 Hz–1 kHz so the voices sit clear.
# - 9.5s: one short motif in the dialogue-free kitchen shots.
# - 11.6–12.2s: a hush.
# - 12.0s: the bloom, plus the women's "dhi-re-naaa" (blended in over 0.8s) on the sip.
# - 24.0s: the santoor button on the logo, ringing out by 29.5s.
# `bash eval/swastea-score.sh` → ~/Desktop/swastea/music/score-draft-1.wav
set -e
cd ~/Desktop/swastea/music
S=stems
ffmpeg -loglevel error -y \
  -i $S/bed-2.wav -i $S/motif-2.wav -i $S/bloom-2.wav -i ../trio-cuts/chorus-b-reverb.wav -i $S/button-2.wav \
  -filter_complex "\
[0]atrim=0:23,asetpts=PTS-STARTPTS,equalizer=f=750:t=o:w=1.2:g=-7,volume=0.32,afade=t=in:d=1.5,afade=t=out:st=21.4:d=1.6,volume='if(between(t,5.1,5.7),0.35,if(between(t,5.5,10),0.55,1))':eval=frame,adelay=6500|6500[bed];\
[1]atrim=4.70:7.00,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=1.7:d=0.6,volume=0.8,adelay=9500|9500[motif];\
[2]atrim=1.00:6.00,asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st=3.5:d=1.5,volume=0.75,adelay=12000|12000[bloom];\
[3]afade=t=in:d=0.8,volume=0.55,adelay=12300|12300[chorus];\
[4]atrim=14.90:20.40,asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=4.4:d=1.1,volume=0.9,adelay=24000|24000[button];\
[bed][motif][bloom][chorus][button]amix=inputs=5:normalize=0,apad=whole_dur=30,atrim=0:30,aformat=channel_layouts=stereo,loudnorm=I=-20:TP=-2" score-draft-1.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 score-draft-1.wav
