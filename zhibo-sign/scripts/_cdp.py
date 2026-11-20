"""Tiny CDP helper shared by the debug scripts.

The debug Chrome lives as a child of whatever python process started it, so a
single script must start it, drive the page and finish the job in one run.
"""
from __future__ import annotations

import asyncio
import base64
import json
import subprocess
from pathlib import Path

import httpx
import websockets

ROOT = Path(__file__).resolve().parent.parent
PORT = 9222
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE = ROOT / ".chrome-doubao"
DOUBAO = "https://www.doubao.com/chat/"


async def tabs() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            return (await c.get(f"http://127.0.0.1:{PORT}/json")).json()
    except Exception:
        return []


async def ensure_browser(wait: int = 40) -> dict:
    t = await tabs()
    if not t:
        PROFILE.mkdir(parents=True, exist_ok=True)
        subprocess.Popen([CHROME, f"--remote-debugging-port={PORT}",
                          f"--user-data-dir={PROFILE}", "--no-first-run",
                          "--no-default-browser-check",
                          "--disable-blink-features=AutomationControlled",
                          DOUBAO],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(wait * 2):
            await asyncio.sleep(0.5)
            t = await tabs()
            if t:
                break
    page = next((x for x in t if x.get("type") == "page"), None)
    if not page:
        raise SystemExit("no page tab")
    return page


class Session:
    def __init__(self, ws):
        self.ws = ws
        self.mid = 0
        self.pending: dict[int, asyncio.Future] = {}

    async def _reader(self):
        async for raw in self.ws:
            m = json.loads(raw)
            if "id" in m and m["id"] in self.pending:
                self.pending.pop(m["id"]).set_result(m.get("result") or {})

    async def call(self, method: str, **params):
        self.mid += 1
        fut = asyncio.get_running_loop().create_future()
        self.pending[self.mid] = fut
        await self.ws.send(json.dumps({"id": self.mid, "method": method,
                                       "params": params}))
        return await asyncio.wait_for(fut, 120)

    async def js(self, expr: str):
        r = await self.call("Runtime.evaluate", expression=expr,
                            returnByValue=True, awaitPromise=True)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print("JS ERR:", (res.get("description") or "")[:200])
        return res.get("value")

    async def click(self, x: float, y: float):
        for kind in ("mousePressed", "mouseReleased"):
            await self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y,
                            button="left", clickCount=1)

    async def shot(self, dst: Path):
        r = await self.call("Page.captureScreenshot", format="png")
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(base64.b64decode(r["data"]))
        return dst


async def open_session(headless: bool = False) -> tuple[Session, asyncio.Task]:
    page = await ensure_browser()
    ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=128 << 20)
    s = Session(ws)
    task = asyncio.create_task(s._reader())
    await s.call("Page.enable")
    await s.call("Runtime.enable")
    return s, task


async def close(s: Session, task: asyncio.Task):
    task.cancel()
    await s.ws.close()
