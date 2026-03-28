// ── Late Night in Bb — Jazz Piano Trio ───────────────────
// 8-bar form: Autumn Leaves A-section changes
// Cm7 → F7 → BbΔ7 → EbΔ7 → Am7b5 → D7 → Gm → turnaround
// Adapted from standalone strudel.cc version.
// Sample subs: rd→cr (ride), rim→rm (rimshot), gm_acoustic_bass→triangle
// (Dirt-Samples lacks rd/rim; @strudel/web excludes GM soundfont engine)
//
// Data mapping:
//   heat      → overall gain scaling, gates energy layers
//   price_move→ melody: ascending phrases (up) / descending (down)
//   velocity  → ghost snare density
//   trade_rate→ rim click probability
//   spread    → reverb spaciousness
//   price     → bass brightness (LPF)
// category: 'music', label: 'Late Night in Bb'

const jazzTrioTrack = (() => {
  let lastSpikeAt = 0;

  // Chord changes — shared by comping
  const changes = "<Cm7 F7 Bb^7 Eb^7 Am7b5 D7 Gm7 [Cm7 F7]>";

  // Melody phrases — ascending contour vs descending contour
  // Used to express price direction
  const ascPhrases = [
    "[C5 Eb5 D5 C5]",   // Am7b5: peak, tension builds (ascending start)
    "[G4@2 Bb4 A4]",    // Gm7: gentle ascending settling
    "[Eb5 D5 C5 Bb4]",  // Cm7: descending from high register
    "[~ D5 C5 Bb4]",    // BbΔ7: pickup into upper register
  ];
  const descPhrases = [
    "[A4 F#4 G4@2]",    // D7: tritone resolution, descending
    "[G4 F4 Eb4@2]",    // turnaround: descending resolution
    "[Eb5 D5 C5 Bb4]",  // Cm7: descending from the 3rd
    "[A4@3 ~]",          // F7: question hangs (held, settling)
  ];

  return {
    name: 'jazz_trio',
    label: 'Late Night in Bb',
    category: 'music',

    init() {
      lastSpikeAt = 0;
    },

    pattern(data) {
      const h   = data.heat || 0.3;
      const pm  = data.price_move || 0;
      const mag = Math.abs(pm);
      const v   = data.velocity || 0.1;
      const tr  = data.trade_rate || 0.2;
      const sp  = data.spread || 0.2;
      const pr  = data.price || 0.5;

      const layers = [];

      // Spread → reverb spaciousness
      const rm = 0.15 + sp * 0.15;
      const rs = 2 + sp * 2;

      // Gain multiplier — everything quieter when market is calm
      const g = 0.4 + h * 0.6;

      // ─── Piano Comping (jazz voicings, syncopated) ───
      // Uses iReal voicing dictionary — exact original patterns
      layers.push(
        chord(changes)
          .dict("ireal")
          .voicing()
          .struct(
            `<
            [~ [~@2 x] ~ [~@2 x]]
            [[~@2 x] ~ ~ x]
            [~ x ~ [~@2 x]]
            [~ ~ [~@2 x] ~]
            [~ [~@2 x] [~@2 x] ~]
            [~ x ~ [~@2 x]]
            [[~@2 x] ~ ~ [~@2 x]]
            [~ [~@2 x] ~ x]
          >`,
          )
          .s("piano")
          .clip(1)
          .velocity(rand.range(0.25 * g, 0.45 * g))
          .room(rm)
          .rsize(rs)
          .delay(0.12)
          .delaytime(0.18)
          .delayfeedback(0.2)
      );

      // ─── Melody (price_move driven) ───
      // Ascending phrases when price goes up, descending when down.
      // Magnitude controls how many phrases (1-4).
      // Silent when market is flat — trio just grooves.
      if (mag >= 0.05) {
        const phrases = pm >= 0 ? ascPhrases : descPhrases;
        const num = Math.min(4, Math.max(1, Math.ceil(mag * 4)));
        const selected = phrases.slice(0, num);
        const rests = Array(8 - num).fill('~');
        const melodyStr = [...selected, ...rests].join(' ');

        layers.push(
          note(`<${melodyStr}>`)
            .s("piano")
            .clip(1)
            .velocity(rand.range(0.45 * g, 0.6 * g))
            .room(rm)
            .rsize(rs)
            .delay(0.08)
            .delaytime(0.18)
            .delayfeedback(0.15)
        );
      }

      // ─── Walking Bass (16-bar) ───
      // Exact original lines. Triangle synth (gm_acoustic_bass unavailable).
      // Price controls LPF brightness.
      layers.push(
        note(`<
          [C2 D2 Eb2 E2]
          [F2 A2 Ab2 Bb2]
          [Bb2 A2 G2 F2]
          [Eb2 F2 G2 Ab2]
          [A2 G2 F2 Eb2]
          [D2 F#2 A2 Ab2]
          [G2 F2 Eb2 D2]
          [C2 Eb2 F2 B1]
          [G1 Bb1 C2 E2]
          [F2 Eb2 D2 [A2 Bb2]]
          [Bb2 D3 C3 A2]
          [Eb2@2 F2 Ab2]
          [C2 Eb2 G2 F2]
          [D2 A2 F#2 [G#2 A2]]
          [G2@2 Bb2 A2]
          [C2 Eb2 [F2 Ab2] [G2 B1]]
        >`)
          .s("triangle")
          .clip(1)
          .gain(
            `<
            [0.45 0.35 0.35 0.30]
            [0.45 0.38 0.32 0.30]
            [0.45 0.35 0.35 0.32]
            [0.45 0.35 0.35 0.30]
            [0.45 0.35 0.35 0.30]
            [0.45 0.38 0.35 0.30]
            [0.45 0.35 0.32 0.30]
            [0.42 0.35 0.35 0.30]
            [0.48 0.35 0.35 0.30]
            [0.45 0.35 0.32 [0.28 0.25]]
            [0.48 0.38 0.35 0.32]
            [0.45 0.35 0.30]
            [0.42 0.35 0.38 0.32]
            [0.45 0.38 0.35 [0.28 0.25]]
            [0.48 0.38 0.30]
            [0.42 0.35 [0.32 0.28] [0.30 0.28]]
          >`,
          )
          .lpf(600 + pr * 600)
          .hpf(60)
          .attack(0.008).decay(0.3).sustain(0.5).release(0.15)
          .room(rm * 0.3)
          .speed(rand.range(0.98, 1.02))
      );

      // ─── Ride Cymbal (spang-a-lang) ───
      // cr = Dirt-Samples ride (original uses rd which isn't in Dirt-Samples)
      layers.push(
        s("cr [cr@2 cr] cr [cr@2 cr]")
          .gain(`${0.25*g} [${0.28*g} ${0.12*g}] ${0.3*g} [${0.32*g} ${0.12*g}]`)
      );

      // ─── Hi-hat (8-bar pattern) ───
      layers.push(
        s(`<
          [~ hh ~ hh]
          [hh hh hh hh]
          [~ hh ~ [hh [~@2 hh]]]
          [~ hh ~ hh]
          [~ hh ~ oh]
          [hh hh hh [hh [~@2 hh]]]
          [~ hh ~ hh]
          [~ hh [~@2 oh] hh]
        >`)
          .gain(
            `<
            [~ ${0.30*g} ~ ${0.24*g}]
            [${0.10*g} ${0.30*g} ${0.10*g} ${0.24*g}]
            [~ ${0.30*g} ~ [${0.24*g} [~ ${0.14*g}]]]
            [~ ${0.28*g} ~ ${0.24*g}]
            [~ ${0.30*g} ~ ${0.34*g}]
            [${0.12*g} ${0.32*g} ${0.12*g} [${0.26*g} [~ ${0.14*g}]]]
            [~ ${0.28*g} ~ ${0.24*g}]
            [~ ${0.30*g} [~ ${0.34*g}] ${0.24*g}]
          >`,
          )
          .cut(1)
      );

      // ─── Kick drum (jazz "bombs" — 8-bar) ───
      // Gated: only when heat > 0.3 (quiet markets = no kick)
      if (h > 0.3) {
        layers.push(
          s(`<
            [bd ~ ~ ~]
            [bd ~ [~@2 bd] ~]
            [bd ~ ~ ~]
            [~ ~ bd ~]
            [bd ~ ~ [~@2 bd]]
            [bd ~ [~@2 bd] ~]
            [bd ~ ~ ~]
            [~ ~ ~ ~]
          >`)
            .gain(0.18 * g)
        );
      }

      // ─── Ghost snare (brush-like texture) ───
      // Density controlled by velocity
      if (h > 0.2) {
        const dropRate = 0.5 - v * 0.25; // more velocity = fewer drops
        layers.push(
          s("[~@2 sd] ~ [~@2 sd] ~")
            .gain(rand.range(0.05 * g, 0.09 * g))
            .sometimesBy(dropRate, (x) => x.gain(0))
        );
      }

      // ─── Cross-stick rim click (beat 4) ───
      // rm = Dirt-Samples rimshot (original uses rim which isn't in Dirt-Samples)
      // Probability controlled by trade_rate
      if (tr > 0.2) {
        const dropRate = 0.7 - tr * 0.4; // more trades = more clicks
        layers.push(
          s("~ ~ ~ rm").degradeBy(dropRate).gain(0.29 * g)
        );
      }

      // ─── Turnaround fill (bar 8 only) ───
      // Only at higher energy
      if (h > 0.5) {
        layers.push(
          s("<~ ~ ~ ~ ~ ~ ~ [~ ~ [sd ~] [~ ~ sd]]>")
            .gain(0.22 * g).room(rm)
        );
      }

      return stack(...layers).cpm(30); // 120 BPM
    },

    onEvent(type, msg, data) {
      const mag = Math.abs(data.price_delta || 0);

      if (type === "spike") {
        const now = Date.now();
        if (now - lastSpikeAt < 15000) return null;
        lastSpikeAt = now;
        // Crash cymbal swell
        return sound("cr:4")
          .speed(0.6).end(0.4).gain(0.06).room(0.25).rsize(0.7);
      }

      if (type === "price_move") {
        // Ascending or descending piano run
        const root = 'Bb4';
        const sc = getScaleNotes(root, 'major', 14, 2);
        const num = Math.min(6, Math.max(2, 2 + Math.floor(mag * 5)));
        const ns = msg.direction > 0
          ? sc.slice(0, num)
          : sc.slice(0, num).reverse();
        return note(ns.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5)
          .gain(Math.min(0.10, 0.04 + mag * 0.06))
          .delay(0.25).delaytime(0.375).delayfeedback(0.2)
          .room(0.3).rsize(0.8);
      }

      if (type === "resolved") {
        const r = msg.result || 1;
        const scaleType = r === 1 ? 'major' : 'minor';
        const sc = getScaleNotes("Bb4", scaleType, 8, 1);
        const notes = r === 1 ? sc : sc.reverse();
        return note(notes.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5).gain(0.08)
          .delay(0.25).delaytime(0.4).delayfeedback(0.18)
          .room(0.35).rsize(0.8);
      }

      return null;
    },
  };
})();

audioEngine.registerTrack("jazz_trio", jazzTrioTrack);
