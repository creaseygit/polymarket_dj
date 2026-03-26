// ── Audio Engine ──────────────────────────────────────────
// Manages Tone.js lifecycle, track loading, and market data routing.

const audioEngine = (() => {
  let initialized = false;
  let currentTrack = null;
  let masterGain = null;

  // Track registry — populated by track files calling audioEngine.registerTrack()
  const trackRegistry = {};

  async function init() {
    if (initialized) return;
    await Tone.start();
    masterGain = new Tone.Gain(0.7).toDestination();
    initialized = true;
    console.log('[Audio] Tone.js initialized');
  }

  async function selectTrack(name) {
    if (!initialized) await init();

    // Stop current track
    if (currentTrack) {
      currentTrack.stop();
      currentTrack = null;
    }

    const TrackClass = trackRegistry[name];
    if (!TrackClass) {
      console.warn('[Audio] Unknown track:', name);
      return;
    }

    currentTrack = new TrackClass(masterGain);
    currentTrack.start();
    console.log('[Audio] Track started:', name);
  }

  function stop() {
    if (currentTrack) {
      currentTrack.stop();
      currentTrack = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  function setVolume(v) {
    if (masterGain) {
      masterGain.gain.rampTo(v, 0.1);
    }
  }

  function onMarketData(data) {
    if (currentTrack && currentTrack.update) {
      currentTrack.update(data);
    }
  }

  function handleEvent(msg) {
    if (currentTrack && currentTrack.onEvent) {
      currentTrack.onEvent(msg.event, msg);
    }
  }

  function registerTrack(name, TrackClass) {
    trackRegistry[name] = TrackClass;
  }

  return { init, selectTrack, stop, setVolume, onMarketData, handleEvent, registerTrack };
})();

// ── Sample bank ─────────────────────────────────────────────
// Loads OGG samples on demand from /static/samples/.
// Usage:  const player = await sampleBank.getPlayer('bd_fat', destination);
//         player.start(time);

const sampleBank = (() => {
  const buffers = {};   // name → Tone.ToneAudioBuffer
  const loading = {};   // name → Promise

  function url(name) {
    return `/static/samples/${name}.ogg`;
  }

  /** Load a sample buffer (cached). Returns a Promise<Tone.ToneAudioBuffer>. */
  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (loading[name]) return loading[name];
    loading[name] = new Promise((resolve, reject) => {
      const buf = new Tone.ToneAudioBuffer(url(name), () => {
        buffers[name] = buf;
        delete loading[name];
        resolve(buf);
      }, (err) => {
        delete loading[name];
        console.warn(`[SampleBank] Failed to load ${name}:`, err);
        reject(err);
      });
    });
    return loading[name];
  }

  /** Get a Tone.Player wired to destination, ready to .start(time). */
  async function getPlayer(name, destination) {
    const buf = await load(name);
    const player = new Tone.Player(buf).connect(destination);
    return player;
  }

  /** Preload a list of sample names. Returns Promise that resolves when all are loaded. */
  function preload(names) {
    return Promise.all(names.map(n => load(n)));
  }

  return { load, getPlayer, preload, url };
})();

// ── Music theory utilities ──────────────────────────────────

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  m7minus5: [0, 3, 6, 10],
};

function midiToNote(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const oct = Math.floor(midi / 12) - 1;
  return names[midi % 12] + oct;
}

function noteToMidi(note) {
  const match = note.match(/^([A-Ga-g][#b]?)(-?\d)$/);
  if (!match) return 60;
  const names = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  };
  const key = match[1][0].toUpperCase() + match[1].slice(1);
  return (names[key] ?? 0) + (parseInt(match[2]) + 1) * 12;
}

/** Convert MIDI note number to Hz. Sonic Pi uses MIDI values for filter cutoffs. */
function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleNotes(rootNote, scaleType, count, octaves) {
  octaves = octaves || 2;
  const rootMidi = typeof rootNote === 'string' ? noteToMidi(rootNote) : rootNote;
  const intervals = SCALES[scaleType] || SCALES.major;
  const notes = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of intervals) {
      notes.push(midiToNote(rootMidi + oct * 12 + interval));
    }
  }
  return notes.slice(0, count);
}
