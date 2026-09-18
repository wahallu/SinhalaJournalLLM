"""
In-process TTL cache for expensive, read-mostly lookups.

Each instance keeps its own copy, and production runs several instances, so
nothing cached here may be something a user would notice being stale for
longer than its TTL. That is why TTLs are short (seconds to a minute) and why
every repository that writes a cached table also calls `invalidate()`: the
TTL is what carries a change to the OTHER instances, invalidation is what
makes the instance that took the write consistent immediately.

Concurrent misses on the same key share one load ("single flight"). Without
that, a cold cache in front of a slow call — the SinLlama health probe has a
5s timeout — turns N simultaneous page loads into N simultaneous probes.

Failures are never cached: a loader that raises leaves the key empty, so a
database blip is retried on the next call rather than pinned for the TTL.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Any

_REGISTRY: list["TTLCache"] = []


class TTLCache:
    def __init__(self, name: str, ttl_seconds: float, maxsize: int = 512) -> None:
        self.name = name
        self.ttl = ttl_seconds
        self.maxsize = maxsize
        self._values: dict[Hashable, tuple[float, Any]] = {}
        self._inflight: dict[Hashable, asyncio.Task] = {}
        _REGISTRY.append(self)

    def _fresh(self, key: Hashable) -> tuple[bool, Any]:
        entry = self._values.get(key)
        if entry is None:
            return False, None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            self._values.pop(key, None)
            return False, None
        return True, value

    async def get_or_load(
        self, key: Hashable, loader: Callable[[], Awaitable[Any]]
    ) -> Any:
        hit, value = self._fresh(key)
        if hit:
            return value

        loop = asyncio.get_running_loop()
        task = self._inflight.get(key)
        # A task left over from another event loop (pytest runs one per test)
        # can never be awaited from this one.
        if task is None or task.get_loop() is not loop:
            task = loop.create_task(loader())
            self._inflight[key] = task
            try:
                # Shielded so one caller disconnecting does not cancel the
                # load every other waiter is sharing.
                value = await asyncio.shield(task)
            finally:
                if self._inflight.get(key) is task:
                    self._inflight.pop(key, None)
            self._store(key, value)
            return value
        return await asyncio.shield(task)

    def _store(self, key: Hashable, value: Any) -> None:
        if len(self._values) >= self.maxsize:
            # Drop the entry closest to expiry — cheap, and good enough for
            # caches this small.
            oldest = min(self._values, key=lambda k: self._values[k][0])
            self._values.pop(oldest, None)
        self._values[key] = (time.monotonic() + self.ttl, value)

    def invalidate(self, key: Hashable | None = None) -> None:
        """Drop one key, or everything when `key` is None."""
        if key is None:
            self._values.clear()
        else:
            self._values.pop(key, None)


def cached(cache: TTLCache, key_fn: Callable[..., Hashable] | None = None):
    """
    Decorator form for an async function whose result depends only on its
    arguments. `key_fn` builds the key; by default it is the arguments
    themselves.
    """

    def decorator(fn):
        async def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs) if key_fn else (args, tuple(sorted(kwargs.items())))
            return await cache.get_or_load(key, lambda: fn(*args, **kwargs))

        wrapper.__wrapped__ = fn
        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = fn.__doc__
        wrapper.cache = cache
        return wrapper

    return decorator


def clear_all() -> None:
    """Empty every cache in the process. Used by the test suite."""
    for cache in _REGISTRY:
        cache.invalidate()
