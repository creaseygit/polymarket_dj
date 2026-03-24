import asyncio
import sys

# Windows asyncio compatibility
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from polymarket.scorer    import MarketScorer
from polymarket.websocket import PolymarketFeed
from mixer.mixer          import AutonomousDJ
from osc.bridge           import OSCBridge


async def param_push_loop(dj: AutonomousDJ, interval: float = 3.0):
    """Continuously push market params to Sonic Pi for reactive music."""
    while True:
        await asyncio.sleep(interval)
        for slot, layer in dj.layers.items():
            try:
                dj.osc.push_market_params(slot, layer["asset_id"])
            except Exception as e:
                print(f"[OSC] Param push error for [{slot}]: {e}")


async def main():
    print("""
    +==========================================+
    |      THE POLYMARKET BAR -- LIVE MUSIC    |
    |  Sonic predictions. Real-time. Always.   |
    +==========================================+
    """)

    scorer  = MarketScorer()
    osc     = OSCBridge(scorer)

    import polymarket.gamma as gamma_module
    dj      = AutonomousDJ(scorer, None, osc, gamma_module)
    feed    = PolymarketFeed(scorer, on_resolution=dj.on_market_resolved)
    dj.feed = feed

    # Run WebSocket feed + DJ loop + param push concurrently
    await asyncio.gather(
        feed.connect(),
        dj.run(),
        param_push_loop(dj),
    )


if __name__ == "__main__":
    asyncio.run(main())
