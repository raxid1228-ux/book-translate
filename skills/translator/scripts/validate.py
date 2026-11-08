#!/usr/bin/env python3
"""Validate the page-based PDF translation output structure."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

PAGE_PATTERN = re.compile(r"^page-(\d{4,})$")
REQUIRED_MARKERS = ("target_language: \"ug\"", "uyghur-rtl")


def validate(output_dir: Path) -> list[str]:
    errors: list[str] = []
    originals_dir = output_dir / "original_pages"
    drafts_dir = output_dir / "translation_drafts"
    translated_dir = output_dir / "translated_pages"
    css_file = output_dir / "_assets" / "uyghur-rtl.css"

    if not originals_dir.is_dir():
        return [f"Original pages directory is missing: {originals_dir}"]

    original_pages = sorted(
        (path for path in originals_dir.iterdir() if path.is_dir() and PAGE_PATTERN.fullmatch(path.name)),
        key=lambda path: int(path.name[5:]),
    )
    if not original_pages:
        errors.append("No page folders found under original_pages/.")

    for page_dir in original_pages:
        name = page_dir.name
        page_pdf = page_dir / f"{name}.pdf"
        source_text = page_dir / "source.txt"
        if not page_pdf.is_file() or page_pdf.stat().st_size == 0:
            errors.append(f"{name}: missing or empty page PDF ({page_pdf}).")
        if not source_text.is_file():
            errors.append(f"{name}: extracted source text file is missing ({source_text}).")

        draft = drafts_dir / f"{name}.md"
        translated = translated_dir / name / f"{name}.md"
        if not draft.is_file() or not draft.read_text(encoding="utf-8").strip():
            errors.append(f"{name}: missing or empty translation draft ({draft}).")
        if not translated.is_file():
            errors.append(f"{name}: translated Markdown file is missing ({translated}).")
            continue

        markdown = translated.read_text(encoding="utf-8")
        if not markdown.strip():
            errors.append(f"{name}: translated Markdown file is empty.")
            continue
        if not markdown.startswith("---\n"):
            errors.append(f"{name}: YAML frontmatter is missing.")
        for marker in REQUIRED_MARKERS:
            if marker not in markdown:
                errors.append(f"{name}: required frontmatter marker is missing: {marker}")
        if not re.search(rf"(?m)^page:\s*{int(name[5:])}\s*$", markdown):
            errors.append(f"{name}: frontmatter page number does not match the page folder.")

    if not css_file.is_file():
        errors.append(f"Obsidian RTL stylesheet is missing: {css_file}")
    elif "UKIJ Tuz" not in css_file.read_text(encoding="utf-8"):
        errors.append("Obsidian RTL stylesheet does not specify the UKIJ Tuz font.")

    if drafts_dir.is_dir():
        for draft in drafts_dir.glob("page-*.md"):
            if PAGE_PATTERN.fullmatch(draft.stem) and draft.stem not in {page.name for page in original_pages}:
                errors.append(f"Translation draft has no matching source page: {draft}")
    if translated_dir.is_dir():
        for translated_page_dir in translated_dir.iterdir():
            if translated_page_dir.is_dir() and PAGE_PATTERN.fullmatch(translated_page_dir.name):
                if translated_page_dir.name not in {page.name for page in original_pages}:
                    errors.append(f"Translated folder has no matching source page: {translated_page_dir}")
                elif not (translated_page_dir / f"{translated_page_dir.name}.md").is_file():
                    errors.append(f"Translated Markdown file is missing: {translated_page_dir / (translated_page_dir.name + '.md')}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path, help="PDF translation output directory")
    args = parser.parse_args()
    output_dir = args.output_dir.expanduser().resolve()
    errors = validate(output_dir)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1
    print(f"Validation passed: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
