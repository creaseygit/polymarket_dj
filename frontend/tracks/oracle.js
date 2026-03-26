// ── Oracle Track ──────────────────────────────────────────
// Alert track. Piano motifs respond to price movement.
// Faithful port of sonic_pi/oracle.rb.
// category: 'alert', label: 'Oracle'

class OracleTrack {
  constructor(destination) {
    this.destination = destination;
    this.data = {
      price_delta: 0,
      tone: 1,
      velocity: 0.1,
      trade_rate: 0.2,
    };

    // Sonic Pi set_volume! 0.3, audio-engine masterGain is 0.7
    // Effective scale: 0.3 / 0.7 ≈ 0.4286
    this.volumeScale = 0.3 / 0.7;

    // Reverb: Sonic Pi room: 0.6, damp: 0.5
    // Tone.js Reverb decay ≈ room * 5 = 3s; wet maps to room level
    this.reverb = new Tone.Reverb({
      decay: 3,
      wet: 0.6,
    }).connect(destination);

    // Pre-generate the reverb impulse response
    this.reverb.generate();

    // Lowpass to approximate Sonic Pi damp: 0.5 on the reverb tail
    this.dampFilter = new Tone.Filter({
      frequency: 3000,
      type: 'lowpass',
      rolloff: -12,
    }).connect(this.reverb);

    // We create individual voices per note for per-note panning.
    // Store references for cleanup.
    this._activeVoices = [];

    // Main loop: every 3 seconds, evaluate and possibly play a motif
    this.loop = new Tone.Loop((time) => this._tick(time), '3s');
  }

  start() {
    this.loop.start(0);
  }

  stop() {
    this.loop.stop();
    // Clean up any lingering voices
    this._activeVoices.forEach((v) => {
      try { v.synth.dispose(); } catch (_) {}
      try { v.panner.dispose(); } catch (_) {}
    });
    this._activeVoices = [];
    this.dampFilter.disconnect();
    this.reverb.disconnect();
    this.dampFilter.dispose();
    this.reverb.dispose();
  }

  update(data) {
    this.data = { ...this.data, ...data };
  }

  onEvent(_type, _msg) {
    // Oracle relies on the main loop; no special event handling.
  }

  /**
   * Build a piano-like FM synth voice.
   *
   * Sonic Pi :piano has `hard` (0–1, brightness/hammer hardness) and
   * `vel` (0–1, velocity/dynamics). We approximate with FM synthesis:
   * - A carrier with quick attack and natural decay (piano-like envelope)
   * - Modulation index driven by `hard` (more harmonics = brighter/harder)
   * - Velocity scales the overall amplitude
   * - harmonicity at 2 gives a piano-ish overtone series
   */
  _makeVoice(hard, vel, pan) {
    const panner = new Tone.Panner(pan).connect(this.dampFilter);

    const synth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 2 + hard * 10,   // hard → brighter attack
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: {
        attack: 0.005,
        decay: 0.6 + vel * 0.4,         // vel → longer sustain
        sustain: 0.05,
        release: 1.0,
      },
      modulationEnvelope: {
        attack: 0.002,
        decay: 0.15 + hard * 0.2,       // hard → longer mod = more brightness
        sustain: 0.0,
        release: 0.3,
      },
    }).connect(panner);

    return { synth, panner };
  }

  _tick(time) {
    const d = this.data;
    const pd = d.price_delta;
    const mag = Math.abs(pd);

    // Sonic Pi: if mag > 0.1 … else just sleep 3
    if (mag <= 0.1) return;

    // Root and scale
    const root = d.tone === 1 ? 'C4' : 'A3';
    const scaleType = d.tone === 1 ? 'major' : 'minor';

    // num = clamp(2 + floor(mag * 6), 2, 6)
    const numNotes = Math.min(6, Math.max(2, 2 + Math.floor(mag * 6)));

    // Build note array (2 octaves of scale, take numNotes)
    let notes = getScaleNotes(root, scaleType, numNotes, 2);
    if (pd < 0) notes = notes.slice().reverse();

    // activity = clamp(0.3 + velocity * 0.4 + trade_rate * 0.3, 0, 1)
    const activity = Math.min(1.0, 0.3 + d.velocity * 0.4 + d.trade_rate * 0.3);

    // vol = clamp(0.02 + mag * 0.06, 0.02, 0.05) * activity
    const vol = Math.min(0.05, Math.max(0.02, 0.02 + mag * 0.06)) * activity;

    // hard = clamp(0.1 + mag * 0.4, 0.1, 0.3)
    const hard = Math.min(0.3, Math.max(0.1, 0.1 + mag * 0.4));

    // vel = 0.2 + mag * 0.5
    const vel = 0.2 + mag * 0.5;

    // Play each note with 0.3s spacing, per-note panning and amplitude envelope
    notes.forEach((note, i) => {
      const frac = notes.length > 1 ? i / (notes.length - 1) : 0;

      // Sonic Pi: amp_env * 0.95
      const ampEnv = pd > 0
        ? vol * (0.7 + frac * 0.3)
        : vol * (1.0 - frac * 0.3);
      const amp = ampEnv * 0.95 * this.volumeScale;

      // Pan: (frac - 0.5) * 0.3
      const pan = (frac - 0.5) * 0.3;

      const noteTime = time + i * 0.3;

      // Create a per-note voice for individual panning
      const voice = this._makeVoice(hard, vel, pan);
      this._activeVoices.push(voice);

      // Schedule note
      Tone.Transport.scheduleOnce((t) => {
        voice.synth.triggerAttackRelease(note, '4n', t, amp);
      }, noteTime);

      // Schedule cleanup after the note fully decays (~3s is generous)
      Tone.Transport.scheduleOnce(() => {
        const idx = this._activeVoices.indexOf(voice);
        if (idx !== -1) this._activeVoices.splice(idx, 1);
        try { voice.synth.dispose(); } catch (_) {}
        try { voice.panner.dispose(); } catch (_) {}
      }, noteTime + 3);
    });
  }
}

audioEngine.registerTrack('oracle', OracleTrack);
