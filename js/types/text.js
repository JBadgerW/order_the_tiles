// Text puzzles: each item in `items` is one card; the array order is the answer.
import { el, richText } from '../util.js';

export const defaultDrag = 'swap';

export const instructions =
  'Drag a card onto another to swap them. Put them in order left to right, then top to bottom.';

// Pick a card width from how long the items are, so long sentences get
// wide cards (fewer columns) and short ones pack into many columns.
function minCardWidth(items) {
  const avg = items.reduce((sum, t) => sum + t.length, 0) / items.length;
  if (avg <= 30) return 140;
  if (avg <= 80) return 190;
  if (avg <= 160) return 230;
  return 270;
}

export async function prepare(puzzle) {
  const tiles = puzzle.items.map(text => ({
    key: text.replace(/\s+/g, ' ').trim(),
    el: el('div', { class: 'tile text-tile' }, el('div', { class: 'tile-body', html: richText(text) })),
  }));

  return {
    tiles,
    configureBoard(board) {
      board.classList.add('text-board');
      if (puzzle.columns) {
        board.style.gridTemplateColumns = `repeat(${puzzle.columns}, minmax(0, 1fr))`;
      } else {
        board.style.setProperty('--card-min', `${minCardWidth(puzzle.items)}px`);
      }
    },
  };
}
