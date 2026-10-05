// student_achievement_tracker.typ
// A student-facing checklist of the puzzles on the menu (puzzles/index.json),
// for tracking which aims have been met over the course of the class.
// Compile with:  typst compile student_achievement_tracker.typ
//
// Regenerating after puzzles change: the row data below (title, kind, tile
// count, aim) is copied by hand from puzzles/index.json. There is no build
// step - if you add, remove, or resize a puzzle, mirror the change in the
// `rows` array below. Aims are set by the teacher, not stored in the JSON.
#import "pt_style.typ": *

#show: doc.with(
  kind: "Achievement Tracker",
  title: "Order the Tiles Achievement Tracker",
  margins: (x: 0.7in, top: 0.95in, bottom: 0.9in),
)

#titleblock(
  "Order the Tiles · Puzzle Fluency",
  [Puzzle Achievement Tracker],
  subtitle: [Every puzzle on the menu — your own record of what you've earned],
)
#v(1em)

#grid(
  columns: (2fr, 1fr, 1.4fr, 1fr),
  column-gutter: 18pt,
  field("Student"), field("Class / period"), field("Teacher"), field("Start date"),
)
#v(0.7em)

#callout("How to use this chart")[
  This is your own record of the course — not a replacement for your Standard Celeration Chart, which is still where your *daily* numbers go. When you solve a puzzle, the "You did it!" box shows your time, your *tiles per minute* (or *places per minute* on a map), and your moves (or tries). Fill in a row here the day you first reach its *aim*: the date, your per-minute rate, your moves (tries on a map), and your initials. *Only Hard mode counts.*
]
#v(0.3em)

#set par(justify: false)

// ---- column layout, shared by the example and the main table ----
#let cols = (0.3in, 1fr, 0.85in, 1.1in, 0.85in, 0.7in, 0.7in, 0.55in)
#let aligns = (center, left, center, center, center, center, center, center)

// ---- worked example ----
#text(size: 8.5pt, fill: ink-mute, style: "italic")[Example of a completed row:]
#v(3pt)
#table(
  columns: cols,
  align: aligns,
  stroke: 0.6pt + rule,
  inset: (x: 6pt, y: 6pt),
  [#text(fill: ink-faint)[4]],
  [#text(fill: ink-faint, style: "italic")[World Map]],
  [#text(fill: ink-faint, size: 9pt)[Picture · 18]],
  [#text(fill: ink-faint)[30–25]],
  [#text(fill: ink-faint)[Sep 12]],
  [#text(fill: ink-faint)[27]],
  [#text(fill: ink-faint)[24]],
  [#text(fill: ink-faint)[J.W.]],
)
#v(0.7em)

// ---- helpers for building the main table ----
#let row(n, label, kind, count, aim) = (
  text(size: 9pt, fill: ink-mute)[#n],
  label,
  text(size: 9pt, fill: ink-soft)[#kind · #count],
  text(size: 9.5pt)[#aim],
  [], [], [], [],
)

#let rows = (
  ..row(1, "Mediterranean Blank", "Picture", 18, "30–25"),
  ..row(2, "Homer’s Greece: Places", "Map", 18, "20–15"),
  ..row(3, "The Ancient Mediterranean", "Map", 24, "20–15"),
  ..row(4, "World Map", "Picture", 18, "30–25"),
  ..row(5, "World Map: Harder", "Picture", 32, "30–25"),
  ..row(6, "The Trojan War", "Story", 18, "15–10"),
  ..row(7, "Trojan War Battlefield", "Picture", 16, "20–15"),
)

// ---- main table ----
#table(
  columns: cols,
  align: aligns,
  stroke: 0.6pt + rule,
  inset: (x: 6pt, y: 8pt),
  table.header(
    repeat: true,
    th[\#], th[Puzzle], th[Kind · tiles], th[Hard aim / min], th[Date met], th[Per min], th[Moves], th[Init.],
  ),
  ..rows
)

#v(0.6em)
#line(length: 100%, stroke: 0.5pt + rule)
#v(0.35em)
#text(size: 8.3pt, fill: ink-mute)[
  Aims count only in *Hard* mode. They are starting hypotheses, not pass/fail cutoffs — see your Standard Celeration Chart for how you're really trending. Rates are *tiles per minute* for picture and story puzzles and *places per minute* for map puzzles. #emph[Picture]: put the pieces of a picture back together. #emph[Map]: drag names onto a blank map. #emph[Story]: put the story cards in order. Generated from the menu list (#raw("puzzles/index.json")) — keep in sync if your class's puzzles change.
]
