"""Grab a screenshot of the overlay page after N seconds.

    python scripts/shot_page.py 6            # default 1080x1920 stage
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
URL = APP
PORT = 9334


async def main() -> int:
    wait = float(sys.argv[1] if len(sys.argv) > 1 else 5)
    name = sys.argv[2] if len(sys.argv) > 2 else "page"
    url = sys.argv[3] if len(sys.argv) > 3 else APP

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

            await call("Page.enable")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url=url)
            await asyncio.sleep(wait)
            shot = await call("Page.captureScreenshot", format="png")
            out = ROOT / f"data/shot_{name}.png"
            out.write_bytes(base64.b64decode(shot["data"]))
            print("saved", out.name, out.stat().st_size // 1024, "KB")
            task.cancel()
    finally:
        proc.terminate()
    return 0


sys.exit(asyncio.run(main()))
