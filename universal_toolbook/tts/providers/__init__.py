"""Engine registry for the TTS subsystem.

``get_engine("kokoro")`` returns a loaded provider instance (cached per
process). Unknown engines raise ``TTSError`` with the list of known ones.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from ..base import TTSProvider, TTSError

__all__ = ["get_engine", "list_engines", "available_engines", "PROVIDERS"]

#: name -> provider class (imported lazily; heavy deps stay out of this module)
PROVIDERS: Dict[str, type] = {}


def _classes() -> Dict[str, type]:
    if not PROVIDERS:
        from .edge_provider import EdgeProvider
        from .kokoro_provider import KokoroProvider
        from .piper_provider import PiperProvider

        PROVIDERS.update({
            KokoroProvider.name: KokoroProvider,
            PiperProvider.name: PiperProvider,
            EdgeProvider.name: EdgeProvider,
        })
    return PROVIDERS


def list_engines() -> List[str]:
    return sorted(_classes().keys())


def available_engines() -> List[str]:
    """Engines that are usable *right now* (package + weights present)."""
    out = []
    for name in list_engines():
        try:
            if get_engine(name, load=False).is_available():
                out.append(name)
        except TTSError:
            continue
    return out


def get_engine(name: str, config: Optional[dict] = None, load: bool = True) -> TTSProvider:
    """Get (and by default load) an engine instance. Instances are cached."""
    classes = _classes()
    key = name.strip().lower()
    if key not in classes:
        raise TTSError(
            f"Unknown TTS engine '{name}'. Known engines: {', '.join(list_engines())}"
        )
    cached = getattr(get_engine, "_cache", {}).get(key)
    if cached is None:
        cached = classes[key](config)
        get_engine._cache = {**getattr(get_engine, "_cache", {}), key: cached}
    if load:
        cached.load()
    return cached


# per-process instance cache
get_engine._cache: Dict[str, TTSProvider] = {}
