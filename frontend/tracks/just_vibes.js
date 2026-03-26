// ── Just Vibes Track ─────────────────────────────────────
// Lo-fi hip hop. F major / D minor, 75 BPM.
// category: 'music', label: 'Just Vibes'

class JustVibesTrack {
  constructor(destination) {
    this.dest = destination;
    this.data = { heat: 0.3, price: 0.5, velocity: 0.1, trade_rate: 0.2, spread: 0.2, tone: 1, price_delta: 0 };
    this.chordIdx = 0;
    this.spikeCooldown = 15000;
    this.lastSpikeAt = 0;
    this.disposed = false;

    // ── Shared effects ──
    this.mainReverb = new Tone.Reverb({ decay: 3, wet: 0.55 }).connect(destination);

    // ── Sub bass ──
    this.subFilter = new Tone.Filter({ frequency: 50, type: 'lowpass' }).connect(destination);
    this.subSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.15, decay: 0.1, sustain: 0.8, release: 0.8 },
    }).connect(this.subFilter);

    // ── Bass line (tb303) ──
    this.bassFilter = new Tone.Filter({ frequency: 52, type: 'lowpass', Q: 3 }).connect(destination);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 3 },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.1 },
      filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.1, baseFrequency: 150, octaves: 2 },
    }).connect(this.bassFilter);

    // ── Kick ──
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(destination);

    // ── Snare ──
    this.snareReverb = new Tone.Reverb({ decay: 2.5, wet: 0.55 }).connect(destination);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    }).connect(this.snareReverb);

    // ── Hi-hat ──
    this.hat = new Tone.MetalSynth({
      frequency: 400, envelope: { attack: 0.001, decay: 0.03, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(destination);

    // ── Rim ──
    this.rim = new Tone.MetalSynth({
      frequency: 800, envelope: { attack: 0.001, decay: 0.025, release: 0.01 },
      harmonicity: 3.5, modulationIndex: 16, resonance: 5000, octaves: 0.5,
    }).connect(destination);

    // ── Pad (hollow/triangle + reverb) ──
    this.padReverb = new Tone.Reverb({ decay: 5, wet: 0.7 }).connect(destination);
    this.padFilter = new Tone.Filter({ frequency: 76, type: 'lowpass' }).connect(this.padReverb);
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 2.5, decay: 1, sustain: 0.5, release: 5 },
    }).connect(this.padFilter);

    // ── Deep echo voice ──
    this.deepReverb = new Tone.Reverb({ decay: 6, wet: 0.5 }).connect(destination);
    this.deepFilter = new Tone.Filter({ frequency: 65, type: 'lowpass' }).connect(this.deepReverb);
    this.deepDelay = new Tone.FeedbackDelay({ delayTime: 1.0, feedback: 0.35, wet: 0.5 }).connect(this.deepFilter);
    this.deepSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 1.5, decay: 0.5, sustain: 0.3, release: 4 },
    }).connect(this.deepDelay);

    // ── Vinyl hiss ──
    this.vinyl = new Tone.Noise('pink');
    this.vinylFilter = new Tone.Filter({ frequency: 2000, type: 'lowpass' });
    this.vinylGain = new Tone.Gain(0.018);
    this.vinyl.connect(this.vinylFilter);
    this.vinylFilter.connect(this.vinylGain);
    this.vinylGain.connect(destination);

    // ── Event synths ──
    this.pianoReverb = new Tone.Reverb({ decay: 4, wet: 0.8 }).connect(destination);
    this.pianoDelay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 0.4 }).connect(this.pianoReverb);
    this.pianoSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1.2 },
    }).connect(this.pianoDelay);

    this.cymbal = new Tone.MetalSynth({
      frequency: 200, envelope: { attack: 0.001, decay: 1, release: 0.5 },
      harmonicity: 5.1, modulationIndex: 40, resonance: 3000, octaves: 1.5,
    }).connect(this.mainReverb);

    this._buildLoops();
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

  _buildLoops() {
    const self = this;

    // Chord clock
    this.chordLoop = new Tone.Loop(() => {
      self.chordIdx = (self.chordIdx + 1) % 4;
    }, '1m');

    // Sub bass
    this.subLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const roots = self._getRoots();
      const root = roots[self.chordIdx];
      const amp = (0.14 + h * 0.06) * 0.23 * 0.39;
      self.subSynth.triggerAttackRelease(root, '2n', time, amp);
    }, '1m');

    // Bass line
    this.bassLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      const cut = 42 + pr * 18;
      self.bassFilter.frequency.rampTo(cut + 10, 0.1);
      const roots = self._getRoots();
      const rootMidi = noteToMidi(roots[self.chordIdx]);
      const amp = (0.05 + h * 0.03) * 0.6 * 0.59;
      const phrases = [
        [0, 0.5, 7, 0.3, 5, 0.2],
        [0, 0.4, 5, 0.3, 0, 0.3],
        [7, 0.3, 5, 0.3, 3, 0.4],
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      for (let i = 0; i < phrase.length; i += 2) {
        const offset = phrase[i];
        const dur = phrase[i + 1];
        const note = midiToNote(rootMidi + offset + 24);
        self.bassSynth.triggerAttackRelease(note, dur * 0.6, time + (i / 2) * 0.5, amp * (0.8 + Math.random() * 0.2));
      }
    }, '1m');

    // Kick: half-time feel (1 every 2 beats, then 1 at beat 3)
    this.kickLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const tr = self.data.trade_rate;
      const amp = (0.18 + h * 0.1) * 1.59;
      self.kick.triggerAttackRelease('C1', '8n', time, amp);
      // Ghost kick
      if (tr > 0.4 && Math.random() < 0.25) {
        self.kick.triggerAttackRelease('C1', '8n', time + 0.75, amp * 0.25);
      }
    }, '2n');

    // Snare: beat 3
    this.snareLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const amp = (0.06 + h * 0.04) * 0.77;
      self.snare.triggerAttackRelease('8n', time, amp);
    }, '1m');

    // Hat
    this.hatLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      const prob = 0.12 + tr * 0.35;
      if (Math.random() < prob) {
        self.hat.triggerAttackRelease('32n', time, (0.015 + Math.random() * 0.025) * 2.2);
      }
    }, '8n');

    // Rim
    this.rimStep = 0;
    this.rimPattern = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0];
    this.rimLoop = new Tone.Loop((time) => {
      const tr = self.data.trade_rate;
      if (tr > 0.2 && self.rimPattern[self.rimStep % 16] === 1) {
        self.rim.triggerAttackRelease('32n', time, 0.02 * 0.52);
      }
      self.rimStep++;
    }, '16n');

    // Pad
    this.padLoop = new Tone.Loop((time) => {
      const h = self.data.heat;
      const pr = self.data.price;
      self.padFilter.frequency.rampTo(58 + pr * 18, 0.5);
      const amp = Math.max(0.012, 0.045 - h * 0.02) * 2.66 * 2.15;
      const chords = self._getChords();
      const chord = chords[self.chordIdx];
      self.padSynth.triggerAttackRelease(chord, '2m', time, amp);
    }, '3m');

    // Deep echo
    this.deepLoop = new Tone.Loop((time) => {
      const v = self.data.velocity;
      if (v <= 0.25) return;
      const roots = self._getRoots();
      const root = roots[Math.floor(Math.random() * roots.length)];
      const rootMidi = noteToMidi(root) + 24; // up 2 octaves
      const amp = (0.025 + v * 0.025) * 25;
      self.deepSynth.triggerAttackRelease(midiToNote(rootMidi), '1m', time, amp);
    }, '5m');
  }

  start() {
    Tone.Transport.bpm.value = 75;
    this.vinyl.start();

    this.chordLoop.start(0);
    this.subLoop.start(0);
    this.bassLoop.start('1m');
    this.kickLoop.start(0);
    this.snareLoop.start('2n');
    this.hatLoop.start(0);
    this.rimLoop.start(0);
    this.padLoop.start(0);
    this.deepLoop.start('2m');

    Tone.Transport.start();
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;

    [this.chordLoop, this.subLoop, this.bassLoop,
     this.kickLoop, this.snareLoop, this.hatLoop, this.rimLoop,
     this.padLoop, this.deepLoop].forEach(l => l && l.stop());

    Tone.Transport.stop();
    Tone.Transport.cancel();

    try { this.vinyl.stop(); } catch (e) {}

    [this.subSynth, this.subFilter, this.bassSynth, this.bassFilter,
     this.kick, this.snare, this.snareReverb, this.hat, this.rim,
     this.padSynth, this.padFilter, this.padReverb,
     this.deepSynth, this.deepDelay, this.deepFilter, this.deepReverb,
     this.vinyl, this.vinylFilter, this.vinylGain,
     this.pianoSynth, this.pianoDelay, this.pianoReverb, this.cymbal,
     this.mainReverb,
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
        this.cymbal.triggerAttackRelease('16n', now, 0.06 * 1.87);
      }
    }

    if (type === 'price_move') {
      const dir = msg.direction || 1;
      const t = this.data.tone;
      const root = t === 1 ? 'F4' : 'D4';
      const scaleType = t === 1 ? 'major' : 'minor';
      const sc = getScaleNotes(root, scaleType, 7, 2);
      const notes = dir > 0 ? sc : sc.slice().reverse();
      notes.forEach((n, i) => {
        const frac = i / Math.max(notes.length - 1, 1);
        const amp = dir > 0
          ? 0.09 * (0.5 + frac * 0.3)
          : 0.09 * (0.9 - frac * 0.3);
        this.pianoSynth.triggerAttackRelease(n, '4n', now + i * 0.5, amp);
      });
    }

    if (type === 'resolved') {
      const result = msg.result || 1;
      const root = result === 1 ? 'F4' : 'D4';
      const scaleType = result === 1 ? 'major' : 'minor';
      let sc = getScaleNotes(root, scaleType, 8, 1);
      if (result !== 1) sc = sc.reverse();
      sc.forEach((n, i) => {
        const frac = i / Math.max(sc.length - 1, 1);
        const amp = 0.09 * (0.5 + frac * 0.5);
        this.pianoSynth.triggerAttackRelease(n, '4n', now + i * 0.5, amp);
      });
    }
  }
}

audioEngine.registerTrack('just_vibes', JustVibesTrack);
