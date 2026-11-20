"""Debug the colour phase: watch the wash canvas + console errors over time."""
import asyncio, json, subprocess, sys, tempfile
import httpx, websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


async def main():
    proc = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                             "--remote-debugging-port=9224",
                             "--user-data-dir=" + tempfile.mkdtemp(),
                             "--window-size=1080,1920", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(60):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get("http://127.0.0.1:9224/json", timeout=1)).json()
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
                    if m.get("method") == "Runtime.consoleAPICalled":
                        args = [a.get("value") or a.get("description") for a in m["params"]["args"]]
                        print("  console:", *args)
                    if m.get("method") == "Runtime.exceptionThrown":
                        d = m["params"]["exceptionDetails"]
                        print("  EXC:", d.get("text"), d.get("exception", {}).get("description"))
                    if m.get("id") == i:
                        return m.get("result", {})

            await call("Page.enable")
            await call("Runtime.enable")
            await call("Page.addScriptToEvaluateOnNewDocument",
                       source="window.__err=null;addEventListener('error',e=>{window.__err=(e.message||'')+' @'+(e.lineno||0)});")
            await call("Emulation.setDeviceMetricsOverride", width=1080, height=1920,
                       deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url="http://127.0.0.1:8848/")
            await asyncio.sleep(3.5)

            PROBE = """(() => {
              const w = document.getElementById('wash');
              const g = w.getContext('2d');
              let painted = 0;
              try {
                const d = g.getImageData(0, 0, w.width, w.height).data;
                for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 8) painted++;
              } catch (e) { return 'getImageData failed: ' + e.message; }
              return {painted, hint: document.getElementById('hint').textContent,
                      tier: document.getElementById('tier').textContent,
                      d: window.__d, err: window.__err || null};
            })()"""

            async with httpx.AsyncClient() as c:
                await c.get("http://127.0.0.1:8848/api/simulate",
                            params={"nickname": "调试", "tier": "color"})
            for k in range(18):
                await asyncio.sleep(0.7)
                r = await call("Runtime.evaluate", expression=PROBE, returnByValue=True)
                print(f"{k*0.7:4.1f}s", r.get("result", {}).get("value"))
    finally:
        proc.terminate()
    return 0


sys.exit(asyncio.run(main()))
