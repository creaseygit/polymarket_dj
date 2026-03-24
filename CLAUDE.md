# Polymarket Bar — Claude Context

## What This Is

An autonomous DJ that turns Polymarket prediction market activity into generative music via Sonic Pi. Python scores markets by real-time heat, maps data to musical parameters, and drives a Sonic Pi track headlessly. A web control panel at `http://localhost:8888` provides full control.

**Repo:** https://github.com/creaseygit/polymarket_dj

## How to Run

```bash
cd C:\Github\polymarket_dj
.\venv\Scripts\activate
python server.py
# Open http://localhost:8888
# Click Start, pick a track (market_pulse recommended), click a market to play
```

**Requirements:** VPN required (user is in UAE, Polymarket blocks non-US traffic). Sonic Pi must be installed at `C:\Program Files\Sonic Pi\`.

## Architecture

```
Polymarket APIs → Python Brain → Sonic Pi (headless) → Audio Out
                       ↓
              Web Control Panel (localhost:8888)
```

### Data Flow
1. `polymarket/gamma.py` — REST client fetches top 50 active markets by volume
2. `polymarket/websocket.py` — WebSocket subscribes to asset IDs, receives price changes/trades/book updates
3. `polymarket/scorer.py` — `MarketScorer` computes heat score (0-1) from price velocity, trade rate, volume, spread
4. `mixer/mixer.py` — `AutonomousDJ` picks which market drives the song (manual or autonomous mode)
5. `osc/bridge.py` — Maps heat/price/velocity/spread to musical params (amp, cutoff, reverb, density, tone, tension)
6. `sonic_pi/headless.py` — Boots Sonic Pi daemon without GUI, sends code via OSC
7. Params pushed to Sonic Pi via `run_code` (direct `set`) every 3 seconds

### Single Market Model
The DJ plays **one market at a time**. All 5 instrument layers (kick, bass, pad, lead, atmosphere) respond to the same market. Two modes:
- **Manual (default):** Click a market in the web UI, it plays until you pick another
- **Autonomous:** DJ auto-switches to the hottest market when heat delta exceeds `SWAP_THRESHOLD` (0.25)

## Key Files

| File | Purpose |
|------|---------|
| `server.py` | **Main entry point.** Web server + all orchestration. Start here. |
| `config.py` | All tunable constants (API URLs, scoring weights, OSC config) |
| `polymarket/gamma.py` | Gamma REST API client. Note: `clobTokenIds` is a JSON string, not a list |
| `polymarket/websocket.py` | CLOB WebSocket feed. First message is a list (book snapshot), not a dict |
| `polymarket/scorer.py` | Heat scoring: `price_velocity * 0.35 + trade_rate * 0.40 + volume * 0.15 + spread * 0.10` |
| `mixer/mixer.py` | `AutonomousDJ` — market selection, manual/autonomous modes, resolution handling |
| `osc/bridge.py` | Market data → musical parameter mapping. Amp capped at 0.8 to prevent clipping |
| `sonic_pi/headless.py` | Boots Sonic Pi daemon headlessly, manages keep-alive, sends code via `/run-code` OSC |
| `sonic_pi/market_pulse.rb` | **Best track.** Clean ambient electronic with prophet lead, hollow pads, subpulse bass |
| `sonic_pi/deep_bass_polymarket.rb` | FM bass/kick track (works) |
| `sonic_pi/bar_track.rb` | Original spec track (broken — OSC sync listeners don't work reliably) |
| `console.py` | CLI debug console (alternative to web UI) |
| `main.py` | Minimal entry point without web UI |

## How Sonic Pi Integration Works

The headless launcher (`sonic_pi/headless.py`):
1. Finds Ruby + daemon.rb in Sonic Pi install dir
2. Runs `daemon.rb` which spawns `scsynth` + Spider server + Tau
3. Reads port allocations from daemon stdout (8 values: daemon, gui-listen, gui-send, scsynth, osc-cues, tau-api, tau-phx, token)
4. Sends `/daemon/keep-alive` with token every 2s
5. Sends `/run-code [token, code]` to Spider to execute .rb code

**Critical:** Params are pushed via `run_code` (e.g., `set :kick_amp, 0.7`) NOT just OSC messages. The tracks read params with `get(:kick_amp)` in their loops. OSC `sync` listeners exist but are unreliable for parameter updates.

**Orphan cleanup:** Previous headless instances can leave `scsynth.exe` and `ruby.exe` running. The web UI has a "Kill All" button. The `atexit` handler in `headless.py` also cleans up.

## Musical Parameter Mapping

| Market Signal | Musical Param | Range |
|--------------|---------------|-------|
| Heat score (composite) | amp | 0.1 – 0.8 |
| Last trade price (0-1) | cutoff | 60 – 115 |
| Price velocity | reverb | 0.1 – 0.85 |
| Trade rate/min | density | 0.1 – 1.0 |
| Price >= 0.5 | tone | 1 (major/bullish) |
| Price < 0.5 | tone | 0 (minor/bearish) |
| Bid-ask spread | tension | 0.0 – 1.0 |

## Known Issues / Gotchas

- **VPN required** — Polymarket blocks UAE/non-US IPs at the TLS level
- **`bar_track.rb` is broken** — Its sequential `sync` OSC listeners stall. Use `market_pulse.rb` or `deep_bass_polymarket.rb`
- **Amp was causing distortion** — Fixed by capping at 0.8 (was 1.4). The `_scale` in `osc/bridge.py` and `server.py` must stay in sync
- **`clobTokenIds`** from Gamma API is a JSON string, not a list — parsed by `_parse_clob_token_ids()` in `gamma.py`
- **WebSocket first message is a list** — `_dispatch()` handles both list and dict messages
- **Audio device** — scsynth outputs to Windows default audio device (currently Bluetooth headphones)

## Web API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | Full state: markets, layers, audio, mode |
| POST | `/api/start` | Boot Sonic Pi, load track. Body: `{"track": "market_pulse"}` |
| POST | `/api/stop` | Stop audio gracefully |
| POST | `/api/test-sound` | Test audio. Body: `{"type": "beep"|"kick"|"all_layers"}` |
| POST | `/api/track` | Switch track. Body: `{"track": "deep_bass_polymarket"}` |
| POST | `/api/pin` | Play specific market. Body: `{"slug": "..."}` |
| POST | `/api/unpin` | Clear pin (stays on current market in manual mode) |
| POST | `/api/autonomous` | Toggle mode. Body: `{"enabled": true|false}` |
| POST | `/api/kill-all` | Kill all scsynth.exe and ruby.exe processes |

## Writing New Tracks

New `.rb` files in `sonic_pi/` are auto-discovered by the web UI. A track must:

1. Initialize layer state with defaults:
```ruby
[:kick, :bass, :pad, :lead, :atmos].each do |layer|
  set :"#{layer}_amp", 0.0
  set :"#{layer}_cutoff", 80.0
  set :"#{layer}_reverb", 0.3
  set :"#{layer}_density", 0.5
  set :"#{layer}_tone", 1
  set :"#{layer}_tension", 0.0
end
```

2. Use `get(:kick_amp)` etc. in live_loops to read params (NOT `sync` for params — Python pushes via `run_code`/`set`)

3. Keep individual amp values conservative (multiply `get(:kick_amp)` by 0.1-0.7 per element)

4. Use HPF on non-bass elements, keep bass centered, spread others in stereo

5. Use `set_volume! 0.7` for master headroom

See `market_pulse.rb` for the reference implementation.

## Tech Stack

- Python 3.12, asyncio (WindowsSelectorEventLoopPolicy on Windows)
- aiohttp (web server)
- python-osc (OSC messaging)
- websockets (Polymarket CLOB feed)
- requests (Gamma REST API)
- Sonic Pi 4.6 (Ruby + SuperCollider scsynth, runs headless)
