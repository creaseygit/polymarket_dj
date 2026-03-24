import asyncio
from config import (
    MAX_ACTIVE_LAYERS, MIN_ACTIVE_LAYERS, SWAP_THRESHOLD,
    LAYER_INSTRUMENTS, RESCORE_INTERVAL, PINNED_MARKET_SLUG
)


class AutonomousDJ:
    """
    Continuously monitors market heat scores and live-mixes
    the music by mapping hot markets to instrument layers.
    """

    def __init__(self, scorer, feed, osc_bridge, gamma):
        self.scorer     = scorer
        self.feed       = feed
        self.osc        = osc_bridge
        self.gamma      = gamma

        # layer_slot → {market_id, question, asset_id, amp}
        self.layers     = {}
        # All known markets (refreshed from Gamma periodically)
        self.all_markets = []
        # Pinned market slug (request mode)
        self.pinned_slug = PINNED_MARKET_SLUG

    # ── Public control ────────────────────────────────────

    def pin_market(self, slug: str):
        """Force lead layer to a specific market (request mode)."""
        self.pinned_slug = slug
        print(f"[DJ] Pinned market: {slug}")

    def unpin(self):
        self.pinned_slug = None

    # ── Main loop ─────────────────────────────────────────

    async def run(self):
        # Initial market fetch
        await self._refresh_markets()

        while True:
            await asyncio.sleep(RESCORE_INTERVAL)
            await self._refresh_markets()
            await self._mix()
            self._log_now_playing()
            # Write overlay state
            self.osc.write_now_playing(self.layers)

    async def _refresh_markets(self):
        """Pull fresh market list from Gamma, update scorer volumes."""
        try:
            markets = self.gamma.fetch_active_markets()
            self.all_markets = markets

            # Register volumes with scorer
            for m in markets:
                for asset_id in m["asset_ids"]:
                    self.scorer.set_volume(asset_id, m["volume"])

            # Make sure we're subscribed to all asset_ids
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

    async def _mix(self):
        """Core mixing decision: figure out what should be playing."""
        if not self.all_markets:
            return

        # Score all asset_ids
        all_asset_ids = [
            aid for m in self.all_markets for aid in m["asset_ids"]
        ]
        ranked = self.scorer.rank(all_asset_ids)
        hot    = [(aid, score) for aid, score in ranked if score > 0]

        if not hot:
            self._enter_ambient_mode()
            return

        # Handle pinned market (request mode) — always gets lead slot
        target_layers = {}

        if self.pinned_slug:
            pinned = next(
                (m for m in self.all_markets if m["slug"] == self.pinned_slug),
                None
            )
            if pinned and pinned["asset_ids"]:
                target_layers["lead"] = pinned["asset_ids"][0]

        # Fill remaining slots with hottest markets
        available_slots = [
            inst for inst in LAYER_INSTRUMENTS
            if inst not in target_layers
        ]
        used_ids = set(target_layers.values())

        for slot, (asset_id, score) in zip(available_slots, hot):
            if asset_id in used_ids:
                continue
            if len(target_layers) >= MAX_ACTIVE_LAYERS:
                break
            target_layers[slot] = asset_id
            used_ids.add(asset_id)

        # Apply changes — fade out dropped layers, fade in new ones
        for slot in LAYER_INSTRUMENTS:
            current = self.layers.get(slot, {}).get("asset_id")
            target  = target_layers.get(slot)

            if current == target:
                # No change, but push updated params
                if current:
                    self.osc.push_market_params(slot, current)
                continue

            if current and not target:
                await self._fade_out(slot)
            elif not current and target:
                await self._fade_in(slot, target)
            else:
                # Crossfade: old → new
                score_current = self.scorer.heat(current) if current else 0
                score_target  = self.scorer.heat(target)  if target  else 0
                if abs(score_target - score_current) > SWAP_THRESHOLD:
                    await self._crossfade(slot, current, target)

    async def _fade_in(self, slot: str, asset_id: str):
        market = self._find_market(asset_id)
        question = market["question"] if market else asset_id[:16]
        print(f"[DJ] >> Fading IN  [{slot}] -> {question}")
        self.layers[slot] = {"asset_id": asset_id, "question": question, "amp": 0.0}
        self.osc.send_layer_command(slot, asset_id, "fade_in")

    async def _fade_out(self, slot: str):
        layer = self.layers.get(slot, {})
        print(f"[DJ] << Fading OUT [{slot}] <- {layer.get('question', '?')}")
        self.osc.send_layer_command(slot, None, "fade_out")
        if slot in self.layers:
            del self.layers[slot]

    async def _crossfade(self, slot: str, old_id: str, new_id: str):
        market = self._find_market(new_id)
        question = market["question"] if market else new_id[:16]
        print(f"[DJ] <> Crossfade [{slot}] -> {question}")
        self.osc.send_layer_command(slot, new_id, "crossfade")
        self.layers[slot] = {"asset_id": new_id, "question": question, "amp": 1.0}

    def _enter_ambient_mode(self):
        print("[DJ] Ambient mode -- no hot markets")
        self.osc.send_global("ambient_mode", 1)

    def _find_market(self, asset_id: str) -> dict | None:
        for m in self.all_markets:
            if asset_id in m["asset_ids"]:
                return m
        return None

    def _log_now_playing(self):
        print("\n-- Now Playing -----------------------------------------------")
        for slot, layer in self.layers.items():
            heat = self.scorer.heat(layer["asset_id"])
            print(f"  [{slot:12s}] heat={heat:.2f}  {layer['question'][:60]}")
        print("--------------------------------------------------------------\n")

    # ── Resolution handler ────────────────────────────────

    def on_market_resolved(self, msg: dict):
        """Called when a market resolves. Triggers musical moment."""
        winning = msg.get("winning_outcome", "?")
        question = msg.get("question", "A market")
        print(f"[RESOLVED] {question} -> {winning}")

        # Trigger dramatic musical event via OSC
        self.osc.send_global("market_resolved", 1 if winning == "Yes" else -1)

        # Remove resolved market from layers
        resolved_ids = set(msg.get("assets_ids", []))
        for slot, layer in list(self.layers.items()):
            if layer["asset_id"] in resolved_ids:
                asyncio.create_task(self._fade_out(slot))
