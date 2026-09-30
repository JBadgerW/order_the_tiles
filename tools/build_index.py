#!/usr/bin/env python3
"""Rebuild puzzles/index.json from the puzzle files in puzzles/.

The menu reads index.json because a static host (like GitHub Pages) can't
list a folder. Run this after adding, removing, or renaming a puzzle:

    python3 tools/build_index.py

Menu order: puzzles with an "order" number come first (lowest first),
then the rest alphabetically by title.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUZZLES = ROOT / "puzzles"


def entry_for(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    kind = data.get("type")
    if kind == "text":
        count = len(data["items"])
    elif kind == "image":
        count = data["rows"] * data["cols"]
    else:
        raise ValueError(f'{path.name}: "type" must be "text" or "image"')

    entry = {
        "id": path.stem,
        "title": data.get("title", path.stem),
        "type": kind,
        "count": count,
    }
    if data.get("description"):
        entry["description"] = data["description"]
    if kind == "image":
        entry["thumb"] = data.get("thumb", data["src"])
    if "order" in data:
        entry["order"] = data["order"]
    return entry


def build():
    entries = []
    errors = []
    for path in sorted(PUZZLES.glob("*.json")):
        if path.name == "index.json":
            continue
        try:
            entries.append(entry_for(path))
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            errors.append(f"  {path.name}: {exc}")

    entries.sort(key=lambda e: (e.get("order", float("inf")), e["title"].lower()))
    (PUZZLES / "index.json").write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote puzzles/index.json with {len(entries)} puzzle(s).")
    if errors:
        print("Skipped files with problems:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(build())
