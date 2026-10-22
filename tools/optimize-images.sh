#!/usr/bin/env bash
# Convert photos into lightweight, responsive WebP files for the website.
#
# Usage:  tools/optimize-images.sh <source-folder> <destination-folder>
# Example: tools/optimize-images.sh ~/Pictures/garden assets/img/garden
#
# For every .jpg/.jpeg/.png in <source-folder> this writes three files:
#   <name>-480.webp, <name>-960.webp, <name>-1600.webp
# Images are resized by width and never upscaled, EXIF data (incl. GPS) is stripped and the
# orientation from the camera is applied. Requires ImageMagick with WebP.
set -euo pipefail

src=${1:?source folder required}
dst=${2:?destination folder required}
quality=${QUALITY:-78}
mkdir -p "$dst"

shopt -s nullglob nocaseglob
for f in "$src"/*.{jpg,jpeg,png}; do
  base=$(basename "${f%.*}")
  for w in 480 960 1600; do
    out="$dst/$base-$w.webp"
    [[ -e "$out" && "$out" -nt "$f" ]] && continue
    convert "$f" -auto-orient -strip -resize "${w}>" \
      -quality "$quality" -define webp:method=6 "$out"
  done
  echo "✓ $base"
done
