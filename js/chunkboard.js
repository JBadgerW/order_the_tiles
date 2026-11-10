// Chunks mode: tiles that sit next to each other in the right order stick
// together, and a group moves as one piece, like a jigsaw.
//
// Groups are never stored; they are worked out from the board after every
// move. A correct pair stays correct, and the moves below never split a
// group, so recomputing never loses one.
//
// layout { kind: 'sequence' }  (text cards) — the board is one line that wraps
//   into rows. Groups are runs of consecutive cards. Moving a group lifts it
//   out and slides it in between two other groups; everything else reflows, so
//   there is always room.
// layout { kind: 'grid', rows, cols }  (picture tiles) — a group is shifted
//   by whole cells, and must stay on the board. Another group it lands on
//   moves, whole, to the nearest spot clear of other groups (a straight swap
//   if it fits); if there is none, the drop is refused. Loose tiles are
//   pushed into whatever cells are left. If groups ever jam, double-clicking
//   (or double-tapping) a group loosens it into single tiles.
import { el, chunkShuffle } from './util.js';

const DRAG_THRESHOLD = 6;   // px of movement before a press becomes a drag
const EDGE = 70;            // px from the window edge where auto-scroll starts
const DOUBLE_TAP = 400;     // ms between taps that count as a double tap
const CHUNK_COLORS = 6;     // outline colors, --chunk-1 … --chunk-6 in the CSS
const LINK_CLASSES = ['chunked', 'link-l', 'link-r', 'link-u', 'link-d', 'wrap-in', 'wrap-out',
  'corner-tl', 'corner-tr', 'corner-bl', 'corner-br'];
const MARK_CLASSES = ['swap-target', 'blocked'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createChunkBoard({ tiles, layout, configureBoard, footer, noun = 'tiles', onChange, onSolved }) {
  const board = el('div', { class: 'board chunk-board', role: 'list' });
  const live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
  const wrapper = el('div', { class: 'board-wrap' }, board, footer, live);
  configureBoard(board, wrapper);

  const grid = layout?.kind === 'grid';
  const cols = grid ? layout.cols : 0;
  const rows = grid ? layout.rows : 0;
  const n = tiles.length;
  const els = tiles.map(t => t.el);
  const home = new Map(els.map((e, i) => [e, i]));   // a tile's place in the answer
  const keyOf = new Map(tiles.map(t => [t.el, t.key]));
  const solution = tiles.map(t => t.key);
  for (const i of chunkShuffle(solution, cols)) {
    const tile = els[i];
    tile.setAttribute('role', 'listitem');
    tile.tabIndex = 0;
    board.append(tile);
  }

  let locked = false;
  let rearranging = false;
  const current = () => [...board.children];
  const announce = msg => { live.textContent = msg; };

  // Pairs a student loosened stay apart until one of the two tiles moves.
  const loosened = new Map();   // "i:j" → [tileA, tileB]
  const pairKey = (a, b) => `${home.get(a)}:${home.get(b)}`;

  // ---- Groups ----

  function computeGroups() {
    const cells = current();
    const parent = cells.map((_, p) => p);
    const find = p => (parent[p] === p ? p : (parent[p] = find(parent[p])));
    const links = [];
    const join = (p, q, dir) => {
      const a = cells[p];
      const b = cells[q];
      if (loosened.has(pairKey(a, b))) return;
      links.push([a, b, dir]);
      parent[find(q)] = find(p);
    };
    for (let p = 0; p < n; p++) {
      const i = home.get(cells[p]);
      if (grid) {
        // Right neighbour: same row on the board and in the picture.
        if ((p + 1) % cols && (i + 1) % cols && home.get(cells[p + 1]) === i + 1) join(p, p + 1, 'h');
        if (p + cols < n && home.get(cells[p + cols]) === i + cols) join(p, p + cols, 'v');
      } else if (p + 1 < n && home.get(cells[p + 1]) === i + 1) {
        join(p, p + 1, 'h');
      }
    }
    const byRoot = new Map();
    cells.forEach((e, p) => {
      const r = find(p);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(e);   // in board order
    });
    const groupOf = new Map();
    for (const g of byRoot.values()) for (const e of g) groupOf.set(e, g);
    return { links, groupOf, groups: [...byRoot.values()] };
  }

  let groups = computeGroups();

  // Show the links. A text chunk that wraps onto the next row gets an edge
  // marker instead of a bridge, so the classes depend on the current layout.
  function paint() {
    for (const e of els) e.classList.remove(...LINK_CLASSES);
    for (const [a, b, dir] of groups.links) {
      if (dir === 'v') { a.classList.add('link-d'); b.classList.add('link-u'); }
      else if (grid || a.offsetTop === b.offsetTop) { a.classList.add('link-r'); b.classList.add('link-l'); }
      else { a.classList.add('wrap-out'); b.classList.add('wrap-in'); }
    }
    for (const g of groups.groups) if (g.length > 1) g.forEach(e => e.classList.add('chunked'));
    if (grid) markInsideCorners();
    colorChunks();
  }

  // Picture: where a group turns an inside corner (an L shape), the tile in
  // the bend is joined on both sides but its diagonal neighbour is not in
  // the group. That tile draws the bit of outline the corner needs.
  function markInsideCorners() {
    const cells = current();
    cells.forEach((e, p) => {
      e.classList.remove('corner-tl', 'corner-tr', 'corner-bl', 'corner-br');
      if (!e.classList.contains('chunked')) return;
      const g = groups.groupOf.get(e);
      const r = Math.floor(p / cols);
      const c = p % cols;
      for (const [dr, dc, name] of [[-1, -1, 'tl'], [-1, 1, 'tr'], [1, -1, 'bl'], [1, 1, 'br']]) {
        const joined = e.classList.contains(dc < 0 ? 'link-l' : 'link-r') && e.classList.contains(dr < 0 ? 'link-u' : 'link-d');
        if (joined && groups.groupOf.get(cells[(r + dr) * cols + c + dc]) !== g) e.classList.add(`corner-${name}`);
      }
    });
  }

  // Give each chunk an outline color (--chunk-1 … --chunk-6 in the CSS). A
  // chunk keeps the color of its first tile in the answer where it can, so
  // colors don't jump around between moves, but it never shares a color
  // with a chunk it touches, so two chunks side by side can't look like one.
  function colorChunks() {
    const cells = current();
    const posOf = new Map(cells.map((e, p) => [e, p]));
    const near = p => (grid
      ? [p % cols ? p - 1 : -1, (p + 1) % cols ? p + 1 : -1, p - cols, p + cols]
      : [p - 1, p + 1]).filter(q => q >= 0 && q < n);
    const color = new Map();
    for (const g of groups.groups) {
      if (g.length < 2) { g[0].style.removeProperty('--chunk'); continue; }
      const taken = new Set();
      for (const e of g) for (const q of near(posOf.get(e))) {
        const h = groups.groupOf.get(cells[q]);
        if (h !== g && color.has(h)) taken.add(color.get(h));
      }
      let c = Math.min(...g.map(e => home.get(e))) % CHUNK_COLORS;
      for (let k = 0; k < CHUNK_COLORS && taken.has(c); k++) c = (c + 1) % CHUNK_COLORS;
      color.set(g, c);
      for (const e of g) e.style.setProperty('--chunk', `var(--chunk-${c + 1})`);
    }
  }
  if (!grid) new ResizeObserver(() => paint()).observe(board);

  function finishMove(before) {
    const now = current();
    const moved = new Set(now.filter((e, p) => e !== before[p]));
    if (!moved.size) { paint(); return; }
    onChange();
    for (const [k, [a, b]] of loosened) if (moved.has(a) || moved.has(b)) loosened.delete(k);

    const sizeBefore = new Map(els.map(e => [e, groups.groupOf.get(e).length]));
    groups = computeGroups();
    paint();
    const grown = groups.groups.filter(g => g.some(e => sizeBefore.get(e) < g.length));
    if (grown.length) {
      const biggest = Math.max(...grown.map(g => g.length));
      for (const g of grown) for (const e of g) {
        e.classList.remove('snap');
        void e.offsetWidth;   // restart the animation
        e.classList.add('snap');
      }
      announce(`Joined: ${biggest} ${noun} together.`);
    }

    if (now.every((e, p) => keyOf.get(e) === solution[p])) {
      locked = true;
      board.classList.add('solved');
      now.forEach(t => t.classList.add('correct'));
      onSolved();
    }
  }

  function loosen(tile) {
    const group = groups.groupOf.get(tile);
    if (group.length < 2) return;
    const members = new Set(group);
    for (const [a, b] of groups.links) if (members.has(a)) loosened.set(pairKey(a, b), [a, b]);
    groups = computeGroups();
    paint();
    announce('Loosened. The pieces will stick again once you move them.');
  }

  // ---- Moving ----

  // FLIP animation: measure, change the DOM, then animate each tile from
  // where it was to where it now is.
  function flip(mutate) {
    const first = new Map(els.map(e => [e, e.getBoundingClientRect()]));
    els.forEach(e => e.getAnimations().forEach(a => { if (a.id === 'flip') a.cancel(); }));
    rearranging = true;   // moving a focused node can fire focusout; ignore it
    mutate();
    rearranging = false;
    if (reduceMotion.matches) return;
    for (const e of els) {
      const a = first.get(e);
      const b = e.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy) {
        e.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 220, easing: 'cubic-bezier(.2, .7, .3, 1)', id: 'flip' },
        );
      }
    }
  }

  // Text: put `group` on the far side of `unit` (another group or a loose card).
  function hop(group, unit) {
    const cells = current();
    if (cells.indexOf(group[0]) < cells.indexOf(unit[0])) {
      const anchor = unit[unit.length - 1].nextSibling;
      for (const e of group) board.insertBefore(e, anchor);
    } else {
      for (const e of group) board.insertBefore(e, unit[0]);
    }
  }

  // Text, keyboard: hop over the neighbouring unit; Up/Down hop until the
  // group has moved about a row.
  function stepText(group, step) {
    const cells = current();
    const start = cells.indexOf(group[0]);
    const far = Math.abs(step) > 1 ? columns() : 1;
    let moved = false;
    flip(() => {
      for (;;) {
        const now = current();
        const first = now.indexOf(group[0]);
        const neighbour = step < 0 ? now[first - 1] : now[first + group.length];
        if (!neighbour || Math.abs(first - start) >= far) break;
        hop(group, groups.groupOf.get(neighbour));
        moved = true;
      }
      paint();
    });
    return moved;
  }

  // Picture: what happens if `group` shifts by (dr, dc)?
  // Returns null for no shift; otherwise { ok, cells (target cells on the
  // board, for the preview), next (the new board order, when ok) }.
  function planShift(group, dr, dc) {
    if (!dr && !dc) return null;
    const cells = current();
    const posOf = new Map(cells.map((e, p) => [e, p]));
    const shift = (p, er, ec) => {
      const r = Math.floor(p / cols) + er;
      const c = (p % cols) + ec;
      return r >= 0 && r < rows && c >= 0 && c < cols ? r * cols + c : null;
    };

    const S = group.map(e => posOf.get(e));
    const T = S.map(p => shift(p, dr, dc));
    const inBoard = T.filter(p => p != null);
    if (inBoard.length < T.length) return { ok: false, cells: inBoard };

    const inS = new Set(S);
    const next = new Array(n).fill(null);
    S.forEach((p, k) => { next[T[k]] = cells[p]; });

    // Groups the moving group lands on must move, whole, to somewhere clear
    // of every other group. Other groups stay put. Loose tiles are fluid:
    // they fill whatever cells are left.
    const fixed = new Set(T);
    const displaced = new Set(T.filter(p => !inS.has(p)).map(p => groups.groupOf.get(cells[p])));
    for (const g of groups.groups) {
      if (g.length > 1 && g !== group && !displaced.has(g)) {
        for (const e of g) { const p = posOf.get(e); fixed.add(p); next[p] = e; }
      }
    }
    const vacated = new Set(S.filter(p => !fixed.has(p)));

    // Try the straight swap first, then the nearest spot that disturbs the fewest loose tiles.
    const offsets = [];
    for (let er = 1 - rows; er < rows; er++) for (let ec = 1 - cols; ec < cols; ec++) if (er || ec) offsets.push([er, ec]);
    for (const u of [...displaced].filter(u => u.length > 1).sort((a, b) => b.length - a.length)) {
      const from = u.map(e => posOf.get(e));
      const own = new Set(from);
      let best = null;
      for (const [er, ec] of offsets) {
        const to = from.map(p => shift(p, er, ec));
        if (to.some(p => p == null || fixed.has(p))) continue;
        const swap = er === -dr && ec === -dc && to.every(p => vacated.has(p) || own.has(p));
        const cost = swap ? -1 : to.filter(p => !vacated.has(p) && !own.has(p)).length * 100 + Math.abs(er) + Math.abs(ec);
        if (!best || cost < best.cost) best = { to, cost };
      }
      if (!best) return { ok: false, cells: T };
      best.to.forEach((p, k) => { next[p] = u[k]; fixed.add(p); });
    }

    // Loose tiles that weren't covered stay put. Covered ones go where the
    // group came from (a plain swap for single tiles), else to any spare cell.
    const bumped = [];
    for (const g of groups.groups) {
      if (g.length > 1 || g === group) continue;
      const p = posOf.get(g[0]);
      if (fixed.has(p)) bumped.push(g[0]);
      else next[p] = g[0];
    }
    const spare = new Set();
    for (let p = 0; p < n; p++) if (!next[p] && !fixed.has(p)) spare.add(p);
    const leftover = [];
    for (const e of bumped) {
      const q = shift(posOf.get(e), -dr, -dc);
      if (q != null && spare.has(q)) { next[q] = e; spare.delete(q); }
      else leftover.push(e);
    }
    const rest = [...spare].sort((a, b) => a - b);
    leftover.forEach((e, k) => { next[rest[k]] = e; });
    return { ok: true, cells: T, next };
  }

  function mark(plan) {
    for (const e of els) e.classList.remove(...MARK_CLASSES);
    board.classList.toggle('cant-drop', !!plan && !plan.ok);
    if (!plan) return;
    const cells = current();
    for (const p of plan.cells) cells[p].classList.add(plan.ok ? 'swap-target' : 'blocked');
  }

  function columns() {
    const cells = current();
    const top = cells[0].offsetTop;
    let k = 0;
    while (k < cells.length && cells[k].offsetTop === top) k++;
    return k;
  }

  // ---- Pointer dragging (mouse, pen, touch) ----
  let drag = null;
  let lastTap = null;

  board.addEventListener('pointerdown', e => {
    if (locked || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const tile = e.target.closest('.tile');
    if (!tile || tile.parentNode !== board) return;
    e.preventDefault();
    if (held) dropHeld(false);
    drag = {
      tile, group: groups.groupOf.get(tile), id: e.pointerId,
      x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
      active: false, before: current(), lastHover: null, plan: null,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  });

  function cleanClone(tile) {
    const c = tile.cloneNode(true);
    c.classList.remove('correct', 'placeholder', 'held', 'snap', ...LINK_CLASSES, ...MARK_CLASSES);
    c.removeAttribute('tabindex');
    c.removeAttribute('role');
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // Text: the grabbed card, drawn as the top of a pile when it brings others.
  function stackGhost(tile, count, r) {
    const ghost = cleanClone(tile);
    ghost.classList.add('ghost');
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    if (count > 1) {
      ghost.classList.add('ghost-stack');
      ghost.append(el('span', { class: 'stack-count' }, `${count} ${noun}`));
    }
    return ghost;
  }

  // Picture: the whole group in its shape, anchored at the grabbed tile.
  function groupGhost(group, r) {
    const ghost = el('div', { class: 'group-ghost', 'aria-hidden': 'true' });
    for (const e of group) {
      const q = e.getBoundingClientRect();
      const c = cleanClone(e);
      Object.assign(c.style, {
        left: `${q.left - r.left}px`, top: `${q.top - r.top}px`,
        width: `${q.width}px`, height: `${q.height}px`,
      });
      ghost.append(c);
    }
    return ghost;
  }

  function startDrag() {
    const { tile, group } = drag;
    const r = tile.getBoundingClientRect();
    drag.offsetX = drag.startX - r.left;
    drag.offsetY = drag.startY - r.top;
    drag.ghost = grid ? groupGhost(group, r) : stackGhost(tile, group.length, r);
    document.body.append(drag.ghost);
    drag.active = true;
    group.forEach(e => e.classList.add('placeholder'));
    board.classList.add('dragging');
    document.body.classList.add('is-dragging');
    autoScroll();
  }

  function onPointerMove(e) {
    if (e.pointerId !== drag.id) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < DRAG_THRESHOLD) return;
      startDrag();
    }
    drag.ghost.style.transform = `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)`;
    updateTarget();
  }

  // Text: which tile's slot is under the point? Uses layout positions
  // (offset*), which ignore the slide animations.
  function tileAt(x, y) {
    const b = board.getBoundingClientRect();
    const px = x - b.left;
    const py = y - b.top;
    return current().find(t =>
      px >= t.offsetLeft && px < t.offsetLeft + t.offsetWidth &&
      py >= t.offsetTop && py < t.offsetTop + t.offsetHeight) ?? null;
  }

  // Picture: which cell is under the point?
  function cellAt(x, y) {
    const b = board.getBoundingClientRect();
    const fx = (x - b.left) / b.width;
    const fy = (y - b.top) / b.height;
    if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null;
    return Math.floor(fy * rows) * cols + Math.floor(fx * cols);
  }

  function updateTarget() {
    if (grid) {
      const cell = cellAt(drag.x, drag.y);
      const from = current().indexOf(drag.tile);
      drag.plan = cell == null ? null : planShift(drag.group,
        Math.floor(cell / cols) - Math.floor(from / cols), (cell % cols) - (from % cols));
      mark(drag.plan);
      return;
    }
    // Text: slide the group past whatever unit the pointer reaches. Only
    // react to a new unit, so one still sliding away doesn't trigger again.
    const under = tileAt(drag.x, drag.y);
    const unit = under && !drag.group.includes(under) ? groups.groupOf.get(under) : null;
    if (unit && unit !== drag.lastHover) flip(() => { hop(drag.group, unit); paint(); });
    drag.lastHover = unit;
  }

  function autoScroll() {
    if (!drag?.active) return;
    const { y } = drag;
    let dy = 0;
    if (y < EDGE) dy = -Math.ceil((EDGE - y) / 5);
    else if (y > innerHeight - EDGE) dy = Math.ceil((y - (innerHeight - EDGE)) / 5);
    if (dy) {
      const before = scrollY;
      scrollBy(0, dy);
      if (scrollY !== before) updateTarget();
    }
    requestAnimationFrame(autoScroll);
  }

  function onPointerUp(e) {
    if (e.pointerId !== drag.id) return;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    const { tile, group, ghost, active, before, plan } = drag;
    drag = null;

    if (!active) {
      // A double tap on a picture group loosens it.
      const now = performance.now();
      if (grid && lastTap && now - lastTap.time < DOUBLE_TAP && groups.groupOf.get(lastTap.tile) === group) {
        lastTap = null;
        loosen(tile);
      } else {
        lastTap = { tile, time: now };
      }
      return;
    }

    if (e.type !== 'pointerup' && !grid) board.append(...before);   // cancelled: undo the live reflow
    if (grid && plan?.ok && e.type === 'pointerup') flip(() => board.append(...plan.next));
    if (grid) mark(null);
    else if (e.type !== 'pointerup') paint();
    if (grid && plan && !plan.ok) announce('No room there.');
    board.classList.remove('dragging');
    document.body.classList.remove('is-dragging');

    // Fly the ghost to the grabbed tile's (new or old) spot, then reveal the group.
    const r = tile.getBoundingClientRect();
    const reveal = () => { ghost.remove(); group.forEach(t => t.classList.remove('placeholder')); };
    if (reduceMotion.matches) {
      reveal();
    } else {
      ghost.animate(
        [{ transform: ghost.style.transform }, { transform: `translate(${r.left}px, ${r.top}px)` }],
        { duration: 160, easing: 'ease-out', fill: 'forwards' },
      ).finished.then(reveal, reveal);
    }
    finishMove(before);
  }

  // ---- Keyboard: Space/Enter picks up and drops, arrows move, Escape cancels ----
  let held = null;

  function pickUp(tile) {
    const group = groups.groupOf.get(tile);
    held = { tile, group, before: current(), dr: 0, dc: 0, plan: null };
    group.forEach(e => e.classList.add('held'));
    const what = group.length > 1 ? `Picked up ${group.length} ${noun}.` : 'Picked up.';
    announce(grid
      ? `${what} Use arrow keys to choose where it goes, then Space. Escape cancels.`
      : `${what} Use arrow keys to move, then Space to drop. Escape cancels.`);
  }

  // `force` drops even where there is no room (by not moving), e.g. on blur.
  function dropHeld(refocus = true, force = true) {
    const { tile, group, before, plan } = held;
    if (grid && plan && !plan.ok && !force) { announce('No room there. Choose another spot, or press Escape.'); return; }
    if (grid && plan?.ok) flip(() => board.append(...plan.next));
    endHeld(group);
    announce('Dropped.');
    finishMove(before);
    if (refocus && !locked) tile.focus();
  }

  function cancelHeld() {
    const { tile, group, before } = held;
    if (!grid) flip(() => { board.append(...before); paint(); });
    endHeld(group);
    announce('Cancelled.');
    tile.focus();
  }

  function endHeld(group) {
    group.forEach(e => e.classList.remove('held'));
    if (grid) mark(null);
    held = null;
  }

  board.addEventListener('keydown', e => {
    const tile = e.target.closest('.tile');
    if (!tile || locked) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (held) dropHeld(true, false);
      else pickUp(tile);
      return;
    }
    if (e.key === 'Escape' && held) { cancelHeld(); return; }
    if (grid && !held && (e.key === 'l' || e.key === 'L')) { loosen(tile); return; }

    const dir = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const cells = current();

    if (!held) {
      const step = grid ? dir[0] * cols + dir[1] : (dir[0] ? dir[0] * columns() : dir[1]);
      cells[Math.max(0, Math.min(n - 1, cells.indexOf(tile) + step))].focus();
    } else if (grid) {
      held.dr = Math.max(1 - rows, Math.min(rows - 1, held.dr + dir[0]));
      held.dc = Math.max(1 - cols, Math.min(cols - 1, held.dc + dir[1]));
      held.plan = planShift(held.group, held.dr, held.dc);
      mark(held.plan);
      const at = cells.indexOf(held.tile);
      const r = Math.floor(at / cols) + held.dr + 1;
      const c = (at % cols) + held.dc + 1;
      announce(!held.plan ? 'Back where it started.'
        : held.plan.ok ? `Row ${r}, column ${c}. Space to drop.` : 'No room there.');
    } else {
      stepText(held.group, dir[0] ? dir[0] * 2 : dir[1]);   // ±2 means "a row"
      held.tile.focus();
      announce(`Position ${current().indexOf(held.group[0]) + 1} of ${n}.`);
    }
  });

  board.addEventListener('focusout', e => {
    if (held && !rearranging && !held.group.includes(e.relatedTarget)) dropHeld(false);
  });

  return { element: wrapper };
}
