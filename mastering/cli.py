"""CLI entry point for the mastering pipeline.

Per-instrument normalization approach:
1. Discover all unique synths/samples across all tracks
2. Record each one playing a single note at a reference amp
3. Measure LUFS — this is the instrument's intrinsic loudness
4. Compute a normalization factor per instrument (target = median LUFS)
5. Multiply every amp: expression in the tracks by the factor

Result: all instruments at amp: 0.3 produce the same perceived loudness.
The LLM author's amp values then directly control relative mix balance.
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from mastering.instruments import extract_instruments, Instrument
from mastering.recorder import MasteringRecorder
from mastering.analyzer import analyze_wav
from mastering.apply import apply_normalization, revert_track


# Factor bounds — prevent extreme corrections
MAX_BOOST = 5.0   # +14 dB max boost
MAX_CUT = 0.1     # -20 dB max cut
# Skip factors close to unity
SKIP_THRESHOLD = 0.02


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mastering",
        description="Normalize Sonic Pi instrument loudness so amp: values "
                    "directly control relative mix balance.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--track", type=str,
                       help="Normalize a single track (e.g. poolside)")
    group.add_argument("--all", action="store_true",
                       help="Normalize all tracks in sonic_pi/")
    group.add_argument(
        "--revert", type=str, nargs="?", const="__all__",
        help="Revert track(s) to pre-normalization backup.",
    )
    parser.add_argument("--duration", type=float, default=5.0,
                        help="Recording duration per instrument (default: 5s)")
    parser.add_argument("--skip-record", action="store_true",
                        help="Skip recording, reuse existing WAVs")
    parser.add_argument("--no-apply", action="store_true",
                        help="Build normalization table only, don't modify tracks")
    parser.add_argument("--output-dir", type=str, default="mastering_output",
                        help="Output directory (default: mastering_output)")
    parser.add_argument("--track-dir", type=str, default="sonic_pi",
                        help="Directory containing .rb track files (default: sonic_pi)")
    return parser.parse_args()


def discover_all_instruments(
    track_dir: Path,
) -> tuple[dict[str, Instrument], dict[str, dict[str, list[str]]]]:
    """Discover all unique instruments across all tracks.

    Returns:
        (all_instruments, per_track_info)
        - all_instruments: {name: Instrument} deduplicated across tracks
        - per_track_info: {track_path: {loop_name: [instrument_names]}}
    """
    all_instruments: dict[str, Instrument] = {}
    per_track: dict[str, dict[str, list[str]]] = {}

    for rb_file in sorted(track_dir.glob("*.rb")):
        _, loop_instruments, instruments = extract_instruments(str(rb_file))
        per_track[str(rb_file)] = loop_instruments
        for inst in instruments:
            if inst.name not in all_instruments:
                all_instruments[inst.name] = inst

    return all_instruments, per_track


def compute_normalization(
    loudness_table: dict[str, float],
    max_boost: float = MAX_BOOST,
    max_cut: float = MAX_CUT,
) -> dict[str, float]:
    """Compute per-instrument normalization factors.

    Target = median LUFS of all valid instruments. This minimizes the
    total magnitude of corrections.

    Args:
        loudness_table: {instrument_name: measured_lufs}
        max_boost: Maximum boost factor (default 5.0 = +14 dB)
        max_cut: Minimum cut factor (default 0.1 = -20 dB)

    Returns:
        {instrument_name: factor} where factor * amp gives normalized loudness.
    """
    # Filter out silence / broken instruments
    valid = {k: v for k, v in loudness_table.items() if v > -70}
    if not valid:
        return {}

    # Target = median LUFS
    target = statistics.median(valid.values())

    factors: dict[str, float] = {}
    for name, lufs in valid.items():
        correction_db = target - lufs
        factor = 10.0 ** (correction_db / 20.0)
        factor = max(max_cut, min(factor, max_boost))
        factors[name] = round(factor, 2)

    return factors


async def main():
    args = parse_args()
    track_dir = Path(args.track_dir)

    # --- Revert mode ---
    if args.revert is not None:
        if args.revert == "__all__":
            for rb in sorted(track_dir.glob("*.rb")):
                revert_track(str(rb))
        else:
            revert_track(str(track_dir / f"{args.revert}.rb"))
        return

    # --- Discover tracks to process ---
    if args.track:
        target_track = track_dir / f"{args.track}.rb"
        if not target_track.exists():
            print(f"Track not found: {target_track}")
            return
        apply_tracks = [target_track]
    else:
        apply_tracks = sorted(track_dir.glob("*.rb"))

    # --- Step 1: Discover ALL instruments across ALL tracks ---
    # (global table ensures consistency — piano gets the same factor everywhere)
    print("Discovering instruments across all tracks...")
    all_instruments, per_track = discover_all_instruments(track_dir)

    print(f"\nFound {len(all_instruments)} unique instruments:")
    for name in sorted(all_instruments):
        # Find which tracks use this instrument
        tracks_using = []
        for tp, loops in per_track.items():
            for loop_name, inst_names in loops.items():
                if name in inst_names:
                    tracks_using.append(Path(tp).stem)
                    break
        print(f"  {name:30} used by: {', '.join(tracks_using)}")

    inst_dir = Path(args.output_dir) / "_instruments"
    inst_dir.mkdir(parents=True, exist_ok=True)

    # --- Step 2: Record each unique instrument ---
    recorder = None
    if not args.skip_record:
        recorder = MasteringRecorder(output_dir=args.output_dir)
        await recorder._ensure_booted()

    try:
        if not args.skip_record:
            print(f"\nRecording {len(all_instruments)} instruments...")
            for inst in all_instruments.values():
                wav_path = inst_dir / f"{inst.safe_name}.wav"
                print(f"\n  Recording {inst.name}...")
                await recorder.record_instrument(inst.test_code, wav_path, args.duration)

        # --- Step 3: Analyze ---
        print(f"\nAnalyzing instrument loudness...")
        loudness_table: dict[str, float] = {}

        for inst in all_instruments.values():
            wav_path = inst_dir / f"{inst.safe_name}.wav"
            if not wav_path.exists():
                print(f"  {inst.name:30} NO RECORDING")
                continue
            analysis = analyze_wav(str(wav_path), "_global", inst.name)
            loudness_table[inst.name] = analysis.integrated_lufs
            print(f"  {inst.name:30} {analysis.integrated_lufs:>7.1f} LUFS  "
                  f"Peak: {analysis.peak_db:>6.1f} dB")

        if not loudness_table:
            print("No analysis results.")
            return

        # --- Step 4: Compute normalization factors ---
        valid = {k: v for k, v in loudness_table.items() if v > -70}
        if not valid:
            print("All instruments below -70 LUFS, nothing to normalize.")
            return

        target = statistics.median(valid.values())
        norm_table = compute_normalization(loudness_table)

        print(f"\n{'='*60}")
        print(f"Normalization Table  (target: {target:.1f} LUFS)")
        print(f"{'='*60}")
        print(f"  {'Instrument':30} {'LUFS':>8}  {'Factor':>8}  {'dB':>7}  Note")

        for name in sorted(norm_table, key=lambda n: loudness_table.get(n, -999), reverse=True):
            factor = norm_table[name]
            lufs = loudness_table[name]
            db = 20 * (factor and __import__('math').log10(factor) or 0)
            note = ""
            if factor >= MAX_BOOST:
                note = "(capped boost)"
            elif factor <= MAX_CUT:
                note = "(capped cut)"
            elif abs(factor - 1.0) <= SKIP_THRESHOLD:
                note = "(~unity, skipped)"
            print(f"  {name:30} {lufs:>7.1f}  x{factor:>6.2f}  {db:>+6.1f}  {note}")

        # Save normalization table
        table_data = {
            "target_lufs": round(target, 1),
            "instrument_loudness": {k: round(v, 1) for k, v in loudness_table.items()},
            "normalization_factors": norm_table,
        }
        table_path = Path(args.output_dir) / "normalization_table.json"
        table_path.parent.mkdir(parents=True, exist_ok=True)
        table_path.write_text(json.dumps(table_data, indent=2), encoding="utf-8")
        print(f"\n  Saved: {table_path}")

        # --- Step 5: Apply to tracks ---
        if not args.no_apply:
            print(f"\nApplying normalization to {len(apply_tracks)} track(s)...")
            for track_path in apply_tracks:
                print(f"\n  --- {track_path.stem} ---")
                apply_normalization(str(track_path), norm_table)
        else:
            print("\n  --no-apply: skipping track modification")

    finally:
        if recorder:
            await recorder.shutdown()

    print(f"\n{'='*60}")
    print("Done. Use --revert to undo.")
    print(f"{'='*60}")
