import json
import requests
from config import GAMMA_API, MARKET_FETCH_LIMIT


def _parse_clob_token_ids(raw) -> list[str]:
    """clobTokenIds comes as a JSON string like '[\"id1\", \"id2\"]', not a list."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []
    return []


def fetch_active_markets(tag: str = None) -> list[dict]:
    """
    Fetch currently active Polymarket markets ordered by volume.
    Returns a list of dicts with id, slug, question, volume, asset_ids.
    """
    params = {
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
        "limit": MARKET_FETCH_LIMIT,
    }
    if tag:
        params["tag"] = tag

    resp = requests.get(f"{GAMMA_API}/markets", params=params, timeout=10)
    resp.raise_for_status()
    markets = resp.json()

    return [
        {
            "id":        m["id"],
            "slug":      m.get("slug", ""),
            "question":  m.get("question", "Unknown market"),
            "volume":    float(m.get("volume24hr") or 0),
            "asset_ids": _parse_clob_token_ids(m.get("clobTokenIds", "[]")),
            "end_date":  m.get("endDate"),
            "tags":      [e.get("slug") for e in m.get("events", [])],
        }
        for m in markets
        if m.get("clobTokenIds")   # must have tradeable tokens
    ]


def fetch_market_by_slug(slug: str) -> dict | None:
    """Fetch a specific market by slug — used for request/pin mode."""
    resp = requests.get(f"{GAMMA_API}/markets", params={"slug": slug}, timeout=10)
    markets = resp.json()
    return markets[0] if markets else None
