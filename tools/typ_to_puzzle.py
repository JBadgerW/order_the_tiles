#!/usr/bin/env python3
"""Turn the cells of a Typst #table(...) into a text puzzle.

Each [content] cell becomes one card, in the order it appears in the table,
so write the table in the correct order. Typst *bold* and _italic_ carry
over (the app renders them). Header cells inside table.header(...) are
skipped.

    python3 tools/typ_to_puzzle.py sources/trojan_war_outline_cards.typ \\
        --id trojan-war --title "The Trojan War" \\
        --description "From the wedding of Peleus and Thetis to the homecomings."

Writes puzzles/<id>.json and adds <id> to the end of the menu (puzzles/index.json)
if it isn't there yet. Pass --hidden to add it with "visible": false, so it
plays from a direct link but doesn't show on the menu.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_puzzles  # noqa: E402


def table_cells(source):
    """Return the text of each top-level [content] argument of #table(...)."""
    start = source.find("#table(")
    if start == -1:
        raise ValueError("no #table( found")
    i = start + len("#table(")
    depth = 1
    cells = []
    n = len(source)
    while i < n and depth > 0:
        ch = source[i]
        if source.startswith("//", i):
            i = source.find("\n", i)
            i = n if i == -1 else i
            continue
        if source.startswith("/*", i):
            i = source.find("*/", i)
            i = n if i == -1 else i + 2
            continue
        if ch == '"':
            i += 1
            while i < n and source[i] != '"':
                i += 2 if source[i] == "\\" else 1
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "[":
            end = matching_bracket(source, i)
            if depth == 1:
                cells.append(source[i + 1:end])
            i = end
        i += 1
    return cells


def matching_bracket(source, open_index):
    level = 0
    i = open_index
    while i < len(source):
        ch = source[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "[":
            level += 1
        elif ch == "]":
            level -= 1
            if level == 0:
                return i
        i += 1
    raise ValueError("unbalanced [ in table")


def clean(cell):
    text = re.sub(r"\s+", " ", cell).strip()
    # Typst escapes like \# or \$ become the plain character.
    return re.sub(r"\\([#$@<>\[\]\\])", r"\1", text)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("typ", type=Path)
    parser.add_argument("--id", required=True, help="file name / URL id, e.g. trojan-war")
    parser.add_argument("--title", required=True)
    parser.add_argument("--description")
    parser.add_argument("--hidden", action="store_true",
                        help='add it to index.json with "visible": false (direct link only)')
    args = parser.parse_args()

    items = [c for c in (clean(c) for c in table_cells(args.typ.read_text(encoding="utf-8"))) if c]
    if len(items) < 2:
        sys.exit(f"Found only {len(items)} card(s) in {args.typ}; nothing to order.")

    puzzle = {"title": args.title, "type": "text"}
    if args.description:
        puzzle["description"] = args.description
    puzzle["source"] = args.typ.as_posix()
    puzzle["items"] = items

    out = check_puzzles.PUZZLES / f"{args.id}.json"
    out.write_text(json.dumps(puzzle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(check_puzzles.ROOT)} with {len(items)} cards.")
    if check_puzzles.add_to_menu(args.id, visible=not args.hidden):
        where = "as hidden (visible: false)" if args.hidden else "to the end of the menu"
        print(f"Added {args.id} {where} in puzzles/index.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
