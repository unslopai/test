#!/bin/bash
# LinkedIn video files (RESEARCH.md §2): 4:5 = 1080×1350, the recommended feed ratio.
# The 9:16 films keep all text inside the safe zone y = 250–1520 (film BRIEFs) and the "Private beta" stamp at
# y = 168–236, so a 1080×1350 window from y = 150 to 1500 removes only empty margin (lowest content ≈ y 1476). Checked on contact sheets (CHECK.md).
# No SRT: the films have no speech; the burned-in kinetic type is the caption (LinkedIn captions would sit on top of it).
#   bash distribution/channels/02-linkedin/visuals/make_li_cuts.sh
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
MO=$ROOT/distribution/motion
OUT=$ROOT/distribution/channels/02-linkedin/visuals
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
ENC=(-c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 -crf 17 -preset slow -g 60
     -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709
     -c:a aac -b:a 192k -ac 2 -ar 48000 -movflags +faststart)

cut45() { # name source
  "$FF" -v error -y -i "$2" -vf "crop=1080:1350:0:150,setsar=1" "${ENC[@]}" "$OUT/li-$1-4x5.mp4"
  echo "li-$1-4x5: $(du -h "$OUT/li-$1-4x5.mp4" | awk '{print $1}')"
}
cut45 film01-beta   "$MO/01-silent-failure/cuts/beta.mp4"
cut45 film02-beta   "$MO/02-regenerate-erosion/cuts/beta.mp4"
cut45 film01-launch "$MO/01-silent-failure/cuts/launch.mp4"
cut45 film03-launch "$MO/03-terminal-to-pr/final.mp4"
