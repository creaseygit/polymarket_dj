import asyncio
from config import FADE_BARS

# At 124 BPM, one bar = 4 beats = 4 * (60/124) ≈ 1.935 seconds
# FADE_BARS bars ≈ 15.5 seconds
FADE_DURATION_SECONDS = FADE_BARS * 4 * (60 / 124)
FADE_STEPS = 16  # number of intermediate amplitude updates


async def fade_in(osc_bridge, slot: str, asset_id: str, target_amp: float = 1.0):
    """Gradually ramp a layer's amplitude from 0 to target."""
    step_duration = FADE_DURATION_SECONDS / FADE_STEPS
    for i in range(1, FADE_STEPS + 1):
        amp = target_amp * (i / FADE_STEPS)
        osc_bridge.client.send_message(
            f"{osc_bridge.SLOT_OSC_MAP.get(slot, '/btc/unknown')}/amp", amp
        )
        await asyncio.sleep(step_duration)


async def fade_out(osc_bridge, slot: str, start_amp: float = 1.0):
    """Gradually ramp a layer's amplitude from current to 0."""
    step_duration = FADE_DURATION_SECONDS / FADE_STEPS
    for i in range(FADE_STEPS - 1, -1, -1):
        amp = start_amp * (i / FADE_STEPS)
        osc_bridge.client.send_message(
            f"{osc_bridge.SLOT_OSC_MAP.get(slot, '/btc/unknown')}/amp", amp
        )
        await asyncio.sleep(step_duration)


async def crossfade(osc_bridge, slot: str, old_id: str, new_id: str):
    """Crossfade from old market to new market on the same layer slot."""
    from osc.bridge import SLOT_OSC_MAP
    prefix = SLOT_OSC_MAP.get(slot, "/btc/unknown")
    step_duration = FADE_DURATION_SECONDS / FADE_STEPS

    for i in range(1, FADE_STEPS + 1):
        progress = i / FADE_STEPS
        # Old fades out, new fades in
        osc_bridge.client.send_message(f"{prefix}/amp", progress)
        await asyncio.sleep(step_duration)

    # Ensure new market params are pushed at the end
    osc_bridge.push_market_params(slot, new_id)
