// hud.js — binds the transport + telemetry HUD to an AgileViewer instance.

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="3.6" height="13" rx="1"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5.5" width="2.6" height="13" rx="1"/><path d="M19 5.5v13l-9-6.5z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="15.4" y="5.5" width="2.6" height="13" rx="1"/><path d="M5 5.5v13l9-6.5z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="6.4"/><path d="M12 2.4v3.2M12 18.4v3.2M2.4 12h3.2M18.4 12h3.2"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>',
  frustum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 7h11l5 3v7l-5-2H4z"/><path d="M15 7v8"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

export class Hud {
  constructor(viewer, els) {
    this.v = viewer;
    this.els = els;
    this._total = 0;
    this._paint();
    this._wire();
    this._bindViewer();
  }

  _paint() {
    const e = this.els;
    e.play.innerHTML = ICON.pause;
    e.prev.innerHTML = ICON.prev;
    e.next.innerHTML = ICON.next;
    e.reset.innerHTML = ICON.reset;
    e.spin.innerHTML = ICON.spin;
    e.frustum.innerHTML = ICON.frustum;
    e.full.innerHTML = ICON.full;
    this._setRangeFill(e.opacity, 35);
    e.opacity.value = 35;
  }

  _setRangeFill(range, pct) { range.style.setProperty('--fill', `${pct}%`); }

  _wire() {
    const e = this.els, v = this.v;
    e.play.addEventListener('click', () => v.toggle());
    e.prev.addEventListener('click', () => { v.pause(); v.prevFrame(); });
    e.next.addEventListener('click', () => { v.pause(); v.nextFrame(); });

    e.scrub.addEventListener('input', () => {
      v.pause();
      v.seek(parseInt(e.scrub.value, 10));
    });

    e.opacity.addEventListener('input', () => {
      const val = parseInt(e.opacity.value, 10);
      v.setOverlayOpacity(val / 100);
      this._setRangeFill(e.opacity, val);
      e.opVal.textContent = `${val}%`;
    });

    e.reset.addEventListener('click', () => v.resetView());
    e.spin.addEventListener('click', () => v.setAutoRotate(!v.autoRotate));
    e.frustum.addEventListener('click', () => v.toggleFrustum());
    e.full.addEventListener('click', () => this._toggleFullscreen());
    document.addEventListener('fullscreenchange', () => this._syncFull());
    document.addEventListener('webkitfullscreenchange', () => this._syncFull());
  }

  _bindViewer() {
    const e = this.els, v = this.v;
    v.on('playstate', ({ paused }) => { e.play.innerHTML = paused ? ICON.play : ICON.pause; });
    v.on('frame', ({ index, total }) => {
      this._total = total;
      e.scrub.max = total - 1;
      e.scrub.value = index;
      this._setRangeFill(e.scrub, total > 1 ? (index / (total - 1)) * 100 : 0);
      e.count.innerHTML = `${String(index + 1).padStart(3, '0')}<span class="tot"> / ${total}</span>`;
      if (e.tFrame) e.tFrame.textContent = `${String(index + 1).padStart(3, '0')}/${total}`;
    });
    v.on('fps', ({ fps }) => { if (e.tRender) e.tRender.textContent = `${fps} FPS`; });
    v.on('autorotate', ({ on }) => {
      e.spin.classList.toggle('active', on);
      if (e.tView) e.tView.textContent = on ? 'AUTO-ORBIT' : 'MANUAL';
    });
    v.on('frustum', ({ on }) => e.frustum.classList.toggle('active', on));
  }

  // called by director when a new sequence is loaded
  onLoad(seq) {
    const e = this.els;
    if (e.tObject) e.tObject.textContent = seq.object;
    if (e.tSource) e.tSource.textContent = seq.dataset;
    e.spin.classList.toggle('active', this.v.autoRotate);
    e.frustum.classList.toggle('active', this.v.frustumVisible);
  }

  _toggleFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      Promise.resolve((root.requestFullscreen || root.webkitRequestFullscreen)?.call(root)).catch(() => {});
    } else {
      Promise.resolve((document.exitFullscreen || document.webkitExitFullscreen)?.call(document)).catch(() => {});
    }
  }
  _syncFull() { this.els.full.classList.toggle('active', !!(document.fullscreenElement || document.webkitFullscreenElement)); }
}
