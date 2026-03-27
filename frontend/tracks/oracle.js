// ── Oracle Track (Strudel) ───────────────────────────────
// Piano chords trace the price curve directly.
// price_move (rolling 30s window) drives everything:
//   magnitude → number of chords (2-5)
//   sign → ascending (price up) or descending (price down)
// Sensitivity controls how big a move triggers music.
// Major scale when bullish, minor when bearish.
// category: 'alert', label: 'Oracle'

const oracleTrack = {
  name: 'oracle',
  label: 'Oracle',
  category: 'alert',

  _cachedPattern: null,
  _cachedKey: null,

  init() {
    this._cachedPattern = null;
    this._cachedKey = null;
  },

  pattern(data) {
    const pm = data.price_move || 0;
    const mag = Math.abs(pm);

    // No meaningful price movement → silence
    if (mag < 0.05) {
      this._cachedPattern = null;
      this._cachedKey = null;
      return null;
    }

    // Major (bullish) or minor (bearish)
    const t = data.tone !== undefined ? data.tone : 1;
    const root = t === 1 ? 'C4' : 'A3';
    const scaleType = t === 1 ? 'major' : 'minor';

    // 2-5 chords based on movement magnitude
    const num = Math.min(5, 2 + Math.floor(mag * 4));

    // Direction follows the price curve
    const dir = pm >= 0 ? 'up' : 'down';

    // Return cached pattern if musical output hasn't changed
    const key = `${dir}:${num}:${root}`;
    if (this._cachedPattern && this._cachedKey === key) {
      return this._cachedPattern;
    }

    // Build triads from explicit note names (same proven approach as mezzanine pads)
    const scaleNotes = getScaleNotes(root, scaleType, 14, 2);
    const chords = [];
    for (let i = 0; i < num; i++) {
      const idx = dir === 'up' ? i : (num - 1 - i);
      const r = noteToStrudel(scaleNotes[idx]);
      const third = noteToStrudel(scaleNotes[idx + 2]);
      const fifth = noteToStrudel(scaleNotes[idx + 4]);
      chords.push(`[${r},${third},${fifth}]`);
    }
    const rests = Array(Math.max(2, 5 - num)).fill('~');
    const pat = [...chords, ...rests].join(' ');

    // Volume scales with movement; slow sine gives natural per-chord dynamics
    const vol = 0.02 + mag * 0.04;

    const result = note(pat)
      .sound("piano")
      .gain(sine.range(vol * 0.75, vol).slow(3))
      .room(0.5)
      .clip(2)
      .cpm(40);

    this._cachedPattern = result;
    this._cachedKey = key;
    return result;
  },

  onEvent() { return null; },
};

audioEngine.registerTrack('oracle', oracleTrack);
