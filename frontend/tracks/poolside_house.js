// category: 'music', label: 'Poolside House'

const poolsideHouse = (() => {
  let _cachedCode = null;
  let _cachedKey = null;

  return {
    name: "poolside_house",
    label: "Poolside House",
    category: "music",
    cpm: 29, // ~116 BPM — relaxed daytime house tempo

    voices: {
      kick:    { label: "Kick",    default: 1.0 },
      chords:  { label: "Chords",  default: 1.0 },
      bass:    { label: "Bass",    default: 1.0 },
      perc:    { label: "Perc",    default: 1.0 },
      melody:  { label: "Melody",  default: 1.0 },
      counter: { label: "Counter", default: 1.0 },
      pad:     { label: "Pad",     default: 1.0 },
    },

    gains: {},

    getGain(voice) {
      return this.gains[voice] ?? this.voices[voice]?.default ?? 1.0;
    },

    init() {
      _cachedCode = null;
      _cachedKey = null;
    },

    evaluateCode(data) {
      // --- 1. Extract & quantize signals ---
      const h = Math.round((data.heat || 0) * 20) / 20;
      const tone = data.tone !== undefined ? data.tone : 1;
      const tradeRate = Math.round((data.trade_rate || 0) * 10) / 10;
      const velocity = Math.round((data.velocity || 0) * 10) / 10;
      const volat = Math.round((data.volatility || 0) * 10) / 10;
      const mom = Math.round((data.momentum || 0) * 10) / 10;
      const price = Math.round((data.price || 0.5) * 10) / 10;

      // Intensity band: 0=chill, 1=grooving, 2=vibing hard
      const rawIntensity = 0.6 * tradeRate + 0.4 * velocity;
      const intBand = rawIntensity < 0.33 ? 0 : rawIntensity < 0.66 ? 1 : 2;

      // --- 2. Cache check ---
      const gainKey = Object.keys(this.voices)
        .map(v => this.getGain(v).toFixed(2)).join(':');
      const key = `${h}:${tone}:${intBand}:${volat}:${mom}:${price}:${gainKey}`;
      if (_cachedCode && _cachedKey === key) return _cachedCode;

      // --- 3. Derived values ---
      const energy = h; // raw heat IS the energy — no floor, silence is valid
      const filterBase = 600 + price * 1400;
      const reverbWet = (0.3 + volat * 0.35).toFixed(2);
      const roomSize = (2 + volat * 4).toFixed(1);

      // Momentum direction: 1=up, -1=down, 0=sideways
      const momSign = Math.abs(mom) < 0.15 ? 0 : (mom > 0 ? 1 : -1);
      // Volatility-driven fragmentation
      const degradeAmt = (volat * 0.4).toFixed(2);

      // --- 4. Build code — 9 $: blocks always emitted ---
      let code = "setcpm(29);\n\n";

      // ==============================
      // BLOCK 1: Soft four-on-the-floor kick
      // Active when heat > 0.3
      // ==============================
      if (h > 0.3) {
        const kickGain = (0.35 * energy * this.getGain('kick')).toFixed(3);
        code += `$: s("bd bd bd bd").gain(${kickGain}).lpf(100).orbit(4);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCK 2: Rhodes / EP chords
      // Active when heat > 0.15 — first harmonic layer to appear
      // Root motion direction follows momentum: ascending roots on uptrend,
      // descending on downtrend, standard cycle when sideways
      // ==============================
      if (h > 0.15) {
        let changes;
        if (tone === 1) {
          // Major world
          if (momSign > 0)      changes = "<C^7 Dm9 Em7 F^7>";      // roots ascend: C→D→E→F
          else if (momSign < 0) changes = "<C^7 Bb^7 Am9 G7>";      // roots descend: C→Bb→A→G
          else                  changes = "<C^7 Am9 Dm9 G7>";        // standard cycle
        } else {
          // Minor world
          if (momSign > 0)      changes = "<Am7 Bm7b5 Cm7 Dm7>";    // roots ascend: A→B→C→D
          else if (momSign < 0) changes = "<Am7 Gm7 Fm9 E7>";       // roots descend: A→G→F→E
          else                  changes = "<Am7 Fm9 Dm7 E7>";        // standard cycle
        }
        const epGain = (0.25 * energy * this.getGain('chords')).toFixed(3);
        code += `$: chord("${changes}").dict("ireal").voicing()`;
        code += `.struct("~ [~@2 x] ~ [~@2 x]")`;
        code += `.s("gm_epiano1").gain(${epGain})`;
        code += `.room(${reverbWet}).rsize(${roomSize})`;
        code += `.lpf(${Math.round(filterBase)})`;
        code += `.pan(0.4).orbit(1);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCK 3: Bouncy, funky bassline
      // Active when heat > 0.25
      // Walking direction follows momentum — bass literally walks up or down
      // ==============================
      if (h > 0.25) {
        const bassGain = (0.3 * energy * this.getGain('bass')).toFixed(3);
        const bassLpf = Math.round(300 + h * 400);
        let bassPattern;
        if (tone === 1) {
          // Major: C root
          if (intBand >= 1) {
            if (momSign > 0)      bassPattern = "<[C2 D2 E2 F2] [A2 B2 C3 D3] [D2 E2 F2 G2] [G2 A2 B2 C3]>";   // walks up
            else if (momSign < 0) bassPattern = "<[C3 B2 A2 G2] [A2 G2 F2 E2] [D3 C3 B2 A2] [G2 F2 E2 D2]>";   // walks down
            else                  bassPattern = "<[C2 ~ E2 ~] [A2 ~ C3 A2] [D2 ~ F2 ~] [G2 ~ B2 G2]>";          // bouncy (sideways)
          } else {
            if (momSign > 0)      bassPattern = "<C2 D2 E2 F2>";
            else if (momSign < 0) bassPattern = "<C3 B2 A2 G2>";
            else                  bassPattern = "<C2 A2 D2 G2>";
          }
        } else {
          // Minor: A root
          if (intBand >= 1) {
            if (momSign > 0)      bassPattern = "<[A1 B1 C2 D2] [F2 G2 A2 B2] [D2 E2 F2 G2] [E2 F2 G#2 A2]>"; // walks up
            else if (momSign < 0) bassPattern = "<[A2 G2 F2 E2] [F2 E2 D2 C2] [D2 C2 B1 A1] [E2 D2 C2 B1]>"; // walks down
            else                  bassPattern = "<[A1 ~ C2 ~] [F2 ~ A2 F2] [D2 ~ F2 ~] [E2 ~ G#2 E2]>";       // bouncy (sideways)
          } else {
            if (momSign > 0)      bassPattern = "<A1 B1 C2 D2>";
            else if (momSign < 0) bassPattern = "<A2 G2 F2 E2>";
            else                  bassPattern = "<A1 F2 D2 E2>";
          }
        }
        code += `$: note("${bassPattern}").s("sawtooth")`;
        code += `.lpf(${bassLpf}).lpq(3).decay(0.3).sustain(0)`;
        code += `.gain(${bassGain}).orbit(3);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCKS 4-6: Organic percussion (3 blocks, always emitted)
      // Active when heat > 0.3 (with kick)
      // ==============================
      if (h > 0.3) {
        const pGM = this.getGain('perc');
        const percGainLo = (0.1 * energy * pGM).toFixed(3);
        const percGainHi = (0.25 * energy * pGM).toFixed(3);

        if (intBand === 0) {
          // Minimal: humanized shaker with rotating accent
          code += `$: s("hh*8").gain(perlin.range(${percGainLo}, ${percGainHi})).hpf(9000)`;
          code += `.iter(4)`;
          code += `.pan(0.6).orbit(4);\n`;
          code += `$: silence;\n`;
          code += `$: silence;\n`;
        } else if (intBand === 1) {
          // Humanized hats + claps on 2&4 + probabilistic open hat
          code += `$: s("hh*8").gain(perlin.range(${percGainLo}, ${percGainHi})).hpf(9000)`;
          code += `.sometimes(x => x.gain(${(0.35 * energy * pGM).toFixed(3)}))`;
          code += `.iter(4)`;
          code += `.pan(0.6).orbit(4);\n`;
          code += `$: s("~ cp ~ cp").gain(${(0.2 * energy * pGM).toFixed(3)}).room(${reverbWet}).pan(0.55).orbit(4);\n`;
          code += `$: s("oh").struct("~ x ~ ~").degradeBy(0.3).gain(${(0.1 * energy * pGM).toFixed(3)}).hpf(7000).pan(0.65).orbit(4);\n`;
        } else {
          // Full groove: dense humanized hats, claps, euclidean rim
          code += `$: s("hh*16").gain(perlin.range(${percGainLo}, ${percGainHi})).hpf(9000)`;
          code += `.sometimes(x => x.gain(${(0.35 * energy * pGM).toFixed(3)}))`;
          code += `.rarely(x => x.ply(2))`;
          code += `.every(4, x => x.struct("x(5,8)"))`;
          code += `.pan(0.6).orbit(4);\n`;
          code += `$: s("~ cp ~ cp").gain(${(0.2 * energy * pGM).toFixed(3)})`;
          code += `.every(7, x => x.ply(2))`;
          code += `.room(${reverbWet}).pan(0.55).orbit(4);\n`;
          code += `$: s("rim").struct("x(3,8)").gain(${(0.12 * energy * pGM).toFixed(3)})`;
          code += `.iter(3)`;
          code += `.room(0.3).pan(0.7).orbit(4);\n`;
        }
      } else {
        code += `$: silence;\n`;
        code += `$: silence;\n`;
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCK 7: Plucked synth melody — directional contour + generative
      // Active when |momentum| > 0.2 or heat > 0.5
      // Phrase SHAPE follows momentum: ascending lines on uptrend, descending on down
      // ==============================
      const melodyActive = Math.abs(mom) > 0.2 || h > 0.5;
      if (melodyActive) {
        const melodyGain = (0.18 * energy * this.getGain('melody')).toFixed(3);
        const scale = tone === 1 ? "C4:major" : "A4:minor";

        let melodyPattern;
        if (momSign > 0) {
          // Ascending phrases — notes climb stepwise
          melodyPattern = intBand >= 2
            ? "[0 2 4 6] [2 4 6 7] [4 6 7 9] [6 7 9 11]"
            : "[0 ~ 2 ~] [4 ~ 6 ~] [7 ~ 9 ~] [6 ~ 7 ~]";
        } else if (momSign < 0) {
          // Descending phrases — notes fall stepwise
          melodyPattern = intBand >= 2
            ? "[11 9 7 6] [9 7 6 4] [7 6 4 2] [6 4 2 0]"
            : "[7 ~ 6 ~] [6 ~ 4 ~] [4 ~ 2 ~] [2 ~ 0 ~]";
        } else {
          // Sideways / low momentum — meandering with random choices
          melodyPattern = intBand >= 2
            ? "[0|2] [2|4] [4|6] [~|7] [7|4] [~|6] [2|4] [0|2]"
            : "[0|2] ~ [4|6] ~ [7|4] ~ [2|0] ~";
        }

        code += `$: note("${melodyPattern}").scale("${scale}")`;
        // Generative transforms: iter rotates start, palindrome doubles length,
        // degradeBy (driven by volatility) fragments the line
        code += `.iter(4).palindrome()`;
        code += `.degradeBy(${degradeAmt})`;
        // Probabilistic octave jumps for sparkle
        code += `.rarely(x => x.add(note(7)))`;
        code += `.s("triangle").decay(0.15).sustain(0)`;
        code += `.gain(${melodyGain}).room(${reverbWet}).rsize(${roomSize})`;
        code += `.delay(0.25).delaytime(${(60 / 116 / 2).toFixed(4)}).delayfeedback(0.35)`;
        code += `.pan(0.35).orbit(2);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCK 8: Secondary melody / counter-motif
      // Active when heat > 0.6 — follows same directional contour as main melody
      // ==============================
      if (h > 0.6) {
        const counterGain = (0.1 * energy * this.getGain('counter')).toFixed(3);
        const scale = tone === 1 ? "C5:major" : "A5:minor";
        // Counter-melody mirrors main direction but with different rhythm and offset
        let counterPattern;
        if (momSign > 0)      counterPattern = "[2 ~ 4 6] [4 ~ 6 7]";   // ascending, sparser
        else if (momSign < 0) counterPattern = "[7 ~ 6 4] [6 ~ 4 2]";   // descending
        else                  counterPattern = "[4|5] [6|7] [2|4] [0|2]"; // meandering
        code += `$: note("${counterPattern}").scale("${scale}")`;
        code += `.iter(3).degradeBy(${(parseFloat(degradeAmt) + 0.15).toFixed(2)})`;
        code += `.s("triangle").decay(0.1).sustain(0)`;
        code += `.gain(${counterGain})`;
        code += `.delay(0.3).delaytime(${(60 / 116 / 3).toFixed(4)}).delayfeedback(0.4)`;
        code += `.room(${reverbWet})`;
        code += `.pan(0.65).orbit(2);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // ==============================
      // BLOCK 9: Atmospheric pad — last layer to arrive, last to leave
      // Active when heat > 0.1
      // Chord voicings follow momentum direction (ascending/descending root motion)
      // ==============================
      if (h > 0.1) {
        const padGain = (0.15 * energy * this.getGain('pad')).toFixed(3);
        let padChanges;
        if (tone === 1) {
          if (momSign > 0)      padChanges = "<[C3,E3,G3,B3] [D3,F3,A3,C4] [E3,G3,B3,D4] [F3,A3,C4,E4]>";  // roots climb
          else if (momSign < 0) padChanges = "<[C4,E4,G4,B4] [Bb3,D4,F4,A4] [A3,C4,E4,G4] [G3,B3,D4,F4]>"; // roots fall
          else                  padChanges = "<[C3,E3,G3,B3] [A3,C4,E4,G4] [D3,F3,A3,C4] [G3,B3,D4,F4]>";   // standard cycle
        } else {
          if (momSign > 0)      padChanges = "<[A3,C4,E4,G4] [B3,D4,F4,A4] [C4,E4,G4,B4] [D4,F4,A4,C5]>";  // roots climb
          else if (momSign < 0) padChanges = "<[A3,C4,E4,G4] [G3,B3,D4,F4] [F3,A3,C4,E4] [E3,G#3,B3,D4]>"; // roots fall
          else                  padChanges = "<[A3,C4,E4,G4] [F3,A3,C4,E4] [D3,F3,A3,C4] [E3,G#3,B3,D4]>";  // standard cycle
        }
        code += `$: note("${padChanges}").s("triangle")`;
        code += `.attack(0.8).release(2).sustain(0.6)`;
        code += `.gain(${padGain}).lpf(${Math.round(filterBase * 0.7)})`;
        code += `.room(${(parseFloat(reverbWet) + 0.15).toFixed(2)}).rsize(${(parseFloat(roomSize) + 1).toFixed(1)})`;
        code += `.pan(sine.range(0.3, 0.7).slow(16))`;
        code += `.orbit(1);\n`;
      } else {
        code += `$: silence;\n`;
      }

      // --- 5. Cache and return ---
      _cachedCode = code;
      _cachedKey = key;
      return code;
    },

    onEvent(type, msg, data) {
      if (type === "spike") {
        const gain = (0.02 + (msg.magnitude || 0.5) * 0.03).toFixed(3);
        return `$: s("<oh:3 ~ ~ ~>").gain(${gain}).room(0.6).rsize(4).hpf(5000).orbit(5);`;
      }
      if (type === "price_move") {
        const dir = msg.direction || 1;
        const mag = msg.magnitude || 0.5;
        const gain = (0.04 + mag * 0.04).toFixed(3);
        const tone = data.tone !== undefined ? data.tone : 1;
        const scale = tone === 1 ? "C5:major" : "A4:minor";
        const run = dir > 0
          ? "[0 2 4 6]"
          : "[6 4 2 0]";
        return `$: note("${run}").scale("${scale}").s("triangle").decay(0.12).sustain(0).gain(${gain}).room(0.4).delay(0.2).delayfeedback(0.3).orbit(5);`;
      }
      if (type === "resolved") {
        const result = msg.result || 1;
        const chord = result > 0 ? "C3,E3,G3,B3" : "A3,C4,E4,G4";
        return `$: note("${chord}").s("gm_epiano1").attack(0.5).release(4).gain(0.08).room(0.7).rsize(5).orbit(5);`;
      }
      return null;
    },
  };
})();

audioEngine.registerTrack("poolside_house", poolsideHouse);
