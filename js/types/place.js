// Place puzzles: drag each name from the tray onto a blank map.
//
// A feature is a point (a city, a peak) or a region (a sea, an island, a land).
// Coordinates are [lat, lon] when the puzzle has `bounds`, otherwise image
// pixels [x, y]. Points use `lat`/`lon` (or `x`/`y`) and count within `snap`
// of the spot; regions use an `area` outline and count inside it or within
// `snap` of its edge; rivers use a `line` (or several, for branches) and count
// within `snap` of it. Distances are fractions of the map's width.
import { el, loadImage, shuffledOrder, PUZZLE_DIR } from '../util.js';

export const terms = { pieces: 'places', short: 'places', rate: 'places per minute', moves: 'Tries' };

export const instructions =
  'Drag each name onto the map. A dot or ▲ goes on its exact spot; a name without one goes anywhere in its region.';

const POINT_SNAP = 0.04;    // default for points (the puzzle's "snap" changes it)
const REGION_SNAP = 0.01;   // default margin around a region's outline
const LINE_SNAP = 0.012;    // default distance from a river's course
const EASY_SNAP = 1.5;      // Easy mode accepts drops this much farther out
const DRAG_THRESHOLD = 4;   // px of movement before a press becomes a drag
const EDGE = 70;            // px from the window edge where auto-scroll starts
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const MARKS = {
  dot: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5"/></svg>',
  triangle: '<svg viewBox="0 0 14 14"><path d="M7 1.5 13 12.5H1z"/></svg>',
};

// The name (with its marker, for points): what's dragged and left on the map.
function pin(f, side = f.side) {
  return el('span', { class: `pin ${f.area || f.lines ? `region ${f.style}` : 'point'} label-${side}` },
    f.mark && el('span', { class: 'mark', 'aria-hidden': 'true', html: MARKS[f.mark] }),
    el('span', { class: 'pin-label' }, f.name));
}

// A feature's name as it sits on the finished map.
export function placedPin(f) {
  const p = pin(f);
  p.classList.add('placed');
  p.style.left = `${f.x * 100}%`;
  p.style.top = `${f.y * 100}%`;
  return p;
}

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// An SVG layer over the map, in image pixels, for region outlines.
export function areaLayer(W, H) {
  return svg('svg', { class: 'place-areas', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
}

export const outlinePoints = (pts, W, H) => pts.map(p => `${p.x * W},${p.y * H}`).join(' ');

export function areaShape(f, W, H) {
  if (!f.lines) return svg('polygon', { points: outlinePoints(f.area, W, H) });
  const group = svg('g');
  group.append(...f.lines.map(line => svg('polyline', { points: outlinePoints(line, W, H) })));
  return group;
}

// Converts the puzzle's coordinate pairs to fractions of the image's width and
// height, and back. [lat, lon] assumes an equirectangular map, as Wikimedia
// location maps are.
function projection(bounds, W, H) {
  if (bounds) {
    const { west, east, north, south } = bounds;
    return {
      geo: true,
      toMap: ([lat, lon]) => ({ x: (lon - west) / (east - west), y: (north - lat) / (north - south) }),
      fromMap: ({ x, y }) => [north - y * (north - south), west + x * (east - west)],
    };
  }
  return {
    geo: false,
    toMap: ([x, y]) => ({ x: x / W, y: y / H }),
    fromMap: ({ x, y }) => [x * W, y * H],
  };
}

function feature(f, puzzle, proj) {
  if (!proj.geo && (f.lat != null || f.lon != null)) {
    throw new Error(`"${f.name}" is given by lat/lon, so the puzzle needs "bounds"`);
  }
  const common = { key: f.name, name: f.name };
  if (f.area) {
    if (f.area.length < 3) throw new Error(`"${f.name}": "area" needs at least 3 points`);
    const area = f.area.map(proj.toMap);
    const spot = f.at
      ? proj.toMap(f.at)
      : { x: area.reduce((s, p) => s + p.x, 0) / area.length, y: area.reduce((s, p) => s + p.y, 0) / area.length };
    return { ...common, area, style: f.style === 'sea' ? 'sea' : 'land', side: 'center', snap: f.snap ?? REGION_SNAP, ...spot };
  }
  if (f.line) {
    // One course, or a list of them for a river with branches (like a delta).
    const courses = Array.isArray(f.line[0]?.[0]) ? f.line : [f.line];
    if (courses.some(c => c.length < 2)) throw new Error(`"${f.name}": a "line" needs at least 2 points`);
    const lines = courses.map(c => c.map(proj.toMap));
    const spot = f.at ? proj.toMap(f.at) : lines[0][Math.floor(lines[0].length / 2)];
    return { ...common, lines, style: 'river', side: 'center', snap: f.snap ?? LINE_SNAP, ...spot };
  }
  const pair = proj.geo ? [f.lat, f.lon] : [f.x, f.y];
  if (pair.some(v => v == null)) {
    throw new Error(`"${f.name}" needs ${proj.geo ? '"lat" and "lon"' : '"x" and "y"'}, an "area" or a "line"`);
  }
  return {
    ...common,
    mark: f.mark === 'triangle' ? 'triangle' : 'dot',
    side: ['left', 'above', 'below'].includes(f.label) ? f.label : 'right',
    snap: f.snap ?? puzzle.snap ?? POINT_SNAP,
    ...proj.toMap(pair),
  };
}

export async function loadPlaces(puzzle) {
  const src = PUZZLE_DIR + puzzle.src;
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const proj = projection(puzzle.bounds, W, H);
  return { src, W, H, proj, features: puzzle.features.map(f => feature(f, puzzle, proj)) };
}

// ---- Hit testing, measured in map widths ----
function segmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function inside(p, pts) {
  let isIn = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) isIn = !isIn;
  }
  return isIn;
}

function hits(f, p, aspect, scale) {
  const flat = q => ({ x: q.x, y: q.y * aspect });
  const at = flat(p);
  const reach = f.snap * scale;
  if (f.lines) {
    return f.lines.some(line => line.map(flat).some((a, i, pts) => i > 0 && segmentDistance(at, pts[i - 1], a) <= reach));
  }
  if (!f.area) return Math.hypot(at.x - f.x, at.y - f.y * aspect) <= reach;
  const pts = f.area.map(flat);
  return inside(at, pts) || pts.some((a, i) => segmentDistance(at, a, pts[(i + 1) % pts.length]) <= reach);
}

export async function prepare(puzzle) {
  const { src, W, H, features } = await loadPlaces(puzzle);
  const tiles = features.map(f => ({
    ...f,
    el: el('div', { class: 'tile place-tile', role: 'button', tabindex: '0' }, pin(f, f.area || f.lines ? 'center' : 'right')),
  }));
  return {
    tiles,
    createBoard: opts => createPlaceBoard({ ...opts, tiles, src, W, H }),
  };
}

function createPlaceBoard({ tiles, src, W, H, easy, footer, onChange, onSolved }) {
  const areas = areaLayer(W, H);
  const map = el('div', { class: 'place-map' },
    el('img', { class: 'place-img', src, alt: 'Blank map', width: W, height: H, draggable: 'false' }),
    areas);
  const tray = el('div', { class: 'place-tray', role: 'group', 'aria-label': 'Names to place' });
  const live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
  const wrapper = el('div', { class: 'board-wrap place-wrap' },
    el('div', { class: 'place-frame' }, map, footer), tray, live);
  wrapper.style.setProperty('--ratio', W / H);

  const byEl = new Map(tiles.map(t => [t.el, t]));
  for (const i of shuffledOrder(tiles.map(t => t.key))) tray.append(tiles[i].el);

  let remaining = tiles.length;
  let locked = false;
  const announce = msg => { live.textContent = msg; };

  // ---- Geometry ----
  function toScreen(p) {
    const r = map.getBoundingClientRect();
    return { x: r.left + p.x * r.width, y: r.top + p.y * r.height };
  }

  function toMap(x, y) {
    const r = map.getBoundingClientRect();
    const p = { x: (x - r.left) / r.width, y: (y - r.top) / r.height };
    return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? p : null;
  }

  // ---- The floating pin ----
  // Picking up a name lifts its pin off the tile; the empty tile stays behind.
  // What lands is the marker's center, or for a region the name's center.
  function lift(t) {
    const source = t.el.querySelector('.pin');
    const r = source.getBoundingClientRect();
    const m = (source.querySelector('.mark') ?? source).getBoundingClientRect();
    const ghost = source.cloneNode(true);
    ghost.classList.add('pin-ghost');
    document.body.append(ghost);
    t.el.classList.add('lifted');
    const g = {
      t, ghost, x: 0, y: 0,
      markX: m.left + m.width / 2 - r.left,   // the landing point within the pin
      markY: m.top + m.height / 2 - r.top,
    };
    moveGhost(g, r.left, r.top);
    return g;
  }

  function moveGhost(g, x, y) {
    g.x = x;
    g.y = y;
    g.ghost.style.transform = `translate(${x}px, ${y}px)`;
  }

  function fly(g, x, y, duration) {
    if (reduceMotion.matches) return Promise.resolve();
    return g.ghost.animate(
      [{ transform: g.ghost.style.transform }, { transform: `translate(${x}px, ${y}px)` }],
      { duration, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' },
    ).finished.catch(() => {});
  }

  // Drop the pin where it is: settle it on the map, or send it home.
  function release(g) {
    const p = toMap(g.x + g.markX, g.y + g.markY);
    if (p) onChange();        // a try is any drop onto the map
    if (p && hits(g.t, p, H / W, easy ? EASY_SNAP : 1)) settle(g);
    else sendHome(g, Boolean(p));
  }

  async function settle(g) {
    const { t } = g;
    remaining--;
    if (!remaining) locked = true;
    const spot = toScreen(t);
    const landed = fly(g, spot.x - g.markX, spot.y - g.markY, 180);
    removeTile(t);
    announce(remaining ? `${t.name} placed. ${remaining} to go.` : `${t.name} placed. All done!`);
    await landed;
    g.ghost.remove();

    map.append(placedPin(t));
    if (t.area || t.lines) {
      // Show the whole region (or river) for a moment, so the student sees its extent.
      const shape = areaShape(t, W, H);
      shape.classList.add('flash');
      shape.addEventListener('animationend', () => shape.remove());
      areas.append(shape);
    }
    if (!remaining) {
      wrapper.classList.add('solved');
      onSolved();
    }
  }

  async function sendHome(g, missed) {
    const { t } = g;
    const home = t.el.querySelector('.pin').getBoundingClientRect();
    await fly(g, home.left, home.top, missed ? 380 : 200);
    g.ghost.remove();
    t.el.classList.remove('lifted', 'missed');
    if (missed) {
      void t.el.offsetWidth;    // restart the shake if it just ran
      t.el.classList.add('missed');
      announce(`Not there. ${t.name} is back in the tray.`);
    }
  }

  // Take a placed name's tile out of the tray and slide the rest together.
  function removeTile(t) {
    const others = [...tray.children].filter(e => e !== t.el);
    const hadFocus = t.el === document.activeElement;
    const next = others[Math.min(others.length - 1, [...tray.children].indexOf(t.el))];
    const first = new Map(others.map(e => [e, e.getBoundingClientRect()]));
    t.el.remove();
    if (hadFocus) next?.focus();
    if (reduceMotion.matches) return;
    for (const e of others) {
      const a = first.get(e);
      const b = e.getBoundingClientRect();
      if (a.left !== b.left || a.top !== b.top) {
        e.animate(
          [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }],
          { duration: 220, easing: 'cubic-bezier(.2, .7, .3, 1)' },
        );
      }
    }
  }

  // ---- Pointer dragging (mouse, pen, touch) ----
  let drag = null;

  tray.addEventListener('pointerdown', e => {
    if (locked || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const tileEl = e.target.closest('.place-tile');
    if (!tileEl || tileEl.classList.contains('lifted')) return;
    e.preventDefault();
    if (held) putBack();
    drag = { t: byEl.get(tileEl), id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, g: null };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  });

  function onPointerMove(e) {
    if (e.pointerId !== drag.id) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.g) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < DRAG_THRESHOLD) return;
      drag.g = lift(drag.t);
      drag.offsetX = drag.startX - drag.g.x;
      drag.offsetY = drag.startY - drag.g.y;
      document.body.classList.add('is-dragging');
      autoScroll();
    }
    moveGhost(drag.g, drag.x - drag.offsetX, drag.y - drag.offsetY);
  }

  function onPointerUp(e) {
    if (e.pointerId !== drag.id) return;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    const { g } = drag;
    drag = null;
    document.body.classList.remove('is-dragging');
    if (!g) return;
    if (e.type === 'pointerup') release(g);
    else sendHome(g, false);
  }

  function autoScroll() {
    if (!drag?.g) return;
    const { y } = drag;
    if (y < EDGE) scrollBy(0, -Math.ceil((EDGE - y) / 5));
    else if (y > innerHeight - EDGE) scrollBy(0, Math.ceil((y - (innerHeight - EDGE)) / 5));
    requestAnimationFrame(autoScroll);
  }

  // ---- Keyboard: Space/Enter picks up and drops, arrows move over the map ----
  let held = null;

  function placeHeld() {
    const spot = toScreen(held.at);
    moveGhost(held, spot.x - held.markX, spot.y - held.markY);
  }

  function pickUp(t) {
    map.scrollIntoView({ block: 'nearest' });
    held = lift(t);
    held.at = { x: 0.5, y: 0.5 };
    placeHeld();
    addEventListener('scroll', placeHeld);
    addEventListener('resize', placeHeld);
    announce(`Picked up ${t.name}. Use the arrow keys to move it over the map (Shift for big steps), Space to drop, Escape to put it back.`);
  }

  function letGo() {
    const g = held;
    held = null;
    removeEventListener('scroll', placeHeld);
    removeEventListener('resize', placeHeld);
    return g;
  }

  function putBack() {
    sendHome(letGo(), false);
  }

  tray.addEventListener('keydown', e => {
    const tileEl = e.target.closest('.place-tile');
    if (!tileEl || locked) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (held) release(letGo());
      else if (!tileEl.classList.contains('lifted')) pickUp(byEl.get(tileEl));
      return;
    }
    if (e.key === 'Escape' && held) { putBack(); return; }

    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    if (held) {
      const step = e.shiftKey ? 0.05 : 0.01;
      const clamp = v => Math.max(0, Math.min(1, v));
      held.at.x = clamp(held.at.x + dir[0] * step);
      held.at.y = clamp(held.at.y + dir[1] * step * (W / H));
      placeHeld();
    } else {
      const els = [...tray.children];
      const i = els.indexOf(tileEl) + dir[0] + dir[1];
      els[Math.max(0, Math.min(els.length - 1, i))].focus();
    }
  });

  tray.addEventListener('focusout', e => {
    if (held && e.relatedTarget !== held.t.el) putBack();
  });

  return { element: wrapper };
}
