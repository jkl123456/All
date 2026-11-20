"""Event bus: fan-out in-process events to connected overlays."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any


class Bus:
    def __init__(self) -> None:
        # ws -> last time we heard from it. A closed OBS browser source can keep
        # its socket open in a half-dead state for ever, which made the
        # presenter believe somebody was watching and wait out the full draw
        # timeout on every order. The timestamp lets us evict those.
        self._clients: dict[Any, float] = {}
        self._lock = asyncio.Lock()

    async def register(self, ws) -> None:
        async with self._lock:
            self._clients[ws] = time.time()
        print(f"[bus] overlay connected ({len(self._clients)} total)")

    async def unregister(self, ws) -> None:
        async with self._lock:
            self._clients.pop(ws, None)
        print(f"[bus] overlay disconnected ({len(self._clients)} total)")

    def touch(self, ws) -> None:
        if ws in self._clients:
            self._clients[ws] = time.time()

    async def prune(self, max_idle: float = 90.0) -> int:
        """Drop sockets that have not pinged for `max_idle` seconds."""
        now = time.time()
        dead = [w for w, t in self._clients.items() if now - t > max_idle]
        for w in dead:
            self._clients.pop(w, None)
            try:
                await w.close()
            except Exception:
                pass
        if dead:
            print(f"[bus] pruned {len(dead)} idle overlay(s), "
                  f"{len(self._clients)} left")
        return len(dead)

    @property
    def count(self) -> int:
        return len(self._clients)

    async def emit(self, kind: str, payload: dict | None = None) -> None:
        msg = json.dumps({"type": kind, "payload": payload or {}}, ensure_ascii=False)
        dead = []
        for ws in list(self._clients):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.unregister(ws)
