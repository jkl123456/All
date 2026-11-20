"""Screenshot the overlay while it paints a supplied picture.

    python scripts/shot_supply.py data/inbox/chk_sketch.png sketch 橘子汽水

Waits for the queue to be empty first, turns the stand-in feed off, then
pushes one order and grabs frames at 25% / 55% / 85% of the painting progress
so the shots line up with the animation instead of with the wall clock.
"""
from __future__ import annotations

import asyncio
import base64
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import httpx
import websockets

ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
APP = "http://127.0.0.1:8848/"
API = "http://127.0.0.1:8848"
PORT = 9333


async def call_factory(ws):
    state = {"id": 0, "pending": {}}

    async def reader():
        async for raw in ws:
            m = json.loads(raw)
            if "id" in m and m["id"] in state["pending"]:
                state["pending"].pop(m["id"]).set_result(m.get("result") or {})

    task = asyncio.create_task(reader())

    async def call(method: str, **params):
        state["id"] += 1
        fut = asyncio.get_running_loop().create_future()
        state["pending"][state["id"]] = fut
        await ws.send(json.dumps({"id": state["id"], "method": method,
                                  "params": params}))
        return await asyncio.wait_for(fut, 60)

    return call, task


async def main() -> int:
    img = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data/inbox/chk_sketch.png")
    tier = sys.argv[2] if len(sys.argv) > 2 else "sketch"
    nick = sys.argv[3] if len(sys.argv) > 3 else "橘子汽水"

    async with httpx.AsyncClient(timeout=20) as c:
        await c.post(f"{API}/api/admin/action", json={"action": "virtual_off"})
        await c.post(f"{API}/api/admin/action", json={"action": "clear"})
        print("后台已停虚拟并清队")

    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--remote-debugging-port={PORT}",
         "--user-data-dir=" + tempfile.mkdtemp(), "--window-size=1080,1920",
         "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(80):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get(f"http://127.0.0.1:{PORT}/json", timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)
        if not target:
            print("no chrome target")
            return 1

        async with websockets.connect(target["webSocketDebuggerUrl"],
                                      max_size=128 << 20) as ws:
            call, task = await call_factory(ws)
            await call("Page.enable")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url=APP)
            await asyncio.sleep(3)

            async def js(expr: str):
                r = await call("Runtime.evaluate", expression=expr,
                               returnByValue=True)
                return r.get("result", {}).get("value")

            # Wait until the canvas and the pre-render buffer are both empty,
            # otherwise the shots land on whatever was queued before ours.
            async with httpx.AsyncClient(timeout=10) as c:
                for _ in range(150):
                    s = (await c.get(f"{API}/api/admin/state")).json()
                    if not s.get("current") and not s.get("ready"):
                        break
                    await asyncio.sleep(1)
            print("画布已空，开始 supply")

            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(f"{API}/api/supply?nickname={nick}&tier={tier}",
                                 content=img.read_bytes(),
                                 headers={"content-type": "application/octet-stream"})
                print("supply:", r.status_code, r.text[:120])

            marks = [(0.25, "t04"), (0.55, "t10"), (0.85, "t18")]
            mi = 0
            for _ in range(1200):            # up to ~2 min
                d = await js("window.__d && window.__d.reveal")
                if d and mi < len(marks):
                    p = (d.get("i") or 0) / max(1, d.get("n") or 1)
                    if p >= marks[mi][0]:
                        shot = await call("Page.captureScreenshot", format="png")
                        out = ROOT / f"data/shot_{marks[mi][1]}.png"
                        out.write_bytes(base64.b64decode(shot["data"]))
                        print(f"saved {out.name}  progress={p:.2f}  part={d.get('part')}")
                        mi += 1
                        continue
                if not d and mi > 0:
                    shot = await call("Page.captureScreenshot", format="png")
                    out = ROOT / "data/shot_end.png"
                    out.write_bytes(base64.b64decode(shot["data"]))
                    print("saved", out.name)
                    break
                await asyncio.sleep(0.15)
            task.cancel()
    finally:
        proc.terminate()
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(f"{API}/api/admin/action", json={"action": "virtual_on"})
    return 0


sys.exit(asyncio.run(main()))
