// showcase.js — looping-video showcase (Rotation, Real-to-Sim).
// Builds a stage video + filmstrip of preview clips into a section element.

function reticles() {
  return '<i class="reticle tl"></i><i class="reticle tr"></i><i class="reticle bl"></i><i class="reticle br"></i>';
}
function titleHTML(title) {
  const parts = title.split(' ');
  if (parts.length === 1) return `<b>${title}</b>`;
  const last = parts.pop();
  return `${parts.join(' ')} <b>${last}</b>`;
}

export function buildShowcase(sectionEl, config) {
  sectionEl.innerHTML = `
    <div class="showcase">
      <div class="sc-head">
        <div>
          <h2 class="sc-title">${titleHTML(config.title)}</h2>
          <p class="sc-tagline">${config.tagline}</p>
        </div>
        <div class="sc-now"><span class="eyebrow">Now showing</span><br><b class="sc-now-label"></b> <span class="sc-now-ds"></span></div>
      </div>
      <div class="sc-stage">
        ${reticles()}
        <video class="sc-video" loop muted playsinline preload="metadata"></video>
      </div>
      <div class="sc-film"></div>
    </div>`;

  const video = sectionEl.querySelector('.sc-video');
  const film = sectionEl.querySelector('.sc-film');
  const nowLabel = sectionEl.querySelector('.sc-now-label');
  const nowDs = sectionEl.querySelector('.sc-now-ds');
  let activeIdx = 0;

  const thumbs = config.items.map((item, idx) => {
    const t = document.createElement('button');
    t.className = 'sc-thumb' + (idx === 0 ? ' is-active' : '');
    t.innerHTML =
      `<video muted loop playsinline preload="metadata"><source src="${item.thumb || item.src}#t=0.1"></video>
       <span class="lb">${item.label}</span>`;
    const tv = t.querySelector('video');
    t.addEventListener('mouseenter', () => { tv.play().catch(() => {}); });
    t.addEventListener('mouseleave', () => { tv.pause(); tv.currentTime = 0.1; });
    t.addEventListener('click', () => select(idx));
    film.appendChild(t);
    return t;
  });

  function select(idx) {
    activeIdx = idx;
    const item = config.items[idx];
    video.src = item.src;
    video.play().catch(() => {});
    thumbs.forEach((t, i) => t.classList.toggle('is-active', i === idx));
    nowLabel.textContent = item.label;
    nowDs.textContent = `· ${item.dataset}`;
  }

  // preload first
  const first = config.items[0];
  video.src = first.src;
  nowLabel.textContent = first.label;
  nowDs.textContent = `· ${first.dataset}`;

  return {
    onShow() { video.play().catch(() => {}); },
    onHide() {
      video.pause();
      // a thumbnail left hovered when the section is hidden programmatically (idle
      // reset / keyboard tab switch) never gets a mouseleave — stop it decoding.
      thumbs.forEach(t => { const tv = t.querySelector('video'); tv.pause(); tv.currentTime = 0.1; });
    },
  };
}
