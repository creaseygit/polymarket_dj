// ── Just Vibes Track ─────────────────────────────────────
// Lo-fi hip hop. F major / D minor, 75 BPM.
// Faithful port of sonic_pi/just_vibes.rb
// category: 'music', label: 'Just Vibes'

class JustVibesTrack {
  constructor(destination) {
    this.dest = destination;
    this.data = { heat: 0.3, price: 0.5, velocity: 0.1, trade_rate: 0.2, spread: 0.2, tone: 1, price_delta: 0, ambient_mode: 0 };
    this.chordIdx = 0;
    this.spikeCooldown = 15000;
    this.lastSpikeAt = 0;
    this.disposed = false;
    this.samplesReady = false;
    this.players = {};        // reusable Tone.Player pool per sample
    this.sampleBuffers = {};  // cached Tone.ToneAudioBuffer per sample

    // ── Volume: set_volume! 0.7 handled by masterGain in audio-engine ──
    // All amp factors below match the Sonic Pi original exactly.

    // ── Sub bass (sine + LPF cutoff 50 MIDI) ──
    this.subFilter = new Tone.Filter({ frequency: midiToHz(50), type: 'lowpass' }).connect(destination);
    this.subSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.15, decay: 0.1, sustain: 0.8, release: 0.8 },
    }).connect(this.subFilter);

    // ── Bass line (tb303: sawtooth MonoSynth, res: 0.12) ──
    this.bassFilter = new Tone.Filter({ frequency: midiToHz(52), type: 'lowpass' }).connect(destination);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 0.12 * 30 },  // res 0.12 scaled
      envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.1 },
      filterEnvelope: {
        attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.1,
        baseFrequency: midiToHz(42), octaves: 1.5,
      },
    }).connect(this.bassFilter);

    // ── Pad (:hollow → triangle + slow attack + heavy reverb + LPF) ──
    this.padReverb = new Tone.Reverb({ decay: 5, wet: 0.7 }).connect(destination);
    this.padFilter = new Tone.Filter({ frequency: midiToHz(58), type: 'lowpass' }).connect(this.padReverb);
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 2.5, decay: 1, sustain: 0.5, release: 5 },
    }).connect(this.padFilter);

    // ── Deep echo (:dark_ambience → detuned saw pair + echo + LPF) ──
    this.deepFilter = new Tone.Filter({ frequency: midiToHz(65), type: 'lowpass' }).connect(destination);
    this.deepDelay = new Tone.FeedbackDelay({ delayTime: 1.0, feedback: 0.35, wet: 0.5 }).connect(this.deepFilter);
    this.deepSynth = new Tone.Synth({
      oscillator: { type: 'fatsawtooth', spread: 20, count: 2 },
      envelope: { attack: 1.5, decay: 0.5, sustain: 0.3, release: 4 },
    }).connect(this.deepDelay);

    // ── Snare reverb chains ──
    this.snareReverb = new Tone.Reverb({ decay: 2.8, wet: 0.55 }).connect(destination);
    this.snareGhostReverb = new Tone.Reverb({ decay: 3, wet: 0.65 }).connect(destination);

    // ── Hat HPF ──
    this.hatHPF = new Tone.Filter({ frequency: midiToHz(105), type: 'highpass' }).connect(destination);

    // ── Spike reverb ──
    this.spikeReverb = new Tone.Reverb({ decay: 2.8, wet: 0.65 }).connect(destination);

    // ── Price drift: :piano → FM synth with quick attack/medium decay + reverb + LPF ──
    this.priceDriftFilter = new Tone.Filter({ frequency: midiToHz(82), type: 'lowpass' }).connect(destination);
    this.priceDriftReverb = new Tone.Reverb({ decay: 4, wet: 0.75 }).connect(this.priceDriftFilter);
    this.priceDriftSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 0.5,
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.08, release: 1.0 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.5 },
    }).connect(this.priceDriftReverb);

    // ── Event move: :piano → FM synth + reverb + echo + LPF ──
    this.eventMoveFilter = new Tone.Filter({ frequency: midiToHz(85), type: 'lowpass' }).connect(destination);
    this.eventMoveDelay = new Tone.FeedbackDelay({ delayTime: 0.75, feedback: 0.3, wet: 0.45 }).connect(this.eventMoveFilter);
    this.eventMoveReverb = new Tone.Reverb({ decay: 5, wet: 0.8 }).connect(this.eventMoveDelay);
    this.eventMoveSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 0.5,
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.08, release: 1.0 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.5 },
    }).connect(this.eventMoveReverb);

    // ── Resolved: :piano → FM synth + reverb + echo ──
    this.resolvedReverb = new Tone.Reverb({ decay: 5, wet: 0.8 }).connect(destination);
    this.resolvedDelay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 0.4 }).connect(this.resolvedReverb);
    this.resolvedSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 0.5,
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.08, release: 1.0 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.5 },
    }).connect(this.resolvedDelay);

    // ── Ambient drone (:dark_ambience → detuned saw + reverb + LPF) ──
    this.droneFilter = new Tone.Filter({ frequency: midiToHz(58), type: 'lowpass' }).connect(destination);
    this.droneReverb = new Tone.Reverb({ decay: 6, wet: 0.85 }).connect(this.droneFilter);
    this.droneSynth = new Tone.Synth({
      oscillator: { type: 'fatsawtooth', spread: 20, count: 2 },
      envelope: { attack: 4, decay: 0.5, sustain: 0.3, release: 8 },
    }).connect(this.droneReverb);

    // ── Preload samples ──
    this._preloadSamples();
    this._buildLoops();
  }

  async _preloadSamples() {
    const names = ['bd_fat', 'sn_dub', 'drum_cymbal_closed', 'drum_cowbell', 'vinyl_hiss', 'drum_cymbal_soft'];
    try {
      await sampleBank.preload(names);
      for (const name of names) {
        this.sampleBuffers[name] = await sampleBank.load(name);
      }
      this.samplesReady = true;
    } catch (e) {
      console.warn('[JustVibes] Sample preload failed:', e);
    }
  }

  /** Create a one-shot Tone.Player for a sample, connected to the given destination node. */
  _playSample(name, dest, time, opts = {}) {
    if (!this.samplesReady || !this.sampleBuffers[name]) return;
    const player = new Tone.Player(this.sampleBuffers[name]);
    player.connect(dest);
    if (opts.playbackRate !== undefined) player.playbackRate = opts.playbackRate;
    // Tone.Player doesn't have a volume property that takes amp directly;
    // we apply volume via a Gain node if amp != 1.
    if (opts.amp !== undefined && opts.amp !== 1) {
      const g = new Tone.Gain(opts.amp);
      player.disconnect();
      player.connect(g);
      g.connect(dest);
      player.onstop = () => { try { g.dispose(); player.dispose(); } catch (e) {} };
    } else {
      player.onstop = () => { try { player.dispose(); } catch (e) {} };
    }
    player.start(time);
    // Auto-dispose after a reasonable duration
    const duration = (opts.disposeDuration || 4);
    Tone.Transport.scheduleOnce(() => {
      try { player.stop(); } catch (e) {}
    }, time + duration);
    return player;
  }

  _getRoots() {
    return this.data.tone === 1
      ? ['F2', 'E2', 'D2', 'C2']
      : ['D2', 'A#1', 'G1', 'A1'];
  }

  _getChords() {
    return this.data.tone === 1
      ? [['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'],
         ['D3', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3']]
      : [['D3', 'F3', 'A3', 'C4'], ['A#2', 'D3', 'F3', 'A3'],
         ['G2', 'A#2', 'D3', 'F3'], ['A2', 'C3', 'E3', 'G3']];
  }

  /** Utility: random float in [min, max) */
  _rrand(min, max) { return min + Math.random() * (max - min); }

  /** Utility: seconds per beat at 75 BPM */
  _beatSec(beats) { return beats * (60 / 75); }

  _buildLoops() {
    const self = this;
    const bps = 60 / 75;  // seconds per beat

    // ── Chord clock: every 4 beats ──
    this.chordLoop = new Tone.Loop(() => {
      self.chordIdx = (self.chordIdx + 1) % 4;
    }, bps * 4);

    // ── Vinyl: every 8 beats, sample :vinyl_hiss rate: 0.7 ──
    this.vinylLoop = new Tone.Loop((time) => {
      self._playSample('vinyl_hiss', self.dest, time, {
        amp: 0.05 * 5.0,         // ~nf
        playbackRate: 0.7,
        disposeDuration: bps * 8,
      });
    }, bps * 8);

    // ── Kick: every 4 beats ──
    // Beat 1: full kick. Beat 1.5: ghost if tr > 0.4 && rand < 0.25. Beat 3: second kick.
    this.kickLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const tr = self.data.trade_rate;
      const amp_val = (0.18 + h * 0.1) * 1.59;  // ~nf

      // Beat 1: sample :bd_fat, cutoff: 60, rate: 0.8
      self._playSample('bd_fat', self.dest, time, {
        amp: amp_val, playbackRate: 0.8, disposeDuration: 2,
      });

      // Ghost kick at beat 1.5 if conditions met
      if (tr > 0.4 && Math.random() < 0.25) {
        self._playSample('bd_fat', self.dest, time + bps * 1.5, {
          amp: amp_val * 0.25, playbackRate: 0.75, disposeDuration: 1.5,
        });
      }

      // Beat 3: second kick
      self._playSample('bd_fat', self.dest, time + bps * 2, {
        amp: amp_val * 0.9, playbackRate: 0.8, disposeDuration: 2,
      });
    }, bps * 4);

    // ── Snare: offset 2 beats, every 4 beats ──
    this.snareLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const amp = (0.06 + h * 0.04) * 0.77;  // ~nf

      // Main snare with reverb(room:0.85, damp:0.6, mix:0.55)
      self._playSample('sn_dub', self.snareReverb, time, {
        amp: amp, playbackRate: 0.85, disposeDuration: 2,
      });

      // Ghost snare at beat 3.75 (1.75 beats after snare hit) if rand < 0.15
      if (Math.random() < 0.15) {
        self._playSample('sn_dub', self.snareGhostReverb, time + bps * 1.75, {
          amp: 0.025 * 0.77, playbackRate: 0.9, disposeDuration: 1.5,
        });
      }
    }, bps * 4);

    // ── Hats: every 0.5 or 0.25 beats depending on trade_rate ──
    // Using dynamic scheduling since interval changes with trade_rate
    this.hatStep = 0;
    this.hatLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const prob = 0.12 + tr * 0.35;
      if (Math.random() < prob) {
        const amp = self._rrand(0.015, 0.04) * 2.2;  // ~nf
        const rate = self._rrand(1.3, 1.7);
        const pan = self._rrand(-0.3, 0.3);
        // HPF cutoff 105 MIDI → use hatHPF
        self._playSample('drum_cymbal_closed', self.hatHPF, time, {
          amp: amp, playbackRate: rate, disposeDuration: 0.5,
        });
      }
    }, bps * 0.25);  // tick at 16th notes; we conditionally play

    // To match the original's dynamic sleep (0.25 vs 0.5), we use 0.25 base
    // and skip alternate ticks when trade_rate <= 0.5
    this.hatTickCount = 0;
    // Override the hat loop with a smarter version
    this.hatLoop.dispose();
    this.hatLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      self.hatTickCount++;
      // If tr <= 0.5, only play on even ticks (every 0.5 beats)
      if (tr <= 0.5 && self.hatTickCount % 2 !== 0) return;

      const prob = 0.12 + tr * 0.35;
      if (Math.random() < prob) {
        const amp = self._rrand(0.015, 0.04) * 2.2;  // ~nf
        const rate = self._rrand(1.3, 1.7);
        self._playSample('drum_cymbal_closed', self.hatHPF, time, {
          amp: amp, playbackRate: rate, disposeDuration: 0.5,
        });
      }
    }, bps * 0.25);

    // ── Rim: every 0.25 beats, 16-step pattern ──
    this.rimStep = 0;
    this.rimPattern = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0];
    this.rimLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      if (tr > 0.2 && self.rimPattern[self.rimStep % 16] === 1) {
        self._playSample('drum_cowbell', self.dest, time, {
          amp: 0.02 * 0.52,  // ~nf
          playbackRate: 2.8,
          disposeDuration: 0.5,
        });
      }
      self.rimStep++;
    }, bps * 0.25);

    // ── Sub bass: every 4 beats ──
    this.subLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const roots = self._getRoots();
      const root = roots[self.chordIdx];
      const amp = (0.14 + h * 0.06) * 0.23 * 0.39;  // ~nf
      self.subSynth.triggerAttackRelease(root, bps * 3 + bps * 0.8, time, amp);
    }, bps * 4);

    // ── Bass line: every 4 beats, tb303-style phrases ──
    this.bassLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const cut = 42 + pr * 18;
      self.bassFilter.frequency.rampTo(midiToHz(cut + 10), 0.1);

      const roots = self._getRoots();
      const rootMidi = noteToMidi(roots[self.chordIdx]);
      const rn = rootMidi;
      const amp_val = (0.05 + h * 0.03) * 0.6 * 0.59;  // ~nf

      // Original phrases: [note_or_rest, duration, ...]
      // :r means rest
      const R = null;  // rest marker
      const phrases = [
        [rn, 1.5, R, 0.5, rn + 7, 0.5, R, 0.5, rn, 0.5],
        [R, 0.5, rn, 1.0, rn + 5, 0.5, R, 0.5, rn, 1.5],
        [rn, 1.0, R, 0.5, rn + 7, 0.5, rn + 5, 0.5, R, 0.5, rn, 0.5, R, 0.5],
        [rn, 0.5, R, 1.0, rn + 3, 0.5, rn, 1.0, R, 1.0],
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];

      // Walk through phrase: pairs of [note, duration_in_beats]
      let offset = 0;
      for (let i = 0; i < phrase.length; i += 2) {
        const n = phrase[i];
        const dur = phrase[i + 1];
        if (n !== null) {
          const noteName = midiToNote(n);
          const releaseDur = Math.min(dur * 0.6, 0.3) * bps;
          const vel = amp_val * self._rrand(0.8, 1.0);
          self.bassSynth.triggerAttackRelease(noteName, releaseDur, time + offset * bps, vel);
        }
        offset += dur;
      }
    }, bps * 4);

    // ── Pad wash: every 6-8 beats (random) ──
    // Since Tone.Loop needs fixed interval, schedule recursively
    this._schedulePad();

    // ── Deep echo: every 10-14 beats (random) ──
    this._scheduleDeep();

    // ── Price drift: every 3 seconds ──
    this.priceDriftLoop = new Tone.Loop((time) => {
      self._playPriceDrift(time);
    }, 3);

    // ── Event move: every 0.5 seconds (polls event_price_move) ──
    // Handled via onEvent instead of polling

    // ── Ambient drone: every 8 beats ──
    this.droneLoop = new Tone.Loop((time) => {
      if (self.data.ambient_mode === 1) {
        const notes = ['F2', 'C3', 'F3'];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const amp = 0.06 * 5.0 * 5.0;  // ~nf
        self.droneSynth.triggerAttackRelease(note, bps * 8, time, amp);
      }
    }, bps * 8);

    // ── Spike event: handled via onEvent ──
  }

  _schedulePad() {
    if (this.disposed) return;
    const self = this;
    const bps = 60 / 75;
    const beats = [6, 8][Math.floor(Math.random() * 2)];
    const intervalSec = bps * beats;

    this.padEvent = Tone.Transport.scheduleOnce((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      self.padFilter.frequency.rampTo(midiToHz(58 + pr * 18), 0.5);
      const amp = Math.max(0.012, 0.045 - h * 0.02) * 2.66 * 2.15;  // ~nf
      const chords = self._getChords();
      const chord = chords[self.chordIdx];
      self.padSynth.triggerAttackRelease(chord, bps * 5, time, amp);
      self._schedulePad();
    }, Tone.Transport.seconds + intervalSec);
  }

  _scheduleDeep() {
    if (this.disposed) return;
    const self = this;
    const bps = 60 / 75;
    const beats = [10, 12, 14][Math.floor(Math.random() * 3)];
    const intervalSec = bps * beats;

    this.deepEvent = Tone.Transport.scheduleOnce((time) => {
      const v = self.data.velocity;
      if (v > 0.25) {
        const roots = self._getRoots();
        const root = roots[Math.floor(Math.random() * roots.length)];
        const rootMidi = noteToMidi(root) + 24;  // up 2 octaves
        const amp = (0.025 + v * 0.025) * 5.0 * 5.0;  // ~nf
        self.deepSynth.triggerAttackRelease(midiToNote(rootMidi), bps * 4, time, amp);
      }
      self._scheduleDeep();
    }, Tone.Transport.seconds + intervalSec);
  }

  _playPriceDrift(time) {
    const pd = this.data.price_delta;
    const mag = Math.abs(pd);
    if (mag <= 0.2) return;

    const t = this.data.tone;
    const scaleRoot = t === 1 ? 'F4' : 'D4';
    const scaleType = t === 1 ? 'major_pentatonic' : 'minor_pentatonic';
    const sc = getScaleNotes(scaleRoot, scaleType, 20, 2);

    const num = Math.min(Math.max(2 + Math.floor(mag * 5), 2), 5);
    const vol = Math.min(Math.max(0.04 + mag * 0.1, 0.04), 0.11);
    const ns = pd > 0 ? sc.slice(0, num) : sc.slice(0, num).reverse();

    const sleepOptions = [0.5, 0.75, 1.0];
    let offset = 0;
    ns.forEach((n) => {
      const vl = vol * this._rrand(0.6, 1.0);
      const amp = vl * 0.97 * 0.95;  // ~nf
      this.priceDriftSynth.triggerAttackRelease(n, '4n', time + offset, amp);
      offset += sleepOptions[Math.floor(Math.random() * sleepOptions.length)];
    });
  }

  start() {
    Tone.Transport.bpm.value = 75;
    const bps = 60 / 75;

    this.chordLoop.start(0);
    this.vinylLoop.start(0);
    this.kickLoop.start(0);
    this.snareLoop.start(bps * 2);  // offset 2 beats like original
    this.hatLoop.start(0);
    this.rimLoop.start(0);
    this.subLoop.start(0);
    this.bassLoop.start(0);
    this.priceDriftLoop.start(0);
    this.droneLoop.start(0);

    // Pad and deep are self-scheduling via Transport.scheduleOnce

    Tone.Transport.start();
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;

    // Stop all loops
    [this.chordLoop, this.vinylLoop, this.kickLoop, this.snareLoop,
     this.hatLoop, this.rimLoop, this.subLoop, this.bassLoop,
     this.priceDriftLoop, this.droneLoop,
    ].forEach(l => { if (l) { try { l.stop(); l.dispose(); } catch (e) {} } });

    // Cancel scheduled events
    if (this.padEvent !== undefined) {
      try { Tone.Transport.clear(this.padEvent); } catch (e) {}
    }
    if (this.deepEvent !== undefined) {
      try { Tone.Transport.clear(this.deepEvent); } catch (e) {}
    }

    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Dispose all audio nodes
    [this.subSynth, this.subFilter,
     this.bassSynth, this.bassFilter,
     this.padSynth, this.padFilter, this.padReverb,
     this.deepSynth, this.deepDelay, this.deepFilter,
     this.snareReverb, this.snareGhostReverb,
     this.hatHPF,
     this.spikeReverb,
     this.priceDriftSynth, this.priceDriftReverb, this.priceDriftFilter,
     this.eventMoveSynth, this.eventMoveReverb, this.eventMoveDelay, this.eventMoveFilter,
     this.resolvedSynth, this.resolvedReverb, this.resolvedDelay,
     this.droneSynth, this.droneReverb, this.droneFilter,
    ].forEach(n => { try { n.dispose(); } catch (e) {} });
  }

  update(data) {
    this.data = { ...this.data, ...data };
  }

  onEvent(type, msg) {
    if (this.disposed) return;
    const now = Tone.now();

    // ── Spike event: drum_cymbal_soft, rate: 0.45 with reverb ──
    if (type === 'spike') {
      const elapsed = Date.now() - this.lastSpikeAt;
      if (elapsed >= this.spikeCooldown) {
        this.lastSpikeAt = Date.now();
        this._playSample('drum_cymbal_soft', this.spikeReverb, now, {
          amp: 0.06 * 1.87,  // ~nf
          playbackRate: 0.45,
          disposeDuration: 5,
        });
      }
    }

    // ── Price move event: :piano arpeggios with reverb + echo + LPF ──
    if (type === 'price_move') {
      const dir = msg.direction || 1;
      const t = this.data.tone;
      const scaleRoot = t === 1 ? 'F4' : 'D4';
      const scaleType = t === 1 ? 'major' : 'minor';
      const sc = getScaleNotes(scaleRoot, scaleType, 7, 2);
      const ns = dir > 0 ? sc : sc.slice().reverse();

      const sleepOptions = [0.4, 0.5, 0.6];
      let offset = 0;
      ns.forEach((n, i) => {
        const frac = i / Math.max(ns.length - 1, 1);
        const amp_env = dir > 0
          ? 0.09 * (0.5 + frac * 0.3)
          : 0.09 * (0.9 - frac * 0.3);
        const amp = amp_env * 0.97 * 0.95;  // ~nf
        this.eventMoveSynth.triggerAttackRelease(n, '4n', now + offset, amp);
        offset += sleepOptions[Math.floor(Math.random() * sleepOptions.length)];
      });
    }

    // ── Resolved event: :piano scale run with reverb + echo ──
    if (type === 'resolved') {
      const result = msg.result || 1;
      const scaleRoot = result === 1 ? 'F4' : 'D4';
      const scaleType = result === 1 ? 'major' : 'minor';
      let sc = getScaleNotes(scaleRoot, scaleType, 8, 1);
      if (result !== 1) sc = sc.reverse();

      sc.forEach((n, i) => {
        const frac = i / Math.max(sc.length - 1, 1);
        const amp = 0.09 * (0.5 + frac * 0.5) * 0.97 * 0.95;  // ~nf
        this.resolvedSynth.triggerAttackRelease(n, '4n', now + i * 0.5, amp);
      });
    }
  }
}

audioEngine.registerTrack('just_vibes', JustVibesTrack);
