import time
from collections import defaultdict, deque
from config import (
    WEIGHT_PRICE_VELOCITY, WEIGHT_TRADE_RATE,
    WEIGHT_VOLUME, WEIGHT_SPREAD, MIN_TRADE_RATE
)


class MarketScorer:
    """
    Tracks real-time signals for each market and produces a
    normalised heat score between 0.0 and 1.0.
    """

    def __init__(self):
        # price history: market_id → deque of (timestamp, price)
        self.price_history  = defaultdict(lambda: deque(maxlen=20))
        # trade events: market_id → deque of timestamps
        self.trade_times    = defaultdict(lambda: deque(maxlen=100))
        # best bid/ask: market_id → (bid, ask)
        self.spreads        = defaultdict(lambda: (0.4, 0.6))
        # 24h volume from Gamma REST (static per fetch cycle)
        self.volumes        = defaultdict(float)

    # ── Feed methods (called by WebSocket handler) ────────

    def on_price_change(self, market_id: str, price: float):
        self.price_history[market_id].append((time.time(), price))

    def on_trade(self, market_id: str):
        self.trade_times[market_id].append(time.time())

    def on_best_bid_ask(self, market_id: str, bid: float, ask: float):
        self.spreads[market_id] = (bid, ask)

    def set_volume(self, market_id: str, volume: float):
        self.volumes[market_id] = volume

    # ── Scoring ───────────────────────────────────────────

    def price_velocity(self, market_id: str, window: int = 300) -> float:
        """Rate of price change over last `window` seconds. Returns 0–1."""
        history = list(self.price_history[market_id])
        now = time.time()
        recent = [(t, p) for t, p in history if now - t < window]
        if len(recent) < 2:
            return 0.0
        prices = [p for _, p in recent]
        return min(1.0, abs(prices[-1] - prices[0]) / max(prices[0], 0.01))

    def trade_rate(self, market_id: str, window: int = 60) -> float:
        """Trades per minute over last `window` seconds. Returns 0–1."""
        now = time.time()
        recent = [t for t in self.trade_times[market_id] if now - t < window]
        rate = len(recent)  # trades in last minute
        return min(1.0, rate / 20.0)   # 20 trades/min = full score

    def spread_score(self, market_id: str) -> float:
        """Tight spread = active market. Returns 0–1 (higher = tighter)."""
        bid, ask = self.spreads[market_id]
        spread = ask - bid
        return max(0.0, 1.0 - (spread / 0.2))   # 0.2 spread = 0 score

    def volume_score(self, market_id: str, max_volume: float = 1_000_000) -> float:
        """Normalised 24h volume. Returns 0–1."""
        return min(1.0, self.volumes.get(market_id, 0) / max_volume)

    def heat(self, market_id: str) -> float:
        """Composite heat score 0.0–1.0."""
        # Dead market floor check
        if self.trade_rate(market_id) < (MIN_TRADE_RATE / 20.0):
            return 0.0

        return (
            self.price_velocity(market_id) * WEIGHT_PRICE_VELOCITY +
            self.trade_rate(market_id)     * WEIGHT_TRADE_RATE     +
            self.volume_score(market_id)   * WEIGHT_VOLUME         +
            self.spread_score(market_id)   * WEIGHT_SPREAD
        )

    def rank(self, market_ids: list[str]) -> list[tuple[str, float]]:
        """Return markets sorted by heat, highest first."""
        scored = [(mid, self.heat(mid)) for mid in market_ids]
        return sorted(scored, key=lambda x: x[1], reverse=True)
