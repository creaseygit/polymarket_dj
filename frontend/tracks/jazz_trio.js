// ── Late Night in Bb — Jazz Piano Trio ───────────────────
// Exact strudel.cc code evaluated via evaluate() — no translation.
// The code below is identical to what you paste into strudel.cc.
// category: 'music', label: 'Late Night in Bb'

const jazzTrioTrack = (() => {
  // The exact original strudel code — verbatim, no changes.
  // evaluate() runs it through the transpiler ($:, setcpm, etc.)
  // exactly like strudel.cc's REPL does.
  const CODE = `
setcpm(30);

let changes = "<Cm7 F7 Bb^7 Eb^7 Am7b5 D7 Gm7 [Cm7 F7]>";

$: chord(changes)
  .dict("ireal")
  .voicing()
  .struct(
    \`<
    [~ [~@2 x] ~ [~@2 x]]
    [[~@2 x] ~ ~ x]
    [~ x ~ [~@2 x]]
    [~ ~ [~@2 x] ~]
    [~ [~@2 x] [~@2 x] ~]
    [~ x ~ [~@2 x]]
    [[~@2 x] ~ ~ [~@2 x]]
    [~ [~@2 x] ~ x]
  >\`,
  )
  .s("piano")
  .clip(1)
  .velocity(rand.range(0.25, 0.45))
  .room(0.25)
  .roomsize(3)
  .delay(0.12)
  .delaytime(0.18)
  .delayfeedback(0.2)
  .orbit(1);

$: note(\`<
  [Eb5 D5 C5 Bb4]
  [A4@3 ~]
  [~ D5 C5 Bb4]
  [G4@3 ~]
  [C5 Eb5 D5 C5]
  [A4 F#4 G4@2]
  [G4@2 Bb4 A4]
  [G4 F4 Eb4@2]
>\`)
  .s("piano")
  .clip(1)
  .velocity(rand.range(0.45, 0.6))
  .room(0.25)
  .roomsize(3)
  .delay(0.08)
  .delaytime(0.18)
  .delayfeedback(0.15)
  .orbit(2);

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
  .gain(
    \`<
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
  >\`,
  )
  .lpf(900)
  .hpf(60)
  .room(0.08)
  .speed(rand.range(0.98, 1.02))
  .orbit(3);

$: s("rd [rd@2 rd] rd [rd@2 rd]")
  .gain("0.25 [0.28 0.12] 0.3 [0.32 0.12]")
  .orbit(4);

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
  .gain(
    \`<
    [~ 0.30 ~ 0.24]
    [0.10 0.30 0.10 0.24]
    [~ 0.30 ~ [0.24 [~ 0.14]]]
    [~ 0.28 ~ 0.24]
    [~ 0.30 ~ 0.34]
    [0.12 0.32 0.12 [0.26 [~ 0.14]]]
    [~ 0.28 ~ 0.24]
    [~ 0.30 [~ 0.34] 0.24]
  >\`,
  )
  .cut(1)
  .orbit(4);

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
  .gain(0.18)
  .orbit(4);

$: s("[~@2 sd] ~ [~@2 sd] ~")
  .gain(rand.range(0.05, 0.09))
  .sometimesBy(0.35, (x) => x.gain(0))
  .orbit(4);

$: s("~ ~ ~ rim").degradeBy(0.5).gain(0.29).orbit(4);

$: s("<~ ~ ~ ~ ~ ~ ~ [~ ~ [sd ~] [~ ~ sd]]>").gain(0.22).room(0.15).orbit(4);
`;

  return {
    name: 'jazz_trio',
    label: 'Late Night in Bb',
    category: 'music',

    init() {},

    // Stage 1: no data wiring — just play the exact original code
    evaluateCode(data) {
      return CODE;
    },

    onEvent() { return null; },
  };
})();

audioEngine.registerTrack("jazz_trio", jazzTrioTrack);
