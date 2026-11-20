"""Dump the colour canvas itself (not a page screenshot) to see what got painted."""
import asyncio, base64, json, subprocess, sys, tempfile
import httpx, websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


async def main():
    tier = sys.argv[1] if len(sys.argv) > 1 else "color"
    proc = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                             "--remote-debugging-port=9226",
                             "--user-data-dir=" + tempfile.mkdtemp(),
                             "--window-size=1080,1920", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(60):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get("http://127.0.0.1:9226/json", timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)

        async with websockets.connect(target["webSocketDebuggerUrl"], max_size=64 << 20) as ws:
            n = [0]

            async def call(method, **params):
                n[0] += 1
                i = n[0]
                await ws.send(json.dumps({"id": i, "method": method, "params": params}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get("method") in ("Runtime.consoleAPICalled", "Runtime.exceptionThrown"):
                        continue
                    if m.get("id") == i:
                        return m.get("result", {})

            await call("Page.enable")
            await call("Runtime.enable")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url="http://127.0.0.1:8848/")
            await asyncio.sleep(3.5)

            async def evaluate(expr):
                r = await call("Runtime.evaluate", expression=expr, returnByValue=True)
                return r.get("result", {}).get("value")

            prev = (await evaluate("window.__d || null") or {}).get("seq", 0)
            async with httpx.AsyncClient() as c:
                await c.get("http://127.0.0.1:8848/api/simulate",
                            params={"nickname": "调试", "tier": tier})

            for _ in range(300):
                d = await evaluate("window.__d || null") or {}
                if d.get("seq", 0) == prev + 1 and not d.get("playing") and not d.get("coloring"):
                    break
                await asyncio.sleep(0.2)

            url = await evaluate("document.getElementById('wash').toDataURL('image/png')")
            if url and url.startswith("data:image/png;base64,"):
                open(f"data/wash_{tier}.png", "wb").write(
                    base64.b64decode(url.split(",", 1)[1]))
                print("saved", f"data/wash_{tier}.png")
            else:
                print("no data url", str(url)[:120])

            s = await call("Page.captureScreenshot", format="png")
            open(f"data/page_{tier}.png", "wb").write(base64.b64decode(s["data"]))
            print("saved", f"data/page_{tier}.png")
    finally:
        proc.terminate()
    return 0


sys.exit(asyncio.run(main()))
