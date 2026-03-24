# ── Polymarket ───────────────────────────────────────────
GAMMA_API      = "https://gamma-api.polymarket.com"
CLOB_WS        = "wss://ws-subscriptions-clob.polymarket.com/ws/market"

# How often to re-score and potentially re-mix (seconds)
RESCORE_INTERVAL   = 30
MARKET_FETCH_LIMIT = 50          # pull top N active markets to score from

# ── Mixer ────────────────────────────────────────────────
MAX_ACTIVE_LAYERS  = 5           # simultaneous market→instrument mappings
MIN_ACTIVE_LAYERS  = 2           # floor — always keep something playing
SWAP_THRESHOLD     = 0.25        # score delta before triggering a swap
FADE_BARS          = 8           # crossfade duration in musical bars

# ── Instruments (one per layer slot) ─────────────────────
LAYER_INSTRUMENTS  = ["kick", "bass", "pad", "lead", "atmosphere"]

# ── Scoring weights ──────────────────────────────────────
WEIGHT_PRICE_VELOCITY = 0.35
WEIGHT_TRADE_RATE     = 0.40
WEIGHT_VOLUME         = 0.15
WEIGHT_SPREAD         = 0.10

# Minimum trade events per minute to be considered "alive"
MIN_TRADE_RATE     = 2

# ── OSC ──────────────────────────────────────────────────
OSC_IP   = "127.0.0.1"
OSC_PORT = 4560

# ── Ambient fallback ─────────────────────────────────────
# Triggered when no markets exceed MIN_TRADE_RATE
AMBIENT_MODE_THRESHOLD = 1       # active markets below this → go ambient

# ── Request mode (Phase 2) ───────────────────────────────
# Allow a specific market to be pinned as the lead layer
PINNED_MARKET_SLUG = None        # e.g. "will-trump-veto-the-bill"
