# AGILE · Live — Design Spec

**Date:** 2026-07-14
**Status:** Approved (design decisions locked via brainstorming)
**Author:** built with Claude Code

A full-screen, **offline**, dark "mission-control" web app that turns AGILE's
precomputed hand-object-interaction (HOI) reconstructions into a SIGGRAPH
**live-demo booth** experience. Idle → cinematic **attract loop**; touch/click →
**free exploration**; ~60 s idle → self-heals back to attract.

---

## 1. Goals & constraints

- **Interactive + 科技感 (tech aesthetic) + SIGGRAPH style.** Dark, neon, HUD-driven.
- **Runs on one computer at a booth.** Works with **both mouse and touch**.
- **Fully offline.** No CDNs (booth wifi is unreliable). Three.js vendored locally;
  no d3 / jQuery / MathJax / FontAwesome / Google Analytics.
- **Robust for unattended use.** Idle self-reset, graceful load-failure handling,
  loading HUD, stable performance.
- **Non-destructive.** The paper page (`index.html`) is untouched; `live/` is a new
  sibling that reuses the existing `static/results` + `static/videos` assets.

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Core experience | **Hybrid**: attract-mode cinematic ⇄ free exploration |
| Hardware | **Both** mouse + touch |
| Content | Interactive 3D · 360° Rotation · Real-to-Sim · Benchmarks (all four) |
| Attract camera | **Slow auto-orbit + dolly** |
| Placement / brand | New `live/` folder, **"AGILE · Live"** |
| Stack | Buildless vanilla JS + Three.js (no build step) |

## 3. Available data (verified on disk)

- **5 complete interactive sequences** (object mesh + per-frame hand GLBs + per-frame
  RGB frames + poses + intrinsics): `ABF12` (165), `GSF13` (166), `MDF12` (120),
  `SM2` (180), `SMu40` (205). `genhoi_controller1` lacks video/intrinsics → **excluded**
  from the interactive viewer (video-only asset).
- **Showcase videos** (all present): reconstruction, `*_rotate` (rotation),
  `*_retarget` (real-to-sim), plus per-clip thumbnail videos in subfolders.
- **Benchmark data**: HO3D-v3 & DexYCB, AGILE vs HOLD vs MagicHOI
  (MPJPE, CD, F@5, F@10, CD_h, SR). AGILE = 100% SR both datasets.

## 4. Architecture (isolated units)

```
live/
  index.html          entry; import map → ./vendor/three (offline)
  css/live.css        dark tech theme, HUD, layout, animations
  js/
    sequences.js      DATA MANIFEST — single source of truth
    viewer.js         AgileViewer: Three.js engine, clean API + events, dark theme
    director.js       modes: attract ⇄ explore, idle timer, section routing
    hud.js            HUD: transport (play/scrub/frame), view controls, telemetry
    gallery.js        sequence gallery (thumbnails + dataset chips)
    showcase.js       video showcase for Rotation + Real-to-Sim
    benchmarks.js     animated dark comparison table
  vendor/             three.module.js, OrbitControls, GLTFLoader (local, offline)
  DESIGN.md           this file
  README.md           how to run at the booth
```

### 4.1 AgileViewer (`viewer.js`)
The proven 3D/pose/loading/frustum math from `demo.js`, **ported verbatim** (camera at
origin looking −Z; object pose matrices × `global_scale=4`; per-frame hand GLB visibility;
camera intrinsics → FOV + `setViewOffset`; frustum `CameraHelper` + video image plane).
Changes are **shell + theme only**:
- Remove the built-in emoji control panel.
- Public API: `loadSequence(seq,{onProgress})`, `play/pause/toggle`,
  `seek(i)/nextFrame/prevFrame/firstFrame/lastFrame`, `setOverlayOpacity(0..1)`,
  `setAutoRotate(bool)/resetView()/toggleFrustum()`, `dispose()`.
- Events: `on('frame', {index,total})`, `on('loaded', seq)`, `on('progress', {pct,text})`.
- Theme: dark clear color, brighter cyan frustum lines, glowing violet hand (emissive),
  subtle rim light; CSS overlays (vignette/scanline) provide "glow" without post-processing
  (keeps it buildless + booth-safe).
- Attract dolly: gentle sine modulation of orbit radius while `autoRotate` is on.

### 4.2 director.js
Owns the **attract ⇄ explore** state machine and the **idle reset** (the piece that makes
the booth self-heal). Routes between the four sections. In attract: `autoRotate` on,
slow dolly, cycle sequences (~18 s) with a styled "reconstructing…" transition, animated
lower-third captions, pulsing "Touch to explore". Any pointer/touch/key → explore; ~60 s
inactivity → back to attract + first sequence.

### 4.3 hud.js / gallery.js / showcase.js / benchmarks.js
Small, single-purpose modules driven by the manifest and the viewer's public API/events.

## 5. Visual language (科技感 / SIGGRAPH)

Near-black + deep-indigo radial gradient, faint grid; **neon cyan** primary + **violet/
magenta** secondary (echoing the hand mesh `#9690F8`); glassmorphic HUD panels (blur, thin
bright border, inner glow); thin uppercase tracked headings + **monospace telemetry**;
animated corner-bracket reticles, glow pulses, number count-ups, scanline/grain; 3D scene
with rim/fresnel lighting and glowing wireframe camera frustums.

## 6. Booth robustness

Fully offline · idle self-reset · fullscreen "Enter" gesture · per-sequence loading HUD ·
graceful skip on sequence-load failure · DPR clamp + asset disposal on switch (already in
the ported code) · single sequence in memory at a time (avoids GPU blowup).

## 7. Out of scope

- Running the real AGILE pipeline live / user video upload (needs heavy GPU backend;
  infeasible in-browser).
- Modifying the existing paper page.

## 8. Run

```bash
# from repo root
python -m http.server 8000
# open http://localhost:8000/live/
```
