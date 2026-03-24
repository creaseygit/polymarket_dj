import asyncio
from config import (
    LAYER_INSTRUMENTS, RESCORE_INTERVAL, SWAP_THRESHOLD,
)


class AutonomousDJ:
    """
    Single-market DJ. Two modes:

    Manual (default): A market is selected via pin_market() and plays
    until another is selected. No automatic switching.

    Autonomous: The hottest market plays automatically. Switches
    when a significantly hotter market emerges.
    """

    def __init__(self, scorer, feed, osc_bridge, gamma):
        self.scorer     = scorer
        self.feed       = feed
        self.osc        = osc_bridge
        self.gamma      = gamma

        self.current_market = None
        self.current_asset  = None
        self.layers     = {}
        self.all_markets = []

        # Mode: False = manual (default), True = autonomous
        self.autonomous = False
        self.pinned_slug = None

    # ── Public control ────────────────────────────────────

    def pin_market(self, slug: str):
        """Select a specific market to play. Stays until changed."""
        self.pinned_slug = slug
        self.autonomous = False
        # Find and switch immediately
        market = next(
            (m for m in self.all_markets if m["slug"] == slug), None
        )
        if market and market["asset_ids"]:
            self._switch_market_sync(market["asset_ids"][0], market)
        print(f"[DJ] Playing: {slug}", flush=True)

    def unpin(self):
        """Clear pinned market. If autonomous, DJ picks next. If manual, keeps current."""
        self.pinned_slug = None

    def set_autonomous(self, enabled: bool):
        """Toggle autonomous mode."""
        self.autonomous = enabled
        if enabled:
            self.pinned_slug = None
            print("[DJ] Autonomous mode ON", flush=True)
        else:
            print("[DJ] Manual mode ON", flush=True)

    # ── Main loop ─────────────────────────────────────────

    async def run(self):
        await self._refresh_markets()

        while True:
            await asyncio.sleep(RESCORE_INTERVAL)
            await self._refresh_markets()
            if self.autonomous:
                await self._auto_mix()
            elif self.current_asset:
                # Manual mode — just push updated params
                self._push_all_layers()
            self._log_now_playing()
            self.osc.write_now_playing(self.layers)

    async def _refresh_markets(self):
        """Pull fresh market list from Gamma, update scorer volumes."""
        try:
            markets = self.gamma.fetch_active_markets()
            self.all_markets = markets

            for m in markets:
                for asset_id in m["asset_ids"]:
                    self.scorer.set_volume(asset_id, m["volume"])

            all_asset_ids = [
                aid for m in markets for aid in m["asset_ids"]
            ]
            new_ids = [
                aid for aid in all_asset_ids
                if aid not in self.feed.subscribed
            ]
            if new_ids:
                await self.feed.update_subscriptions(add=new_ids, remove=[])

        except Exception as e:
            print(f"[DJ] Market refresh failed: {e}")

    async def _auto_mix(self):
        """Autonomous mode: pick the hottest market."""
        if not self.all_markets:
            return

        all_asset_ids = [
            aid for m in self.all_markets for aid in m["asset_ids"]
        ]
        ranked = self.scorer.rank(all_asset_ids)
        hot = [(aid, score) for aid, score in ranked if score > 0]

        if not hot:
            self._enter_ambient_mode()
            return

        target_asset = hot[0][0]
        target_market = self._find_market(target_asset)

        if self.current_asset == target_asset:
            self._push_all_layers()
            return

        if self.current_asset:
            current_heat = self.scorer.heat(self.current_asset)
            target_heat = self.scorer.heat(target_asset)
            if target_heat - current_heat < SWAP_THRESHOLD:
                self._push_all_layers()
                return

        self._switch_market_sync(target_asset, target_market)

    def _switch_market_sync(self, asset_id: str, market: dict | None):
        """Switch all layers to a new market."""
        question = market["question"] if market else asset_id[:16]

        if self.current_market:
            old_q = self.current_market["question"][:40]
            print(f"[DJ] === SWITCHING: {old_q} -> {question[:40]}", flush=True)
        else:
            print(f"[DJ] === NOW PLAYING: {question[:60]}", flush=True)

        self.current_market = market
        self.current_asset = asset_id

        for slot in LAYER_INSTRUMENTS:
            was_playing = slot in self.layers
            self.layers[slot] = {
                "asset_id": asset_id,
                "question": question,
                "amp": 1.0,
            }
            if was_playing:
                self.osc.send_layer_command(slot, asset_id, "crossfade")
            else:
                self.osc.send_layer_command(slot, asset_id, "fade_in")

        # Push params immediately so music reacts now
        self._push_all_layers()

    def _push_all_layers(self):
        if not self.current_asset:
            return
        for slot in LAYER_INSTRUMENTS:
            self.osc.push_market_params(slot, self.current_asset)

    def _enter_ambient_mode(self):
        print("[DJ] Ambient mode -- no hot markets", flush=True)
        self.current_market = None
        self.current_asset = None
        self.layers.clear()
        self.osc.send_global("ambient_mode", 1)

    def _find_market(self, asset_id: str) -> dict | None:
        for m in self.all_markets:
            if asset_id in m["asset_ids"]:
                return m
        return None

    def _log_now_playing(self):
        if not self.current_market:
            return
        heat = self.scorer.heat(self.current_asset) if self.current_asset else 0
        mode = "AUTO" if self.autonomous else "MANUAL"
        print(f"[DJ] [{mode}] heat={heat:.2f}  {self.current_market['question'][:50]}", flush=True)

    def on_market_resolved(self, msg: dict):
        winning = msg.get("winning_outcome", "?")
        question = msg.get("question", "A market")
        print(f"[RESOLVED] {question} -> {winning}", flush=True)

        self.osc.send_global("market_resolved", 1 if winning == "Yes" else -1)

        resolved_ids = set(msg.get("assets_ids", []))
        if self.current_asset in resolved_ids:
            print("[DJ] Current market resolved", flush=True)
            self.current_market = None
            self.current_asset = None
            self.layers.clear()
            self.pinned_slug = None
