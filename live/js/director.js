// director.js — orchestration: attract ⇄ explore, idle self-reset, section
// routing, sequence cycling. The piece that makes the booth self-heal.

import { AgileViewer } from './viewer.js';
import { SEQUENCES, SHOWCASES, BENCHMARKS } from './sequences.js';
import { buildGallery } from './gallery.js';
import { Hud } from './hud.js';
import { buildShowcase } from './showcase.js';
import { buildBenchmarks } from './benchmarks.js';
import { buildExplainer } from './explainer.js';

const ATTRACT_MS = 18000;   // dwell per sequence in attract mode
const IDLE_MS = 60000;      // inactivity → return to attract

const $ = (id) => document.getElementById(id);

export function init() {
  const app = $('app');
  const stageFrame = $('stage-frame');

  // --- build the interactive viewer ---------------------------------------
  const viewer = new AgileViewer($('viewer-stage'), { overlayOpacity: 0.35, autoRotateSpeed: 0.55 });

  // --- HUD ----------------------------------------------------------------
  const hud = new Hud(viewer, {
    play: $('tp-play'), prev: $('tp-prev'), next: $('tp-next'),
    scrub: $('scrub'), count: $('frame-count'),
    opacity: $('opacity'), opVal: $('op-val'),
    reset: $('tp-reset'), spin: $('tp-spin'), frustum: $('tp-frustum'), full: $('tp-full'),
    tObject: $('t-object'), tSource: $('t-source'), tFrame: $('t-frame'),
    tRender: $('t-render'), tView: $('t-view'),
  });

  // --- gallery ------------------------------------------------------------
  const gallery = buildGallery($('gallery-list'), SEQUENCES, (idx) => {
    userInteract();
    loadSeq(idx);
  });

  // --- other sections -----------------------------------------------------
  const showRotation = buildShowcase($('sec-rotation'), SHOWCASES.rotation);
  const showRetarget = buildShowcase($('sec-retarget'), SHOWCASES.retarget);
  const bench = buildBenchmarks($('sec-bench'), BENCHMARKS);
  const explain = buildExplainer($('sec-explain'));

  const sections = {
    recon: $('sec-recon'), rotation: $('sec-rotation'),
    retarget: $('sec-retarget'), bench: $('sec-bench'), explain: $('sec-explain'),
  };
  const sectionHooks = { rotation: showRotation, retarget: showRetarget, bench, explain };

  // --- viewer load lifecycle → loading UI ---------------------------------
  viewer.on('loadstart', () => stageFrame.classList.add('is-loading'));
  viewer.on('progress', ({ pct, text }) => {
    $('load-fill').style.width = `${pct}%`;
    $('load-pct').textContent = `${Math.round(pct)}%`;
    $('load-text').textContent = text;
  });
  viewer.on('loaded', ({ seq, aspect }) => {
    stageFrame.style.setProperty('--stage-aspect', `${aspect}`);
    stageFrame.style.setProperty('--stage-aspect-num', `${aspect}`);
    stageFrame.classList.remove('is-loading');
    hud.onLoad(seq);
    setCaption(seq);
    applyModeToViewer();
  });
  viewer.on('error', () => stageFrame.classList.remove('is-loading'));

  // --- state --------------------------------------------------------------
  let mode = 'attract';      // 'attract' | 'explore'
  let section = 'recon';
  let currentIdx = 0;
  let cycleTimer = null;
  let idleTimer = null;
  let loadSeqToken = 0;
  let started = false;       // becomes true once the visitor taps "Begin"

  function setCaption(seq) {
    $('cap-object').textContent = seq.title;
    $('cap-line').innerHTML = `Monocular video → 4D interaction · <b>${seq.dataset}</b>`;
  }

  async function loadSeq(idx) {
    currentIdx = ((idx % SEQUENCES.length) + SEQUENCES.length) % SEQUENCES.length;
    gallery.setActive(currentIdx);
    const myToken = ++loadSeqToken;
    const ok = await viewer.loadSequence(SEQUENCES[currentIdx]);
    if (myToken !== loadSeqToken) return; // superseded
    if (!ok) {
      // self-heal: never let a broken sequence stall the attract loop
      if (started && mode === 'attract' && section === 'recon') {
        clearTimeout(cycleTimer);
        cycleTimer = setTimeout(() => loadSeq(currentIdx + 1), 3000);
      }
      return;
    }
    // if we're in attract and still on recon, queue the next cycle
    scheduleCycle();
  }

  function scheduleCycle() {
    clearTimeout(cycleTimer);
    if (started && mode === 'attract' && section === 'recon') {
      cycleTimer = setTimeout(() => loadSeq(currentIdx + 1), ATTRACT_MS);
    }
  }

  function applyModeToViewer() {
    if (mode === 'attract' && section === 'recon') {
      viewer.setAutoRotate(true);
      viewer.setDolly(true);
      viewer.play();
    } else {
      viewer.setDolly(false);
    }
  }

  // --- mode transitions ---------------------------------------------------
  function goAttract() {
    clearTimeout(idleTimer);   // definitive return-to-attract: cancel any pending idle reset
    mode = 'attract';
    app.classList.remove('mode-explore');
    app.classList.add('mode-attract');
    if (section !== 'recon') switchSection('recon', false);
    applyModeToViewer();
    scheduleCycle();
  }

  function goExplore() {
    mode = 'explore';
    app.classList.remove('mode-attract');
    app.classList.add('mode-explore');
    clearTimeout(cycleTimer);
    viewer.setAutoRotate(false);
    viewer.setDolly(false);
  }

  function userInteract() {
    if (mode !== 'explore') goExplore();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goAttract, IDLE_MS);
  }

  // --- section routing ----------------------------------------------------
  function switchSection(name, byUser = true) {
    if (!sections[name]) return;
    // leave previous
    if (sectionHooks[section]?.onHide) sectionHooks[section].onHide();
    section = name;
    Object.entries(sections).forEach(([k, el]) => el.classList.toggle('is-active', k === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.section === name));
    if (sectionHooks[name]?.onShow) sectionHooks[name].onShow();
    if (name === 'recon') scheduleCycle(); else clearTimeout(cycleTimer);
    if (byUser) userInteract();
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.section, true));
  });

  // dedicated reset-camera button (explore mode)
  $('reset-view').addEventListener('click', () => viewer.resetView());

  // --- global interaction + keyboard --------------------------------------
  ['pointerdown', 'touchstart', 'wheel'].forEach(ev =>
    window.addEventListener(ev, (e) => { if (e.isTrusted && started) userInteract(); }, { passive: true, capture: true }));

  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted || !started) return;   // ignore input while the start gate is up
    userInteract();
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      switchSection(['recon', 'rotation', 'retarget', 'bench', 'explain'][+e.key - 1], true);
    } else if (section === 'recon') {
      if (e.key === ' ') { e.preventDefault(); viewer.toggle(); }
      else if (e.key === 'ArrowRight') { viewer.pause(); viewer.nextFrame(); }
      else if (e.key === 'ArrowLeft') { viewer.pause(); viewer.prevFrame(); }
      else if (e.key.toLowerCase() === 'r') viewer.setAutoRotate(!viewer.autoRotate);
    }
    if (e.key.toLowerCase() === 'f') hud._toggleFullscreen();
  });

  // --- start gate ---------------------------------------------------------
  const gate = $('gate');
  function start() {
    const root = document.documentElement;
    Promise.resolve((root.requestFullscreen || root.webkitRequestFullscreen)?.call(root)).catch(() => {});
    gate.classList.add('is-out');
    started = true;
    goAttract();
  }
  $('gate-start').addEventListener('click', start);

  // Boot: begin loading the first sequence immediately (behind the gate) so the
  // reveal is instant, and pre-arm attract mode.
  app.classList.add('mode-attract');
  loadSeq(0);
}
