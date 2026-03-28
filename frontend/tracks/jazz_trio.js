// ── Late Night in Bb — Jazz Piano Trio ───────────────────
// Two paradigms: bullish (Bb major, ascending) / bearish (G minor, descending).
// Tone selects paradigm; trade_rate + velocity drive complexity.
// Heat controls overall energy (volume scaling).
// category: 'music', label: 'Late Night in Bb'

const jazzTrioTrack = (() => {
  let _cachedCode = null;
  let _cachedKey = null;

  // ── Chord changes ──
  // Bullish: ii-V-I-IV in Bb major (bright, resolved to tonic)
  const BULLISH_CHANGES = "<Cm7 F7 Bb^7 Eb^7 Cm7 F7 Bb^7 Bb^7>";
  // Bearish: iiø-V-i-iv in G minor (dark, tense, resolves to minor)
  const BEARISH_CHANGES = "<Am7b5 D7 Gm7 Cm7 Am7b5 D7 Gm7 Gm7>";

  function scaleGains(pattern, factor) {
    return pattern.replace(/\d+\.\d+/g, (m) =>
      (parseFloat(m) * factor).toFixed(2)
    );
  }

  function q(v, step) {
    return Math.round(v / step) * step;
  }

  // ── Bass note patterns: BULL_BASS[intBand], BEAR_BASS[intBand] ──
  // Each is 16 bars (two passes through the 8-bar form).

  // Bullish bass: ascending through chord tones (root→3rd→5th→approach)
  const BULL_BASS = [
    // Low: simple ascending quarter notes
    `<
  [C2 D2 Eb2 E2]
  [F2 A2 Bb2 A2]
  [Bb2 C3 D3 D2]
  [Eb2 F2 G2 Bb2]
  [C2 Eb2 G2 E2]
  [F2 G2 A2 Bb2]
  [Bb2 D3 C3 A2]
  [Bb2 A2 C3 Bb2]
  [C2 Eb2 F2 E2]
  [F2 A2 C3 A2]
  [Bb2 D3 C3 D2]
  [Eb2 G2 Bb2 B2]
  [C2 D2 Eb2 E2]
  [F2 G2 Bb2 A2]
  [Bb2 C3 D3 Bb2]
  [Bb2 D3 C3 Bb2]
>`,
    // Mid: eighth-note approaches on beat 4
    `<
  [C2 Eb2 G2 [Bb2 E2]]
  [F2 A2 C3 [Bb2 A2]]
  [Bb2 D3 C3 [Eb3 D2]]
  [Eb2 G2 Bb2 [A2 B2]]
  [C2 D2 Eb2 [G2 E2]]
  [F2 A2 Bb2 [C3 A2]]
  [Bb2 C3 D3 Bb2]
  [Bb2 D3 [C3 D3] Bb2]
  [C2 Eb2 G2 [A2 E2]]
  [F2 G2 A2 [C3 A2]]
  [Bb2 D3 C3 [Eb3 D2]]
  [Eb2 F2 G2 [Bb2 B2]]
  [C2 D2 [Eb2 G2] E2]
  [F2 A2 C3 [Bb2 A2]]
  [Bb2 [C3 D3] C3 A2]
  [Bb2 C3 [D3 C3] Bb2]
>`,
    // High: busy chromatic fills, wider leaps
    `<
  [C2 [D2 Eb2] G2 [A2 E2]]
  [F2 [G2 A2] C3 [Bb2 A2]]
  [[Bb2 C3] D3 C3 [Eb3 D2]]
  [Eb2 [F2 G2] Bb2 [A2 B2]]
  [[C2 Eb2] G2 [Bb2 A2] E2]
  [[F2 A2] C3 [Bb2 C3] A2]
  [[Bb2 D3] C3 D3 [Eb3 Bb2]]
  [Bb2 [C3 D3] [Eb3 D3] Bb2]
  [C2 [D2 Eb2] G2 [Bb2 E2]]
  [[F2 G2] A2 [Bb2 C3] A2]
  [Bb2 [C3 D3] C3 [D3 D2]]
  [[Eb2 F2] G2 [Ab2 Bb2] B2]
  [C2 [D2 Eb2] [F2 G2] E2]
  [F2 [G2 A2] [Bb2 C3] A2]
  [Bb2 [C3 D3] [C3 D3] Bb2]
  [[Bb2 D3] [C3 Bb2] [A2 C3] Bb2]
>`,
  ];

  // Bearish bass: descending through chord tones (7th→5th→3rd→root)
  const BEAR_BASS = [
    // Low: simple descending quarter notes
    `<
  [A2 G2 Eb2 D2]
  [D3 C3 A2 Ab2]
  [G2 F2 D2 C2]
  [C3 Bb2 Ab2 Bb2]
  [A2 Eb2 C2 D2]
  [D3 A2 F#2 Ab2]
  [G2 F2 D2 Bb1]
  [G2 F2 Eb2 D2]
  [A2 G2 Eb2 D2]
  [D3 C3 F#2 Ab2]
  [G2 D2 Bb1 C2]
  [C3 Bb2 G2 Bb2]
  [A2 Eb2 C2 D2]
  [D3 A2 C3 Ab2]
  [G2 F2 Eb2 D2]
  [G2 D2 Bb1 G1]
>`,
    // Mid: chromatic descending approaches
    `<
  [A2 G2 Eb2 [C2 D2]]
  [D3 C3 A2 [Bb2 Ab2]]
  [G2 F2 D2 [Eb2 C2]]
  [C3 Bb2 G2 [A2 Bb2]]
  [A2 [G2 Eb2] C2 D2]
  [D3 [C3 A2] F#2 Ab2]
  [G2 [F2 D2] Bb1 C2]
  [G2 [Bb2 A2] F2 G2]
  [A2 G2 [Eb2 C2] D2]
  [D3 [C3 A2] F#2 [Bb2 Ab2]]
  [G2 F2 [D2 Bb1] C2]
  [C3 [Bb2 Ab2] G2 Bb2]
  [A2 [G2 Eb2] C2 [Eb2 D2]]
  [D3 C3 [A2 F#2] Ab2]
  [G2 [F2 D2] [Eb2 C2] D2]
  [G2 [F2 Eb2] D2 G1]
>`,
    // High: fast descending runs
    `<
  [[A2 G2] Eb2 C2 [Eb2 D2]]
  [[D3 C3] A2 F#2 [Bb2 Ab2]]
  [[G2 F2] D2 Bb1 [Eb2 C2]]
  [[C3 Bb2] Ab2 G2 [A2 Bb2]]
  [A2 [G2 Eb2] [C2 Eb2] D2]
  [[D3 C3] [A2 F#2] C3 Ab2]
  [G2 [F2 D2] [Bb1 D2] C2]
  [G2 [Bb2 A2] [F2 Eb2] G1]
  [[A2 G2] [Eb2 C2] Eb2 D2]
  [D3 [C3 A2] [F#2 A2] Ab2]
  [[G2 F2] [D2 Bb1] [C2 Eb2] C2]
  [C3 [Bb2 Ab2] [G2 Bb2] Bb2]
  [A2 [G2 Eb2] [C2 D2] [Eb2 D2]]
  [[D3 C3] [A2 C3] [F#2 A2] Ab2]
  [[G2 F2] D2 [Bb1 C2] D2]
  [[G2 F2] [Eb2 D2] [Bb1 C2] G1]
>`,
  ];

  // Shared bass gain pattern (16 bars, scaled by energy)
  const BASS_GAINS = `<
  [0.45 0.35 0.35 0.30]
  [0.45 0.38 0.32 0.30]
  [0.45 0.35 0.35 0.32]
  [0.45 0.35 0.35 0.30]
  [0.45 0.35 0.35 0.30]
  [0.45 0.38 0.35 0.30]
  [0.45 0.35 0.32 0.30]
  [0.42 0.35 0.35 0.30]
  [0.48 0.35 0.35 0.30]
  [0.45 0.35 0.32 0.30]
  [0.48 0.38 0.35 0.32]
  [0.45 0.35 0.30 0.30]
  [0.42 0.35 0.38 0.32]
  [0.45 0.38 0.35 0.30]
  [0.48 0.38 0.30 0.30]
  [0.42 0.35 0.32 0.30]
>`;

  // ── Melody note patterns: BULL_MELODY[intBand], BEAR_MELODY[intBand] ──
  // Each is 8 bars (one pass through the chord form).

  // Bullish: ascending through Bb major over bullish changes
  //   Cm7 | F7 | Bb^7 | Eb^7 | Cm7 | F7 | Bb^7 | Bb^7
  const BULL_MELODY = [
    // Low: sparse, spacious ascending hints
    `<
  [C5@2 D5 ~]
  [A4@3 ~]
  [Bb4 ~ D5@2]
  [Eb5@2 G4@2]
  [C5@2 Eb5 ~]
  [A4 ~ C5@2]
  [D5@2 Bb4@2]
  [Bb4@2 C5@2]
>`,
    // Mid: quarter-note ascending climbs through chord tones
    //   Cm7:  7th→root→9th→b3 ascending
    //   F7:   3rd→5th→b7 up
    //   Bb^7: root→3rd→5th ascending
    //   Eb^7: root→3rd→5th ascending
    `<
  [Bb4 C5 D5 Eb5]
  [A4 C5 Eb5 ~]
  [Bb4 ~ D5 F5]
  [Eb4 G4 Bb4 ~]
  [C5 D5 Eb5 G5]
  [F4 A4 C5 Eb5]
  [Bb4 D5 F5 ~]
  [Bb4 C5 D5 F5]
>`,
    // High: eighth-note runs, chromatic approaches
    `<
  [Bb4 C5 [Db5 D5] Eb5]
  [A4 [Bb4 C5] Eb5 ~]
  [[Bb4 C5] D5 [Eb5 F5] ~]
  [Eb4 [F4 G4] Bb4 ~]
  [C5 [D5 Eb5] G5 F5]
  [[F4 G4] A4 C5 Eb5]
  [Bb4 [C5 D5] F5 D5]
  [[Bb4 D5] [C5 Eb5] F5 D5]
>`,
  ];

  // Bearish: descending through G minor over bearish changes
  //   Am7b5 | D7 | Gm7 | Cm7 | Am7b5 | D7 | Gm7 | Gm7
  const BEAR_MELODY = [
    // Low: sparse, mournful descending
    `<
  [G5@2 Eb5 ~]
  [F#4@3 ~]
  [D5@2 Bb4@2]
  [C5@2 ~ G4]
  [Eb5@2 C5 ~]
  [A4@2 F#4@2]
  [Bb4@3 ~]
  [D5@2 Bb4@2]
>`,
    // Mid: quarter-note descending phrases through chord tones
    //   Am7b5: b7→b5→b3→root descending arpeggio
    //   D7:    b7→5th→3rd resolving down
    //   Gm7:   5th→b3→root settling
    //   Cm7:   root→b7→5th→b3 continued descent
    `<
  [G5 Eb5 C5 A4]
  [C5 A4 F#4 ~]
  [D5 Bb4 G4 ~]
  [C5 Bb4 G4 Eb4]
  [Eb5 C5 A4 G4]
  [A4 F#4 D4@2]
  [Bb4 A4 G4 F4]
  [D5 Bb4 A4 G4]
>`,
    // High: fast descending runs, chromatic passing tones
    `<
  [G5 [F5 Eb5] C5 A4]
  [[C5 Bb4] A4 F#4 ~]
  [D5 [C5 Bb4] G4 F4]
  [C5 [Bb4 Ab4] G4 Eb4]
  [[Eb5 Db5] C5 [Bb4 A4] G4]
  [A4 [Ab4 F#4] D4 ~]
  [[Bb4 A4] G4 [F4 Eb4] D4]
  [D5 [C5 Bb4] [A4 G4] F4]
>`,
  ];

  // ── Layer code generators ──

  function bassCode(tone, intBand, energy) {
    const notes = tone === 1 ? BULL_BASS[intBand] : BEAR_BASS[intBand];
    const gains = scaleGains(BASS_GAINS, energy);
    return `
$: note(\`${notes}\`)
  .s("gm_acoustic_bass")
  .clip(1)
  .gain(\`${gains}\`)
  .lpf(900)
  .hpf(60)
  .room(0.08)
  .speed(rand.range(0.98, 1.02))
  .orbit(3);
`;
  }

  function melodyCode(tone, intBand, pmAbs, energy) {
    const notes = tone === 1 ? BULL_MELODY[intBand] : BEAR_MELODY[intBand];
    const vel = (0.30 + pmAbs * 0.30).toFixed(2);
    const velMax = (0.40 + pmAbs * 0.20).toFixed(2);
    return `
$: note(\`${notes}\`)
  .s("piano")
  .clip(1)
  .velocity(rand.range(${vel}, ${velMax}))
  .room(0.25)
  .roomsize(3)
  .delay(0.08)
  .delaytime(0.18)
  .delayfeedback(0.15)
  .orbit(2);
`;
  }

  function rideCode(energy) {
    const gains = scaleGains(
      "0.25 [0.28 0.12] 0.3 [0.32 0.12]",
      energy,
    );
    return `
$: s("rd [rd@2 rd] rd [rd@2 rd]")
  .gain("${gains}")
  .orbit(4);
`;
  }

  function hihatCode(intBand, energy) {
    if (intBand === 0) {
      // Simple 2 & 4 only
      const g = (0.25 * energy).toFixed(2);
      return `
$: s("[~ hh ~ hh]")
  .gain(${g})
  .cut(1)
  .orbit(4);
`;
    }
    // Mid and high: full 8-bar pattern
    const gains = scaleGains(
      `<
      [~ 0.30 ~ 0.24]
      [0.10 0.30 0.10 0.24]
      [~ 0.30 ~ [0.24 [~ 0.14]]]
      [~ 0.28 ~ 0.24]
      [~ 0.30 ~ 0.34]
      [0.12 0.32 0.12 [0.26 [~ 0.14]]]
      [~ 0.28 ~ 0.24]
      [~ 0.30 [~ 0.34] 0.24]
    >`,
      energy,
    );
    return `
$: s(\`<
  [~ hh ~ hh]
  [hh hh hh hh]
  [~ hh ~ [hh [~@2 hh]]]
  [~ hh ~ hh]
  [~ hh ~ oh]
  [hh hh hh [hh [~@2 hh]]]
  [~ hh ~ hh]
  [~ hh [~@2 oh] hh]
>\`)
  .gain(\`${gains}\`)
  .cut(1)
  .orbit(4);
`;
  }

  function compCode(intBand, energy) {
    let struct, vel, velMax;
    if (intBand === 0) {
      // Very sparse: hits on only 2 of 8 bars
      struct = `<
    [~ [~@2 x] ~ ~]
    [~ ~ ~ ~]
    [~ ~ ~ ~]
    [~ ~ ~ ~]
    [~ ~ ~ [~@2 x]]
    [~ ~ ~ ~]
    [~ ~ ~ ~]
    [~ ~ ~ ~]
  >`;
      vel = (0.15 * energy).toFixed(2);
      velMax = (0.25 * energy).toFixed(2);
    } else if (intBand === 1) {
      // Mid: syncopated on alternate bars
      struct = `<
    [~ [~@2 x] ~ [~@2 x]]
    [~ ~ ~ ~]
    [~ x ~ [~@2 x]]
    [~ ~ ~ ~]
    [~ [~@2 x] [~@2 x] ~]
    [~ ~ ~ ~]
    [[~@2 x] ~ ~ [~@2 x]]
    [~ ~ ~ ~]
  >`;
      vel = (0.20 * energy).toFixed(2);
      velMax = (0.35 * energy).toFixed(2);
    } else {
      // High: dense every bar
      struct = `<
    [~ [~@2 x] ~ [~@2 x]]
    [[~@2 x] ~ ~ x]
    [~ x ~ [~@2 x]]
    [~ ~ [~@2 x] ~]
    [~ [~@2 x] [~@2 x] ~]
    [~ x ~ [~@2 x]]
    [[~@2 x] ~ ~ [~@2 x]]
    [~ [~@2 x] ~ x]
  >`;
      vel = (0.25 * energy).toFixed(2);
      velMax = (0.45 * energy).toFixed(2);
    }
    return `
$: chord(changes)
  .dict("ireal")
  .voicing()
  .struct(\`${struct}\`)
  .s("piano")
  .clip(1)
  .velocity(rand.range(${vel}, ${velMax}))
  .room(0.25)
  .roomsize(3)
  .delay(0.12)
  .delaytime(0.18)
  .delayfeedback(0.2)
  .orbit(1);
`;
  }

  function ghostSnareCode(intBand, energy) {
    // Busier at high intensity (less dropout)
    const dropout = intBand >= 2 ? 0.25 : 0.50;
    const gMin = (0.05 * energy).toFixed(2);
    const gMax = (0.09 * energy).toFixed(2);
    return `
$: s("[~@2 sd] ~ [~@2 sd] ~")
  .gain(rand.range(${gMin}, ${gMax}))
  .sometimesBy(${dropout}, (x) => x.gain(0))
  .orbit(4);
`;
  }

  function crossStickCode() {
    return `
$: s("~ ~ ~ rim").degradeBy(0.5).gain(0.29).orbit(4);
`;
  }

  function kickCode(energy) {
    const g = (0.18 * energy).toFixed(2);
    return `
$: s(\`<
  [bd ~ ~ ~]
  [bd ~ [~@2 bd] ~]
  [bd ~ ~ ~]
  [~ ~ bd ~]
  [bd ~ ~ [~@2 bd]]
  [bd ~ [~@2 bd] ~]
  [bd ~ ~ ~]
  [~ ~ ~ ~]
>\`)
  .gain(${g})
  .orbit(4);
`;
  }

  function fillCode() {
    return `
$: s("<~ ~ ~ ~ ~ ~ ~ [~ ~ [sd ~] [~ ~ sd]]>").gain(0.22).room(0.15).orbit(4);
`;
  }

  // ── Track object ──

  return {
    name: "jazz_trio",
    label: "Late Night in Bb",
    category: "music",
    cpm: 30,

    init() {
      _cachedCode = null;
      _cachedKey = null;
    },

    evaluateCode(data) {
      const h = data.heat || 0;
      const pm = data.price_move || 0;
      const pmAbs = Math.abs(pm);
      const tone = data.tone !== undefined ? data.tone : 1;
      const tradeRate = data.trade_rate || 0;
      const vel = data.velocity || 0;

      // Quantize for cache stability
      const hQ = q(h, 0.05);
      // Intensity from trading activity (separate from heat/energy)
      const rawIntensity = 0.6 * tradeRate + 0.4 * vel;
      const intensity = Math.max(0.15, Math.min(1.0, rawIntensity));
      const intBand = intensity < 0.33 ? 0 : intensity < 0.66 ? 1 : 2;
      const pmDir = pmAbs < 0.05 ? 0 : pm > 0 ? 1 : -1;
      const pmMag = q(pmAbs, 0.1);
      const key = `${tone}:${intBand}:${hQ}:${pmDir}:${pmMag}`;

      if (_cachedCode && _cachedKey === key) return _cachedCode;

      // Energy scales volume: 0.4 at rest → 1.0 at full heat
      const energy = 0.4 + hQ * 0.6;
      const changes = tone === 1 ? BULLISH_CHANGES : BEARISH_CHANGES;

      let code = "setcpm(30);\n";
      code += `let changes = "${changes}";\n`;

      // ── Always on: bass + ride ──
      code += bassCode(tone, intBand, energy);
      code += rideCode(energy);

      // ── Hi-hat: scales with intensity ──
      code += hihatCode(intBand, energy);

      // ── Comping: always on, density scales with intensity ──
      code += compCode(intBand, energy);

      // ── Conditional layers: always emit $: blocks to keep positional
      //    IDs stable (silent placeholder when inactive).  This prevents
      //    Strudel's anonymous $: indexing from shifting when layers
      //    appear/disappear, which would cause pattern mismatches mid-cycle.

      // Ghost snare: mid+ intensity
      code += intBand >= 1 ? ghostSnareCode(intBand, energy) : '\n$: silence;\n';

      // Cross-stick: mid+ intensity
      code += intBand >= 1 ? crossStickCode() : '\n$: silence;\n';

      // Kick bombs: high intensity only
      code += intBand >= 2 ? kickCode(energy) : '\n$: silence;\n';

      // Turnaround fill: high intensity only
      code += intBand >= 2 ? fillCode() : '\n$: silence;\n';

      // Melody: only when price is actively moving
      code += pmAbs > 0.05 ? melodyCode(tone, intBand, pmAbs, energy) : '\n$: silence;\n';

      _cachedCode = code;
      _cachedKey = key;
      return code;
    },

    onEvent(type) {
      if (type === "spike") {
        return sound("cr:0").gain(0.06).room(0.4);
      }
      return null;
    },

    onEventCode(type) {
      if (type === "spike") {
        // Play crash once then go silent — <cr:0 ~ ~ ~> plays beat 1 only,
        // and the next evaluate() call (3s later) drops this pattern entirely.
        return '$: s("<cr:0 ~ ~ ~>").gain(0.06).room(0.4).orbit(4);';
      }
      return null;
    },
  };
})();

audioEngine.registerTrack("jazz_trio", jazzTrioTrack);
