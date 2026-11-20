"""Screenshot the overlay for each gift tier, synchronised on the real state
machine (window.__d) instead of guessed sleeps."""
import asyncio, base64, json, subprocess, sys, tempfile
import httpx, websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
APP = "http://127.0.0.1:8848/"
TIERS = ["simple", "sketch", "color", "fine"]


async def main():
    proc = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                             "--remote-debugging-port=9225",
                             "--user-data-dir=" + tempfile.mkdtemp(),
                             "--window-size=1080,1920", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(60):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get("http://127.0.0.1:9225/json", timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)
        if not target:
            print("no chrome target")
            return 1

        async with websockets.connect(target["webSocketDebuggerUrl"], max_size=64 << 20) as ws:
            n = [0]

            async def call(method, **params):
                n[0] += 1
                i = n[0]
                await ws.send(json.dumps({"id": i, "method": method, "params": params}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get("method") in ("Runtime.consoleAPICalled",
                                           "Runtime.exceptionThrown"):
                        continue
                    if m.get("id") == i:
                        return m.get("result", {})

            await call("Page.enable")
            await call("Runtime.enable")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url=APP)
            await asyncio.sleep(3.5)

            async def state():
                r = await call("Runtime.evaluate", expression="window.__d || null",
                               returnByValue=True)
                return r.get("result", {}).get("value") or {}

            async def shot(path):
                s = await call("Page.captureScreenshot", format="png")
                open(path, "wb").write(base64.b64decode(s["data"]))
                print("saved", path)

            async def wait_for(pred, timeout=25):
                loop = asyncio.get_event_loop()
                t0 = loop.time()
                while loop.time() - t0 < timeout:
                    if pred(await state()):
                        return True
                    await asyncio.sleep(0.12)
                return False

            async with httpx.AsyncClient() as c:
                for key in TIERS:
                    prev = (await state()).get("seq", 0)
                    await c.get("http://127.0.0.1:8848/api/simulate",
                                params={"nickname": "橘子汽水", "tier": key})
                    seq = prev + 1
                    await wait_for(lambda d: d.get("seq") == seq and d.get("playing")
                                   and d.get("drawn", 0) > d.get("total", 1) * 0.55)
                    await shot(f"data/shot_{key}_mid.png")
                    await wait_for(lambda d: d.get("seq") == seq
                                   and not d.get("playing") and not d.get("coloring"))
                    await asyncio.sleep(0.6)
                    await shot(f"data/shot_{key}_end.png")
                    await asyncio.sleep(1.0)     # let the presenter close the order
    finally:
        proc.terminate()
    return 0


sys.exit(asyncio.run(main()))
