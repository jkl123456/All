"""Drive a headless Chrome over CDP: connect overlay -> queue one order -> screenshot."""
import asyncio, base64, json, subprocess, sys, time
import httpx, websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
APP = "http://127.0.0.1:8848/"
WAIT = float(sys.argv[1]) if len(sys.argv) > 1 else 50
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/shot_draw.png"
COUNT = int(sys.argv[3]) if len(sys.argv) > 3 else 1


async def cdp(ws, _id=[0]):
    def nid():
        _id[0] += 1
        return _id[0]
    async def call(method, **params):
        i = nid()
        await ws.send(json.dumps({"id": i, "method": method, "params": params}))
        while True:
            m = json.loads(await ws.recv())
            if m.get("id") == i:
                return m.get("result", {})
    return call


async def main():
    proc = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                             "--remote-debugging-port=9222", "--user-data-dir=" + str(__import__("tempfile").mkdtemp()),
                             "--window-size=1080,1920", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(60):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get("http://127.0.0.1:9222/json", timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)
        if not target:
            print("no chrome target"); return 1

        async with websockets.connect(target["webSocketDebuggerUrl"], max_size=64 << 20) as ws:
            call = await cdp(ws)
            await call("Page.enable")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url=APP)
            await asyncio.sleep(4)                     # overlay websocket settles
            async with httpx.AsyncClient() as c:
                for k in range(COUNT):
                    r = await c.post("http://127.0.0.1:8848/api/simulate",
                                     json={"nickname": f"橘子汽水{k}",
                                           "avatar": "data/samples/test01.jpg"})
                    if k == 0:
                        print("queued:", r.json()["order"]["nickname"])
            await asyncio.sleep(WAIT)
            shot = await call("Page.captureScreenshot", format="png")
            open(OUT, "wb").write(base64.b64decode(shot["data"]))
            print("saved", OUT)
    finally:
        proc.terminate()
    return 0


sys.exit(asyncio.run(main()))
