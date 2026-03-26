// ── Mezzanine ────────────────────────────────────────────
// Massive Attack trip-hop. Half-time beat, deep bass. 80 BPM.
// Am → Am → Fm → Gm feel. Dark, heavy, sparse.
// category: 'music', label: 'Mezzanine'

const mezzanineTrack = (() => {
  let lastSpikeAt = 0;

  return {
    name: 'mezzanine',
    label: 'Mezzanine',
    category: 'music',

    init() { lastSpikeAt = 0; },

    pattern(data) {
      const h  = data.heat || 0.3;
      const pr = data.price || 0.5;
      const v  = data.velocity || 0.1;
      const tr = data.trade_rate || 0.2;
      const t  = data.tone !== undefined ? data.tone : 1;

      // ── DRUMS — always on, half-time trip-hop feel ──

      // Kick: beat 1 and the "and" of 2 (classic trip-hop)
      const kick = sound("bd:3").struct("x ~ ~ ~ ~ x ~ ~")
        .speed(0.8).gain(0.35 + h * 0.08).lpf(200);

      // Snare: beat 3 only (half-time)
      const snare = sound("sd:1").struct("~ ~ ~ ~ x ~ ~ ~")
        .speed(0.95).gain(0.18 + h * 0.06)
        .room(0.25).rsize(1.5);

      // Hi-hat: 8th notes, degraded for human feel
      const hat = sound("hh:2").struct("x x x x x x x x")
        .gain(rand.range(0.04, 0.09))
        .speed(rand.range(1.3, 1.7))
        .hpf(6000).end(0.04)
        .degradeBy(0.3);

      // ── BASS — the backbone ──
      // Simple dark bass phrase, root-fifth movement
      const bassNotes = t === 1
        ? "<[a1 ~ ~ a1 ~ e2 ~ d2] [a1 ~ ~ a1 ~ c2 ~ e2] [f1 ~ ~ f1 ~ c2 ~ bb1] [g1 ~ ~ g1 ~ d2 ~ b1]>"
        : "<[a1 ~ ~ a1 ~ e2 ~ d2] [a1 ~ ~ a1 ~ c2 ~ eb2] [f1 ~ ~ f1 ~ c2 ~ ab1] [g1 ~ ~ g1 ~ d2 ~ bb1]>";

      const bass = note(bassNotes).sound("sawtooth")
        .gain(0.14 + h * 0.06)
        .lpf(midiToHz(36 + pr * 24)).lpq(4)
        .decay(0.2).release(0.15);

      // Sub bass: just the roots, pure sine
      const sub = note("<a1 a1 f1 g1>").sound("sine")
        .gain(0.18 + h * 0.05)
        .lpf(120)
        .attack(0.05).decay(0.3).sustain(0.8).release(0.2);

      const layers = [kick, snare, hat, bass, sub];

      // ── TEXTURE — data-driven atmosphere ──

      // Pad: slow chords, always present but quiet
      const padNotes = t === 1
        ? "<[a3,c4,e4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>"
        : "<[a3,c4,eb4] [a3,c4,eb4] [f3,ab3,c4] [g3,bb3,d4]>";
      layers.push(
        note(padNotes).sound("triangle")
          .gain(0.06 + h * 0.03)
          .lpf(midiToHz(52 + pr * 18))
          .attack(1.0).decay(0.5).release(1.5)
          .room(0.35).rsize(2)
      );

      // Vinyl hiss — constant texture
      layers.push(
        sound("pink").slow(2)
          .end(0.5).gain(0.04).hpf(3000)
      );

      // ── Activity-gated layers ──

      // Open hat on beat 4 when active
      if (tr > 0.3) {
        layers.push(
          sound("hh:8").struct("~ ~ ~ ~ ~ ~ x ~")
            .gain(0.06 + tr * 0.04)
            .speed(0.8).end(0.12)
            .room(0.2)
        );
      }

      // Ghost kick shuffle when busy
      if (tr > 0.5) {
        layers.push(
          sound("bd:1").struct("~ ~ x ~ ~ ~ ~ x")
            .speed(0.7).gain(0.06).lpf(150)
        );
      }

      // Dub echo stab — velocity-gated
      if (v > 0.3) {
        const echoNote = t === 1 ? "<e4 ~ c4 ~>" : "<eb4 ~ c4 ~>";
        layers.push(
          note(echoNote).sound("triangle")
            .gain(0.05 + v * 0.05)
            .lpf(midiToHz(60)).attack(0.01).decay(0.15).release(0.6)
            .delay(0.4).delaytime(0.375).delayfeedback(0.35)
            .room(0.3)
        );
      }

      // Rim/click pattern at moderate activity
      if (tr > 0.25) {
        layers.push(
          sound("cb").struct("~ ~ ~ x ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~")
            .speed(2.5).end(0.03)
            .gain(0.04 + h * 0.02)
            .pan(sine.range(0.3, 0.7).slow(3))
        );
      }

      return stack(...layers).cpm(20);
    },

    onEvent(type, msg, data) {
      const t = data.tone !== undefined ? data.tone : 1;
      const mag = Math.abs(data.price_delta || 0);

      if (type === "spike") {
        const now = Date.now();
        if (now - lastSpikeAt < 15000) return null;
        lastSpikeAt = now;
        return sound("hh:6")
          .speed(0.5).end(0.2).gain(0.1).room(0.4);
      }

      if (type === "price_move") {
        const sc = getScaleNotes("A4", "minor", 14, 2);
        const num = Math.min(5, Math.max(2, 2 + Math.floor(mag * 5)));
        const ns = msg.direction > 0 ? sc.slice(0, num) : sc.slice(0, num).reverse();
        return note(ns.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5)
          .gain(Math.min(0.12, 0.06 + mag * 0.08))
          .delay(0.3).delaytime(0.375).delayfeedback(0.25)
          .room(0.35);
      }

      if (type === "resolved") {
        const r = msg.result || 1;
        const sc = r === 1
          ? getScaleNotes("A4", "major", 6, 1)
          : getScaleNotes("A4", "minor", 6, 1).reverse();
        return note(sc.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5).gain(0.1)
          .delay(0.3).delaytime(0.4).delayfeedback(0.2)
          .room(0.4);
      }

      return null;
    },
  };
})();

audioEngine.registerTrack("mezzanine", mezzanineTrack);
