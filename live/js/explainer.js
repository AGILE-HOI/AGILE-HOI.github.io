// explainer.js — "How It Works": a stepped kiosk explainer (motivation + method)
// with native dark node-flow diagrams and a deep-dive lightbox for the paper figures.

import { EXPLAINER } from './sequences.js';

// bespoke node-flow diagrams (distilled from the paper figures)
const FLOWS = {
  stage1: [
    { label: 'Keyframes', sub: 'VLM selects', model: true },
    { label: 'Multi-view synth', sub: 'orthogonal views' },
    { label: 'Rejection sampling', sub: 'VLM critic ↺', model: true },
    { label: '3D lift + refine', sub: 'retopo · texture' },
    { label: 'Watertight mesh', sub: 'simulation-ready', out: true },
  ],
  stage2: [
    { label: 'Metric init', sub: 'SAM2 · MoGe-2', model: true },
    { label: 'Hand init', sub: 'WiLoR · ICP', model: true },
    { label: 'Anchor @ onset', sub: 'FoundationPose', model: true },
    { label: 'Bidirectional track', sub: 'mask · DINO · stability', track: true },
    { label: '4D trajectory', sub: 'contact-aware', out: true },
  ],
};

function flowHTML(nodes) {
  return `<div class="flow">` + nodes.map((n, i) => {
    const cls = ['flow-node'];
    if (n.model) cls.push('is-model');
    if (n.out) cls.push('is-out');
    if (n.track) cls.push('is-track');
    const node = `<div class="${cls.join(' ')}" style="--d:${(i * 0.09).toFixed(2)}s"><span class="fn-label">${n.label}</span>${n.sub ? `<span class="fn-sub">${n.sub}</span>` : ''}</div>`;
    const arrow = i < nodes.length - 1 ? `<div class="flow-arrow" style="--d:${(i * 0.09 + 0.05).toFixed(2)}s"></div>` : '';
    return node + arrow;
  }).join('') + `</div>`;
}

function motivationHTML() {
  return `
    <div class="mot">
      <div class="mot-col">
        <div class="mot-card bad" style="--d:.05s"><div class="mot-h">Occlusion</div><div class="mot-t">Neural rendering → fragmented, non-simulation-ready geometry.</div></div>
        <div class="mot-card bad" style="--d:.13s"><div class="mot-h">Brittle SfM</div><div class="mot-t">Structure-from-Motion init fails on in-the-wild video.</div></div>
      </div>
      <div class="mot-arrow" style="--d:.22s">→</div>
      <div class="mot-card good" style="--d:.3s"><div class="mot-badge">AGILE</div><div class="mot-h">Reconstruction → Agentic Generation</div><div class="mot-t">Generate a complete, watertight asset — then track it robustly.</div></div>
    </div>`;
}

function resultHTML(step) {
  return `<div class="res"><video class="res-video" src="${step.video}" muted loop playsinline preload="metadata"></video></div>`;
}

function visualHTML(step) {
  if (step.id === 'motivation') return motivationHTML();
  if (step.id === 'result') return resultHTML(step);
  if (FLOWS[step.id]) return flowHTML(FLOWS[step.id]);
  return '';
}

export function buildExplainer(sectionEl, data = EXPLAINER) {
  const steps = data.steps;

  sectionEl.innerHTML = `
    <div class="explain">
      <div class="explain-rail"></div>
      <div class="explain-body"></div>
      <div class="explain-nav">
        <button class="ex-btn ex-prev">‹ Prev</button>
        <div class="ex-count"></div>
        <button class="ex-btn ex-next">Next ›</button>
      </div>
    </div>
    <div class="ex-lightbox" hidden>
      <button class="ex-lb-close" aria-label="Close">✕</button>
      <figure class="ex-lb-fig"><img alt=""><figcaption></figcaption></figure>
    </div>`;

  const rail = sectionEl.querySelector('.explain-rail');
  const body = sectionEl.querySelector('.explain-body');
  const count = sectionEl.querySelector('.ex-count');
  const lb = sectionEl.querySelector('.ex-lightbox');
  const lbImg = lb.querySelector('img');
  const lbCap = lb.querySelector('figcaption');

  rail.innerHTML = steps.map((s, i) =>
    `<button class="ex-step" data-i="${i}"><span class="ex-num">${String(i + 1).padStart(2, '0')}</span><span class="ex-tag">${s.tag}</span></button>`
  ).join('');
  const chips = [...rail.querySelectorAll('.ex-step')];

  let cur = 0, timer = null, active = false;

  const stopVideo = () => { const v = body.querySelector('.res-video'); if (v) v.pause(); };

  function render(i) {
    const s = steps[i];
    const figBtn = s.figure
      ? `<button class="ex-figure-btn" data-fig="${s.figure}" data-cap="${s.figureCaption || ''}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 15 5-5 4 4 3-3 6 6"/></svg> View full figure</button>`
      : '';
    const cta = s.cta ? `<button class="ex-cta" data-cta="recon">Explore the reconstruction →</button>` : '';
    body.innerHTML = `
      <div class="ex-visual">${visualHTML(s)}</div>
      <div class="ex-copy">
        <div class="ex-kicker">${String(i + 1).padStart(2, '0')} · ${s.tag}</div>
        <h2 class="ex-title">${s.title}</h2>
        <p class="ex-lead">${s.lead}</p>
        <ul class="ex-points">${s.points.map(p => `<li>${p}</li>`).join('')}</ul>
        <div class="ex-actions">${figBtn}${cta}</div>
      </div>`;
    chips.forEach((c, ci) => c.classList.toggle('is-active', ci === i));
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
    const v = body.querySelector('.res-video');
    if (v && active) v.play().catch(() => {});
    body.classList.remove('is-in'); void body.offsetWidth; body.classList.add('is-in');
  }

  function go(i, user = false) {
    stopVideo();
    cur = (i + steps.length) % steps.length;
    render(cur);
    if (user) arm();
  }

  function arm() {
    clearTimeout(timer);
    // re-arm inside the callback so auto-advance keeps looping (not just one hop)
    if (active && data.autoAdvanceMs) timer = setTimeout(() => { go(cur + 1); arm(); }, data.autoAdvanceMs);
  }

  function openLB(src, cap) { lbImg.src = src; lbCap.textContent = cap; lb.hidden = false; clearTimeout(timer); }
  function closeLB() { if (lb.hidden) return; lb.hidden = true; lbImg.src = ''; if (active) arm(); }

  chips.forEach(c => c.addEventListener('click', () => go(+c.dataset.i, true)));
  sectionEl.querySelector('.ex-prev').addEventListener('click', () => go(cur - 1, true));
  sectionEl.querySelector('.ex-next').addEventListener('click', () => go(cur + 1, true));
  body.addEventListener('click', (e) => {
    const fb = e.target.closest('.ex-figure-btn');
    if (fb) { openLB(fb.dataset.fig, fb.dataset.cap); return; }
    const cta = e.target.closest('.ex-cta');
    if (cta) { const tab = document.querySelector('.tab[data-section="recon"]'); if (tab) tab.click(); }
  });
  lb.querySelector('.ex-lb-close').addEventListener('click', closeLB);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
  document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (!lb.hidden) { if (e.key === 'Escape') closeLB(); return; }
    if (e.key === 'ArrowRight') go(cur + 1, true);
    else if (e.key === 'ArrowLeft') go(cur - 1, true);
  });

  render(0);

  return {
    onShow() { active = true; go(0); arm(); },
    onHide() { active = false; clearTimeout(timer); stopVideo(); closeLB(); },
  };
}
