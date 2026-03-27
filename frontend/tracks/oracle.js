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

  // Pre-defined chord run patterns — triads on consecutive scale degrees.
  // Each [a,b,c] is a simultaneous triad (polyphonic mini-notation).
  // Degrees beyond 6 wrap into the next octave via Strudel's scale mapping.
  _runs: {
    up: {
      2: "[0,2,4] [1,3,5] ~ ~ ~ ~ ~",
      3: "[0,2,4] [1,3,5] [2,4,6] ~ ~ ~ ~",
      4: "[0,2,4] [1,3,5] [2,4,6] [3,5,7] ~ ~ ~",
      5: "[0,2,4] [1,3,5] [2,4,6] [3,5,7] [4,6,8] ~ ~",
    },
    down: {
      2: "[1,3,5] [0,2,4] ~ ~ ~ ~ ~",
      3: "[2,4,6] [1,3,5] [0,2,4] ~ ~ ~ ~",
      4: "[3,5,7] [2,4,6] [1,3,5] [0,2,4] ~ ~ ~",
      5: "[4,6,8] [3,5,7] [2,4,6] [1,3,5] [0,2,4] ~ ~",
    },
  },

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
    const scaleName = t === 1 ? 'C4:major' : 'A3:minor';

    // 2-5 chords based on movement magnitude
    const num = Math.min(5, 2 + Math.floor(mag * 4));

    // Direction follows the price curve
    const dir = pm >= 0 ? 'up' : 'down';

    // Return cached pattern if musical output hasn't changed —
    // the audio engine uses object identity to skip unnecessary .play() calls
    const key = `${dir}:${num}:${scaleName}`;
    if (this._cachedPattern && this._cachedKey === key) {
      return this._cachedPattern;
    }

    // Volume scales with movement size
    const vol = 0.02 + mag * 0.04;

    const result = mini(this._runs[dir][num])
      .n().scale(scaleName)
      .sound("piano")
      .gain(rand.range(vol * 0.8, vol * 1.2))
      .late(rand.range(0, 0.015))
      .room(0.5)
      .clip(2)
      .cpm(12);

    this._cachedPattern = result;
    this._cachedKey = key;
    return result;
  },

  onEvent() { return null; },
};

audioEngine.registerTrack('oracle', oracleTrack);
