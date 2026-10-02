// Screens and routing. URLs:
//   #/            the menu
//   #/play/<id>   a puzzle (puzzles/<id>.json)
//   #/draw/<id>   a place puzzle's drawing page, for teachers (not linked from the menu)
import { createBoard } from './board.js';
import { drawBoard } from './draw.js';
import * as textType from './types/text.js';
import * as imageType from './types/image.js';
import * as placeType from './types/place.js';
import { el, fetchJSON, formatTime, store, PUZZLE_DIR } from './util.js';

const TYPES = { text: textType, image: imageType, place: placeType };
const MODE_KEY = 'order-the-tiles:mode';
const app = document.getElementById('app');

let indexPromise = null;
const loadIndex = () => (indexPromise ??= fetchJSON(PUZZLE_DIR + 'index.json'));

const getMode = () => (store.get(MODE_KEY, 'easy') === 'hard' ? 'hard' : 'easy');

function show(...nodes) {
  document.querySelector('.overlay')?.remove();
  app.replaceChildren(...nodes);
  scrollTo(0, 0);
}

function showError(err) {
  const onFile = location.protocol === 'file:';
  show(el('main', { class: 'screen error' },
    el('h1', {}, 'Something went wrong'),
    el('p', {}, onFile
      ? 'This page has to be opened through a web server, not straight from the file. In this folder, run "python3 -m http.server" and open http://localhost:8000.'
      : String(err.message || err)),
    el('p', {}, el('a', { class: 'btn', href: '#/' }, 'Back to menu')),
  ));
  console.error(err);
}

// ---------- Menu ----------

function modeToggle() {
  const hint = el('p', { class: 'mode-hint' });
  const buttons = ['easy', 'hard'].map(mode => el('button', {
    type: 'button', class: 'seg', 'data-mode': mode,
    onclick: () => { store.set(MODE_KEY, mode); update(); },
  }, mode === 'easy' ? 'Easy' : 'Hard'));

  function update() {
    const mode = getMode();
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    hint.textContent = mode === 'easy'
      ? 'Tiles in the right spot get a green edge. Map names snap into place from farther away.'
      : 'No hints: you won’t know a tile is right until the whole puzzle is. Map names must land closer.';
  }
  update();

  return el('div', { class: 'mode' },
    el('div', { class: 'segmented', role: 'group', 'aria-label': 'Difficulty' }, buttons),
    hint,
  );
}

function puzzleCard(p) {
  const terms = TYPES[p.type]?.terms ?? textType.terms;
  const art = p.thumb
    ? el('img', { src: PUZZLE_DIR + p.thumb, alt: '', loading: 'lazy' })
    : el('div', { class: 'art-count-box' },
        el('span', { class: 'art-count' }, String(p.count)),
        el('span', { class: 'art-label' }, terms.short));

  return el('a', { class: 'card', href: `#/play/${encodeURIComponent(p.id)}` },
    el('div', { class: 'card-art' }, art),
    el('div', { class: 'card-text' },
      el('h2', {}, p.title),
      p.description && el('p', {}, p.description),
      el('span', { class: 'card-meta' }, `${p.count} ${terms.pieces}`),
    ),
  );
}

async function showMenu() {
  document.title = 'Order the Tiles';
  const puzzles = await loadIndex();
  show(el('main', { class: 'screen menu' },
    el('header', { class: 'menu-head' },
      el('div', {},
        el('h1', {}, 'Order the Tiles'),
        el('p', { class: 'lede' }, 'Pick a puzzle, then drag the tiles into the right order.'),
      ),
      modeToggle(),
    ),
    puzzles.length
      ? el('div', { class: 'cards' }, puzzles.map(puzzleCard))
      : el('p', {}, 'No puzzles yet. Add one to the puzzles folder and run tools/build_index.py.'),
  ));
}

// ---------- Puzzle ----------

async function showPuzzle(id) {
  const puzzle = await fetchJSON(`${PUZZLE_DIR}${encodeURIComponent(id)}.json`);
  const type = TYPES[puzzle.type];
  if (!type) throw new Error(`Unknown puzzle type "${puzzle.type}" in ${id}.json`);
  document.title = `${puzzle.title} · Order the Tiles`;

  const mode = getMode();
  // A type can bring its own board; otherwise tiles go on the ordering board.
  const { tiles, configureBoard, createBoard: typeBoard } = await type.prepare(puzzle);
  let moves = 0;
  let started = 0;
  const moveCount = el('b', {}, '0');
  const note = el('p', { class: 'instructions' }, type.instructions);

  const board = (typeBoard ?? createBoard)({
    tiles,
    configureBoard,
    footer: creditLine(puzzle.credit),
    dragStyle: puzzle.drag || type.defaultDrag,
    easy: mode === 'easy',
    onChange() { moveCount.textContent = String(++moves); },
    onSolved() {
      const ms = performance.now() - started;
      const perMinute = tiles.length / (ms / 60000);
      const summary = {
        time: formatTime(ms),
        rate: perMinute >= 10 ? Math.round(perMinute) : perMinute.toFixed(1),
        moves,
      };
      note.textContent = `Solved in ${summary.time} · ${summary.rate} ${type.terms.rate} · ${moves} ${type.terms.moves.toLowerCase()}`;
      note.classList.add('done');
      setTimeout(() => celebrate(summary, mode, type.terms), 350);
    },
  });

  show(el('main', { class: `screen play play-${puzzle.type}` },
    el('header', { class: 'play-bar' },
      el('a', { class: 'btn quiet', href: '#/' }, '← Menu'),
      el('h1', {}, puzzle.title),
      el('div', { class: 'stats' },
        el('span', { class: `badge badge-${mode}` }, mode === 'easy' ? 'Easy' : 'Hard'),
        el('span', { class: 'moves' }, `${type.terms.moves} `, moveCount),
      ),
    ),
    note,
    board.element,
  ));
  started = performance.now();
}

// ---------- Drawing page (place puzzles) ----------

async function showDraw(id) {
  const puzzle = await fetchJSON(`${PUZZLE_DIR}${encodeURIComponent(id)}.json`);
  if (puzzle.type !== 'place') throw new Error(`${id} is not a place puzzle, so there is nothing to draw`);
  document.title = `Drawing: ${puzzle.title} · Order the Tiles`;
  show(el('main', { class: 'screen play play-place' },
    el('header', { class: 'play-bar' },
      el('a', { class: 'btn quiet', href: '#/' }, '← Menu'),
      el('h1', {}, `Drawing: ${puzzle.title}`),
      el('a', { class: 'btn quiet', href: `#/play/${encodeURIComponent(id)}` }, 'Play'),
    ),
    el('p', { class: 'instructions' },
      'Every answer is shown. Click once for a point’s coordinates, or click around a region to outline it.'),
    await drawBoard(puzzle),
  ));
}

// Attribution for borrowed material, shown in small print under the puzzle:
// "credit": { "text": "…", "url": "…" }  →  Source: <link>
function creditLine(credit) {
  if (!credit?.text) return null;
  const label = credit.url
    ? el('a', { href: credit.url, target: '_blank', rel: 'noopener' }, credit.text)
    : credit.text;
  return el('p', { class: 'credit' }, `${credit.prefix ?? 'Source:'} `, label);
}

function celebrate({ time, rate, moves }, mode, terms) {
  const close = () => {
    overlay.classList.add('leaving');
    setTimeout(() => overlay.remove(), 250);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };

  const stat = (value, label) =>
    el('div', { class: 'stat' }, el('span', { class: 'stat-value' }, String(value)), el('span', { class: 'stat-label' }, label));

  const overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'win-title' },
    el('div', { class: 'win' },
      el('h2', { id: 'win-title' }, 'You did it!'),
      el('div', { class: 'win-stats' },
        stat(time, 'time'),
        stat(rate, terms.rate),
        stat(moves, terms.moves.toLowerCase()),
      ),
      el('p', { class: 'win-mode' }, mode === 'easy' ? 'Easy mode' : 'Hard mode'),
      el('div', { class: 'win-actions' },
        el('a', { class: 'btn primary', href: '#/' }, 'Back to menu'),
        el('button', { type: 'button', class: 'btn', onclick: close }, 'View puzzle'),
      ),
    ),
  );
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.querySelector('.btn.primary').focus();
}

// ---------- Routing ----------

async function route() {
  const [, screen, id] = location.hash.match(/^#\/(play|draw)\/(.+)$/) ?? [];
  app.setAttribute('aria-busy', 'true');
  try {
    if (screen === 'play') await showPuzzle(decodeURIComponent(id));
    else if (screen === 'draw') await showDraw(decodeURIComponent(id));
    else await showMenu();
  } catch (err) {
    showError(err);
  } finally {
    app.removeAttribute('aria-busy');
  }
}

addEventListener('hashchange', route);
route();
