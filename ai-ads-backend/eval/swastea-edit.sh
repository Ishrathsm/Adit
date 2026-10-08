#!/usr/bin/env bash
# Swastea 30s edit (2026-10-08): one Veo take per shot, cut fast (hard cuts, dialogue shots at
# 1.15x with pitch kept, so lines are brisk); the sip (s4) stays at real speed. s2 is cropped to keep
# out the young man, whom Veo dressed in a red shirt; in s6 Veo's extra "Hari" is cut out (picture
# and sound, 0.12s blend). Malhar take 1 sits low throughout; the women's "dhi-re-naaa" (take B,
# reverb) plays faintly only while he drinks. Ends on the pack push-in, then a white logo card.
# `bash eval/swastea-edit.sh` → ~/Desktop/swastea/swastea-cut-1.mp4
set -e
D=~/Desktop/swastea; V=$D/video; T=$D/edit-tmp; mkdir -p $T
SP=1.15
KARLA=$(fc-match -f '%{file}' 'Karla:bold')
seg() { # name in from to speed [vf]
  local vf="setpts=(PTS-STARTPTS)/$5${6:+,$6},scale=1280:720,fps=24,format=yuv420p"
  ffmpeg -loglevel error -y -i $V/$2.mp4 -filter_complex "[0:v]trim=$3:$4,$vf[v];[0:a]atrim=$3:$4,asetpts=PTS-STARTPTS,atempo=$5,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/$1.mkv
}
seg 1 s1 0.45 6.25 $SP
seg 2 s2 0.40 4.30 $SP "crop=896:504:0:30"
seg 3 s3 0.60 3.30 $SP
seg 4 s4 0.40 6.70 1.0
seg 5 s5 0.30 4.70 $SP
# s6 without "Hari" (3.45–3.85s): two parts joined by a 0.12s blend
seg 6a s6 0.40 3.44 1.0
seg 6b s6 3.86 7.60 1.0
ffmpeg -loglevel error -y -i $T/6a.mkv -i $T/6b.mkv -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.12:offset=$(python3 -c "print(round(3.04-0.12,3))"),setpts=PTS/$SP[v];[0:a][1:a]acrossfade=d=0.12,atempo=$SP[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/6.mkv
# pack push-in, its audio muted (Veo added a narrator and music)
ffmpeg -loglevel error -y -i $V/end.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo -filter_complex "[0:v]trim=3.0:4.8,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v];[1:a]atrim=0:1.8[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/7.mkv
# logo card: the flat logo on white, tagline in the pack's green
ffmpeg -loglevel error -y -f lavfi -i color=c=white:s=1280x720:r=24:d=2.1 -i $D/logo-flat.png -f lavfi -i anullsrc=r=48000:cl=stereo -filter_complex "[1:v]scale=-1:470[l];[0:v][l]overlay=(W-w)/2:40,drawtext=fontfile=$KARLA:text='Roj piyo, swasth raho.':fontsize=50:fontcolor=0x1c4a2e:x=(w-tw)/2:y=560,format=yuv420p[v];[2:a]atrim=0:2.1[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/8.mkv
# assemble: hard cuts, then a 0.3s dissolve from the pack shot into the logo card
ffmpeg -loglevel error -y -i $T/1.mkv -i $T/2.mkv -i $T/3.mkv -i $T/4.mkv -i $T/5.mkv -i $T/6.mkv -i $T/7.mkv -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a][5:v][5:a][6:v][6:a]concat=n=7:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/body.mkv
BODY=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $T/body.mkv)
ffmpeg -loglevel error -y -i $T/body.mkv -i $T/8.mkv -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.3:offset=$(python3 -c "print(round($BODY-0.3,3))")[v];[0:a][1:a]acrossfade=d=0.3[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -preset fast -c:a pcm_s16le $T/picture.mkv
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $T/picture.mkv)
# where the sip starts: s4 begins after s1+s2+s3
SIP=$(python3 -c "
import subprocess
d=lambda f: float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
print(round(sum(d('$T/%d.mkv'%i) for i in (1,2,3))+0.2,3))")
END=$(python3 -c "print(round($TOTAL-2.4,3))")
echo "total ${TOTAL}s, sip at ${SIP}s"
# mix: dialogue + Malhar bed (low; dips a little under the hook; lifts on the logo card) + faint hook on the sip
ffmpeg -loglevel error -y -i $T/picture.mkv -i $D/malhar-1.wav -i $D/trio-cuts/chorus-b-reverb.wav -filter_complex "\
[0:a]volume=1.0[dlg];\
[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:$TOTAL,volume=0.14,volume='if(between(t,$SIP,$SIP+4.4),0.6,if(gt(t,$END),1.9,1))':eval=frame,afade=t=in:d=0.8,afade=t=out:st=$(python3 -c "print(round($TOTAL-1.2,3))"):d=1.2[bed];\
[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.16,adelay=$(python3 -c "print(int($SIP*1000))")|$(python3 -c "print(int($SIP*1000))")[hook];\
[dlg][bed][hook]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.89[a]" -map 0:v -map "[a]" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart $D/swastea-cut-1.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 $D/swastea-cut-1.mp4
