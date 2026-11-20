"""Smoke test: fake an overlay client, push one order, verify strokes arrive."""
import asyncio
import json
import sys
import time

import httpx
import websockets

BASE = "http://127.0.0.1:8848"


async def main():
    for _ in range(40):
        try:
            async with httpx.AsyncClient() as c:
                await c.get(f"{BASE}/api/status", timeout=1)
            break
        except Exception:
            await asyncio.sleep(0.5)
    else:
        print("server not up"); return 1

    async with websockets.connect("ws://127.0.0.1:8848/ws/overlay") as ws:
        hello = json.loads(await ws.recv())
        print("hello:", hello["type"], JSON := hello["payload"].get("stroke_width"))
        async with httpx.AsyncClient() as c:
            r = await c.post(f"{BASE}/api/simulate",
                             json={"nickname": "测试小鹿", "avatar": "data/samples/test01.jpg"})
            print("simulate:", r.status_code, r.json()["order"])
        t0 = time.time()
        while time.time() - t0 < 30:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=30))
            if m["type"] != "draw_start":
                continue
            p = m["payload"]
            print(f"draw_start @{p['nickname']} strokes={len(p['strokes'])} "
                  f"len={p['total_len']} size={p['size']} avatar={p['avatar_url']} "
                  f"dur={p['duration_ms']/1000:.0f}s provider={p['provider']}")
            print(f"first stroke pts={len(p['strokes'][0])} "
                  f"start={p['strokes'][0][0]} end={p['strokes'][0][-1]}")
            await ws.send(json.dumps({"type": "done"}))
            print("sent done ->", round(time.time() - t0, 1), "s")
            return 0
    print("no draw_start received"); return 1


sys.exit(asyncio.run(main()))
