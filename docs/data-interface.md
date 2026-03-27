# Data-Music Interface

The server pushes **normalized market data** to each connected browser client via WebSocket every 3 seconds. Activity metrics (heat, velocity, trade_rate, spread) are pre-adjusted by the client's **sensitivity** setting before sending. Tracks receive data via their `update(data)` method and decide their own musical interpretation. **The server does not prescribe musical behaviour.**

## Data Values (pushed every 3s via WebSocket)

| Name          | Range     | Source                                                              |
| ------------- | --------- | ------------------------------------------------------------------- |
| `heat`        | 0.0 – 1.0 | Composite market activity (velocity, trade rate, volume, spread)    |
| `price`       | 0.0 – 1.0 | Current price (WS bid/ask midpoint preferred, Gamma API fallback)   |
| `price_delta` | -1.0 – 1.0| Per-cycle (3s) price change, sensitivity-adjusted. Signed: +ve = up, -ve = down. Normalized so raw 10¢ → magnitude 1.0 |
| `price_move`  | -1.0 – 1.0| Rolling window (30s) price change, sensitivity-adjusted. Signed. Normalized so raw 5¢ → magnitude 1.0. Best signal for tracking price curves |
| `velocity`    | 0.0 – 1.0 | Price velocity (first derivative, 5-min window average)             |
| `trade_rate`  | 0.0 – 1.0 | Trades per minute, normalized                                       |
| `spread`      | 0.0 – 1.0 | Bid-ask spread, normalized (raw 0–0.3 → 0–1)                        |
| `tone`        | 0 or 1    | 1 = major (price > 0.55), 0 = minor (price < 0.45), with hysteresis |
| `sensitivity` | 0.0 – 1.0 | Client's sensitivity setting (0=low, 1=high). Optional for tracks   |

Activity metrics (`heat`, `velocity`, `trade_rate`, `spread`, `price_move`) are transformed by a power curve based on sensitivity before pushing. At 50% (default) the values are unchanged; at 100% small values are inflated; at 0% small values are crushed. `price` and `tone` are never affected. `price_delta` is also sensitivity-adjusted.

## Event Triggers (separate WebSocket messages)

| Event         | Fields        | Condition                         |
| ------------- | ------------- | --------------------------------- |
| `spike`       | —             | Heat delta exceeds threshold (scaled by sensitivity) |
| `price_move`  | `direction: 1\|-1` | Price delta exceeds threshold (scaled by sensitivity) |
| `resolved`    | `result: 1\|-1`    | Market resolved (1=Yes won, -1=No won) |
| `ambient_mode`| `value: 1`    | No active markets — ambient fallback   |

Events are **suppressed for one push cycle** when the market rotates (e.g., a live finance market expires and the next one loads). On rotation, `_prev_price`, `_prev_heat`, and `_current_tone` reset to the new market's values so the first delta is zero.

## Per-Client State

Each client session (in `sessions.py`) maintains independent:
- Market selection (`market_slug`, `asset_id`)
- Sensitivity setting
- Event detection state (`_prev_heat`, `_prev_price`, `_prev_asset`, `_current_tone`)

This means each user can watch a different market with different sensitivity, and event detection is independent per client.

## Tone Hysteresis

Tone uses hysteresis to prevent major/minor flickering when price hovers near 0.50:

- Must drop below **0.45** to switch to minor
- Must rise above **0.55** to switch to major

## Price Display

The display price uses the **WebSocket bid/ask midpoint** as the primary source (real-time). Falls back to the **Gamma REST API** (`outcomePrices` field, polled every 5s via `price_poll_loop`) when WebSocket data hasn't arrived yet.

## Outcome Selection

Markets have multiple outcomes (e.g., "Yes"/"No" or "Up"/"Down"), each with its own asset_id. `_primary_asset()` in `mixer.py` always picks the "Yes" or "Up" outcome to match Polymarket's headline display.
