# Motif System Research

Working doc for developing a unified melodic system across tracks.
Status: **Prototyping** — testing in `digging_in_the_markets.js` first.

## Problem Statement

Both music tracks (Late Night in Bb, Digging in the Markets) react to market direction but:
- No memorable melodic identity — melodies sound like random scale walking
- Market direction isn't instantly recognizable by ear
- Bass and melody don't reinforce each other's direction
- No shared DNA across tracks — switching tracks resets the listener's learned associations
- Melodies repeat verbatim per bar — no "musician playing around a theme" feel

## The Seed Motif

**`[1, 2, 3, 5]`** (scale degrees) — stepwise rise then a leap.

Why this shape:
- 3 steps + 1 leap = "reaching" feeling
- Asymmetric = clear direction (unlike [1,3,5,3] which goes nowhere)
- Only consonant intervals (2nds and a 3rd)
- Passes the hum test: "do re mi sol"
- Inversion `[5, 3, 2, 1]` (leap then stepwise fall) equally clear

In Bb pentatonic (0-indexed degrees for Strudel `.scale()`):
- Rising: `[0, 1, 2, 4]` = Bb, C, D, F
- Falling: `[4, 2, 1, 0]` = F, D, C, Bb

In G minor pentatonic:
- Rising: `[0, 1, 2, 4]` = G, A, Bb, D
- Falling: `[4, 2, 1, 0]` = D, Bb, A, G

## Four Dimensions

### 1. Direction (momentum sign)
- Positive → original motif `[1,2,3,5]`
- Negative → inversion `[5,3,2,1]`
- Flat → fragments that never complete: `[1,2,~,~]`, `[3,2,~,~]`

### 2. Magnitude (momentum abs) — how far sequences travel
- Low (< 0.35): motif stated once with space, gentle echo
- Medium (0.35–0.65): motif sequenced up/down 2 steps
- High (> 0.65): full ascending/descending sequence, every bar filled

### 3. Variation (cycle position) — "musician plays around the theme"
Over an 8-bar phrase cycle, the motif gets developed then returns home:

| Bar | Technique | Rising example | Effect |
|-----|-----------|---------------|--------|
| 1 | **Core motif** | `[0,1,2,4]` | Anchor — "here's the theme" |
| 2 | **Neighbour ornament** | `[0,1,3,2,4,~]` | Decoration, passing tone |
| 3 | **Sequence +1** | `[1,2,3,5]` | Develop, climb |
| 4 | **Extension** | `[2,3,4,6,5,4]` | Reach high, settle back |
| 5 | **Truncation** | `[0,1,2,~]` | Pull back, breathe |
| 6 | **Enclosure** | `[0,1,3,1,2,4]` | Sophisticated restatement |
| 7 | **Answer (retrograde)** | `[4,2,1,~]` | Respond to the motif |
| 8 | **Core motif (home)** | `[0,1,2,4]` | Resolution — back to anchor |

Principle: **depart and return**. Bars 1 and 8 are anchors. Bars 2-7 explore.

For falling, invert all patterns (flip scale degrees around the axis).

### 4. Intensity (heat / trade_rate) — density
- Low: only bars 1, 5, 8 have notes (rest is silence)
- Medium: bars 1, 3, 5, 7, 8 filled
- High: all 8 bars filled with full variations

## Magnitude × Variation Interaction

These aren't independent knobs — they're layers of the same system:
- Low magnitude + low intensity: bars 1 and 8 only, simple core motif
- High magnitude + high intensity: all 8 bars filled, sequences climb further, extensions reach wider

## Bass-Melody Coordination

Bass echoes the motif direction at half speed / lower register:
- Rising melody sequence → bass walks chord roots upward
- Falling melody sequence → bass walks roots downward
- Flat → bass holds pedal tones (root of current chord)

The sensation: small wave (melody) riding on big wave (bass), same direction.

## Implementation Notes

### Strudel specifics
- Use `.scale("Bb4:pentatonic")` / `.scale("G4:minor pentatonic")` with integer degrees
- 8-bar phrases via `<bar1 bar2 bar3 bar4 bar5 bar6 bar7 bar8>` cycling
- Variation is baked into the `<>` cycle, not computed per rebuild
- Magnitude selects which set of 8-bar patterns to use
- `degradeBy()` for intensity-based thinning rather than conditional silence

### Genre adaptation
The same motif shape works across tracks by changing:
- Instrument (piano vs Rhodes)
- Tempo (80 BPM vs 120 BPM)
- Articulation (legato vs short + heavy delay)
- Register (C5-G5 jazz vs Bb4-F5 lo-fi warmth)
- Rhythmic feel (straight vs swung)
- Scale type (full diatonic vs pentatonic)

## Track: Digging in the Markets (prototype — IMPLEMENTED)

Changes made:
- Replaced `melodyCode()` with 9 pre-composed 8-bar phrase sets (3 directions × 3 magnitudes)
- Each phrase uses `<>` cycling for 8-bar variation (previously 1-bar repeating)
- Seed motif `[0,1,2,4]` anchors bars 1 and 8 of each phrase
- Bars 2-7 use variation techniques (neighbour, sequence, extension, truncation, enclosure, answer)
- Flat phrases deliberately never complete the motif (no leap to degree 4) — indecision
- `onEvent` price_move also uses seed motif `[0,1,2,4]` / `[4,2,1,0]`
- IntBand controls embellishment (octave reinforcement at high intensity) rather than separate patterns
- Bass and keys unchanged for now — coordinate direction via existing momSign logic

### Observations after implementation
- Beats 3-4 of each bar are rests `[~ ~ ~ ~]` — the motif concentrates on beats 1-2 with delay/reverb filling the space. This is a lo-fi aesthetic choice
- 8-bar cycling means the melody won't repeat for 24 seconds (8 bars × 3s per bar) — much more variation than the old 1-bar loop
- The `<>` operator means Strudel manages the cycling deterministically — stable across rebuilds

## Track: Late Night in Bb (IMPLEMENTED)

Changes made:
- Replaced all 18 melody arrays (BB/GM × UP/DOWN/FLAT × 3 intBands) with 9 motif constants
- Switched from explicit note names to `.scale("Bb4:major")` / `.scale("G4:minor")` with degrees
- Same seed motif `[0,1,2,4]` as Digging — shared melodic DNA across both tracks
- Jazz phrasing via `@` weights in low-magnitude patterns (held notes, ballad feel)
- `melodyCode()` now selects scale from tone, pattern from direction × magnitude
- `onEvent` price_move uses seed motif via `.scale()` too
- IntBand embellishment: octave reinforcement at high intensity (7 degrees = diatonic octave)
- Bass patterns unchanged — still use explicit note names with melodicBand selection
- Net reduction: 154 insertions, 172 deletions (simpler code)

### Key difference from Digging
- Quarter-note phrasing (4 events/bar) vs Digging's sixteenth-note feel (16 events/bar)
- `@2` and `@3` weights in low-magnitude patterns for held jazz notes
- Diatonic scale (7 notes/octave) vs pentatonic (5 notes/octave)
- Degree 4 leap = perfect 5th (diatonic) vs major 6th (pentatonic)
- Octave embellishment uses `note(7)` (diatonic octave) vs `note(5)` (pentatonic octave)
