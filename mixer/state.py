import time
from dataclasses import dataclass, field


@dataclass
class LayerState:
    """State for a single instrument layer."""
    asset_id: str
    question: str
    amp: float = 0.0
    assigned_at: float = field(default_factory=time.time)


@dataclass
class MixerState:
    """Global mixer state."""
    layers: dict[str, LayerState] = field(default_factory=dict)
    ambient_mode: bool = False
    last_mix_time: float = 0.0

    def get_layer(self, slot: str) -> LayerState | None:
        return self.layers.get(slot)

    def set_layer(self, slot: str, asset_id: str, question: str, amp: float = 0.0):
        self.layers[slot] = LayerState(
            asset_id=asset_id, question=question, amp=amp
        )

    def remove_layer(self, slot: str):
        self.layers.pop(slot, None)

    def active_layer_count(self) -> int:
        return len(self.layers)

    def to_dict(self) -> dict:
        """Serialise for OSC bridge / overlay."""
        return {
            slot: {
                "asset_id": layer.asset_id,
                "question": layer.question,
                "amp": layer.amp,
            }
            for slot, layer in self.layers.items()
        }
