// The puzzle board: shuffles the tiles, lets students reorder them by
// dragging (mouse or touch) or with the keyboard, and reports when solved.
//
// dragStyle 'insert': the tile slides into the new spot and the rest reflow.
// dragStyle 'swap':   the tile trades places with the one it's dropped on.
import { el, shuffledOrder } from './util.js';

const DRAG_THRESHOLD = 6;   // px of movement before a press becomes a drag
const EDGE = 70;            // px from the window edge where auto-scroll starts
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createBoard({ tiles, dragStyle, easy, configureBoard, footer, onChange, onSolved }) {
  const board = el('div', { class: `board drag-${dragStyle}`, role: 'list' });
  const live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
  const wrapper = el('div', { class: 'board-wrap' }, board, footer, live);
  configureBoard(board, wrapper);

  const solution = tiles.map(t => t.key);
  const keyOf = new Map(tiles.map(t => [t.el, t.key]));
  for (const i of shuffledOrder(solution)) {
    const tile = tiles[i].el;
    tile.setAttribute('role', 'listitem');
    tile.tabIndex = 0;
    board.append(tile);
  }

  let locked = false;
  let rearranging = false;
  const current = () => [...board.children];
  const announce = msg => { live.textContent = msg; };

  // Mark tiles in the right spot (shown only in Easy mode) and report whether solved.
  function refresh() {
    let solved = true;
    current().forEach((tile, i) => {
      const ok = keyOf.get(tile) === solution[i];
      if (!ok) solved = false;
      tile.classList.toggle('correct', easy && ok);
    });
    return solved;
  }

  function finishMove(before) {
    if (!current().some((tile, i) => tile !== before[i])) return;
    onChange();
    if (refresh()) {
      locked = true;
      board.classList.add('solved');
      current().forEach(t => t.classList.add('correct'));
      onSolved();
    }
  }

  // FLIP animation: measure, change the DOM, then animate each tile from
  // where it was to where it now is.
  function flip(mutate) {
    const els = current();
    const first = new Map(els.map(e => [e, e.getBoundingClientRect()]));
    els.forEach(e => e.getAnimations().forEach(a => a.cancel()));
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
          { duration: 220, easing: 'cubic-bezier(.2, .7, .3, 1)' },
        );
      }
    }
  }

  function swapNodes(a, b) {
    const mark = document.createComment('');
    board.replaceChild(mark, a);
    board.replaceChild(a, b);
    board.replaceChild(b, mark);
  }

  function moveTo(tile, target) {
    const els = current();
    board.insertBefore(tile, els.indexOf(tile) < els.indexOf(target) ? target.nextSibling : target);
  }

  function columns() {
    const els = current();
    const top = els[0].offsetTop;
    let n = 0;
    while (n < els.length && els[n].offsetTop === top) n++;
    return n;
  }

  // ---- Pointer dragging (mouse, pen, touch) ----
  let drag = null;

  board.addEventListener('pointerdown', e => {
    if (locked || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const tile = e.target.closest('.tile');
    if (!tile || tile.parentNode !== board) return;
    e.preventDefault();
    if (held) dropHeld(false);
    drag = {
      tile, id: e.pointerId, x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      active: false, before: current(), target: null, lastHover: null,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  });

  function startDrag() {
    const { tile } = drag;
    const r = tile.getBoundingClientRect();
    drag.offsetX = drag.startX - r.left;
    drag.offsetY = drag.startY - r.top;
    const ghost = tile.cloneNode(true);
    ghost.classList.remove('correct');
    ghost.classList.add('ghost');
    ghost.removeAttribute('tabindex');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.active = true;
    tile.classList.add('placeholder');
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
    placeGhost();
    updateTarget();
  }

  function placeGhost() {
    drag.ghost.style.transform =
      `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)`;
  }

  // Which tile's slot is under the point? Uses layout positions (offset*),
  // which ignore the slide animations, so a drop lands where the pointer is
  // even while neighbours are still moving.
  function tileAt(x, y) {
    const b = board.getBoundingClientRect();
    const px = x - b.left;
    const py = y - b.top;
    return current().find(t =>
      px >= t.offsetLeft && px < t.offsetLeft + t.offsetWidth &&
      py >= t.offsetTop && py < t.offsetTop + t.offsetHeight) ?? null;
  }

  function updateTarget() {
    const under = tileAt(drag.x, drag.y);
    const target = under !== drag.tile ? under : null;
    if (dragStyle === 'swap') {
      if (target !== drag.target) {
        drag.target?.classList.remove('swap-target');
        target?.classList.add('swap-target');
        drag.target = target;
      }
    } else {
      // Only react when the pointer reaches a new tile, so a tile that's
      // still sliding out of the way doesn't trigger another move.
      if (target && target !== drag.lastHover) flip(() => moveTo(drag.tile, target));
      drag.lastHover = target;
    }
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
    const { tile, ghost, target, active, before } = drag;
    drag = null;
    if (!active) return;

    if (target) {
      target.classList.remove('swap-target');
      if (e.type === 'pointerup') flip(() => swapNodes(tile, target));
    }
    tile.getAnimations().forEach(a => a.cancel());
    board.classList.remove('dragging');
    document.body.classList.remove('is-dragging');

    // Fly the ghost into the tile's new spot, then reveal the tile.
    const r = tile.getBoundingClientRect();
    const reveal = () => { ghost.remove(); tile.classList.remove('placeholder'); };
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

  // ---- Keyboard: Space/Enter picks up and drops, arrows move ----
  let held = null;

  function dropHeld(refocus = true) {
    const { tile, before, target } = held;
    tile.classList.remove('held');
    if (target) {
      target.classList.remove('swap-target');
      flip(() => swapNodes(tile, target));
    }
    held = null;
    announce('Dropped.');
    finishMove(before);
    if (refocus && !locked) tile.focus();
  }

  board.addEventListener('keydown', e => {
    const tile = e.target.closest('.tile');
    if (!tile || locked) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (held) { dropHeld(); return; }
      held = { tile, before: current(), target: null };
      tile.classList.add('held');
      announce(dragStyle === 'swap'
        ? 'Picked up. Use arrow keys to choose a tile to swap with, then Space.'
        : 'Picked up. Use arrow keys to move it, then Space to drop.');
      return;
    }
    if (e.key === 'Escape' && held) { dropHeld(); return; }

    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns(), ArrowDown: columns() }[e.key];
    if (!step) return;
    e.preventDefault();
    const els = current();
    const n = els.length;

    if (!held) {
      els[Math.max(0, Math.min(n - 1, els.indexOf(tile) + step))].focus();
    } else if (dragStyle === 'swap') {
      const from = els.indexOf(held.target ?? held.tile);
      const next = els[Math.max(0, Math.min(n - 1, from + step))];
      held.target?.classList.remove('swap-target');
      held.target = next === held.tile ? null : next;
      held.target?.classList.add('swap-target');
      announce(`Swap with position ${els.indexOf(next) + 1} of ${n}.`);
    } else {
      const to = Math.max(0, Math.min(n - 1, els.indexOf(tile) + step));
      if (els[to] === tile) return;
      flip(() => moveTo(tile, els[to]));
      tile.focus();
      announce(`Position ${to + 1} of ${n}.`);
    }
  });

  board.addEventListener('focusout', e => {
    if (held && !rearranging && e.relatedTarget !== held.tile) dropHeld(false);
  });

  refresh();
  return { element: wrapper };
}
