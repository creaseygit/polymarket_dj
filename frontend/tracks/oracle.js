// ── Oracle Track (Strudel) ───────────────────────────────
// Alert track. Silence when market is calm.
// Piano scale runs when price moves — length and direction match the move.
// Ported from sonic_pi/oracle.rb.
// category: 'alert', label: 'Oracle'

const oracleTrack = {
  name: 'oracle',
  label: 'Oracle',
  category: 'alert',

  init() {},

  pattern(data) {
    const pd = data.price_delta || 0;
    const mag = Math.abs(pd);

    // No significant movement → silence
    if (mag <= 0.1) return null;

    // Scale: C major (bullish) or A minor (bearish)
    const t = data.tone !== undefined ? data.tone : 1;
    const root = t === 1 ? 'C4' : 'A3';
    const scaleType = t === 1 ? 'major' : 'minor';

    // Bigger move → more notes (2-6)
    const num = Math.min(6, Math.max(2, 2 + Math.floor(mag * 6)));
    let notes = getScaleNotes(root, scaleType, num, 2);
    if (pd < 0) notes.reverse();

    // Volume scales with magnitude and market activity
    const v = data.velocity || 0.1;
    const tr = data.trade_rate || 0.2;
    const activity = Math.min(1.0, 0.3 + v * 0.4 + tr * 0.3);
    const vol = Math.min(0.05, Math.max(0.02, 0.02 + mag * 0.06)) * activity;

    // Notes + rest padding = 10 elements.
    // At cpm(20) → 3s cycle → 0.3s per element (matches Sonic Pi sleep 0.3).
    const rests = Array(Math.max(1, 10 - num)).fill('~');
    const pat = [...notes.map(n => noteToStrudel(n)), ...rests].join(' ');

    return note(pat)
      .sound("piano")
      .gain(vol)
      .room(0.6)
      .roomlp(3000)
      .cpm(20);
  },

  onEvent() { return null; },
};

audioEngine.registerTrack('oracle', oracleTrack);
