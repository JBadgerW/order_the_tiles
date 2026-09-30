# Order the Tiles

A drag-and-drop ordering quiz. Students pick a puzzle from the menu, then put
shuffled tiles back in the right order: story cards (text) or pieces of a
picture (image). When the order is right they see **"You did it!"** with their
time, tiles per minute, and number of moves.

It's a static site: plain HTML, CSS and JavaScript, with no build step and no server code.

## Run it locally

The page loads its puzzles with `fetch`, so it must be served over HTTP.
Opening `index.html` straight from disk won't work.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Hosting

- **GitHub Pages:** push the repo, then go to **Settings → Pages → Deploy from a branch → `main` / root**.
  The site appears at `https://<user>.github.io/order_the_tiles/`.
- **Your own network:** copy the folder to any web server (nginx, Apache, IIS),
  or run `python3 -m http.server 8000` on a machine students can reach.

You can link students straight to a puzzle: `…/#/play/trojan-war`.

## How it plays

| | Text puzzles | Image puzzles |
|---|---|---|
| Dragging | The card slides in and the others shift over | The tile swaps with the one it's dropped on |
| Layout | Numbered cards; the column count adapts to text length and screen width | The grid keeps the picture's shape and fits the screen |

- **Easy / Hard:** chosen on the menu (the browser remembers the choice). In Easy mode, tiles in the right
  spot get a green edge. Hard mode gives no hints.
- **Shuffling:** no tile ever starts in its correct spot.
- **Moves:** each drag that changes the order counts as one move.
- **Tiles per minute:** the number of tiles ÷ minutes taken.
- **Devices:** mouse, touch screen (Chromebooks, iPads, phones) and keyboard all work. With the keyboard,
  Tab moves to a tile, Space picks it up, the arrow keys move it (or choose a tile to swap with), and Space drops it.

## Adding puzzles

All puzzles live in `puzzles/`. After adding, removing, or renaming one, rebuild the menu list:

```sh
python3 tools/build_index.py
```

### Text puzzle

`puzzles/<id>.json`: list the items **in the correct order**. `*bold*` and `_italic_` are supported.

```json
{
  "title": "The Prodigal Son",
  "type": "text",
  "description": "Luke 15:11–32",
  "items": [
    "A man had *two sons*.",
    "The younger asks for his share of the estate.",
    "..."
  ]
}
```

### From a Typst table

Write the cards as a Typst `#table(...)`, in order, then:

```sh
python3 tools/typ_to_puzzle.py sources/trojan_war_outline_cards.typ \
  --id trojan-war --title "The Trojan War" \
  --description "From the wedding of Peleus and Thetis to the homecomings."
```

This writes `puzzles/trojan-war.json` and rebuilds the index. Keep the `.typ` in `sources/`
so you can print the cards and regenerate the puzzle from the same file.

### Image puzzle

Put the picture in `puzzles/images/`, then create `puzzles/<id>.json`:

```json
{
  "title": "World Map",
  "type": "image",
  "src": "images/world_map.png",
  "rows": 3,
  "cols": 6
}
```

Tiles are square. If the picture's shape doesn't match `cols : rows`, it is cropped from the center.
(`world_map.png` is 1200×600, which is 2:1, so 3×6 or 4×8 fit it exactly.)

### Optional fields

| Field | Applies to | Effect |
|---|---|---|
| `description` | all | A line under the title on the menu card |
| `order` | all | A number that sets the menu position (lower comes first); otherwise puzzles are listed alphabetically |
| `drag` | all | `"insert"` or `"swap"`, overriding the default for that puzzle type |
| `columns` | text | A fixed number of columns in place of the automatic layout |
| `thumb` | image | A different menu thumbnail, or `null` to hide the picture (so the menu doesn't give away the answer) |

## Files

```
index.html            page shell
css/style.css         all styling (light and dark themes)
js/app.js             menu, puzzle screen, "You did it!" message, routing
js/board.js           shuffling, dragging, keyboard moves, win check
js/types/text.js      text cards
js/types/image.js     cuts an image into tiles
js/util.js            shared helpers
puzzles/              puzzle JSON files, index.json, images/
sources/              original source files (e.g. Typst card tables)
tools/                build_index.py, typ_to_puzzle.py
```
