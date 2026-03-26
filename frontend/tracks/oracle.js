// ── Oracle Track ──────────────────────────────────────────
// Minimal alert track. Piano motifs respond to price movement.
// category: 'alert', label: 'Oracle'

class OracleTrack {
  constructor(destination) {
    this.destination = destination;
    this.data = { price_delta: 0, tone: 1, velocity: 0.1, trade_rate: 0.2 };

    // Piano synth with reverb
    this.reverb = new Tone.Reverb({ decay: 2, wet: 0.5 }).connect(destination);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.8 },
    }).connect(this.reverb);

    // Main loop: every 3 seconds, play a motif based on price_delta
    this.loop = new Tone.Loop((time) => this._tick(time), '3s');
  }

  start() {
    Tone.Transport.bpm.value = 120;
    this.loop.start(0);
    Tone.Transport.start();
  }

  stop() {
    this.loop.stop();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.synth.releaseAll();
    this.synth.disconnect();
    this.reverb.disconnect();
    this.synth.dispose();
    this.reverb.dispose();
  }

  update(data) {
    this.data = { ...this.data, ...data };
  }

  onEvent(type, msg) {
    // Oracle doesn't have special event handling beyond the main loop
  }

  _tick(time) {
    const d = this.data;
    const mag = Math.abs(d.price_delta);
    if (mag < 0.1) return; // too quiet, skip

    const root = d.tone === 1 ? 'C4' : 'A3';
    const scaleType = d.tone === 1 ? 'major' : 'minor';
    const numNotes = Math.min(6, Math.max(2, 2 + Math.floor(mag * 6)));
    const activity = Math.min(1.0, 0.3 + d.velocity * 0.4 + d.trade_rate * 0.3);
    const vol = Math.min(0.05, Math.max(0.02, 0.02 + mag * 0.06)) * activity;

    let notes = getScaleNotes(root, scaleType, numNotes, 2);
    if (d.price_delta < 0) notes = notes.slice().reverse();

    notes.forEach((note, i) => {
      const frac = notes.length > 1 ? i / (notes.length - 1) : 0;
      const ampEnv = d.price_delta > 0
        ? vol * (0.7 + frac * 0.3)
        : vol * (1.0 - frac * 0.3);
      this.synth.triggerAttackRelease(note, '8n', time + i * 0.3, ampEnv * 6);
    });
  }
}

audioEngine.registerTrack('oracle', OracleTrack);
