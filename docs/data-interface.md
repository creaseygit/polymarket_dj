# Data-Music Interface

Python pushes **normalized market data** to Sonic Pi every 3 seconds via `run_code` / `set`. Activity metrics (heat, velocity, trade_rate, spread) are pre-adjusted by the user's **sensitivity** setting before reaching tracks. Tracks read these values with `get()` and decide their own musical interpretation. **Python does not prescribe musical behaviour** — no per-layer params, no instrument assumptions.

## Data Values (pushed every 3s)

| Name          | Range     | Source                                                              |
| ------------- | --------- | ------------------------------------------------------------------- |
| `:heat`       | 0.0 – 1.0 | Composite market activity (velocity, trade rate, volume, spread)    |
| `:price`      | 0.0 – 1.0 | Current price (WS bid/ask midpoint preferred, Gamma API fallback)   |
| `:price_delta`| -1.0 – 1.0| Per-cycle price change, sensitivity-adjusted. Signed: +ve = up, -ve = down. Normalized so raw 10¢ → magnitude 1.0 |
| `:velocity`   | 0.0 – 1.0 | Price velocity (first derivative, 5-min window average)             |
| `:trade_rate` | 0.0 – 1.0 | Trades per minute, normalized                                       |
| `:spread`     | 0.0 – 1.0 | Bid-ask spread, normalized (raw 0–0.3 → 0–1)                        |
| `:tone`       | 0 or 1    | 1 = major (price > 0.55), 0 = minor (price < 0.45), with hysteresis |
| `:sensitivity`| 0.0 – 1.0 | User's sensitivity setting (0=low, 1=high). Optional — tracks can read for custom behavior |

Activity metrics (`:heat`, `:velocity`, `:trade_rate`, `:spread`) are transformed by a power curve based on sensitivity before pushing. At 50% (default) the values are unchanged; at 100% small values are inflated; at 0% small values are crushed. `:price` and `:tone` are never affected.

## Event Triggers (one-shot, reset to 0)

| Name                | Values    | Condition                         |
| ------------------- | --------- | --------------------------------- |
| `:event_spike`      | 0 or 1    | Heat delta exceeds threshold (scaled by sensitivity) |
| `:event_price_move` | -1, 0, +1 | Price delta exceeds threshold (scaled by sensitivity) |

Events are **suppressed for one push cycle** when the market rotates (e.g., a live finance market expires and the next one loads). On rotation, `_prev_price`, `_prev_heat`, and `_current_tone` reset to the new market's values so the first delta is zero. Normal event detection resumes on the next cycle (3s later).

## System State

| Name               | Values   | Meaning                                |
| ------------------ | -------- | -------------------------------------- |
| `:market_resolved` | 0, 1, -1 | Market resolved (1=Yes won, -1=No won) |
| `:ambient_mode`    | 0 or 1   | No active markets — ambient fallback   |

When the currently-playing market resolves: live finance markets auto-rotate to the next window; non-live markets stop audio playback entirely (prevents stale music from playing after the market has ended).

## Tone Hysteresis

Tone uses hysteresis to prevent major/minor flickering when price hovers near 0.50:

- Must drop below **0.45** to switch to minor
- Must rise above **0.55** to switch to major

## Price Display

The display price uses the **WebSocket bid/ask midpoint** as the primary source (real-time, matches Polymarket's live display). Falls back to the **Gamma REST API** (`outcomePrices` field, polled every 5s via `price_poll_loop`) when WebSocket data hasn't arrived yet.

## Single Market Model

The DJ plays **one market at a time** in manual mode only. Pick a market from browse tabs or paste a URL; it plays until you pick another via `pin_market()`.

## Outcome Selection

Markets have multiple outcomes (e.g., "Yes"/"No" or "Up"/"Down"), each with its own asset_id. `_primary_asset()` in `mixer.py` always picks the "Yes" or "Up" outcome to match Polymarket's headline display.
