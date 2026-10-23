#!/usr/bin/env bash
# Create the 1200×630 link-preview images (WhatsApp, Facebook, …) from each
# apartment's cover photo. Run again after changing a cover photo.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/img/og
og() { convert "$1" -resize 1200x630^ -gravity center -extent 1200x630 -strip -quality 82 "assets/img/og/$2.jpg"; echo "✓ $2"; }
for d in assets/img/*/; do
  id=$(basename "$d")
  cover=$(grep -A40 "^- id: $id\$" _data/apartments.yml | grep -m1 -oP '(?<=src: )[\w-]+' || true)
  [[ -n "$cover" && -f "$d$cover-1600.webp" ]] && og "$d$cover-1600.webp" "$id"
done
og assets/img/natural/01-living-1600.webp home
