// Image puzzles: `src` is cut into a rows × cols grid of square tiles.
// If the image's shape doesn't match the grid, it is cropped from the center.
import { el, loadImage, PUZZLE_DIR } from '../util.js';

export const defaultDrag = 'swap';

export const terms = { pieces: 'picture tiles', short: 'tiles', rate: 'tiles per minute', moves: 'Moves' };

export const instructions = 'Drag a tile onto another to swap them and rebuild the picture.';

export async function prepare(puzzle) {
  const { rows, cols } = puzzle;
  const src = PUZZLE_DIR + puzzle.src;
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  // Largest square tile that fits the grid, and the centered crop around it.
  const side = Math.min(W / cols, H / rows);
  const cropX = (W - cols * side) / 2;
  const cropY = (H - rows * side) / 2;

  // background-position percentages: p% lines up p% of the image with p% of
  // the tile, so offset = p × (tile − image). Solve for p.
  const pct = (offset, full) => (full === side ? 0 : (offset / (full - side)) * 100);

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = el('div', { class: 'tile image-tile', 'aria-label': `Row ${r + 1}, column ${c + 1} piece` });
      tile.style.backgroundImage = `url("${src}")`;
      tile.style.backgroundSize = `${(W / side) * 100}% ${(H / side) * 100}%`;
      tile.style.backgroundPosition =
        `${pct(cropX + c * side, W)}% ${pct(cropY + r * side, H)}%`;
      tiles.push({ key: `${r},${c}`, el: tile });
    }
  }

  return {
    tiles,
    // The wrapper gets the size so anything under the board (like a credit)
    // lines up with the picture's edges.
    configureBoard(board, wrapper) {
      board.classList.add('image-board');
      wrapper.classList.add('image-wrap');
      wrapper.style.setProperty('--cols', cols);
      wrapper.style.setProperty('--rows', rows);
    },
  };
}
