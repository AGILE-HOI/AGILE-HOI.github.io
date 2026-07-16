#!/usr/bin/env bash
# Package AGILE·Live into a self-contained zip others can run.
# Recipients need only Python 3 + a modern browser — no install, no internet.
#
# Usage:  bash live/pack.sh [output_dir]      (default output dir: ~/Downloads)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # repo root (parent of live/)
OUTDIR="${1:-$HOME/Downloads}"
WORK="$(mktemp -d)"
STAGE="$WORK/AGILE-Live"
mkdir -p "$STAGE/static/img/icons"

echo "Staging app + assets…"
rsync -a --exclude '.DS_Store' --exclude 'pack.sh' "$ROOT/live/"            "$STAGE/live/"
rsync -a --exclude '.DS_Store'                     "$ROOT/static/results/"  "$STAGE/static/results/"
rsync -a --exclude '.DS_Store'                     "$ROOT/static/videos/"   "$STAGE/static/videos/"
cp "$ROOT/static/img/agentic_gen.png" "$ROOT/static/img/pipeline.png"       "$STAGE/static/img/"
cp "$ROOT/static/img/icons/agile_icon.png"                                  "$STAGE/static/img/icons/"

cat > "$STAGE/START-HERE.md" <<'EOF'
# AGILE · Live — how to run

An interactive SIGGRAPH demo. Runs fully offline.

## Requirements
- **Python 3** (macOS/Linux usually have it; on Windows install from python.org)
- A modern **browser** (Chrome / Edge / Safari)

Nothing else to install — Three.js, fonts and the QR are bundled.

## Run
Open a terminal **in this folder**, then:

    python3 live/serve.py        # macOS / Linux
    python  live/serve.py        # Windows (if `python3` is not found)

Then open in your browser:

    http://localhost:8000/live/

Click **Begin Demo**, press **F** for fullscreen.
(Change port:  `python3 live/serve.py 8080`)
EOF

mkdir -p "$OUTDIR"
ZIP="$OUTDIR/AGILE-Live.zip"
rm -f "$ZIP"
echo "Zipping → $ZIP …"
( cd "$WORK" && zip -rq -1 "$ZIP" AGILE-Live -x '*.DS_Store' )
rm -rf "$WORK"

echo "Done:"
du -sh "$ZIP"
