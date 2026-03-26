"""Apply per-instrument normalization factors to track .rb files.

Instead of wrapping loops in with_fx :level (which ignores authored amp values),
this multiplies each amp: expression by the instrument's normalization factor.
The result: every instrument at amp: 0.3 produces the same perceived loudness.
The LLM author's amp values then directly control relative mix balance.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path


_MARKER = "# ~nf"


def _find_amp_expr_end(line: str, start: int) -> int:
    """Find where an amp: expression ends in a line.

    Tracks parenthesis/bracket depth so commas inside rrand(0.7, 1.0)
    are not mistaken for parameter separators.

    Args:
        line: The full line of code.
        start: Index right after 'amp: ' (start of the expression).

    Returns:
        Index of the first character after the expression.
    """
    i = start
    depth = 0
    while i < len(line):
        ch = line[i]
        if ch in "([":
            depth += 1
        elif ch in ")]":
            if depth > 0:
                depth -= 1
            else:
                return i
        elif ch == "," and depth == 0:
            rest = line[i + 1 :].lstrip()
            if re.match(r"\w+:", rest):
                return i
            # Trailing comma (line continuation) — expression ends here
            return i
        elif ch == "#":
            return i
        i += 1
    return len(line.rstrip())


def _is_multiply_only(expr: str) -> bool:
    """Check if expression is safe to append '* factor' without parens.

    Returns True if the expression has no + or - at depth 0 (top level).
    Multiplication is associative, so appending * factor is safe.
    """
    depth = 0
    for ch in expr:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        elif ch in "+-" and depth == 0:
            return False
    return True


def _apply_factor_to_line(line: str, factor: float) -> str:
    """Multiply the amp: expression in a line by a normalization factor."""
    m = re.search(r"amp:\s*", line)
    if not m:
        return line

    expr_start = m.end()
    expr_end = _find_amp_expr_end(line, expr_start)
    expr = line[expr_start:expr_end].strip()

    if not expr:
        return line

    # Build new expression
    if re.match(r"^[\w.]+$", expr):
        # Single variable or number: amp_val * 0.85
        new_expr = f"{expr} * {factor}"
    elif _is_multiply_only(expr):
        # Only multiplications at top level: safe to append
        new_expr = f"{expr} * {factor}"
    else:
        # Has +/- at top level: wrap in parens
        new_expr = f"({expr}) * {factor}"

    result = line[:expr_start] + new_expr + line[expr_end:]
    return result.rstrip() + f"  {_MARKER}"


def apply_normalization(
    track_path: str,
    norm_table: dict[str, float],
    output_path: str | None = None,
) -> str | None:
    """Apply per-instrument normalization factors to a track.

    For every synth/sample/play call with an amp: parameter, multiplies
    the amp expression by the instrument's normalization factor.

    Args:
        track_path: Path to the .rb track file.
        norm_table: {instrument_name: factor} normalization table.
                    Sample keys use "sample:name" format.
        output_path: Optional output path. If None, modifies in-place with .bak backup.

    Returns:
        Path to the written file, or None if no changes were made.
    """
    track_file = Path(track_path)
    track_name = track_file.stem
    code = track_file.read_text(encoding="utf-8")
    lines = code.split("\n")

    current_synth: str | None = None
    modified = 0
    result_lines: list[str] = []

    for line in lines:
        # Reset synth scope at loop boundaries
        if re.search(r"live_loop\s+:", line):
            current_synth = None

        # Track use_synth declarations
        m = re.search(r"use_synth\s+:(\w+)", line)
        if m:
            current_synth = m.group(1)

        # Skip already-normalized lines
        if _MARKER in line:
            result_lines.append(line)
            continue

        # Skip with_fx lines (might have amp: but not an instrument)
        if "with_fx" in line:
            result_lines.append(line)
            continue

        # Only process lines that have amp:
        if "amp:" not in line:
            result_lines.append(line)
            continue

        # Determine instrument for this line
        inst_name: str | None = None

        # Explicit synth :NAME call (not use_synth)
        m = re.search(r"(?<!use_)synth\s+:(\w+)", line)
        if m:
            inst_name = m.group(1)

        # sample :NAME call
        if not inst_name:
            m = re.search(r"sample\s+:(\w+)", line)
            if m:
                inst_name = f"sample:{m.group(1)}"

        # play call — use current use_synth
        if not inst_name and re.search(r"\bplay\b", line) and current_synth:
            inst_name = current_synth

        # Apply factor if we have instrument + factor
        if inst_name and inst_name in norm_table:
            factor = norm_table[inst_name]
            if abs(factor - 1.0) > 0.02:
                new_line = _apply_factor_to_line(line, factor)
                if new_line != line:
                    result_lines.append(new_line)
                    modified += 1
                    continue

        result_lines.append(line)

    if modified == 0:
        print(f"  [NORM] No changes needed for '{track_name}'")
        return None

    # Write output
    if output_path:
        out = Path(output_path)
    else:
        backup = track_file.with_suffix(".rb.bak")
        if not backup.exists():
            shutil.copy2(track_file, backup)
            print(f"  [NORM] Backup: {backup}")
        out = track_file

    new_code = "\n".join(result_lines)
    out.write_text(new_code, encoding="utf-8")
    print(f"  [NORM] Written: {out} ({modified} amp expressions normalized)")
    return str(out)


def revert_track(track_path: str) -> bool:
    """Revert a track to its pre-normalization backup."""
    track_file = Path(track_path)
    backup = track_file.with_suffix(".rb.bak")
    if backup.exists():
        shutil.copy2(backup, track_file)
        print(f"[REVERT] Restored {track_file} from {backup}")
        return True
    else:
        print(f"[REVERT] No backup found for {track_file}")
        return False
