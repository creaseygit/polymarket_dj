// ── Late Night in Bb — Jazz Piano Trio ───────────────────
// Data-wired jazz bar: rhythm section is the ambiance,
// melody responds to price direction (Oracle-style).
// Heat controls energy (layer gating + volume scaling).
// category: 'music', label: 'Late Night in Bb'

const jazzTrioTrack = (() => {
  let _cachedCode = null;
  let _cachedKey = null;

  // Scale all decimal gain/velocity values in a mini-notation string
  function scaleGains(pattern, factor) {
    return pattern.replace(/\d+\.\d+/g, (m) =>
      (parseFloat(m) * factor).toFixed(2)
    );
  }

  // Quantize to reduce cache churn
  function q(v, step) {
    return Math.round(v / step) * step;
  }

  // ── Layer code generators ──────────────────────────────
  // Each returns a strudel code string fragment.
  // `energy` is 0.4 (silent market) → 1.0 (full heat).

  function bassCode(energy) {
    const gains = scaleGains(
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
      energy,
    );
    return `
$: note(\`<
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
>\`)
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

  function hihatSimpleCode(energy) {
    // Just 2 & 4 — minimal hi-hat for low energy
    const g = (0.25 * energy).toFixed(2);
    return `
$: s("[~ hh ~ hh]")
  .gain(${g})
  .cut(1)
  .orbit(4);
`;
  }

  function hihatFullCode(energy) {
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

  function compSparseCode(energy) {
    // Comping on bars 1, 3, 5, 7 only — silent on alternate bars
    // so the rhythm aligns with the 8-bar chord changes
    const vel = (0.20 * energy).toFixed(2);
    const velMax = (0.35 * energy).toFixed(2);
    return `
$: chord(changes)
  .dict("ireal")
  .voicing()
  .struct(\`<
    [~ [~@2 x] ~ [~@2 x]]
    [~ ~ ~ ~]
    [~ x ~ [~@2 x]]
    [~ ~ ~ ~]
    [~ [~@2 x] [~@2 x] ~]
    [~ ~ ~ ~]
    [[~@2 x] ~ ~ [~@2 x]]
    [~ ~ ~ ~]
  >\`)
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

  function compFullCode(energy) {
    const vel = (0.25 * energy).toFixed(2);
    const velMax = (0.45 * energy).toFixed(2);
    return `
$: chord(changes)
  .dict("ireal")
  .voicing()
  .struct(\`<
    [~ [~@2 x] ~ [~@2 x]]
    [[~@2 x] ~ ~ x]
    [~ x ~ [~@2 x]]
    [~ ~ [~@2 x] ~]
    [~ [~@2 x] [~@2 x] ~]
    [~ x ~ [~@2 x]]
    [[~@2 x] ~ ~ [~@2 x]]
    [~ [~@2 x] ~ x]
  >\`)
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

  function ghostSnareCode(energy) {
    const gMin = (0.05 * energy).toFixed(2);
    const gMax = (0.09 * energy).toFixed(2);
    return `
$: s("[~@2 sd] ~ [~@2 sd] ~")
  .gain(rand.range(${gMin}, ${gMax}))
  .sometimesBy(0.35, (x) => x.gain(0))
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

  function melodyCode(pm, pmAbs) {
    // Ascending phrases for price up, descending (original) for price down.
    // Both voice-lead over the Autumn Leaves changes:
    //   Cm7 → F7 → BbΔ7 → EbΔ7 → Am7b5 → D7 → Gm7 → [Cm7 F7]
    //
    // Ascending: each phrase climbs through chord tones
    //   Cm7:    Bb4(7th)→C5(root)→D5(9th)→Eb5(3rd)
    //   F7:     A4(3rd)→C5(5th)→Eb5(7th)
    //   BbΔ7:   Bb4(root)→D5(3rd)→F5(5th)
    //   EbΔ7:   Eb4(root)→G4(3rd)→Bb4(5th)
    //   Am7b5:  C5(b3)→D5(4th)→Eb5(b5)→G5(b7)
    //   D7:     F#4(3rd)→A4(5th)→C5(b7)
    //   Gm7:    G4(root)→Bb4(3rd)→D5(5th)
    //   turn:   Eb4(3rd/Cm)→F4(root/F)→G4(9th)→A4(3rd/F)
    //
    // Descending: the original melody (naturally falls through the changes)
    const ascending = `<
  [Bb4 C5 D5 Eb5]
  [A4 C5 Eb5 ~]
  [Bb4 ~ D5 F5]
  [Eb4 G4 Bb4 ~]
  [C5 D5 Eb5 G5]
  [F#4 A4 C5 ~]
  [G4 Bb4 D5 ~]
  [Eb4 F4 G4 A4]
>`;
    const descending = `<
  [Eb5 D5 C5 Bb4]
  [A4@3 ~]
  [~ D5 C5 Bb4]
  [G4@3 ~]
  [C5 Eb5 D5 C5]
  [A4 F#4 G4@2]
  [G4@2 Bb4 A4]
  [G4 F4 Eb4@2]
>`;
    const melody = pm >= 0 ? ascending : descending;
    // Velocity scales with price move magnitude
    const vel = (0.30 + pmAbs * 0.30).toFixed(2);
    const velMax = (0.40 + pmAbs * 0.20).toFixed(2);
    return `
$: note(\`${melody}\`)
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

  return {
    name: "jazz_trio",
    label: "Late Night in Bb",
    category: "music",

    init() {
      _cachedCode = null;
      _cachedKey = null;
    },

    evaluateCode(data) {
      const h = data.heat || 0;
      const pm = data.price_move || 0;
      const pmAbs = Math.abs(pm);

      // Quantize for cache stability
      const hQ = q(h, 0.05);
      const pmDir = pmAbs < 0.05 ? 0 : pm > 0 ? 1 : -1;
      const pmMag = q(pmAbs, 0.1);
      const key = `${hQ}:${pmDir}:${pmMag}`;

      if (_cachedCode && _cachedKey === key) return _cachedCode;

      // Energy scales volume: 0.4 at rest → 1.0 at full heat
      const energy = 0.4 + hQ * 0.6;

      let code = "setcpm(30);\n";
      code +=
        'let changes = "<Cm7 F7 Bb^7 Eb^7 Am7b5 D7 Gm7 [Cm7 F7]>";\n';

      // ── Always on: bass + ride ──
      code += bassCode(energy);
      code += rideCode(energy);

      // ── Hi-hat: simple 2&4 at low energy, full 8-bar pattern when active ──
      if (hQ > 0.35) {
        code += hihatFullCode(energy);
      } else {
        code += hihatSimpleCode(energy);
      }

      // ── Comping: sparse at medium heat, full at high ──
      if (hQ > 0.5) {
        code += compFullCode(energy);
      } else if (hQ > 0.2) {
        code += compSparseCode(energy);
      }

      // ── Ghost snare: medium heat ──
      if (hQ > 0.2) code += ghostSnareCode(energy);

      // ── Cross-stick: medium-high heat ──
      if (hQ > 0.4) code += crossStickCode();

      // ── Kick bombs: high heat only ──
      if (hQ > 0.6) code += kickCode(energy);

      // ── Turnaround fill: high heat only ──
      if (hQ > 0.6) code += fillCode();

      // ── Melody: only when price is actively moving ──
      if (pmAbs > 0.05 && hQ > 0.3) {
        code += melodyCode(pm, pmAbs);
      }

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
  };
})();

audioEngine.registerTrack("jazz_trio", jazzTrioTrack);
