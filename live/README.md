# AGILE · Live — how to run

An interactive SIGGRAPH booth demo (offline, fully static web app). Five sections:
Reconstruction / 360° Geometry / Real-to-Sim / Benchmarks / How It Works.

## Requirements

- **Python 3** — for the local web server (usually preinstalled)
- A modern **browser** — Chrome / Edge recommended; Safari works

No npm, no dependencies to install, no internet, no build step — Three.js, the fonts and
the QR code are all bundled.

## Run

Serve from the **repo root** (the parent of `live/`), then open `/live/`:

```bash
# from the repo root (the folder that contains live/ and static/):

# recommended: no-cache server (edits show up on a plain refresh)
python3 live/serve.py
# then open http://localhost:8000/live/

# or the built-in server (equivalent, but the browser may cache old files)
python3 -m http.server 8000
# then open http://localhost:8000/live/
```

- Change port: `python3 live/serve.py 8080`
- Must be served from the repo root (the app references `../static/...`), not from inside `live/`.
- Click **Begin Demo** to start (also enters fullscreen); press **F** or the top-right ⤢ button anytime.

## Not seeing your latest changes?

The browser cached old files. **Hard-refresh** (⌘⇧R / Ctrl+Shift+R) or open a private window.
Serving with `live/serve.py` avoids this entirely (it sends no-cache headers).

## Package & share

Build a self-contained zip others can run (recipients need only Python 3 + a browser):

```bash
bash live/pack.sh            # → ~/Downloads/AGILE-Live.zip
```
