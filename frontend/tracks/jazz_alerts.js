// ── Jazz Alerts ──────────────────────────────────────────
// Jazz trio: spang-a-lang ride, feathered kick, ghost-note
// snare comping, walking bass with chromatic approaches,
// Oracle-style piano 7th chords on price movement. 100 BPM.
// Major: I-vi-ii-V (Cmaj7-Am7-Dm7-G7)
// Minor: i-iv-v-i (Am7-Dm7-Em7-Am7)
// category: 'music', label: 'Jazz Alerts'

// 100 BPM = 25 cpm. Triplet grid = 12 elements per cycle.
// Quarter notes = 4 elements. 8th notes = 8 elements.

const jazzAlertsTrack = (() => {
  let _cachedChordPat = null;
  let _cachedChordKey = null;
  let lastSpikeAt = 0;

  return {
    name: 'jazz_alerts',
    label: 'Jazz Alerts',
    category: 'music',

    init() {
      _cachedChordPat = null;
      _cachedChordKey = null;
      lastSpikeAt = 0;
    },

    pattern(data) {
      const h  = data.heat || 0.3;
      const pr = data.price || 0.5;
      const v  = data.velocity || 0.1;
      const tr = data.trade_rate || 0.2;
      const t  = data.tone !== undefined ? data.tone : 1;
      const pm = data.price_move || 0;
      const mag = Math.abs(pm);

      const layers = [];

      // ── RIDE CYMBAL (spang-a-lang) ──
      // Two layers: quarter-note pulse on every beat ("ding ding ding ding")
      // plus skip notes on the last triplet of beats 2 and 4 ("ga").
      // Together: ding — ding-ga — ding — ding-ga

      // Quarter-note ride pulse: all 4 beats, moderate volume
      // Low speed + longer end = washy, ride-like sustain
      layers.push(
        sound("[hh:8 hh:8 hh:8 hh:8]")
          .speed(rand.range(0.5, 0.65))
          .gain(rand.range(0.07, 0.10))
          .end(0.18)
          .room(0.12)
      );

      // Skip notes: 12-element triplet grid, positions 5 and 11
      // (last triplet of beats 2 and 4) — softer than the main pulse
      layers.push(
        sound("[~ ~ ~ ~ ~ hh:8 ~ ~ ~ ~ ~ hh:8]")
          .speed(rand.range(0.55, 0.7))
          .gain(rand.range(0.04, 0.07))
          .end(0.10)
          .room(0.12)
      );

      // ── HI-HAT FOOT ──
      // Beats 2 and 4: tight "chick" — the backbone everyone listens for
      layers.push(
        sound("[~ hh:0 ~ hh:0]")
          .speed(2.2)
          .gain(0.05 + h * 0.015)
          .end(0.015)
          .hpf(6000)
      );

      // ── FEATHERED KICK ──
      // All 4 quarter notes, barely audible — felt not heard
      // Locks with the walking bass pulse
      layers.push(
        sound("[bd:3 bd:3 bd:3 bd:3]")
          .speed(0.65)
          .gain(0.025 + h * 0.01)
          .lpf(120)
          .degradeBy(0.1)
      );

      // ── SNARE GHOST NOTES ──
      // Comping on triplet partials between ride hits
      // 12-element triplet grid, heavy degradeBy = conversational, never metronomic
      // Positions 1,2,4,7,8,10 = all the gaps between ride notes
      layers.push(
        sound("[~ sd:1 sd:1 ~ sd:1 ~ ~ sd:1 sd:1 ~ sd:1 ~]")
          .speed(rand.range(1.4, 1.8))
          .gain(rand.range(0.012, 0.028))
          .end(0.025)
          .hpf(2000)
          .room(0.06)
          .degradeBy(0.65)
      );

      // ── WALKING BASS ──
      // Quarter-note walks through chord tones, chromatic approach on beat 4
      // Sawtooth with warm filter = woody upright bass tone
      // Major: Cmaj7 → Am7 → Dm7 → G7 (I-vi-ii-V turnaround)
      // Minor: Am7 → Dm7 → Em7 → Am7 (i-iv-v-i)
      const bassLine = t === 1
        ? cat(
            "[c2 d2 e2 gs1]",     // Cmaj7 — scale walk, G# approaches A from below
            "[a1 b1 c2 cs2]",     // Am7   — ascending, C# approaches D from below
            "[d2 e2 f2 fs2]",     // Dm7   — ascending, F# approaches G from below
            "[g1 b1 d2 b1]",      // G7    — arpeggio up, B approaches C from below
          )
        : cat(
            "[a1 c2 e2 cs2]",     // Am7   — chord tones, C# approaches D
            "[d2 f2 e2 ds2]",     // Dm7   — root 3rd step-back, D# approaches E
            "[e2 d2 b1 bb1]",     // Em7   — descending, Bb approaches A from above
            "[a1 c2 e2 gs1]",     // Am7   — arpeggio, G# approaches A (turnaround)
          );

      layers.push(
        bassLine.note().sound("sawtooth")
          .gain(0.28 + h * 0.07)
          .lpf(midiToHz(64 + pr * 14)).lpq(2)
          .attack(0.01).decay(0.15).sustain(0.6).release(0.08)
      );

      // Sub bass: chord roots, sine for low-end warmth underneath the walk
      const subRoots = t === 1
        ? "<c2 a1 d2 g1>"
        : "<a1 d2 e2 a1>";
      layers.push(
        note(subRoots).sound("sine")
          .gain(0.12 + h * 0.04)
          .lpf(90)
          .attack(0.02).decay(0.2).sustain(0.8).release(0.15)
      );

      // ── ENERGY-RESPONSIVE LAYERS ──

      // Cross-stick comping on upbeat triplet partials
      if (tr > 0.25) {
        layers.push(
          sound("[~ ~ cb ~ ~ ~ ~ ~ ~ ~ cb ~]")
            .speed(2.5).end(0.025)
            .gain(0.03 + tr * 0.015)
            .pan(0.6)
            .room(0.06)
            .degradeBy(0.4)
        );
      }

      // Ride bell accents on 2 and 4 when energy builds
      // Brighter variant + higher speed = cutting bell tone
      if (h > 0.5) {
        layers.push(
          sound("[~ hh:6 ~ hh:6]")
            .speed(rand.range(1.1, 1.4))
            .gain(rand.range(0.03, 0.05))
            .end(0.06)
            .hpf(5000)
            .degradeBy(0.5)
        );
      }

      // Louder snare accent on trip-of-2 when very busy
      // (jazz "bomb" on the snare — punctuating the music)
      if (tr > 0.5) {
        layers.push(
          sound("[~ ~ ~ ~ ~ sd:1 ~ ~ ~ ~ ~ ~]")
            .speed(1.2)
            .gain(0.04 + tr * 0.02)
            .end(0.04)
            .room(0.1)
            .degradeBy(0.35)
        );
      }

      // Hi-hat foot splash between beats when velocity high
      // Half-open sound via longer end + lower hpf
      if (v > 0.4) {
        layers.push(
          sound("[~ ~ ~ ~ ~ ~ hh:0 ~ ~ ~ ~ ~]")
            .speed(1.5)
            .gain(0.03 + v * 0.015)
            .end(0.06)
            .hpf(3000)
            .degradeBy(0.5)
        );
      }

      // ── PIANO CHORDS (Oracle-style, reactive to price_move) ──
      // Jazz voicings: 7th chords (root, 3rd, 5th, 7th)
      if (mag >= 0.05) {
        const root = t === 1 ? 'C4' : 'A3';
        const scaleType = t === 1 ? 'major' : 'minor';
        const num = Math.min(5, 2 + Math.floor(mag * 4));
        const dir = pm >= 0 ? 'up' : 'down';

        const key = `${dir}:${num}:${root}`;
        if (!_cachedChordPat || _cachedChordKey !== key) {
          const scaleNotes = getScaleNotes(root, scaleType, 14, 2);
          const chords = [];
          for (let i = 0; i < num; i++) {
            const idx = dir === 'up' ? i : (num - 1 - i);
            const r = noteToStrudel(scaleNotes[idx]);
            const third = noteToStrudel(scaleNotes[idx + 2]);
            const fifth = noteToStrudel(scaleNotes[idx + 4]);
            const seventh = noteToStrudel(scaleNotes[idx + 6]);
            chords.push(`[${r},${third},${fifth},${seventh}]`);
          }
          const rests = Array(Math.max(2, 5 - num)).fill('~');
          const pat = [...chords, ...rests].join(' ');

          const vol = 0.02 + mag * 0.04;
          _cachedChordPat = note(pat)
            .sound("piano")
            .gain(sine.range(vol * 0.75, vol).slow(3))
            .room(0.4)
            .clip(2);
          _cachedChordKey = key;
        }
        layers.push(_cachedChordPat);
      } else {
        _cachedChordPat = null;
        _cachedChordKey = null;
      }

      return stack(...layers).cpm(25);
    },

    onEvent(type, msg, data) {
      const t = data.tone !== undefined ? data.tone : 1;
      const mag = Math.abs(data.price_delta || 0);

      if (type === "spike") {
        const now = Date.now();
        if (now - lastSpikeAt < 15000) return null;
        lastSpikeAt = now;
        return sound("hh:6")
          .speed(0.4).end(0.25).gain(0.07).room(0.3);
      }

      if (type === "price_move") {
        const scaleType = t === 1 ? 'major' : 'minor';
        const root = t === 1 ? 'C4' : 'A3';
        const sc = getScaleNotes(root, scaleType, 14, 2);
        const num = Math.min(5, Math.max(2, 2 + Math.floor(mag * 5)));
        const ns = msg.direction > 0
          ? sc.slice(0, num)
          : sc.slice(0, num).reverse();
        return note(ns.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5)
          .gain(Math.min(0.10, 0.05 + mag * 0.06))
          .delay(0.3).delaytime(0.375).delayfeedback(0.25)
          .room(0.35);
      }

      if (type === "resolved") {
        const r = msg.result || 1;
        const scaleType = r === 1 ? 'major' : 'minor';
        const sc = getScaleNotes("C4", scaleType, 8, 1);
        const notes = r === 1 ? sc : sc.reverse();
        return note(notes.map(n => noteToStrudel(n)).join(" "))
          .sound("piano").end(1.5).gain(0.08)
          .delay(0.3).delaytime(0.4).delayfeedback(0.2)
          .room(0.4);
      }

      return null;
    },
  };
})();

audioEngine.registerTrack("jazz_alerts", jazzAlertsTrack);
