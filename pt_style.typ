// pt_style.typ
// Shared visual identity for the Order the Tiles printables
// (student_achievement_tracker.typ). Adapted from the Precision Teaching
// Typing Webapp's pt_style.typ so the two trackers look like a set.
//
// Deliberately grayscale-only: no hue anywhere. These documents are meant to
// be photocopied on a typical office machine, so every distinction (probe
// tags, table headers, callouts) is built from black/white contrast and
// rules rather than color tints that can wash out on cheap toner.
//
// Usage in a document:
//   #import "pt_style.typ": *
//   #show: doc.with(kind: "Teacher's Guide", title: [...], subtitle: [...])
//   = A heading
//   ...

#let serif = "PT Serif"
#let sans = "PT Sans"

// ---- palette (grayscale only) ----
#let ink = luma(15)
#let ink-soft = luma(70)
#let ink-mute = luma(120)
#let ink-faint = luma(160)
#let band = luma(28) // near-black band fill: section heads, table headers, tags
#let panel = luma(246) // callout / panel background
#let panel-strong = luma(228) // group bands inside tables
#let rule-strong = luma(60)
#let rule = luma(195)
#let rule-light = luma(222)

// ---- small building blocks ----

#let kicker(body) = text(font: sans, size: 8.5pt, weight: "bold", fill: ink-mute, tracking: 1.7pt)[#upper(body)]

// A small solid tag, e.g. for marking probe/checkpoint rows. Solid fill
// reproduces reliably on any black-and-white copier, unlike a light tint.
#let tag(body) = box(fill: band, radius: 1.5pt, inset: (x: 4pt, y: 1pt))[
  #text(font: sans, size: 6.3pt, weight: "bold", fill: white, tracking: 0.6pt, baseline: -0.15em)[#upper(body)]
]

#let titleblock(kicker-text, title, subtitle: none, meta: none) = align(center)[
  #kicker(kicker-text)
  #v(10pt)
  #text(font: serif, size: 25pt, weight: "bold", fill: ink, hyphenate: false)[#title]
  #if subtitle != none [
    #v(7pt)
    #text(font: sans, size: 12pt, fill: ink-soft)[#subtitle]
  ]
  #v(11pt)
  #line(length: 38%, stroke: 0.75pt + rule-strong)
  #if meta != none [
    #v(8pt)
    #text(font: sans, size: 8.5pt, fill: ink-faint, tracking: 0.4pt)[#meta]
  ]
]

// Callout / principle box. `label` is shown as a bold tracked kicker line.
#let callout(label, body) = block(
  fill: panel,
  stroke: (left: 2.75pt + band),
  inset: (x: 13pt, y: 9.5pt),
  radius: 1.5pt,
  width: 100%,
  above: 1.1em,
  below: 1.1em,
)[
  #text(font: sans, weight: "bold", size: 8.5pt, fill: ink, tracking: 1.1pt)[#upper(label)]
  #v(4pt)
  #par(leading: 0.58em, justify: false)[#body]
]

// A fill-in-the-blank field (label above a rule) for cover-sheet style info.
#let field(label) = box(width: 100%)[
  #text(font: sans, size: 8pt, fill: ink-mute, tracking: 0.9pt)[#upper(label)]
  #v(2pt)
  #line(length: 100%, stroke: 0.6pt + rule)
]

// Table header cell: dark band, white bold small-caps-ish label.
#let th(body) = table.cell(fill: band)[
  #text(font: sans, fill: white, weight: "bold", size: 8.3pt, tracking: 0.3pt)[#body]
]

// A full-width group/category band inside a table (needs colspan from caller).
#let group-row(title, colspan: 1) = table.cell(
  colspan: colspan,
  fill: panel-strong,
  inset: (x: 8pt, y: 5.5pt),
)[#text(font: sans, weight: "bold", size: 8.8pt, fill: ink, tracking: 0.2pt)[#title]]

// ---- document shell ----
//
// kind: short label shown in the running header/footer, e.g. "Teacher's Guide".
// numbering-scheme: pass e.g. "1." to number level-1 headings, or leave
// `none` for an unnumbered document.
#let doc(
  kind: "",
  title: "",
  subtitle: none,
  meta: none,
  margins: (x: 1.25in, top: 1in, bottom: 0.95in),
  numbering-scheme: none,
  body,
) = {
  set document(title: title, author: "Order the Tiles")
  set page(
    paper: "us-letter",
    margin: margins,
    header: context [
      #if here().page() > 1 [
        #grid(
          columns: (1fr, 1fr),
          text(font: sans, size: 8pt, fill: ink-faint, tracking: 0.5pt)[#upper(kind)],
          align(right)[#text(font: sans, size: 8pt, fill: ink-faint, tracking: 0.5pt)[ORDER THE TILES]],
        )
        #v(-3pt)
        #line(length: 100%, stroke: 0.5pt + rule)
      ]
    ],
    footer: context [
      #line(length: 100%, stroke: 0.5pt + rule)
      #v(-2pt)
      #grid(
        columns: (1fr, 1fr),
        text(font: sans, size: 8pt, fill: ink-faint)[#title],
        align(right)[
          #text(font: sans, size: 8pt, fill: ink-faint)[
            Page #counter(page).display() of #counter(page).final().first()
          ]
        ],
      )
    ],
  )
  set text(font: serif, size: 11pt, fill: ink, lang: "en")
  set par(justify: true, leading: 0.62em, first-line-indent: 0pt)
  set heading(numbering: numbering-scheme)
  show heading.where(level: 1): it => context {
    let num = if it.numbering != none {
      counter(heading).display(it.numbering)
    }
    block(fill: band, width: 100%, inset: (x: 11pt, y: 7pt), radius: 1.5pt, above: 1.6em, below: 0.75em)[
      #set text(font: sans, fill: white, weight: "bold", size: 11.5pt, tracking: 0.4pt)
      #if num != none [#num #h(7pt)]
      #upper(it.body)
    ]
  }
  show raw: set text(font: "DejaVu Sans Mono", size: 0.92em)
  show link: set text(fill: ink)
  body
}
