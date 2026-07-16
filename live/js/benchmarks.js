// benchmarks.js — animated dark comparison for the Benchmarks section.
// Each dataset may define its own `methods` (baselines) and `note`; the success-rate
// hero card is optional (only rendered when the dataset has an `sr` metric).

const HERO_KEY = 'sr';

function score(values, arrow, i) {
  // goodness score 0..100 → longer bar = better (handles lower/higher-is-better)
  if (arrow === 'down') { const best = Math.min(...values); return (best / values[i]) * 100; }
  const best = Math.max(...values); return (values[i] / best) * 100;
}
function bestIndex(values, arrow) {
  return arrow === 'down' ? values.indexOf(Math.min(...values)) : values.indexOf(Math.max(...values));
}
// round to ≤2 decimals and drop trailing zeros (25.0 → "25", 37.10 → "37.1")
function fmt(v) { return String(Math.round(v * 100) / 100); }

export function buildBenchmarks(sectionEl, data) {
  const keys = Object.keys(data.datasets);
  let dataset = keys[0];

  const toggle = keys.map((k, i) =>
    `<button class="ds-btn ${i === 0 ? 'is-active' : ''}" data-ds="${k}">${data.datasets[k].name}</button>`
  ).join('');

  sectionEl.innerHTML = `
    <div class="bench">
      <div class="bench-head">
        <div>
          <h2 class="bench-title">Benchmark <b>Comparison</b></h2>
          <p class="bench-sub"></p>
        </div>
        <div class="ds-toggle">${toggle}</div>
      </div>
      <div class="bench-grid"></div>
      <div class="bench-note"></div>
    </div>`;

  const grid = sectionEl.querySelector('.bench-grid');
  const note = sectionEl.querySelector('.bench-note');
  const sub = sectionEl.querySelector('.bench-sub');

  function render() {
    const ds = data.datasets[dataset];
    const methods = ds.methods || data.methods;
    sub.innerHTML = `AGILE vs ${methods.slice(1).join(' &amp; ')}. Longer bar = better across every metric.`;
    grid.innerHTML = '';

    ds.metrics.filter(m => m.key !== HERO_KEY).forEach(metric => {
      const bi = bestIndex(metric.values, metric.arrow);
      const rows = methods.map((m, i) => {
        const isOurs = i === 0;
        const w = score(metric.values, metric.arrow, i);
        return `<div class="bar-row">
            <span class="bar-name ${isOurs ? 'ours' : ''}">${m}</span>
            <div class="bar-track"><div class="bar-fill ${isOurs ? 'ours' : 'base'}" data-w="${w.toFixed(1)}"></div></div>
            <span class="bar-val ${i === bi ? 'best' : ''}">${fmt(metric.values[i])}</span>
          </div>`;
      }).join('');
      const card = document.createElement('div');
      card.className = 'metric';
      card.innerHTML = `
        <div class="metric-h">
          <span class="metric-name reveal">${metric.name}</span>
          <span class="metric-arrow reveal">${metric.unit} ${metric.arrow === 'down' ? '↓' : '↑'}</span>
        </div>
        <div class="metric-desc reveal">${metric.desc}</div>
        <div class="bars reveal">${rows}</div>`;
      grid.appendChild(card);
    });

    // optional hero: success rate / robustness (only when the dataset has an SR metric)
    const sr = ds.metrics.find(m => m.key === HERO_KEY);
    if (sr) {
      const others = methods.slice(1).map((m, i) => `${m} on ${fmt(sr.values[i + 1])}%`).join(' and ');
      const hero = document.createElement('div');
      hero.className = 'metric hero';
      hero.innerHTML = `
        <div>
          <div class="eyebrow reveal">Success Rate · ${ds.name}</div>
          <div class="hero-num reveal" data-target="${sr.values[0]}">0<span style="font-size:.5em">%</span></div>
        </div>
        <div class="hero-txt reveal">
          <b>AGILE reconstructs every sequence.</b> On ${ds.name}, ${others} —
          prior methods frequently collapse where AGILE holds.
        </div>`;
      grid.appendChild(hero);
    }

    note.innerHTML = `<b>Note.</b> ${ds.note || data.note}`;
    animateIn();
  }

  function animateIn() {
    // reset to 0 and flush a reflow so the grow replays every time the section
    // is opened (otherwise later opens set the same width → no transition).
    const bars = grid.querySelectorAll('.bar-fill');
    bars.forEach(el => { el.style.width = '0%'; });
    void grid.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bars.forEach(el => { el.style.width = `${el.dataset.w}%`; });
      const heroNum = grid.querySelector('.hero-num');
      if (heroNum) countUp(heroNum, parseFloat(heroNum.dataset.target));
    }));
  }

  function countUp(el, target) {
    const dur = 900; let start = null;
    const suffix = '<span style="font-size:.5em">%</span>';
    function step(ts) {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.innerHTML = `${fmt(target * eased)}${suffix}`;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  sectionEl.querySelectorAll('.ds-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dataset = btn.dataset.ds;
      sectionEl.querySelectorAll('.ds-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      render();
    });
  });

  render();
  return { onShow() { animateIn(); } };
}
