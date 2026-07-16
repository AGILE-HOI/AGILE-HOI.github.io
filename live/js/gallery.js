// gallery.js — sequence gallery (left rail). Thumbnails + dataset chips.
export function buildGallery(listEl, sequences, onSelect) {
  listEl.innerHTML = '';
  const items = sequences.map((seq, idx) => {
    const el = document.createElement('button');
    el.className = 'seq';
    el.dataset.idx = idx;
    el.innerHTML =
      `<img class="seq-thumb" src="${seq.thumbnail}" alt="" draggable="false">
       <span class="seq-meta">
         <span class="seq-name">${seq.title}</span>
         <span class="seq-chip">${seq.dataset} · ${seq.numFrames}F</span>
       </span>`;
    el.addEventListener('click', () => onSelect(idx));
    listEl.appendChild(el);
    return el;
  });
  return {
    setActive(idx) { items.forEach((el, i) => el.classList.toggle('is-active', i === idx)); },
  };
}
