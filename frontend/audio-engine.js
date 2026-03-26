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

// ── Music theory utilities ──────────────────────────────────

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

function midiToNote(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const oct = Math.floor(midi / 12) - 1;
  return names[midi % 12] + oct;
}

function noteToMidi(note) {
  const match = note.match(/^([A-Ga-g]#?)(-?\d)$/);
  if (!match) return 60;
  const names = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  return names[match[1].toUpperCase()] + (parseInt(match[2]) + 1) * 12;
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
