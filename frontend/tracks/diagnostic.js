// ── Diagnostic Track ─────────────────────────────────────
// One sound per signal, spatially separated, individually toggleable.
// Not musical — designed for audible data verification.
// Close your eyes and identify: "heat ~0.6, momentum negative, volatility high."
//
// Toggle layers on/off in the LAYERS config below.
// category: 'diagnostic', label: 'Data Diagnostic'

const diagnosticTrack = (() => {
  let _cachedCode = null;
  let _cachedKey = null;

  // ── Toggle individual layers on/off for isolation ──
  const LAYERS = {
    heat: true,        // Kick pulse — rate speeds up with heat
    price: true,       // Sine drone — pitch tracks price (C3 at 0 → C5 at 1)
    momentum: true,    // Sawtooth sweep — rising when +ve, falling when -ve
    volatility: true,  // Filtered noise — wider/louder when volatile
    priceMove: true,   // Piano arp — ascending or descending on active move
    tradeRate: true,   // Hi-hat — density increases with trade_rate
    tone: true,        // Pad chord — major or minor
    spread: true,      // Click/tick — filter opens with spread
    events: true,      // Crash on spike, bell on price_move event
  };

  function q(v, step) {
    return Math.round(v / step) * step;
  }

  // ── Layer code generators ──
  // Each returns a $: block. Orbit + pan isolate every layer.

  function heatCode(heat) {
    // Kick drum pulse: 1 hit/cycle at heat=0, up to 8 hits at heat=1
    // Gain also scales so you hear intensity
    const hits = Math.max(1, Math.round(1 + heat * 7));
    const struct = Array(8).fill('~');
    for (let i = 0; i < hits; i++) {
      struct[i] = 'x';
    }
    const g = (0.15 + heat * 0.15).toFixed(2);
    return `
$: s("bd:3").struct("${struct.join(' ')}").gain(${g}).pan(0.5).orbit(0);
`;
  }

  function priceCode(price) {
    // Sine drone: pitch maps linearly C3 (0.0) → C5 (1.0)
    // That's MIDI 48–72 = 24 semitones
    const midi = Math.round(48 + price * 24);
    const noteName = midiToNote(midi);
    const n = noteToStrudel(noteName);
    return `
$: note("${n}").s("sine").gain(0.08).lpf(800).pan(0.5).sustain(3).orbit(1);
`;
  }

  function momentumCode(momentum) {
    // Sawtooth with pitch sweep: base note shifts with momentum
    // Positive momentum → higher pitch, negative → lower
    // Slow LFO on pitch so you hear the "direction" as movement
    const absMom = Math.abs(momentum);
    if (absMom < 0.05) {
      // Near zero — quiet hum at middle pitch
      return `
$: note("c4").s("sawtooth").gain(0.03).lpf(300).pan(0.25).orbit(2);
`;
    }
    // Map momentum -1→1 to midi 48→72 (C3→C5), center at C4 (60)
    const midi = Math.round(60 + momentum * 12);
    const noteName = noteToStrudel(midiToNote(midi));
    const g = (0.04 + absMom * 0.06).toFixed(2);
    // Sweep direction: positive momentum sweeps filter up, negative sweeps down
    const lpfLo = momentum > 0 ? 200 : 400;
    const lpfHi = momentum > 0 ? 600 : 200;
    return `
$: note("${noteName}").s("sawtooth").gain(${g}).lpf(sine.range(${lpfLo}, ${lpfHi}).slow(4)).pan(0.25).orbit(2);
`;
  }

  function volatilityCode(volatility) {
    // Filtered noise: bandwidth and gain scale with volatility
    // Calm = barely audible narrow hiss, volatile = wide loud wash
    if (volatility < 0.05) {
      return '\n$: silence;\n';
    }
    const g = (0.02 + volatility * 0.08).toFixed(2);
    const lpf = Math.round(300 + volatility * 2000);
    const hpf = Math.round(200 - volatility * 150);
    return `
$: s("pink").gain(${g}).lpf(${lpf}).hpf(${Math.max(50, hpf)}).pan(0.75).orbit(3);
`;
  }

  function priceMoveCode(priceMove) {
    // Piano arp: ascending when positive, descending when negative
    // Number of notes scales with magnitude
    const absPm = Math.abs(priceMove);
    if (absPm < 0.05) {
      return '\n$: silence;\n';
    }
    const numNotes = Math.min(6, 2 + Math.floor(absPm * 5));
    const scaleNotes = getScaleNotes('C4', 'major', 8, 1);
    const selected = [];
    for (let i = 0; i < numNotes; i++) {
      const idx = priceMove >= 0 ? i : (numNotes - 1 - i);
      selected.push(noteToStrudel(scaleNotes[idx]));
    }
    const g = (0.06 + absPm * 0.06).toFixed(2);
    return `
$: note("${selected.join(' ')}").s("piano").gain(${g}).room(0.2).pan(0.25).orbit(4);
`;
  }

  function tradeRateCode(tradeRate) {
    // Hi-hat: density increases with trade_rate
    // 2 hits at 0 → 8 hits at 1
    const hits = Math.max(2, Math.round(2 + tradeRate * 6));
    const struct = Array(8).fill('~');
    for (let i = 0; i < hits; i++) {
      // Spread hits evenly
      const pos = Math.floor(i * 8 / hits);
      struct[pos] = 'x';
    }
    const g = (0.10 + tradeRate * 0.12).toFixed(2);
    return `
$: s("hh:6").struct("${struct.join(' ')}").gain(${g}).pan(0.75).orbit(5);
`;
  }

  function toneCode(tone) {
    // Pad chord: C major (tone=1) or A minor (tone=0)
    // Quiet background harmonic reference
    const chord = tone === 1
      ? '[c4,e4,g4]'   // C major
      : '[a3,c4,e4]';  // A minor
    return `
$: note("${chord}").s("triangle").gain(0.04).lpf(600).attack(0.3).release(1).pan(0.5).orbit(6);
`;
  }

  function spreadCode(spread) {
    // Rhythmic click: filter opens with spread
    // Tight spread (low value) = muffled ticks, wide spread = bright clicks
    const lpf = Math.round(200 + spread * 3000);
    const g = (0.08 + spread * 0.10).toFixed(2);
    return `
$: s("cb:0").struct("~ x ~ x").gain(${g}).lpf(${lpf}).pan(0.75).orbit(7);
`;
  }

  // ── Track object ──

  return {
    name: 'diagnostic',
    label: 'Data Diagnostic',
    category: 'diagnostic',
    cpm: 30,

    init() {
      _cachedCode = null;
      _cachedKey = null;
    },

    evaluateCode(data) {
      const heat = data.heat || 0;
      const price = data.price || 0.5;
      const momentum = data.momentum || 0;
      const volatility = data.volatility || 0;
      const pm = data.price_move || 0;
      const tradeRate = data.trade_rate || 0;
      const tone = data.tone !== undefined ? data.tone : 1;
      const spread = data.spread || 0;

      // Quantize everything for cache stability
      const hQ = q(heat, 0.05);
      const pQ = q(price, 0.04);  // ~1 semitone resolution
      const momQ = q(momentum, 0.1);
      const volQ = q(volatility, 0.1);
      const pmQ = q(pm, 0.1);
      const trQ = q(tradeRate, 0.1);
      const spQ = q(spread, 0.1);

      const key = `${hQ}:${pQ}:${momQ}:${volQ}:${pmQ}:${trQ}:${tone}:${spQ}`;
      if (_cachedCode && _cachedKey === key) return _cachedCode;

      let code = 'setcpm(30);\n';

      // Each layer gets a $: block (silence if disabled) to keep IDs stable
      code += LAYERS.heat       ? heatCode(hQ)          : '\n$: silence;\n';
      code += LAYERS.price      ? priceCode(pQ)         : '\n$: silence;\n';
      code += LAYERS.momentum   ? momentumCode(momQ)    : '\n$: silence;\n';
      code += LAYERS.volatility ? volatilityCode(volQ)  : '\n$: silence;\n';
      code += LAYERS.priceMove  ? priceMoveCode(pmQ)    : '\n$: silence;\n';
      code += LAYERS.tradeRate  ? tradeRateCode(trQ)    : '\n$: silence;\n';
      code += LAYERS.tone       ? toneCode(tone)        : '\n$: silence;\n';
      code += LAYERS.spread     ? spreadCode(spQ)       : '\n$: silence;\n';

      _cachedCode = code;
      _cachedKey = key;
      return code;
    },

    onEvent(type, msg) {
      if (!LAYERS.events) return null;

      if (type === 'spike') {
        // Crash — gain scales with magnitude
        const g = (0.04 + (msg.magnitude || 0.5) * 0.06).toFixed(3);
        return `$: s("cr:0").gain(${g}).room(0.3).pan(0.5).orbit(8);`;
      }
      if (type === 'price_move') {
        // Distinct bell — pitch indicates direction (high=up, low=down)
        const n = msg.direction > 0 ? 'g5' : 'c4';
        const g = (0.05 + (msg.magnitude || 0.5) * 0.05).toFixed(3);
        return `$: note("${n}").s("gm_vibraphone").gain(${g}).room(0.4).pan(0.5).orbit(8);`;
      }
      return null;
    },
  };
})();

audioEngine.registerTrack('diagnostic', diagnosticTrack);
