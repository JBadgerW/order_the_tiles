#!/usr/bin/env python3
"""Check the puzzle files and the menu list for mistakes.

    python3 tools/check_puzzles.py

puzzles/index.json is the menu: a list of entries like
{"id": "trojan-war", "visible": true}, in the order they appear. Entries
with "visible": false stay in the list but don't show on the menu. This
checks that every entry is well formed and has a puzzle file, that every
puzzle file is valid JSON with what its type needs, and that images exist.
It also names the hidden puzzles and the ones not listed at all (both
still play from a direct link, #/play/<id>). It changes nothing.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUZZLES = ROOT / "puzzles"
INDEX = PUZZLES / "index.json"

NEEDS = {"text": ["items"], "image": ["src", "rows", "cols"], "place": ["src", "features"]}


def check_puzzle(path):
    """Return a list of problems with one puzzle file."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"not valid JSON ({exc})"]
    kind = data.get("type")
    if kind not in NEEDS:
        return ['"type" must be "text", "image" or "place"']
    problems = [f'missing "{key}"' for key in ["title", *NEEDS[kind]] if key not in data]
    for key in ("src", "thumb"):
        if data.get(key) and not (PUZZLES / data[key]).is_file():
            problems.append(f'"{key}" image not found: puzzles/{data[key]}')
    return problems


def add_to_menu(puzzle_id, visible=True):
    """Append an entry to the end of the menu list if its id isn't already there."""
    entries = json.loads(INDEX.read_text(encoding="utf-8"))
    if any(e.get("id") == puzzle_id for e in entries):
        return False
    entries.append({"id": puzzle_id, "visible": visible})
    INDEX.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def check():
    errors = []
    try:
        entries = json.loads(INDEX.read_text(encoding="utf-8"))
        if not isinstance(entries, list):
            raise ValueError('it should be a list of entries, like [{"id": "trojan-war", "visible": true}]')
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"puzzles/index.json: {exc}", file=sys.stderr)
        return 1

    for n, entry in enumerate(entries, 1):
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            errors.append(f'index.json entry {n}: should look like {{"id": "trojan-war", "visible": true}}')
        elif not isinstance(entry.get("visible"), bool):
            errors.append(f'index.json entry {n} ({entry["id"]}): "visible" must be true or false')
    entries = [e for e in entries if isinstance(e, dict) and isinstance(e.get("id"), str)]
    ids = [e["id"] for e in entries]
    hidden = [e["id"] for e in entries if e.get("visible") is False]

    for puzzle_id in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"{puzzle_id}: listed more than once in index.json")
    for puzzle_id in ids:
        if not (PUZZLES / f"{puzzle_id}.json").is_file():
            errors.append(f"{puzzle_id}: listed in index.json, but puzzles/{puzzle_id}.json doesn't exist")

    files = sorted(p for p in PUZZLES.glob("*.json") if p != INDEX)
    for path in files:
        errors += [f"{path.name}: {problem}" for problem in check_puzzle(path)]

    off_menu = [p.stem for p in files if p.stem not in ids]
    print(f"{len(ids) - len(hidden)} puzzle(s) on the menu.")
    if hidden:
        print(f"Hidden (visible: false; direct link only): {', '.join(hidden)}")
    if off_menu:
        print(f"Not in index.json (direct link only): {', '.join(off_menu)}")
    if errors:
        print("Problems:\n" + "\n".join(f"  {e}" for e in errors), file=sys.stderr)
        return 1
    print("No problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(check())
