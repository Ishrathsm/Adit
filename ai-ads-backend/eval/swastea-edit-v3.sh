#!/usr/bin/env bash
# Swastea cut 2 (plan v3, 2026-10-08). Built to the film-craft bar:
# - Picture: no speed changes; hard cuts on lines and looks; one dissolve into the hero; 2.39 letterbox;
#   warm grade and light grain.
# - Mandala: keyed onto the plain peach wall behind his head on the sip (a per-frame mask from the wall's
#   colour, so it never crosses his face).
# - Supers: a corner logo watermark (except on the hero), a T&C line in the bottom bar throughout, and
#   the logo and tagline fading in over the hero (no light sweep: user, 2026-10-08). No white end card.
# - Sound: Veo dialogue; room tone under everything; score draft 3 with the bansuri sigh, re-timed to
#   this cut and faint; the end line in the TTS voice (Aoede).
# `bash eval/swastea-edit-v3.sh` → ~/Desktop/swastea/swastea-cut-2.mp4
set -e
D=~/Desktop/swastea; V=$D/video-v3; T=$D/edit-v3/tmp; mkdir -p $T
KARLA=$(fc-match -f '%{file}' 'Karla')
GRADE="eq=contrast=1.04:saturation=1.04:gamma=1.01,colorbalance=rs=0.02:gs=0.0:bs=-0.03:rm=0.02:bm=-0.02"

# name clip in out [crop] [dub-line] — picture and sound trimmed together, 25 ms sound fades at the edges.
# With a dub line whose take was approved in Dub Studio (adr/final/<line>.wav, recorded from the clip's
# first frame), that voice replaces Veo's, laid over Veo's quietened room sound.
DUB=$D/adr/final
seg() {
  local len; len=$(python3 -c "print(round($4-$3,3))")
  local vf="scale=1280:720"; [ -n "$5" ] && vf="$5,scale=1280:720"
  local fade="afade=t=in:d=0.025,afade=t=out:st=$(python3 -c "print(round($len-0.025,3))"):d=0.025"
  if [ -n "$6" ] && [ -f $DUB/$6.wav ]; then
    echo "  seg $1: dubbed voice ($6)"
    ffmpeg -loglevel error -y -i $V/$2.mp4 -i $DUB/$6.wav -filter_complex "[0:v]trim=$3:$4,setpts=PTS-STARTPTS,$vf,fps=24,setsar=1,$GRADE,format=yuv420p[v];[0:a]atrim=$3:$4,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=0.12[bed];[1:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=$len,atrim=0:$len,loudnorm=I=-18:TP=-2,aresample=48000[voice];[bed][voice]amix=inputs=2:normalize=0:duration=first,$fade[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 14 -preset fast -c:a pcm_s16le $T/$1.mkv
  else
    ffmpeg -loglevel error -y -i $V/$2.mp4 -filter_complex "[0:v]trim=$3:$4,setpts=PTS-STARTPTS,$vf,fps=24,setsar=1,$GRADE,format=yuv420p[v];[0:a]atrim=$3:$4,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,$fade[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 14 -preset fast -c:a pcm_s16le $T/$1.mkv
  fi
}
# Re-shot s1/s2 (user, 2026-10-08: "he is not pronouncing… the sneeze is entirely gone… she speaks very
# slow"). s1-t2: a clear line, then he sneezes into his elbow on camera (his own sneeze, lifted ~5 dB).
# s2-t2: Aunty at a normal pace, alone in frame.
seg 1 s1-t2 0.0 4.8 "" l1
ffmpeg -loglevel error -y -i $T/1.mkv -c:v copy -af "volume=enable='between(t,3.0,4.8)':volume=1.8" -c:a pcm_s16le $T/1b.mkv && mv $T/1b.mkv $T/1.mkv
seg 2 s2-t2 0.3 2.4 "" l2
seg 3 s3-t1 0.0 2.3 "" l3
seg 4 s4a-t1 0.3 2.4
seg 5 s4b-t1 0.4 1.7
seg 6 s5-t2 0.4 6.9 "" l4
seg 7 s6-t2 3.4 6.0 "" l5
seg 8 s7-t1 1.0 5.7 "" l6
seg 9 s8-t1 0.0 4.1

# The sip: the mandala only where the warm peach wall is (red well above blue, and bright), feathered,
# from 0.2s into the shot for 3.2s. Gold lines vanished on the peach wall, so the mandala is drawn
# warm white-gold with a soft glow around its lines.
ffmpeg -loglevel error -y -i $T/6.mkv -i $D/edit-v3/mandala.mov -filter_complex "\
[0:v]split[base][mk];\
[mk]format=gbrp,geq=r='if(gt(r(X,Y)-b(X,Y),75)*gt(r(X,Y),160),255,0)':g='if(gt(r(X,Y)-b(X,Y),75)*gt(r(X,Y),160),255,0)':b='if(gt(r(X,Y)-b(X,Y),75)*gt(r(X,Y),160),255,0)',format=gray,erosion,gblur=sigma=6[wall];\
[1:v]setpts=PTS-STARTPTS+0.2/TB,format=rgba,lutrgb=r=255:g=240:b=200,colorchannelmixer=aa=1.7,split[l1][l2];\
[l2]gblur=sigma=9,colorchannelmixer=aa=1.3[glow];\
[glow][l1]overlay=format=auto,split[mrgb][malpha];\
[malpha]alphaextract[ma];\
[ma][wall]blend=all_mode=multiply:shortest=0:repeatlast=1[a2];\
[mrgb][a2]alphamerge[mand];\
[base][mand]overlay=eof_action=pass:format=auto,format=yuv420p[v]" -map "[v]" -map 0:a -c:v libx264 -crf 14 -preset fast -c:a copy $T/6m.mkv

# Assemble: hard cuts 1–8, then a 0.5s dissolve into the hero.
ffmpeg -loglevel error -y -i $T/1.mkv -i $T/2.mkv -i $T/3.mkv -i $T/4.mkv -i $T/5.mkv -i $T/6m.mkv -i $T/7.mkv -i $T/8.mkv \
  -filter_complex "concat=n=8:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 14 -preset fast -c:a pcm_s16le $T/body.mkv
BODY=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $T/body.mkv)
HERO=$(python3 -c "print(round($BODY-0.5,3))")
ffmpeg -loglevel error -y -i $T/body.mkv -i $T/9.mkv -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=$HERO[v];[0:a][1:a]acrossfade=d=0.5[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 14 -preset fast -c:a pcm_s16le $T/picture.mkv
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $T/picture.mkv)
SIP=$(python3 -c "
import subprocess
d=lambda f: float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
print(round(sum(d('$T/%d.mkv'%i) for i in range(1,6)),3))")
echo "total ${TOTAL}s · sip ${SIP}s · hero ${HERO}s"

# Score draft 3 + bansuri sigh, re-timed: bloom on the sip, bed under the later lines, button on the hero.
ms() { python3 -c "print(int(round(($1)*1000)))"; }
ACCENT="bansuri-1:9.3:13.9" OUT="score-cut-2.wav" T_BLOOM=$(ms "$SIP") T_ACCENT=$(ms "$SIP+0.1") \
  T_BEDB=$(ms "$SIP+6.5") B_END=18.5 B_FADE=5.0 T_BUTTON=$(ms "$HERO+0.1") bash $(dirname $0)/swastea-score-v3.sh

# Picture finishing: grain, 2.39 letterbox, watermark until the hero, T&C line, logo reveal on the hero.
TC="Swastea is a herbal tea, not a medicine. Visuals are for representation only. *T&C apply."
ffmpeg -loglevel error -y -i $T/picture.mkv -i $D/logo-transparent.png -i $D/edit-v3/logo-reveal.mov -filter_complex "\
[0:v]noise=alls=5:allf=t,drawbox=x=0:y=0:w=1280:h=92:color=black:t=fill,drawbox=x=0:y=628:w=1280:h=92:color=black:t=fill[pic];\
[1:v]scale=86:-1,format=rgba,colorchannelmixer=aa=0.6[wm];\
[pic][wm]overlay=x=1280-86-30:y=92+16:enable='lt(t,$HERO)'[p1];\
[2:v]setpts=PTS-STARTPTS+$(python3 -c "print($HERO+0.4)")/TB[lr];\
[p1][lr]overlay=eof_action=pass:format=auto[p2];\
[p2]drawtext=fontfile=$KARLA:text='$TC':fontsize=15:fontcolor=white@0.72:x=(w-tw)/2:y=628+(92-th)/2,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -crf 17 -preset slow $T/final-picture.mp4

# Mix: dialogue (levelled), room tone from the hero shot looped under everything, the faint score, the VO.
VO=$D/replan/vo2-Aoede-a.wav; [ -f $DUB/l7.wav ] && VO=$DUB/l7.wav && echo "  end line: dubbed voice"
ffmpeg -loglevel error -y -i $T/picture.mkv -i $V/s8-t1.mp4 -i $D/music/score-cut-2.wav -i $VO -filter_complex "\
[0:a]aresample=48000,dynaudnorm=f=200:g=11,loudnorm=I=-18:TP=-2,aresample=48000[dlg];\
[1:a]aresample=48000,aformat=channel_layouts=stereo,aloop=loop=-1:size=384000,atrim=0:$TOTAL,volume=0.18,lowpass=f=6000[room];\
[2:a]aresample=48000,volume=-9dB[score];\
[3:a]aresample=48000,aformat=channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-17:TP=-2,aresample=48000,adelay=$(ms "$HERO+0.6")|$(ms "$HERO+0.6")[vo];\
[dlg][room][score][vo]amix=inputs=4:normalize=0:duration=first,alimiter=limit=0.9[a]" \
  -map "[a]" -c:a pcm_s16le $T/final-audio.wav
ffmpeg -loglevel error -y -i $T/final-picture.mp4 -i $T/final-audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart $D/swastea-cut-2.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 $D/swastea-cut-2.mp4
