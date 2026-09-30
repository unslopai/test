#!/bin/bash
# Builds the X video files from the motion films (distribution/motion/*):
#   9:16  = the film as is, re-encoded for X (30 fps, H.264 High, yuv420p, CBR 6 Mbit/s ≥ the 5,000 kbps minimum, AAC-LC 192k)
#   16:9  = static backplate (composite.html) + the 9:16 film at full height (608×1080) on the right
# Sources: 01/02 = cuts/beta.mp4 ("Private beta" stamp, corrected stat + end card), 03 = final.mp4 (launch CTA).
# X media specs: RESEARCH.md §2 (docs.x.com/x-api/media/quickstart/best-practices). Run from the repo root:
#   bash distribution/channels/01-x/visuals/make_x_cuts.sh [film01|film02|film03]...
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
CH=$ROOT/distribution/channels
MO=$ROOT/distribution/motion
OUT=$CH/01-x/visuals
PLATES=$OUT/plates            # intermediate, git-ignored
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
ENC=(-c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 -b:v 6M -minrate 6M -maxrate 6M -bufsize 6M -x264-params nal-hrd=cbr -g 60
     -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709
     -c:a aac -b:a 192k -ac 2 -ar 48000 -movflags +faststart)

mkdir -p "$PLATES"
CHROME_PATH=${CHROME_PATH:-/opt/pw-browsers/chromium} python3 "$CH/_kit/render.py" "$OUT/composite.html" "$PLATES" >/dev/null

build() { # name source plate
  local name=$1 src=$2 plate=$3
  "$FF" -v error -y -i "$src" "${ENC[@]}" -vf "scale=1080:1920:flags=lanczos,setsar=1" "$OUT/x-$name-9x16.mp4"
  "$FF" -v error -y -loop 1 -framerate 30 -i "$PLATES/$plate.png" -i "$src" \
    -filter_complex "[1:v]scale=608:1080:flags=lanczos,setsar=1[f];[0:v][f]overlay=1232:0:shortest=1,format=yuv420p[v]" \
    -map "[v]" -map 1:a "${ENC[@]}" -shortest "$OUT/x-$name-16x9.mp4"
  echo "x-$name: $(du -h "$OUT/x-$name-9x16.mp4" | cut -f1) (9:16), $(du -h "$OUT/x-$name-16x9.mp4" | cut -f1) (16:9)"
}

for film in "${@:-film01 film02 film03}"; do
  case $film in
    film01) build film01-beta "$MO/01-silent-failure/cuts/beta.mp4" plate-film01-beta ;;
    film02) build film02-beta "$MO/02-regenerate-erosion/cuts/beta.mp4" plate-film02-beta ;;
    film03) build film03-launch "$MO/03-terminal-to-pr/final.mp4" plate-film03-launch ;;
  esac
done
