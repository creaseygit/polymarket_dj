# Writing Tracks

Tracks are JavaScript files in `frontend/tracks/` that use Tone.js to generate audio in the browser. Each track is a class that receives market data and produces music.

## Track Interface

```javascript
class MyTrack {
  constructor(destination)  // Create synths, loops, connect to Tone.js destination
  start()                   // Start Tone.Transport and loops
  stop()                    // Stop and dispose all synths/loops
  update(data)              // Called every 3s with market data object
  onEvent(type, msg)        // Handle one-shot events (spike, price_move, resolved)
}

// Register with the audio engine
audioEngine.registerTrack('my_track', MyTrack);
```

## Data Received

The `update(data)` method receives:
```javascript
{
  heat: 0.0-1.0,        // Composite market activity (sensitivity-adjusted)
  price: 0.0-1.0,       // Current market price
  price_delta: -1.0-1.0, // Signed per-cycle price change (sensitivity-adjusted)
  velocity: 0.0-1.0,     // Price velocity (sensitivity-adjusted)
  trade_rate: 0.0-1.0,   // Trades per minute (sensitivity-adjusted)
  spread: 0.0-1.0,       // Bid-ask spread (sensitivity-adjusted)
  tone: 0|1,             // 1=bullish/major, 0=bearish/minor
  sensitivity: 0.0-1.0   // Raw sensitivity value (optional use)
}
```

Activity metrics (heat, velocity, trade_rate, spread) are **pre-adjusted by the user's sensitivity setting** — tracks don't need to handle sensitivity themselves.

## Events

The `onEvent(type, msg)` method handles one-shot events:
- `type === 'spike'` — Heat delta exceeded threshold
- `type === 'price_move'` — `msg.direction` is `1` (up) or `-1` (down)
- `type === 'resolved'` — `msg.result` is `1` (Yes won) or `-1` (No won)

## Track Metadata

Add metadata as comments or in the export for the track selector UI:
```javascript
// category: 'music', label: 'My Track Name'
```
Category is `"music"` (continuous generative) or `"alert"` (reactive). The server reads these from the file to populate the track selector.

## Music Utilities

`audio-engine.js` provides helpers:
- `getScaleNotes(root, scaleType, count, octaves)` — Get scale notes (e.g., `getScaleNotes('C4', 'major', 8, 2)`)
- `midiToNote(midi)` / `noteToMidi(note)` — Convert between MIDI numbers and note names
- `SCALES` — `{major: [...], minor: [...]}` interval arrays

## Tone.js Patterns

Common patterns used in existing tracks:
- **Loops:** `new Tone.Loop(callback, interval)` — equivalent to Sonic Pi's `live_loop`
- **Synths:** `Tone.Synth`, `Tone.MonoSynth` (tb303-style), `Tone.PluckSynth`, `Tone.MembraneSynth` (kick), `Tone.NoiseSynth` (snare), `Tone.MetalSynth` (hat/cymbal)
- **Effects:** `Tone.Reverb`, `Tone.FeedbackDelay`, `Tone.Filter`
- **Parameter updates:** Use `.rampTo()` for smooth transitions, direct `.set()` for instant changes
- **One-shots:** `synth.triggerAttackRelease(note, duration, time, velocity)`

## Existing Tracks

### oracle.js
Minimal piano-only alert track. Single `Tone.Loop` (3s interval). Plays ascending/descending motifs (2–6 notes) on price movement > 0.1. C major when bullish, A minor when bearish. Volume scales with velocity + trade_rate.

### mezzanine.js
Ambient dub track, 80 BPM. Am → Am → F → G progression. 10+ concurrent Tone.Loops: sub bass (sine), bass (MonoSynth/sawtooth), arp (PluckSynth), kick (MembraneSynth), snare (NoiseSynth), hi-hat (MetalSynth), rim, pad (PolySynth/triangle + heavy reverb), deep echo voice. Heat drives density inversely for pads. Price drives filter cutoff. Events trigger piano arpeggios and cymbal crashes.

### just_vibes.js
Lo-fi hip hop, 75 BPM. Key: F major / D minor. Chord clock syncs all harmonic loops via `chordIdx`. Same instrument palette as mezzanine but different harmonic field and rhythmic feel. Bullish: Fmaj7→Em7→Dm7→Cmaj7. Bearish: Dm7→Bbmaj7→Gm7→Am7.

## Legacy Sonic Pi Tracks

The original `.rb` tracks remain in `sonic_pi/` for reference and local Sonic Pi development. They are not deployed to the web server. See `sonic_pi/oracle.rb`, `sonic_pi/mezzanine.rb`, `sonic_pi/just_vibes.rb`.
