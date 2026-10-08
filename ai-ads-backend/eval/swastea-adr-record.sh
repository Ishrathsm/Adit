#!/usr/bin/env bash
# Swastea dub, step 1 (user, 2026-10-08: "I will read the script, u catch the phonetics... dub it").
# A teleprompter: records your mic for the whole read and shows one line at a time. Read each line
# with its feeling; pronunciation and timing are taken from YOU, and the voice is converted afterwards
# (eval/swastea-adr-convert.sh). Run it in your own terminal:
#   bash ~/Desktop/Adit/ai-ads-backend/eval/swastea-adr-record.sh
# → ~/Desktop/swastea/adr/my-read.wav (run again to redo; the old take is kept as my-read-<time>.wav)
set -e
OUT=~/Desktop/swastea/adr; mkdir -p $OUT
[ -f $OUT/my-read.wav ] && mv $OUT/my-read.wav $OUT/my-read-$(date +%H%M%S).wav
LINES=(
  "1 · Young man (a little shy, blocked nose)|Aunty, thodi adrak milegi?"
  "2 · Aunty (gentle, concerned)|Lagta hai zukaam hai."
  "3 · Aunty (warm, inviting)|Andar aao, beta."
  "4 · Young man (soft, eyes closed, relief)|Aah… kitna aaram mila."
  "5 · Young man (grateful, a little homesick)|Aunty, bilkul maa ke haath jaisi."
  "6 · Aunty (warm, simple)|Adrak, ashwagandha aur tulsi se bani hai."
  "7 · End voice-over (soft, sweet, smiling)|SWAS-tea.  Roj piyo, swasth raho."
)
clear
echo "Swastea dub read: 7 lines. Speak at a natural pace; leave a short pause between lines."
echo "Use a quiet room, about a hand's width from the laptop mic."
echo; read -r -p "Press Enter to start recording… " _
ffmpeg -loglevel error -y -f pulse -i default -ac 1 -ar 48000 $OUT/my-read.wav &
REC=$!
trap 'kill -INT $REC 2>/dev/null; wait $REC 2>/dev/null' EXIT
sleep 1
for i in 3 2 1; do printf "\r  Starting in %s… " $i; sleep 1; done; echo
for entry in "${LINES[@]}"; do
  who=${entry%%|*}; line=${entry#*|}
  clear; echo; echo "   $who"; echo; echo "      $line"; echo
  echo "   (read it now, then wait)"
  sleep 5
  clear; echo; echo "   …pause…"; sleep 1.5
done
clear; echo "Done. Saved to $OUT/my-read.wav. Tell Claude it's recorded."
