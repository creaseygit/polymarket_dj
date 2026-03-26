// ── Mezzanine Track ──────────────────────────────────────
// Massive Attack / Teardrop-inspired ambient dub.
// Am -> Am -> F -> G progression, 80 BPM.
// Faithful port of sonic_pi/mezzanine.rb
// category: 'music', label: 'Mezzanine'

class MezzanineTrack {
  constructor(destination) {
    this.dest = destination;
    this.data = {
      heat: 0.3, price: 0.5, velocity: 0.1, trade_rate: 0.2,
      spread: 0.2, tone: 1, price_delta: 0, ambient_mode: 0,
    };
    this.chordIdx = 0;
    this.spikeCooldown = 15000; // ms
    this.lastSpikeAt = 0;
    this.disposed = false;
    this.samplesReady = false;

    // Sample pools: each name -> array of Tone.Player (pooled for overlapping hits)
    this.samplePlayers = {};
    this._poolSize = 4;

    // Preload all required samples
    const sampleNames = [
      'bd_fat', 'sn_dub', 'drum_cymbal_closed',
      'drum_cowbell', 'vinyl_hiss', 'drum_cymbal_soft',
    ];
    sampleBank.preload(sampleNames).then(() => {
      if (this.disposed) return;
      this.samplesReady = true;
      this._buildSamplePools(sampleNames);
    });

    // ── Sub bass (sine + LPF cutoff 55 = midiToHz(55)) ──
    this.subFilter = new Tone.Filter({
      frequency: midiToHz(55), type: 'lowpass',
    }).connect(destination);
    this.subSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.8 },
    }).connect(this.subFilter);

    // ── Bass line (tb303 style: sawtooth + filter envelope + resonance) ──
    this.bassFilter = new Tone.Filter({
      frequency: midiToHz(48), type: 'lowpass', Q: 3,
    }).connect(destination);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 4, rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
      filterEnvelope: {
        attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1,
        baseFrequency: 200, octaves: 2,
      },
    }).connect(this.bassFilter);

    // ── Arp (pluck with reverb(0.8) -> lpf) ──
    this.arpReverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(destination);
    this.arpFilter = new Tone.Filter({
      frequency: midiToHz(75), type: 'lowpass',
    }).connect(this.arpReverb);
    this.arpSynth = new Tone.PluckSynth({
      resonance: 0.85, release: 1.5,
    }).connect(this.arpFilter);

    // ── Snare reverb chain ──
    this.snareReverb = new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(destination);
    this.snareGhostReverb = new Tone.Reverb({ decay: 3, wet: 0.6 }).connect(destination);

    // ── Hat HPF (cutoff 110 = midiToHz(110)) ──
    this.hatFilter = new Tone.Filter({
      frequency: midiToHz(110), type: 'highpass',
    }).connect(destination);

    // ── Pad / dub wash (hollow synth: triangle + slow attack + reverb(0.95) + LPF) ──
    this.padReverb = new Tone.Reverb({ decay: 6, wet: 0.75 }).connect(destination);
    this.padFilter = new Tone.Filter({
      frequency: midiToHz(55), type: 'lowpass',
    }).connect(this.padReverb);
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 3, decay: 1, sustain: 0.6, release: 5 },
    }).connect(this.padFilter);

    // ── Deep echo (dark_ambience: detuned saw pair + heavy LPF + reverb) ──
    // Chain: synth -> delay(echo phase:0.75, decay:6) -> lpf(70) -> reverb -> out
    this.deepFilter = new Tone.Filter({
      frequency: midiToHz(70), type: 'lowpass',
    }).connect(destination);
    this.deepDelay = new Tone.FeedbackDelay({
      delayTime: 0.75, feedback: 0.5, wet: 0.6,
    }).connect(this.deepFilter);
    // Detuned saw pair for dark_ambience
    this.deepSynth = new Tone.Synth({
      oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
      envelope: { attack: 1, decay: 0.5, sustain: 0.3, release: 3 },
    }).connect(this.deepDelay);

    // ── Price drift chain: pluck -> reverb(0.9) -> echo(0.5, decay:5) -> lpf(85) ──
    this.driftFilter = new Tone.Filter({
      frequency: midiToHz(85), type: 'lowpass',
    }).connect(destination);
    this.driftDelay = new Tone.FeedbackDelay({
      delayTime: 0.5, feedback: 0.45, wet: 0.5,
    }).connect(this.driftFilter);
    this.driftReverb = new Tone.Reverb({ decay: 5, wet: 0.75 }).connect(this.driftDelay);
    this.driftSynth = new Tone.PluckSynth({
      resonance: 0.8, release: 3,
    }).connect(this.driftReverb);

    // ── Event move chain: piano -> reverb(0.92) -> echo(0.75, decay:6) -> lpf(90) ──
    this.moveFilter = new Tone.Filter({
      frequency: midiToHz(90), type: 'lowpass',
    }).connect(destination);
    this.moveDelay = new Tone.FeedbackDelay({
      delayTime: 0.75, feedback: 0.5, wet: 0.5,
    }).connect(this.moveFilter);
    this.moveReverb = new Tone.Reverb({ decay: 4, wet: 0.8 }).connect(this.moveDelay);
    // :piano -> FM synth with quick attack, medium decay
    this.pianoSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 1.5,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
    }).connect(this.moveReverb);

    // ── Spike cymbal: reverb(0.8) -> out ──
    this.spikeReverb = new Tone.Reverb({ decay: 3, wet: 0.6 }).connect(destination);

    // ── Ambient drone (dark_ambience: detuned saw + reverb(0.95) + lpf(60)) ──
    this.droneFilter = new Tone.Filter({
      frequency: midiToHz(60), type: 'lowpass',
    }).connect(destination);
    this.droneReverb = new Tone.Reverb({ decay: 6, wet: 0.85 }).connect(this.droneFilter);
    this.droneSynth = new Tone.Synth({
      oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
      envelope: { attack: 4, decay: 1, sustain: 0.5, release: 8 },
    }).connect(this.droneReverb);

    // ── Resolved chain: piano -> reverb(0.95) -> echo(0.5, decay:6) ──
    this.resolvedFilter = new Tone.Filter({
      frequency: 3000, type: 'lowpass',
    }).connect(destination);
    this.resolvedDelay = new Tone.FeedbackDelay({
      delayTime: 0.5, feedback: 0.4, wet: 0.4,
    }).connect(this.resolvedFilter);
    this.resolvedReverb = new Tone.Reverb({ decay: 5, wet: 0.8 }).connect(this.resolvedDelay);
    this.resolvedSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 1.5,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
    }).connect(this.resolvedReverb);

    // ── Timing state ──
    this.bassPhraseTick = 0;
    this.kickGhostTick = 0;
    this.rimTick = 0;

    // ── Build Transport loops ──
    this._buildLoops();
  }

  // ── Build a pool of Tone.Players for each sample (for polyphonic sample playback) ──
  _buildSamplePools(names) {
    for (const name of names) {
      this.samplePlayers[name] = [];
      for (let i = 0; i < this._poolSize; i++) {
        const p = new Tone.Player(sampleBank.url(name));
        this.samplePlayers[name].push({ player: p, idx: 0 });
      }
    }
  }

  // Play a sample with given params, connecting through an optional destination node
  _playSample(name, time, opts = {}) {
    if (!this.samplesReady || this.disposed) return;
    const pool = this.samplePlayers[name];
    if (!pool || pool.length === 0) return;

    // Round-robin through pool
    const entry = pool[0];
    const player = entry.player;

    // Create a fresh player each time for overlapping playback
    const p = new Tone.Player(sampleBank.url(name));
    const gain = new Tone.Gain(opts.amp !== undefined ? opts.amp : 1);

    if (opts.destination) {
      gain.connect(opts.destination);
    } else {
      gain.connect(this.dest);
    }

    p.connect(gain);

    if (opts.playbackRate !== undefined) {
      p.playbackRate = opts.playbackRate;
    }

    p.loaded.then(() => {
      if (this.disposed) { p.dispose(); gain.dispose(); return; }
      try {
        p.start(time);
        // Auto-dispose after playback
        const dur = p.buffer.duration / (opts.playbackRate || 1);
        const disposeTime = Math.max(0.1, dur + 1);
        p.onstop = () => {
          setTimeout(() => { try { p.dispose(); gain.dispose(); } catch (e) {} }, 100);
        };
        setTimeout(() => {
          try { p.stop(); } catch (e) {}
          try { p.dispose(); gain.dispose(); } catch (e) {}
        }, disposeTime * 1000 + 500);
      } catch (e) {}
    });
  }

  // Utility: random float in [lo, hi]
  _rrand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  // Utility: random choice from array
  _choose(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Get chord root MIDI note based on current chord index
  _chordRootMidi() {
    const idx = this.chordIdx % 8;
    // A2=45, F2=41, G2=43
    if (idx < 4) return 45; // A2
    if (idx < 6) return 41; // F2
    return 43; // G2
  }

  // Get arp notes based on chord index and tone
  _arpNotes() {
    const t = this.data.tone;
    const idx = this.chordIdx % 8;
    if (idx < 4) {
      return t === 1
        ? ['A4', 'C5', 'E5', 'C5', 'A4', 'C5']
        : ['A4', 'C5', 'E5', 'C5', 'G#4', 'C5'];
    } else if (idx < 6) {
      return ['F4', 'A4', 'C5', 'A4', 'F4', 'A4'];
    } else {
      return ['G4', 'B4', 'D5', 'B4', 'G4', 'B4'];
    }
  }

  _buildLoops() {
    const self = this;
    const beatDur = 60 / 80; // 0.75s per beat at 80 BPM

    // ── Chord clock: advance every 4 beats ──
    // Sonic Pi ticks chord_idx once per sub_bass call (every 4 beats)
    // We advance on the sub_bass loop to stay in sync

    // ── Sub bass: every 4 beats ──
    this.subLoop = new Tone.Loop((time) => {
      // Advance chord on each sub_bass tick (matches Sonic Pi tick(:chord_idx))
      self.chordIdx = (self.chordIdx + 1) % 8;
      const h = self.data.heat;
      const root = self._chordRootMidi();
      const amp = (0.16 + h * 0.1) * 0.23;
      self.subSynth.triggerAttackRelease(
        midiToNote(root), { attack: 0.2, sustain: 3, release: 0.8 }, time, amp
      );
    }, '1m'); // 4 beats = 1 measure

    // ── Bass line: every 4 beats ──
    this.bassLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const cut = midiToHz(48 + pr * 25);
      self.bassFilter.frequency.rampTo(cut, 0.1, time);

      const idx = self.chordIdx % 8;
      const r = idx < 4 ? 45 : (idx < 6 ? 41 : 43); // A2, F2, G2

      const amp = (0.06 + h * 0.05) * 0.6;

      // 4 bass phrases matching Sonic Pi, cycling via tick
      const phrases = [
        [r, 1.5, null, 0.5, r + 7, 0.5, r + 5, 0.5, r, 1.0],
        [null, 0.5, r, 1.0, r + 3, 0.5, r + 5, 1.0, null, 1.0],
        [r, 1.0, r + 5, 0.5, r + 3, 0.5, null, 0.5, r + 7, 0.5, r, 0.5, null, 0.5],
        [r + 7, 0.5, r + 5, 0.5, null, 1.0, r, 1.0, r + 3, 1.0],
      ];
      const phrase = phrases[self.bassPhraseTick % phrases.length];
      self.bassPhraseTick++;

      let offset = 0;
      for (let i = 0; i < phrase.length; i += 2) {
        const n = phrase[i];
        const dur = phrase[i + 1];
        if (n !== null) {
          const noteName = midiToNote(n);
          const noteAmp = amp * self._rrand(0.8, 1.0);
          const releaseDur = Math.min(dur * 0.7 * beatDur, 0.35);
          self.bassSynth.triggerAttackRelease(
            noteName, releaseDur, time + offset * beatDur, noteAmp
          );
        }
        offset += dur;
      }
    }, '1m');

    // ── Teardrop arp: every 4 beats (0.5 beat offset at start) ──
    this.arpLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const v = self.data.velocity;
      const tr = self.data.trade_rate;

      // Drop out when hot (matching Sonic Pi: h > 0.75 && rand < 0.6)
      if (h > 0.75 && Math.random() < 0.6) return;

      const amp = Math.max(0.015, 0.04 - h * 0.015);
      self.arpFilter.frequency.rampTo(midiToHz(75 + pr * 15), 0.1, time);

      const ns = self._arpNotes();

      // 0.5 beat offset (sleep 0.5 at start of Sonic Pi loop)
      let offset = 0.5 * beatDur;
      ns.forEach(n => {
        // Random skip (rest): 12% chance
        if (Math.random() < 0.12) {
          offset += self._choose([0.25, 0.5]) * beatDur;
          return;
        }
        // Random octave shift
        const oct = (v > 0.4 && Math.random() < v * 0.4) ? 12 : 0;
        const midi = noteToMidi(n) + oct;
        const vel = amp * self._rrand(0.6, 1.0);
        const release = self._rrand(1.0, 2.0);
        // PluckSynth: coeff maps to resonance (lower coeff = brighter, more resonant)
        self.arpSynth.resonance = self._rrand(0.1, 0.2);
        self.arpSynth.triggerAttack(midiToNote(midi), time + offset, vel * 1.86);

        // Echo note on high trade rate
        if (tr > 0.5 && Math.random() < 0.2) {
          offset += 0.25 * beatDur;
          self.arpSynth.triggerAttack(
            midiToNote(midi + 12), time + offset, vel * 0.5 * 1.86
          );
          offset += 0.25 * beatDur;
        } else {
          offset += (tr > 0.4
            ? self._choose([0.25, 0.5, 0.75])
            : 0.5) * beatDur;
        }
      });
    }, '1m');

    // ── Kick: every 2 beats ──
    this.kickLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const tr = self.data.trade_rate;
      const amp = (0.2 + h * 0.15) * 1.6;

      // sample :bd_fat, cutoff: 70, rate: 0.85
      self._playSample('bd_fat', time, {
        amp: amp,
        playbackRate: 0.85,
      });

      // Ghost kick at 0.75 beats if trade_rate > 0.4
      if (tr > 0.4) {
        self._playSample('bd_fat', time + 0.75 * beatDur, {
          amp: amp * 0.4,
          playbackRate: 0.8,
        });
      }
    }, '2n'); // 2 beats

    // ── Kick ghost: every 0.5 beats, ring pattern [0,0,1,0,0,1,0,0] ──
    this.kickGhostPattern = [0, 0, 1, 0, 0, 1, 0, 0];
    this.kickGhostLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const h = self.data.heat;
      const pat = self.kickGhostPattern[self.kickGhostTick % 8];
      self.kickGhostTick++;
      if (tr > 0.3 && pat === 1) {
        self._playSample('bd_fat', time, {
          amp: (0.06 + h * 0.05) * 1.6,
          playbackRate: 0.75,
        });
      }
    }, '8n'); // 0.5 beats = eighth note

    // ── Snare dub: offset 2 beats, then every 4 beats ──
    this.snareLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const tr = self.data.trade_rate;
      const amp = (0.08 + h * 0.07) * 0.78;

      // Main snare hit with reverb
      self._playSample('sn_dub', time, {
        amp: amp,
        playbackRate: 0.9,
        destination: self.snareReverb,
      });

      // Ghost snare: 40% chance when trade_rate > 0.5
      if (tr > 0.5 && Math.random() < 0.4) {
        self._playSample('sn_dub', time + 1.5 * beatDur, {
          amp: 0.05 * 0.78,
          playbackRate: 1.0,
          destination: self.snareGhostReverb,
        });
      }
    }, '1m'); // every 4 beats

    // ── Rim (cowbell): every 0.25 beats, 16-step pattern ──
    this.rimPattern = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    this.rimLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const h = self.data.heat;
      if (tr > 0.25 && self.rimPattern[self.rimTick % 16] === 1) {
        const amp = (0.03 + h * 0.03) * 0.52;
        self._playSample('drum_cowbell', time, {
          amp: amp,
          playbackRate: 2.5,
        });
      }
      self.rimTick++;
    }, '16n'); // 0.25 beats

    // ── Hat ghost: probabilistic, every 0.5 or 0.25 beats ──
    this.hatLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const prob = 0.1 + tr * 0.35;
      if (Math.random() < prob) {
        const amp = self._rrand(0.02, 0.06) * 2.48;
        self._playSample('drum_cymbal_closed', time, {
          amp: amp,
          playbackRate: self._rrand(1.2, 1.8),
          destination: self.hatFilter,
        });
      }
      // Adjust interval: 0.25 beats when tr > 0.6, else 0.5 beats
      self.hatLoop.interval = tr > 0.6 ? '16n' : '8n';
    }, '8n'); // default 0.5 beats, switches to 0.25 when trade_rate > 0.6

    // ── Vinyl dust: every 8 beats ──
    this.vinylLoop = new Tone.Loop((time) => {
      self._playSample('vinyl_hiss', time, {
        amp: 0.045 * 5.0,
        playbackRate: 0.8,
      });
    }, '2m'); // 8 beats = 2 measures

    // ── Dub wash (hollow pad): every 6-8 beats ──
    this.padLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const t = self.data.tone;

      const amp = Math.max(0.015, 0.05 - h * 0.025) * 2.66;
      self.padFilter.frequency.rampTo(midiToHz(55 + pr * 20), 0.5, time);

      // chord selection: tone=1 -> minor7, tone=0 -> m7minus5
      const ch = t === 1
        ? [noteToMidi('A3'), noteToMidi('C4'), noteToMidi('E4'), noteToMidi('G4')]    // Am7
        : [noteToMidi('A3'), noteToMidi('C4'), noteToMidi('Eb4'), noteToMidi('G4')];  // Am7b5
      const note = midiToNote(self._choose(ch));
      const pan = self._rrand(-0.3, 0.3);
      self.padSynth.triggerAttackRelease(note, 5, time, amp);

      // Randomize next interval: 6 or 8 beats
      self.padLoop.interval = self._choose([6, 8]) * beatDur;
    }, 6 * beatDur); // initial: 6 beats

    // ── Deep echo: every 8-12 beats ──
    this.deepLoop = new Tone.Loop((time) => {
      const v = self.data.velocity;
      if (v <= 0.3) {
        self.deepLoop.interval = self._choose([8, 10, 12]) * beatDur;
        return;
      }
      const t = self.data.tone;
      const notes = t === 1
        ? ['A3', 'C4', 'E4']
        : ['A3', 'C4', 'G#3'];
      const n = self._choose(notes);
      const amp = (0.03 + v * 0.03) * 5.0;
      self.deepSynth.triggerAttackRelease(n, 3, time, amp);

      self.deepLoop.interval = self._choose([8, 10, 12]) * beatDur;
    }, 8 * beatDur); // initial: 8 beats

    // ── Price drift: every 3 seconds (time-based, not beat-based) ──
    this.driftLoop = new Tone.Loop((time) => {
      const pd = self.data.price_delta;
      const mag = Math.abs(pd);
      if (mag <= 0.2) return;

      const t = self.data.tone;
      const sc = getScaleNotes('A4', 'minor_pentatonic', 14, 2);
      const num = Math.min(6, Math.max(2, 2 + Math.floor(mag * 6)));
      const vol = Math.min(0.14, Math.max(0.04, 0.04 + mag * 0.12));
      const ns = pd > 0 ? sc.slice(0, num) : sc.slice(0, num).reverse();

      let offset = 0;
      ns.forEach(n => {
        const v = vol * self._rrand(0.6, 1.0);
        self.driftSynth.resonance = 0.8;
        self.driftSynth.triggerAttack(n, time + offset, v * 1.86);
        offset += self._choose([0.5, 0.75, 1.0]);
      });
    }, 3); // 3 seconds

    // ── Ambient drone: every 8 beats ──
    this.droneLoop = new Tone.Loop((time) => {
      if (self.data.ambient_mode !== 1) return;
      const notes = ['A2', 'E3', 'A3'];
      const n = self._choose(notes);
      self.droneSynth.triggerAttackRelease(n, 8, time, 0.08 * 5.0);
    }, '2m'); // 8 beats

    // ── Event spike check: every 0.5 beats ──
    // (Spike events are now handled via onEvent, but we keep a polling loop
    //  for ambient_mode drone which has no event trigger)

    // ── Event move polling: every 0.5 beats ──
    // (Handled via onEvent instead)
  }

  start() {
    Tone.Transport.bpm.value = 80;

    const beatDur = 60 / 80;

    this.subLoop.start(0);
    this.bassLoop.start(0);
    this.arpLoop.start(0);
    this.kickLoop.start(0);
    this.kickGhostLoop.start(0);
    this.snareLoop.start('2n');       // offset 2 beats into the bar
    this.rimLoop.start(0);
    this.hatLoop.start(0);
    this.vinylLoop.start(0);
    this.padLoop.start(0);
    this.deepLoop.start('2m');        // delayed start
    this.driftLoop.start(0);
    this.droneLoop.start(0);

    Tone.Transport.start();
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;

    // Stop all loops
    const loops = [
      this.subLoop, this.bassLoop, this.arpLoop,
      this.kickLoop, this.kickGhostLoop, this.snareLoop,
      this.rimLoop, this.hatLoop, this.vinylLoop,
      this.padLoop, this.deepLoop, this.driftLoop, this.droneLoop,
    ];
    loops.forEach(l => { try { l.stop(); } catch (e) {} });

    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Dispose all audio nodes
    const nodes = [
      this.subSynth, this.subFilter,
      this.bassSynth, this.bassFilter,
      this.arpSynth, this.arpFilter, this.arpReverb,
      this.snareReverb, this.snareGhostReverb,
      this.hatFilter,
      this.padSynth, this.padFilter, this.padReverb,
      this.deepSynth, this.deepDelay, this.deepFilter,
      this.driftSynth, this.driftDelay, this.driftReverb, this.driftFilter,
      this.pianoSynth, this.moveReverb, this.moveDelay, this.moveFilter,
      this.spikeReverb,
      this.droneSynth, this.droneReverb, this.droneFilter,
      this.resolvedSynth, this.resolvedReverb, this.resolvedDelay, this.resolvedFilter,
    ];
    nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
    loops.forEach(l => { try { l.dispose(); } catch (e) {} });
  }

  update(data) {
    this.data = { ...this.data, ...data };
  }

  onEvent(type, msg) {
    if (this.disposed) return;
    const now = Tone.now();

    // ── Spike event: cymbal soft with reverb, 15s cooldown ──
    if (type === 'spike') {
      const elapsed = Date.now() - this.lastSpikeAt;
      if (elapsed >= this.spikeCooldown) {
        this.lastSpikeAt = Date.now();
        this._playSample('drum_cymbal_soft', now, {
          amp: 0.08 * 1.88,
          playbackRate: 0.5,
          destination: this.spikeReverb,
        });
      }
    }

    // ── Price move event: piano arpeggio through reverb+echo+lpf chain ──
    if (type === 'price_move') {
      const dir = msg.direction || 1;
      const pd = this.data.price_delta;
      const mag = Math.abs(pd);

      const sc = getScaleNotes('A4', 'minor', 14, 2);
      const num = Math.min(7, Math.max(3, 3 + Math.floor(mag * 7)));
      const vol = Math.min(0.1, Math.max(0.04, 0.04 + mag * 0.12));
      const ns = dir > 0 ? sc.slice(0, num) : sc.slice(0, num).reverse();

      ns.forEach((n, i) => {
        const frac = i / Math.max(ns.length - 1, 1);
        const ampEnv = vol * (0.5 + frac * 0.3) * this._rrand(0.7, 1.0);
        this.pianoSynth.triggerAttackRelease(
          n, '4n', now + i * this._choose([0.4, 0.5, 0.6]), ampEnv * 0.97
        );
      });
    }

    // ── Resolved event: piano scale through reverb+echo ──
    if (type === 'resolved') {
      const result = msg.result || 1;
      const sc = result === 1
        ? getScaleNotes('A4', 'major', 8, 1)
        : getScaleNotes('A4', 'minor', 8, 1).reverse();

      sc.forEach((n, i) => {
        const frac = i / Math.max(sc.length - 1, 1);
        const amp = 0.1 * (0.5 + frac * 0.5) * 0.97;
        this.resolvedSynth.triggerAttackRelease(
          n, '4n', now + i * 0.5, amp
        );
      });
    }
  }
}

audioEngine.registerTrack('mezzanine', MezzanineTrack);
