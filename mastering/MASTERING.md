# Mastering Pipeline — Per-Instrument Normalization

## Problem

Each Sonic Pi synth and sample has wildly different intrinsic loudness at the same `amp:` value — e.g. `:sine` at `amp: 0.3` measures -27 LUFS, while `:hollow` at `amp: 0.3` measures -49 LUFS. That's a 22 dB gap. This means the LLM author can't reason about relative volume — `amp: 0.3` on piano sounds completely different from `amp: 0.3` on hollow.

## Solution: Per-Instrument Normalization Factors

The pipeline measures each instrument's intrinsic loudness, computes a normalization factor, and multiplies it into every `amp:` expression in the track. After normalization, all instruments at `amp: 0.3` produce the same perceived loudness (LUFS). The author's `amp:` values then directly control relative mix balance.

### Example

Before normalization:
```ruby
sample :bd_haus, amp: amp_val, cutoff: 80     # very loud intrinsically
play notes, amp: amp_val, attack: 1.5          # use_synth :hollow — very quiet intrinsically
```

After normalization:
```ruby
sample :bd_haus, amp: amp_val * 0.4, cutoff: 80     # ~nf  (cut: bd_haus is loud)
play notes, amp: amp_val * 2.5, attack: 1.5          # ~nf  (boost: hollow is quiet)
```

Now both lines at `amp_val = 0.3` produce the same perceived loudness. The author controls relative balance by setting different amp values — no need to guess at intrinsic loudness differences.

## How It Works

### Pipeline

```
python -m mastering --all              # full run: record + analyze + apply
python -m mastering --all --no-apply   # just build the normalization table
python -m mastering --all --skip-record  # reuse existing WAVs
python -m mastering --revert           # restore all tracks from .bak
python -m mastering --revert NAME      # restore one track
```

**Step 1 — Discover instruments** (`instruments.py`):
Scans ALL `.rb` tracks, finds every unique `use_synth :name` / `synth :name` / `sample :name`. The normalization table is global — piano gets the same factor regardless of which track uses it.

**Step 2 — Record each instrument** (`recorder.py`):
Boots Sonic Pi headless, plays each unique instrument once at reference amp (0.3), records to WAV. Stored in `mastering_output/_instruments/`.

**Step 3 — Analyze** (`analyzer.py`):
Measures integrated LUFS (ITU-R BS.1770 via pyloudnorm) for each instrument WAV.

**Step 4 — Compute normalization factors** (`cli.py`):
Target = median LUFS of all valid instruments. For each instrument:
- `factor = 10^((target - measured_lufs) / 20)`
- Capped to [0.1, 5.0] (−20 dB to +14 dB)
- Factors within 0.02 of 1.0 are skipped

**Step 5 — Apply** (`apply.py`):
For each `synth :NAME, amp: EXPR` / `sample :NAME, amp: EXPR` / `play ..., amp: EXPR`:
- Determines the instrument (explicit name or tracked `use_synth`)
- Multiplies the amp expression by the factor
- Marks the line with `# ~nf` (normalization factor applied)
- Creates `.rb.bak` backup before modifying

### Amp Expression Handling

The parser handles all expression patterns found in the tracks:

| Pattern | Transformation |
|---------|---------------|
| `amp: 0.18` | `amp: 0.18 * 0.85` |
| `amp: amp_val` | `amp: amp_val * 0.85` |
| `amp: amp_val * 0.5` | `amp: amp_val * 0.5 * 0.85` |
| `amp: 0.18 * (0.5 + frac)` | `amp: 0.18 * (0.5 + frac) * 0.85` |
| `amp: 0.08 + (h * 0.15)` | `amp: (0.08 + (h * 0.15)) * 0.6` |

Rules:
- Single token or multiply-only expressions: append `* factor`
- Expressions with `+`/`-` at top level: wrap in parens first
- Nested parens in function calls (e.g., `rrand(0.7, 1.0)`) are handled correctly
- `with_fx` lines are skipped (not instrument calls)
- Variable assignments (e.g., `vol = 0.08 + ...`) are skipped (no `amp:` keyword)
- Lines already marked `# ~nf` are skipped (idempotent re-runs)

### Normalization Table

Saved to `mastering_output/normalization_table.json`:
```json
{
  "target_lufs": -37.5,
  "instrument_loudness": {"piano": -37.7, "sine": -26.6, ...},
  "normalization_factors": {"piano": 0.97, "sine": 0.28, "hollow": 2.51, ...}
}
```

## Measured Instrument Loudness (at amp: 0.3)

| Instrument | LUFS | Category |
|---|---|---|
| sine | -26.6 to -31.9 | Loud (varies by track BPM) |
| sample:bd_haus | -30.4 to -37.4 | Loud |
| tb303 | -34.4 to -35.4 | Medium |
| saw | -34.9 to -36.1 | Medium |
| sample:drum_tom_lo_hard | -35.8 | Medium |
| sample:drum_cymbal_open | -36.6 | Medium |
| sample:sn_dub | -37.1 | Medium |
| piano | -37.7 to -39.0 | Medium |
| sample:drum_cowbell | -33.6 | Medium |
| blade | -39.6 | Medium-Quiet |
| sample:drum_cymbal_hard | -40.1 | Medium-Quiet |
| sample:bd_fat | -43.4 | Quiet |
| sample:drum_cymbal_soft | -44.8 | Quiet |
| sample:drum_cymbal_closed | -46.2 | Quiet |
| pluck | -46.4 | Quiet |
| hollow | -46.8 to -49.2 | Quiet |
| dark_ambience | -61.0 | Very Quiet |
| sample:vinyl_hiss | -64.4 | Very Quiet |
| zpad | -120.0 | Broken (doesn't exist in Sonic Pi 4.6) |

## CLI Reference

```
python -m mastering --all              # normalize all tracks
python -m mastering --track NAME       # normalize one track
python -m mastering --revert           # restore all from .bak
python -m mastering --revert NAME      # restore one track

Options:
  --duration SECS        Recording duration per instrument (default: 5)
  --skip-record          Reuse existing WAVs
  --no-apply             Build table only, don't modify tracks
  --output-dir DIR       Output directory (default: mastering_output)
  --track-dir DIR        Directory with .rb files (default: sonic_pi)
```

## Files

| File | Purpose |
|---|---|
| `mastering/cli.py` | CLI + global normalization table computation |
| `mastering/apply.py` | Per-line amp factor injection |
| `mastering/instruments.py` | Extracts instruments, generates test snippets |
| `mastering/recorder.py` | Records via Sonic Pi headless |
| `mastering/analyzer.py` | LUFS/RMS/spectral analysis |
| `mastering/parser.py` | Parses .rb track files |
| `mastering/solo_gen.py` | Generates per-loop solo snippets (unused by current pipeline) |
| `mastering/reporter.py` | Balance reports (unused by current pipeline) |

## Dependencies

```
# requirements-mastering.txt
pyloudnorm>=0.1.0
librosa>=0.10.0
soundfile>=0.12.0
numpy>=1.24.0
```

## Known Issues

- **`:zpad` synth doesn't exist** in Sonic Pi 4.6. Records as silence, excluded from normalization (below -70 LUFS).
- **LUFS varies slightly by BPM** — `use_bpm` affects timing, causing ~1-2 dB variance. The global table records without BPM context.
- **Samples could be analyzed from disk** instead of recording through Sonic Pi. Not implemented yet.
- **Factor cap limits very quiet instruments** — `dark_ambience` and `vinyl_hiss` are capped at 5.0x (+14 dB). At `amp: 0.3` they'll still be quieter than other instruments. The LLM author may need higher amp values for these.
