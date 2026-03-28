# Writing Tracks

Tracks are JavaScript files in `frontend/tracks/` that use Strudel (`@strudel/web` + `@strudel/soundfonts`) to generate audio in the browser. Each track is an object that receives market data and produces audio via one of two modes.

## Track Modes

### Evaluate mode (preferred for faithful strudel.cc reproduction)

The track provides an `evaluateCode(data)` method that returns a strudel code **string**. The audio engine passes it to strudel's `evaluate()` function — the same code path strudel.cc's REPL uses. This handles `$:` pattern labels, `setcpm()`, `.orbit()` isolation, and the transpiler identically.

```javascript
const myTrack = {
  name: "my_track",
  label: "My Track",
  category: "music",

  init() {},

  evaluateCode(data) {
    // Return raw strudel code — identical to what you paste into strudel.cc.
    // Use string interpolation to inject data values.
    return `
      setcpm(30);
      $: note("c4 e4 g4").s("piano").gain(${0.2 + (data.heat || 0.3) * 0.3})
      $: s("bd sd bd sd").gain(0.3).orbit(1)
    `;
  },

  onEvent() { return null; },
};

audioEngine.registerTrack("my_track", myTrack);
```

### Pattern mode (legacy)

The track provides a `pattern(data)` method that returns a Strudel Pattern object directly. Simpler but doesn't support `$:`, `setcpm()`, or `.orbit()` — patterns must be combined with `stack().cpm()`.

```javascript
const myTrack = {
  name: "my_track",
  label: "My Track",
  category: "music",

  init() {},

  pattern(data) {
    const h = data.heat || 0.3;
    return stack(
      note("<c2 c2 f2 g2>").sound("sawtooth").lpf(400).gain(0.3 + h * 0.2),
      sound("bd_fat").struct("x ~ x ~").gain(0.4),
    ).cpm(20);
  },

  onEvent(type, msg, data) {
    if (type === "spike") return sound("drum_cymbal_soft").gain(0.1).room(0.6);
    return null;
  },
};

audioEngine.registerTrack("my_track", myTrack);
```

**Key principle: patterns are regenerated, not mutated.** Both modes are called fresh every 3 seconds with new data.

**Critical rules for stable, musical output:**

1. **Never use `Math.random()`** in `pattern()`. JS randomness produces different values on each 3-second rebuild, making the music chaotic. Use Strudel's cycle-deterministic randomness instead: `degradeBy()`, `rand.range()`, `sometimes()`.

2. **Use `<>` mini-notation for progressions**, not JS counters. `note("<a2 a2 f2 g2>")` cycles one value per bar based on the Strudel cycle position — stable across rebuilds.

3. **`struct()` already defines subdivision.** A 16-element struct gives 16th notes natively. Do NOT add `fast()` on top of struct patterns — that creates 64th notes.

4. **Use data values only for parameters** (gain, filter cutoff) and structural decisions (which layers to include). The pattern *structure* (rhythms, note sequences) should be Strudel mini-notation, not JS-computed.

## Data Received

The `pattern(data)` method receives:
```javascript
{
  heat: 0.0-1.0,        // Composite market activity (sensitivity-adjusted)
  price: 0.0-1.0,       // Current market price
  price_delta: -1.0-1.0, // Signed per-cycle (3s) price change (sensitivity-adjusted)
  price_move: -1.0-1.0,  // Edge-detected price change (30s window, only non-zero during active movement)
  velocity: 0.0-1.0,     // Price velocity (sensitivity-adjusted)
  trade_rate: 0.0-1.0,   // Trades per minute (sensitivity-adjusted)
  spread: 0.0-1.0,       // Bid-ask spread (sensitivity-adjusted)
  tone: 0|1,             // 1=bullish/major, 0=bearish/minor
  sensitivity: 0.0-1.0   // Raw sensitivity value (optional use)
}
```

Activity metrics are **pre-adjusted by the user's sensitivity setting**.

## Events

The `onEvent(type, msg, data)` method handles one-shot events:
- `type === 'spike'` — Heat delta exceeded threshold
- `type === 'price_move'` — `msg.direction` is `1` (up) or `-1` (down)
- `type === 'resolved'` — `msg.result` is `1` (Yes won) or `-1` (No won)

Return a Strudel Pattern to layer on top of the current pattern, or `null` for no response.

## Track Metadata

Add metadata as comments at the top of the file for the server to parse:
```javascript
// category: 'music', label: 'My Track Name'
```

## Adding a New Track

Tracks are **auto-discovered and dynamically loaded** — no `index.html` changes needed:
1. Create `frontend/tracks/yourname.js` with the metadata comment and `registerTrack()` call
2. Restart the server (it scans `frontend/tracks/` on startup)
3. The browser loads track scripts dynamically based on the server's discovered list

## Music Utilities

`audio-engine.js` provides helpers (independent of Strudel):
- `getScaleNotes(root, scaleType, count, octaves)` — Get scale notes
- `midiToNote(midi)` / `noteToMidi(note)` — Convert between MIDI numbers and note names (`C#4`, `Bb3`)
- `midiToHz(midi)` — Convert MIDI note to Hz. **Use this for all filter cutoff values** (MIDI note numbers, not Hz)
- `noteToStrudel(noteName)` — Convert standard notation to Strudel format (`C#4` → `cs4`, `Bb3` → `bb3`)
- `SCALES` — `{major, minor, major_pentatonic, minor_pentatonic, major7, minor7, m7minus5}` interval arrays

## Sounds

Tracks use Strudel's built-in oscillators, sampled instruments, and multiple loaded sample libraries:

1. **Salamander Grand Piano** (`"piano"`) — Multi-velocity acoustic grand piano from CDN
2. **Dirt-Samples** — 200+ sample banks from TidalCycles (drums, cymbals, percussion)
3. **uzu-drumkit** — Default drum sounds: `bd`, `sd`, `hh`, `oh`, `cr`, `rd` (ride), `rim` (rimshot), `cp`, `cb`, `ht`, `mt`, `lt`
4. **VCSL** — Orchestral percussion (CC0 license)
5. **Tidal Drum Machines** — Classic drum machine samples (TR-808, LinnDrum, etc.)
6. **GM Soundfonts** (`"gm_*"`) — 128 General MIDI instruments via `@strudel/soundfonts` (loaded from webaudiofontdata CDN on demand)

```javascript
note("c4 e4 g4").sound("piano").gain(0.3).room(0.5)        // acoustic piano
note("c2 e2 a2").sound("gm_acoustic_bass").gain(0.3)       // GM upright bass
note("<c2 f2>").sound("sawtooth").lpf(200).gain(0.1)        // synth oscillator
sound("rd").gain(0.25)                                       // ride cymbal (uzu-drumkit)
sound("cr:0").speed(0.95).gain(0.06).end(0.3)               // crash cymbal (Dirt-Samples)
```

## Sound Reference

### Sampled Instruments (acoustic)

| Sound | Usage | Notes |
| --- | --- | --- |
| `"piano"` | `.sound("piano")` | Salamander Grand Piano (CDN). Multi-velocity, ~3 semitones per sample |
| `"gm_acoustic_bass"` | `.sound("gm_acoustic_bass")` | GM upright bass soundfont. Use with `note()` for walking bass lines |
| `"gm_epiano1"` | `.sound("gm_epiano1")` | GM Rhodes-style electric piano |
| `"gm_vibraphone"` | `.sound("gm_vibraphone")` | GM vibraphone |
| `"gm_tenor_sax"` | `.sound("gm_tenor_sax")` | GM tenor saxophone |

### Drum Samples (Dirt-Samples + uzu-drumkit)

| Sound | Source | Usage | Notes |
| --- | --- | --- | --- |
| `"bd"` | uzu-drumkit / Dirt | `.sound("bd")` | Kick drum (Dirt-Samples has 24 variants via `bd:0`–`bd:23`) |
| `"sd"` | uzu-drumkit / Dirt | `.sound("sd")` | Snare drum |
| `"hh"` | uzu-drumkit / Dirt | `.sound("hh")` | Closed hi-hat |
| `"oh"` | uzu-drumkit / Dirt | `.sound("oh")` | Open hi-hat |
| `"rd"` | uzu-drumkit | `.sound("rd")` | **Ride cymbal**. Default strudel ride |
| `"rim"` | uzu-drumkit | `.sound("rim")` | **Rimshot / cross-stick** |
| `"cr"` | uzu-drumkit / Dirt | `.sound("cr")` | Crash cymbal (Dirt-Samples has 6 variants `cr:0`–`cr:5`) |
| `"cp"` | uzu-drumkit / Dirt | `.sound("cp")` | Hand clap |
| `"cb"` | uzu-drumkit / Dirt | `.sound("cb")` | Cowbell |
| `"ho"` | `.sound("ho")` | Open hi-hat (6 variants) |
| `"cc"` | `.sound("cc")` | Crash cymbal (6 variants) |
| `"cb"` | `.sound("cb")` | Cowbell |

### Oscillators (synthetic)

| Sound | Usage | Notes |
| --- | --- | --- |
| `"sine"` | `.sound("sine")` | Pure sine. Good for sub bass |
| `"sawtooth"` | `.sound("sawtooth")` | Saw wave. Good for bass lines, pads with `.lpf()` |
| `"triangle"` | `.sound("triangle")` | Triangle wave. Good for plucks, arps, pads |
| `"pink"` | `.sound("pink")` | Pink noise synth. Good for vinyl hiss / texture |
## Strudel Effects Reference

| Effect | Usage | Notes |
| --- | --- | --- |
| Low-pass filter | `.lpf(hz)` | Use `midiToHz()` if converting from MIDI note numbers |
| High-pass filter | `.hpf(hz)` | |
| Reverb | `.room(amount)`, `.rsize(size)` | `room` = wet mix, `rsize` = decay time |
| Delay/echo | `.delay(wet)`, `.delaytime(s)`, `.delayfeedback(fb)` | |
| Pan | `.pan(value)` | 0=left, 0.5=center, 1=right |
| Envelope | `.attack(s)`, `.release(s)` | |
| Filter resonance | `.lpq(value)` | |

## Strudel Pattern Basics

Common patterns used in existing tracks:

```javascript
// ── Basic patterns ──
note("c3 e3 g3").sound("sine").gain(0.2)       // synth notes
sound("bd_fat").speed(0.85).lpf(370).gain(0.3)  // sample trigger
note("c4 e4 g4").sound("piano").room(0.3)        // sampled piano

// ── Stack layers ──
stack(
  sound("bd_fat").struct("x ~ x ~").gain(0.4),
  sound("sn_dub").struct("~ x ~ ~").gain(0.15),
  note("c3 e3 g3").sound("sine").gain(0.2)
).cpm(20)  // 80 BPM (= 20 cycles per minute)

// ── Cycling / Progressions ──
note("<a2 a2 f2 g2>").sound("sine")   // <> = one per cycle (chord roots)
note("[c3 e3 g3 e3]").sound("sine")   // [] = all in one cycle (arp)

// ── Rhythms ──
sound("bd_fat").struct("x ~ x ~")      // 4 positions = quarter notes
sound("sn_dub").struct("~ x ~ ~")      // snare on beat 2
sound("drum_cowbell").struct("~ ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ x ~ ~")  // 16th notes
// WARNING: struct element count = subdivision. Do NOT add fast() on top.

// ── Duration weights ──
note("[a2@3 ~ e3 d3 a2@2]")  // a2=3/8, rest=1/8, e3=1/8, d3=1/8, a2=2/8

// ── Speed / Slow ──
sound("vinyl_hiss").slow(2)   // every 2 cycles
sound("hh").fast(4)           // 4× speed (for simple patterns WITHOUT struct)

// ── Probabilistic (cycle-deterministic, safe for rebuilds) ──
sound("hh").degradeBy(0.6)               // 40% chance of playing
sound("hh").gain(rand.range(0.05, 0.15)) // random gain per event
sound("hh").speed(rand.range(1.2, 1.8))  // random speed per event

// ── Rests ──
note("c3 ~ e3 ~ g3").sound("sine")  // ~ = silence

// ── Pan with LFO ──
.pan(sine.range(0.3, 0.7).slow(4))
```

## Existing Tracks

### oracle.js
Piano chord alert that fires on price moves. Uses `price_move` (edge-detected, only non-zero during active movement): magnitude sets chord count (2-5), sign sets direction (ascending=up, descending=down). Silent when price is flat. C major when bullish (tone=1), A minor when bearish (tone=0). Uses pre-defined triad chord runs via polyphonic mini-notation `[deg,deg+2,deg+4]`.

### jazz_alerts.js
Jazz trio with reactive piano. 100 BPM (cpm 25). All acoustic samples: ride cymbal (`cr` samples, 2-layer spang-a-lang), walking upright bass (`gm_acoustic_bass` GM soundfont), Salamander grand piano voicings. Ride uses quarter-note pulse on all 4 beats plus triplet skip notes on beats 2 and 4 (12-element grid). Hi-hat foot chicks on 2 and 4. Feathered kick barely audible. Snare ghost notes on triplet partials (65% `degradeBy`). Bass walks chord tones with chromatic approaches — Cmaj7→Am7→Dm7→G7 (major) or Am7→Dm7→Em7→Am7 (minor). Piano 7th-chord voicings trigger on `price_move`. Energy-gated: cross-stick, ride bell (`cr:3` high speed), snare bombs, hi-hat splashes. Consistent room reverb across all layers for cohesive acoustic space.

### mezzanine.js
Massive Attack trip-hop, 80 BPM. Am → Am → Fm → Gm progression (4-bar cycle). Half-time beat: kick on 1 and "and" of 2 (`bd:3`), snare on 3 only (`sd:1`), 8th-note hi-hats with `degradeBy` for human feel. Deep saw bass with root-fifth phrases, sub bass (sine) on roots. Pad triads (triangle + reverb), vinyl hiss. Activity-gated: open hat, ghost kicks, dub echo stab (delay/feedback), cowbell rim clicks. Tone switches between natural minor (bullish) and darker voicings (bearish). Events trigger piano arpeggios and cymbal crashes.

### jazz_trio.js
Jazz piano trio with two market paradigms, 120 BPM. **Uses evaluate mode** — strudel code built dynamically with data-driven interpolation. **Two paradigms driven by `tone`:** Bullish (tone=1) plays Bb major changes (Cm7→F7→BbΔ7→EbΔ7, ii-V-I-IV) with ascending bass walks and ascending melodies. Bearish (tone=0) plays G minor changes (Am7b5→D7→Gm7→Cm7, iiø-V-i-iv) with descending bass walks and descending melodies. **Intensity axis:** `trade_rate` (60%) + `velocity` (40%) compute an intensity score quantized into 3 bands (low/mid/high). Each band selects from pre-composed bass (16 bars x 6 variants), melody (8 bars x 6 variants), and percussion patterns of increasing complexity. Low: quarter-note walks, sparse comping, simple hi-hat. Mid: eighth-note approaches, ghost snares, cross-stick. High: chromatic runs, kick bombs, turnaround fills, dense comping. Heat still controls overall energy/gain scaling. Melody responds to `price_move`: plays only during active movement, velocity scales with magnitude. Piano comping uses `chord().dict("ireal").voicing()` with 3 density levels. All layers use `.orbit()` for bus isolation. Spike events trigger crash cymbal. Caches output keyed on tone + intensity band + quantized heat + price direction + magnitude.

## Legacy References

- **Sonic Pi originals** were removed from the repo (Strudel migration complete). Git history has them if needed.
