// The drawing page for place puzzles (#/draw/<id>), for teachers. It shows
// every answer on the map, and turns clicks into coordinates to paste into the
// puzzle file: one click for a point, several clicks around a region for an
// "area" outline.
import { el } from './util.js';
import { loadPlaces, placedPin, areaLayer, areaShape, outlinePoints } from './types/place.js';

export async function drawBoard(puzzle) {
  const { src, W, H, proj, features } = await loadPlaces(puzzle);
  const areas = areaLayer(W, H);
  areas.append(...features.filter(f => f.area).map(f => areaShape(f, W, H)));
  const draft = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  draft.classList.add('draft');
  areas.append(draft);

  const map = el('div', { class: 'place-map drawing' },
    el('img', { class: 'place-img', src, alt: 'Map', width: W, height: H, draggable: 'false' }),
    areas,
    features.map(placedPin));

  // Outlines don't need much precision: 2 decimals of a degree is about 1 km.
  const round = (v, places) => Number(v.toFixed(places));
  const pair = (p, places) => proj.fromMap(p).map(v => (proj.geo ? round(v, places) : Math.round(v)));

  const points = [];
  const lastOut = el('code', {}, '—');
  const areaOut = el('code', {}, '—');
  const copyBtn = el('button', { type: 'button', class: 'btn' }, 'Copy outline');

  function update() {
    draft.setAttribute('points', outlinePoints(points, W, H));
    const last = points.at(-1);
    if (last) {
      const [a, b] = pair(last, 4);
      lastOut.textContent = proj.geo
        ? `"lat": ${a}, "lon": ${b}    or    [${a}, ${b}]`
        : `"x": ${a}, "y": ${b}    or    [${a}, ${b}]`;
    } else {
      lastOut.textContent = '—';
    }
    areaOut.textContent = points.length
      ? `"area": ${JSON.stringify(points.map(p => pair(p, 2))).replaceAll(',', ', ')}`
      : '—';
  }

  map.addEventListener('click', e => {
    const r = map.getBoundingClientRect();
    points.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    update();
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(areaOut.textContent);
      copyBtn.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(areaOut);
      copyBtn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy outline'; }, 1500);
  });

  const panel = el('div', { class: 'draw-panel' },
    el('p', {}, el('b', {}, 'Last click: '), lastOut),
    el('p', {}, el('b', {}, 'Outline: '), areaOut),
    el('div', { class: 'draw-actions' },
      el('button', { type: 'button', class: 'btn', onclick: () => { points.pop(); update(); } }, 'Undo point'),
      el('button', { type: 'button', class: 'btn', onclick: () => { points.length = 0; update(); } }, 'Clear'),
      copyBtn,
    ),
  );

  const wrapper = el('div', { class: 'board-wrap place-wrap' }, el('div', { class: 'place-frame' }, map), panel);
  wrapper.style.setProperty('--ratio', W / H);
  return wrapper;
}
