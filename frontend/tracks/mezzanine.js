// ── Mezzanine Track ──────────────────────────────────────
// Sigur Ros-inspired ambient dub. Am -> Am -> F -> G progression.
// category: 'music', label: 'Mezzanine'

class MezzanineTrack {
  constructor(destination) {
    this.dest = destination;
    this.data = { heat: 0.3, price: 0.5, velocity: 0.1, trade_rate: 0.2, spread: 0.2, tone: 1, price_delta: 0 };
    this.chordIdx = 0;
    this.spikeCooldown = 15000; // ms
    this.lastSpikeAt = 0;
    this.disposed = false;

    // ── Shared effects ──
    this.mainReverb = new Tone.Reverb({ decay: 3, wet: 0.5 }).connect(destination);
    this.echoDelay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.35, wet: 0.4 }).connect(this.mainReverb);

    // ── Sub bass (sine + LPF) ──
    this.subFilter = new Tone.Filter({ frequency: 55, type: 'lowpass' }).connect(destination);
    this.subSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.1, sustain: 0.8, release: 0.8 },
    }).connect(this.subFilter);

    // ── Bass line (tb303 style) ──
    this.bassFilter = new Tone.Filter({ frequency: 65, type: 'lowpass', Q: 5 }).connect(destination);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 4 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1, baseFrequency: 200, octaves: 2 },
    }).connect(this.bassFilter);

    // ── Arp (pluck) ──
    this.arpReverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(destination);
    this.arpFilter = new Tone.Filter({ frequency: 3000, type: 'lowpass' }).connect(this.arpReverb);
    this.arpSynth = new Tone.PluckSynth({ resonance: 0.9, release: 1.5 }).connect(this.arpFilter);

    // ── Kick (membrane synth) ──
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(destination);

    // ── Snare ──
    this.snareReverb = new Tone.Reverb({ decay: 2, wet: 0.5 }).connect(destination);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    }).connect(this.snareReverb);

    // ── Hi-hat ──
    this.hat = new Tone.MetalSynth({
      frequency: 400, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(destination);

    // ── Rim (cowbell) ──
    this.rim = new Tone.MetalSynth({
      frequency: 800, envelope: { attack: 0.001, decay: 0.03, release: 0.01 },
      harmonicity: 3.5, modulationIndex: 16, resonance: 5000, octaves: 0.5,
    }).connect(destination);

    // ── Pad (hollow/triangle + reverb) ──
    this.padReverb = new Tone.Reverb({ decay: 6, wet: 0.75 }).connect(destination);
    this.padFilter = new Tone.Filter({ frequency: 75, type: 'lowpass' }).connect(this.padReverb);
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 3, decay: 1, sustain: 0.6, release: 5 },
    }).connect(this.padFilter);

    // ── Deep echo voice (dark ambience = filtered saw) ──
    this.deepReverb = new Tone.Reverb({ decay: 5, wet: 0.6 }).connect(destination);
    this.deepFilter = new Tone.Filter({ frequency: 70, type: 'lowpass' }).connect(this.deepReverb);
    this.deepDelay = new Tone.FeedbackDelay({ delayTime: 0.75, feedback: 0.4, wet: 0.6 }).connect(this.deepFilter);
    this.deepSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 1, decay: 0.5, sustain: 0.3, release: 3 },
    }).connect(this.deepDelay);

    // ── Vinyl hiss ──
    this.vinyl = new Tone.Noise('pink').connect(destination);
    this.vinylGain = new Tone.Gain(0.015);
    this.vinylFilter = new Tone.Filter({ frequency: 2000, type: 'lowpass' });
    this.vinyl.disconnect();
    this.vinyl.connect(this.vinylFilter);
    this.vinylFilter.connect(this.vinylGain);
    this.vinylGain.connect(destination);

    // ── Event synths (one-shot piano/cymbal) ──
    this.pianoReverb = new Tone.Reverb({ decay: 4, wet: 0.8 }).connect(destination);
    this.pianoSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 1.5 },
    }).connect(this.pianoReverb);

    this.cymbal = new Tone.MetalSynth({
      frequency: 200, envelope: { attack: 0.001, decay: 1, release: 0.5 },
      harmonicity: 5.1, modulationIndex: 40, resonance: 3000, octaves: 1.5,
    }).connect(this.mainReverb);

    // ── Loops ──
    this._buildLoops();
  }

  _buildLoops() {
    const self = this;
    const bpm = 80;

    // Chord clock: advance every 4 beats (2 bars at half speed feel)
    this.chordLoop = new Tone.Loop(() => {
      self.chordIdx = (self.chordIdx + 1) % 8;
    }, '2m');

    // Sub bass: every 4 beats
    this.subLoop = new Tone.Loop((time) => {
      const roots = ['A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'G1', 'G1'];
      const h = self.data.heat;
      const amp = (0.16 + h * 0.1) * 0.23;
      self.subSynth.triggerAttackRelease(roots[self.chordIdx], '2n', time, amp);
    }, '1m');

    // Bass line: every 4 beats
    this.bassLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const cut = 48 + pr * 25;
      self.bassFilter.frequency.rampTo(cut + 10, 0.1);
      const roots = [33, 33, 33, 33, 29, 29, 31, 31]; // A1, F1, G1 in midi-ish
      const rootNote = roots[self.chordIdx];
      const amp = (0.06 + h * 0.05) * 0.6;
      // Simple bass phrase
      const phrases = [
        [0, 0.4, 7, 0.3, 5, 0.3],
        [0, 0.5, 3, 0.25, 5, 0.25],
        [7, 0.3, 5, 0.3, 0, 0.4],
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      for (let i = 0; i < phrase.length; i += 2) {
        const offset = phrase[i];
        const dur = phrase[i + 1];
        const note = midiToNote(rootNote + offset + 24);
        self.bassSynth.triggerAttackRelease(note, dur * 0.6, time + (i / 2) * 0.5, amp * (0.8 + Math.random() * 0.2));
      }
    }, '1m');

    // Arp: every 4 beats
    this.arpLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const v = self.data.velocity;
      if (h > 0.75 && Math.random() < 0.6) return; // drop out when hot
      const amp = Math.max(0.015, 0.04 - h * 0.015) * 1.86;
      self.arpFilter.frequency.rampTo(75 + pr * 15 + 1000, 0.1); // scale cutoff

      const t = self.data.tone;
      const idx = self.chordIdx;
      let notes;
      if (idx < 4) {
        notes = t === 1 ? ['A4', 'C5', 'E5', 'C5', 'A4', 'C5'] : ['A4', 'C5', 'E5', 'C5', 'G#4', 'C5'];
      } else if (idx < 6) {
        notes = ['F4', 'A4', 'C5', 'A4', 'F4', 'A4'];
      } else {
        notes = ['G4', 'B4', 'D5', 'B4', 'G4', 'B4'];
      }

      let offset = 0.25;
      notes.forEach(n => {
        if (Math.random() < 0.12) { offset += 0.25; return; }
        const octShift = (v > 0.4 && Math.random() < v * 0.4) ? 12 : 0;
        const midi = noteToMidi(n) + octShift;
        self.arpSynth.triggerAttack(midiToNote(midi), time + offset);
        offset += self.data.trade_rate > 0.4 ? [0.25, 0.5, 0.75][Math.floor(Math.random() * 3)] : 0.5;
      });
    }, '1m');

    // Kick: every 2 beats
    this.kickLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const tr = self.data.trade_rate;
      const amp = (0.2 + h * 0.15) * 1.6;
      self.kick.triggerAttackRelease('C1', '8n', time, amp);
      if (tr > 0.4 && Math.random() < 0.5) {
        self.kick.triggerAttackRelease('C1', '8n', time + 0.375, amp * 0.4);
      }
    }, '2n');

    // Snare: beat 3 of each bar
    this.snareLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const amp = (0.08 + h * 0.07) * 0.78;
      self.snare.triggerAttackRelease('8n', time, amp);
    }, '1m');
    // Offset snare to beat 3 (2 beats in)
    this.snareLoop.playbackRate = 1;

    // Hat: probabilistic at 16th/8th intervals
    this.hatLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const prob = 0.1 + tr * 0.35;
      if (Math.random() < prob) {
        self.hat.triggerAttackRelease('32n', time, (0.02 + Math.random() * 0.04) * 2.48);
      }
    }, '8n');

    // Rim: 16th note pattern
    this.rimStep = 0;
    this.rimPattern = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    this.rimLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      if (tr > 0.25 && self.rimPattern[self.rimStep % 16] === 1) {
        const h = self.data.heat;
        self.rim.triggerAttackRelease('32n', time, (0.03 + h * 0.03) * 0.52);
      }
      self.rimStep++;
    }, '16n');

    // Pad (dub wash): every 6-8 beats
    this.padLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const t = self.data.tone;
      const amp = Math.max(0.015, 0.05 - h * 0.025) * 2.66;
      self.padFilter.frequency.rampTo(55 + pr * 20, 0.5);
      const chords = t === 1
        ? [['A3', 'C4', 'E4', 'G4'], ['A3', 'C4', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4'], ['G3', 'B3', 'D4', 'F4']]
        : [['A3', 'C4', 'Eb4', 'G4'], ['A3', 'C4', 'Eb4', 'G4'], ['F3', 'Ab3', 'C4', 'E4'], ['G3', 'B3', 'D4', 'F4']];
      const chord = chords[Math.floor(self.chordIdx / 2) % 4];
      const note = chord[Math.floor(Math.random() * chord.length)];
      self.padSynth.triggerAttackRelease(note, '2m', time, amp);
    }, '3m');

    // Deep echo: every 8-12 beats, sparse
    this.deepLoop = new Tone.Loop((time) => {
      const v = self.data.velocity;
      if (v <= 0.3) return;
      const t = self.data.tone;
      const notes = t === 1 ? ['A3', 'C4', 'E4'] : ['A3', 'C4', 'G#3'];
      const n = notes[Math.floor(Math.random() * notes.length)];
      const amp = (0.03 + v * 0.03) * 5;
      self.deepSynth.triggerAttackRelease(n, '2m', time, amp);
    }, '5m');
  }

  start() {
    Tone.Transport.bpm.value = 80;
    this.vinyl.start();

    this.chordLoop.start(0);
    this.subLoop.start(0);
    this.bassLoop.start('1m');
    this.arpLoop.start('1m');
    this.kickLoop.start(0);
    this.snareLoop.start('2n'); // offset to beat 3
    this.hatLoop.start(0);
    this.rimLoop.start(0);
    this.padLoop.start(0);
    this.deepLoop.start('2m');

    Tone.Transport.start();
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;

    // Stop all loops
    [this.chordLoop, this.subLoop, this.bassLoop, this.arpLoop,
     this.kickLoop, this.snareLoop, this.hatLoop, this.rimLoop,
     this.padLoop, this.deepLoop].forEach(l => l && l.stop());

    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Stop vinyl
    try { this.vinyl.stop(); } catch (e) {}

    // Dispose all
    [this.subSynth, this.subFilter, this.bassSynth, this.bassFilter,
     this.arpSynth, this.arpFilter, this.arpReverb,
     this.kick, this.snare, this.snareReverb, this.hat, this.rim,
     this.padSynth, this.padFilter, this.padReverb,
     this.deepSynth, this.deepDelay, this.deepFilter, this.deepReverb,
     this.vinyl, this.vinylFilter, this.vinylGain,
     this.pianoSynth, this.pianoReverb, this.cymbal,
     this.mainReverb, this.echoDelay,
    ].forEach(n => { try { n.dispose(); } catch (e) {} });
  }

  update(data) {
    this.data = { ...this.data, ...data };
  }

  onEvent(type, msg) {
    if (this.disposed) return;
    const now = Tone.now();

    if (type === 'spike') {
      const elapsed = Date.now() - this.lastSpikeAt;
      if (elapsed >= this.spikeCooldown) {
        this.lastSpikeAt = Date.now();
        this.cymbal.triggerAttackRelease('16n', now, 0.08 * 1.88);
      }
    }

    if (type === 'price_move') {
      const dir = msg.direction || 1;
      const sc = getScaleNotes('A4', 'minor', 7, 2);
      const notes = dir > 0 ? sc : sc.slice().reverse();
      const mag = Math.abs(this.data.price_delta);
      const vol = Math.min(0.1, Math.max(0.04, 0.04 + mag * 0.12));
      notes.forEach((n, i) => {
        const frac = i / Math.max(notes.length - 1, 1);
        const amp = vol * (0.5 + frac * 0.3) * (0.7 + Math.random() * 0.3);
        this.pianoSynth.triggerAttackRelease(n, '4n', now + i * 0.5, amp);
      });
    }

    if (type === 'resolved') {
      const result = msg.result || 1;
      const sc = result === 1
        ? getScaleNotes('A4', 'major', 8, 1)
        : getScaleNotes('A4', 'minor', 8, 1).reverse();
      sc.forEach((n, i) => {
        const frac = i / Math.max(sc.length - 1, 1);
        const amp = 0.1 * (0.5 + frac * 0.5);
        this.pianoSynth.triggerAttackRelease(n, '4n', now + i * 0.5, amp);
      });
    }
  }
}

audioEngine.registerTrack('mezzanine', MezzanineTrack);
