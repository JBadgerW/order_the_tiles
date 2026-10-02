# Order the Tiles

A drag-and-drop ordering quiz. Students pick a puzzle from the menu, then put
shuffled tiles back in the right order: story cards (text) or pieces of a
picture (image). Place puzzles work differently: students drag names onto a blank map. When the order is right they see **"You did it!"** with their
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

Dragging a tile onto another swaps the two; no other tiles move.

- **Text puzzles:** numbered cards. The column count adapts to text length and screen width.
- **Image puzzles:** the grid keeps the picture's shape and fits the screen.

- **Place puzzles:** drag a name from the tray onto the map. A name with a dot (a city) must land near its
  spot; a name without one (a sea, island, or region) can land anywhere inside the region. A correct drop
  settles and leaves the tray; a wrong one flies back. Every drop on the map is a try. On wide screens the
  tray sits beside the map; on narrow ones, underneath.
- **Easy / Hard:** chosen on the menu (the browser remembers the choice). In Easy mode, tiles in the right
  spot get a green edge, and map names snap into place from 1.5× farther away. Hard mode gives no hints.
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

### Place puzzle

Put a blank map in `puzzles/images/`, then list the places in `features`. A place is either a
**point** (a city or a mountain) or a **region** (a sea, an island, a land):

```json
{
  "title": "Homer’s Greece: Places",
  "type": "place",
  "src": "images/Aegean_sea_and_Western_Anatolia.webp",
  "bounds": { "west": 19.0913, "east": 28.787, "north": 41.6116, "south": 34.7973 },
  "features": [
    { "name": "Athens", "lat": 37.9715, "lon": 23.7257 },
    { "name": "Mt. Olympus", "lat": 40.0856, "lon": 22.3586, "mark": "triangle" },
    { "name": "Crete", "at": [35.2, 24.82], "area": [[35.64, 23.52], [35.67, 23.88], "…"] },
    { "name": "Aegean Sea", "style": "sea", "area": ["…"] }
  ]
}
```

**Coordinates.** With `bounds` (the longitude of the map's left and right edges and the latitude of
its top and bottom), places use latitude and longitude, which you can copy from Wikipedia. This
works for "location maps" like Wikimedia's, where the latitude and longitude lines are straight and
evenly spaced. Without `bounds`, use the image's own pixels: `"x"`/`"y"` for points and `[x, y]`
pairs for outlines.

**Points** use `lat`/`lon` (or `x`/`y`) and show a dot; `"mark": "triangle"` is for mountains. A drop
counts within `snap` of the spot: a fraction of the map's width, `0.04` unless the puzzle sets its own
`"snap"`. Make it smaller when places are close together. When the right side of the dot is crowded,
`"label"` can put the name `"left"`, `"above"` or `"below"` it instead.

**Regions** have an `area` outline, a list of `[lat, lon]` pairs. A drop counts anywhere inside it, or
within `snap` of its edge (`0.01` unless the region sets its own). `"at"` is where the name sits once
placed (otherwise the middle of the outline). `"style": "sea"` labels it in blue italics; land regions
get spaced capitals. When a region is placed, its outline flashes so students see its extent.

**The drawing page.** Open `#/draw/<id>` (for example `…/#/draw/greece-places`) to see every answer
and outline on the map. Click once to get a point's coordinates, or click around a region and press
**Copy outline** to get an `"area"` to paste into the file. Outlines can be rough: 6 to 15 points.
The page isn't linked from the menu, but anyone with the address can open it.

### Optional fields

| Field | Applies to | Effect |
|---|---|---|
| `description` | all | A line under the title on the menu card |
| `order` | all | A number that sets the menu position (lower comes first); otherwise puzzles are listed alphabetically |
| `drag` | all | `"insert"` makes a dropped tile slide into place while the others shift over (the default is `"swap"`) |
| `columns` | text | A fixed number of columns in place of the automatic layout |
| `credit` | all | Small print under the puzzle, e.g. `{"text": "World Map with Countries – GISGeography", "url": "https://gisgeography.com/world-map/"}` shows **Source: <link>**. Add `"prefix"` to change the word "Source:" |
| `thumb` | image, place | A different menu thumbnail, or `null` to hide the picture (so the menu doesn't give away the answer) |

## Files

```
index.html            page shell
css/style.css         all styling (light and dark themes)
js/app.js             menu, puzzle screen, "You did it!" message, routing
js/board.js           shuffling, dragging, keyboard moves, win check
js/types/text.js      text cards
js/types/image.js     cuts an image into tiles
js/types/place.js     place puzzles: names dragged onto a blank map
js/draw.js            the drawing page for place puzzles (#/draw/<id>)
js/util.js            shared helpers
puzzles/              puzzle JSON files, index.json, images/
sources/              original source files (e.g. Typst card tables)
tools/                build_index.py, typ_to_puzzle.py
```
