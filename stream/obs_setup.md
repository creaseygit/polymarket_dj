# OBS Studio Setup — Polymarket Bar Stream

## Prerequisites

1. **Sonic Pi** installed and running
2. **Virtual Audio Cable** installed (VB-CABLE recommended: https://vb-audio.com/Cable/)
3. **OBS Studio** installed

## Audio Routing

1. Open Sonic Pi → Preferences → Audio → set output device to **CABLE Input (VB-Audio Virtual Cable)**
2. Open OBS → Sources → Add **Audio Input Capture** → select **CABLE Output (VB-Audio Virtual Cable)**

This routes Sonic Pi's audio through the virtual cable into OBS.

## Stream Settings

1. OBS → Settings → Stream
   - Service: **YouTube - RTMP**
   - Server: Primary YouTube ingest server
   - Stream Key: (paste from YouTube Studio → Go Live → Stream Key)

2. OBS → Settings → Output
   - Audio Bitrate: **160 kbps** (music quality)
   - Video: optional — can be a static image or the overlay

## Now Playing Overlay

1. Start a local HTTP server from the project root:
   ```
   python -m http.server 8080
   ```

2. OBS → Sources → Add **Browser Source**
   - URL: `http://localhost:8080/stream/overlay.html`
   - Width: 800, Height: 300
   - Refresh every **3 seconds**

The overlay reads `now_playing.json` (written by the Python process) and displays
current market assignments and heat levels.

## Running the Full Stack

1. Start Sonic Pi, load `sonic_pi/bar_track.rb` (Run)
2. Start the Python system: `python main.py`
3. Start local HTTP server: `python -m http.server 8080`
4. Start OBS streaming

The Python process connects to Polymarket, scores markets, and sends OSC
messages to Sonic Pi. OBS captures the audio and streams to YouTube.
