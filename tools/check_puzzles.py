#!/usr/bin/env python3
"""Check the puzzle files and the menu list for mistakes.

    python3 tools/check_puzzles.py

puzzles/index.json is the menu: a list of puzzle ids in the order they
appear. This checks that every listed id has a puzzle file, that every
puzzle file is valid JSON with what its type needs, and that images exist.
It also names the puzzles that aren't on the menu (they still play from a
direct link, #/play/<id>). It changes nothing.
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


def add_to_menu(puzzle_id):
    """Append an id to the end of the menu list if it isn't already there."""
    ids = json.loads(INDEX.read_text(encoding="utf-8"))
    if puzzle_id in ids:
        return False
    ids.append(puzzle_id)
    INDEX.write_text(json.dumps(ids, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def check():
    errors = []
    try:
        ids = json.loads(INDEX.read_text(encoding="utf-8"))
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise ValueError("it should be a list of puzzle ids, like [\"trojan-war\", \"world-map\"]")
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"puzzles/index.json: {exc}", file=sys.stderr)
        return 1

    for puzzle_id in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"{puzzle_id}: listed more than once in index.json")
    for puzzle_id in ids:
        if not (PUZZLES / f"{puzzle_id}.json").is_file():
            errors.append(f"{puzzle_id}: listed in index.json, but puzzles/{puzzle_id}.json doesn't exist")

    files = sorted(p for p in PUZZLES.glob("*.json") if p != INDEX)
    for path in files:
        errors += [f"{path.name}: {problem}" for problem in check_puzzle(path)]

    off_menu = [p.stem for p in files if p.stem not in ids]
    print(f"{len(ids)} puzzle(s) on the menu.")
    if off_menu:
        print(f"Not on the menu (direct link only): {', '.join(off_menu)}")
    if errors:
        print("Problems:\n" + "\n".join(f"  {e}" for e in errors), file=sys.stderr)
        return 1
    print("No problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(check())
