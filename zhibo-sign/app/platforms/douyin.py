"""Douyin live adapter (best effort, no official API).

Douyin has no public API for a personal account to read a live room's
barrage + viewer avatars. The only working route is the webcast IM
WebSocket, which requires a `signature` produced by Douyin's obfuscated
front-end JS together with a valid `ttwid` cookie.

`signature` expires, so it is read from config and can be refreshed by
re-running scripts/grab_params.py (see README) or by pasting a fresh one
from Chrome devtools. Everything else (frame decoding, event mapping) is
implemented here.

Verify with:  python run.py --source douyin --debug
If field numbers drifted, adjust FIELD_MAP at the top.
"""
from __future__ import annotations

import asyncio
import gzip
import json
import random
import time
import uuid

import websockets

from .base import EventSource

WS_URL = "wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/"

# ---------------------------------------------------------------- protobuf
def _varint(buf: bytes, i: int) -> tuple[int, int]:
    shift = val = 0
    while True:
        b = buf[i]
        i += 1
        val |= (b & 0x7F) << shift
        if not b & 0x80:
            return val, i
        shift += 7


def fields(buf: bytes):
    """Yield (field_no, value) for a protobuf message without a .proto file.
    value is int for varint, bytes for length-delimited."""
    i, n = 0, len(buf)
    while i < n:
        key, i = _varint(buf, i)
        no, wire = key >> 3, key & 7
        if wire == 0:
            v, i = _varint(buf, i)
            yield no, v
        elif wire == 2:
            ln, i = _varint(buf, i)
            yield no, buf[i:i + ln]
            i += ln
        elif wire == 5:
            yield no, buf[i:i + 4]
            i += 4
        elif wire == 1:
            yield no, buf[i:i + 8]
            i += 8
        else:
            return


def field_dict(buf: bytes) -> dict[int, list]:
    out: dict[int, list] = {}
    for no, v in fields(buf):
        out.setdefault(no, []).append(v)
    return out


def _s(buf: bytes) -> str:
    try:
        return buf.decode("utf-8", "ignore")
    except Exception:
        return ""


def parse_user(blob: bytes) -> dict:
    d = field_dict(blob)
    nick = _s(d.get(3, [b""])[0])
    avatar = ""
    img = d.get(9)                                  # avatar_thumb
    if img:
        urls = field_dict(img[0]).get(1) or []       # repeated url_list
        for u in urls:
            if isinstance(u, bytes) and u.startswith(b"http"):
                avatar = _s(u)
                if "http" in avatar:
                    break
    return {"nickname": nick, "avatar": avatar}


# field numbers of the messages we care about
FIELD_MAP = {
    "WebcastChatMessage": {"user": 2, "content": 3},
    "WebcastGiftMessage": {"user": 7, "gift_id": 2, "repeat": 5},
    "WebcastMemberMessage": {"user": 2},
    "WebcastLikeMessage": {"count": 2, "total": 3},
}


def parse_message(method: str, payload: bytes) -> dict | None:
    m = FIELD_MAP.get(method)
    if not m:
        return None
    d = field_dict(payload)
    user = parse_user(d[m["user"]][0]) if "user" in m and d.get(m["user"]) else {}
    if not user.get("nickname"):
        return None
    if method == "WebcastChatMessage":
        return {"type": "chat", "content": _s(d.get(3, [b""])[0]), **user}
    if method == "WebcastGiftMessage":
        # The gift itself is the nested GiftStruct (field 15): 16 is its name,
        # 11 its price in diamonds (1 yuan = 10 diamonds). Without this the
        # event only carried an id, so every gift fell back to the cheapest
        # tier and the same sketch style.
        name, diamond = "", 0
        g = d.get(15)
        if g:
            gd = field_dict(g[0])
            for no in (16, 2):
                v = _s(gd.get(no, [b""])[0])
                if v and not v.startswith("http"):
                    name = v
                    break
            diamond = int(gd.get(11, [0])[0] or 0)
        return {"type": "gift", "gift": name or f"gift{d.get(2, [0])[0]}",
                "diamond": diamond, **user}
    if method == "WebcastMemberMessage":
        return {"type": "member", **user}
    return {"type": "like", **user}


def _gunzip(b: bytes) -> bytes:
    if b[:2] == b"\x1f\x8b":
        try:
            return gzip.decompress(b)
        except Exception:
            return b
    return b


def decode_frame(buf: bytes) -> tuple[bytes | None, bool]:
    """取出一帧里的 Response 字节。

    这里有三种壳子，都得认：
      1. PushFrame（老 WebSocket 时代）：1=seqid(varint), 7=encoding, 8=payload
      2. `/webcast/im/fetch/` 的响应体：**本身就是一个 Response**，1 = repeated Message
         （网页端现在走这条路，早期只认 PushFrame 会把整帧当成空帧丢掉）
      3. 整帧 gzip：magic 1f 8b，先解开再看上面两种
    """
    raw = _gunzip(buf)
    d = field_dict(raw)

    f1 = d.get(1)
    is_response = bool(f1) and isinstance(f1[0], (bytes, bytearray))

    if is_response:
        payload = raw
    elif isinstance(d.get(8, [None])[0], (bytes, bytearray)):
        payload = _gunzip(bytes(d[8][0]))
    else:
        return None, False
    if not payload:
        return None, False

    resp = field_dict(payload)
    ack = resp.get(9, [0])[0]
    need_ack = bool(ack) if isinstance(ack, int) else False
    return payload, need_ack


# ---------------------------------------------------------------- source
class DouyinSource(EventSource):
    name = "douyin"

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.room_id = str(cfg.get("room_id") or "").strip()
        self.debug = bool(cfg.get("debug"))
        self._ack = b""

    # ---- handshake params
    def _params(self) -> str:
        c = self.cfg
        p = {
            "app_name": "douyin_web",
            "version_code": "180800",
            "webcast_sdk_version": "1.0.14-beta.0",
            "update_version_code": "1.0.14-beta.0",
            "compress": "gzip",
            "device_platform": "web",
            "cookie_enabled": "true",
            "browser_language": "zh-CN",
            "browser_platform": "Win32",
            "browser_name": "Mozilla",
            "browser_version": "5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36",
            "aid": "6383",
            "live_id": "1",
            "did_rule": "3",
            "endpoint": "live",
            "support_wrds": "1",
            "im_path": "/webcast/im/fetch/",
            "im_path_version": "1",
            "identity": "audience",
            "need_persist_msg_count": "15",
            "room_id": self.room_id,
            "heartbeatDuration": "0",
            "signature": c.get("signature") or "",
            "ttwid": c.get("ttwid") or "",
            "user_unique_id": c.get("user_unique_id") or "",
            "device_id": c.get("device_id") or "",
            "webcast_language": "zh",
        }
        return "&".join(f"{k}={v}" for k, v in p.items() if v != "")

    def _headers(self) -> dict:
        h = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Origin": "https://live.douyin.com",
            "Referer": f"https://live.douyin.com/{self.room_id}",
        }
        ck = self.cfg.get("cookie") or ""
        if ck:
            h["Cookie"] = ck
        return h

    def _ack_frame(self) -> bytes:
        """Build a heartbeat/ack PushFrame: field8 payload_type=hb, field9 payload."""
        def ld(no: int, data: bytes) -> bytes:
            return bytes([(no << 3) | 2, len(data)]) + data if len(data) < 128 else \
                   bytes([(no << 3) | 2]) + _enc_varint(len(data)) + data

        def vi(no: int, v: int) -> bytes:
            return bytes([no << 3]) + _enc_varint(v)

        body = b""
        if self._ack:
            body += ld(2, self._ack)          # internal_ext
        frame = vi(1, int(time.time() * 1000)) + vi(4, 1) + ld(7, b"hb") + ld(8, body)
        return frame

    async def run(self, emit) -> None:
        if not self.room_id:
            raise RuntimeError("platform.douyin.room_id 未配置（直播间房间号，不是主播号）")
        if not self.cfg.get("signature"):
            print("[douyin] 缺少 signature，握手大概率失败；见 README「抖音接入」")
        backoff = 3
        while True:
            try:
                await self._session(emit)
                backoff = 3
            except Exception as e:
                print(f"[douyin] 连接异常: {e}; {backoff}s 后重连")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)

    async def _session(self, emit) -> None:
        url = f"{WS_URL}?{self._params()}"
        async with websockets.connect(url, extra_headers=self._headers(),
                                      max_size=8 << 20, ping_interval=None) as ws:
            print(f"[douyin] room {self.room_id} 已连接")
            hb = asyncio.create_task(self._heartbeat(ws))
            try:
                async for raw in ws:
                    await self._handle(raw, emit)
            finally:
                hb.cancel()

    async def _heartbeat(self, ws) -> None:
        while True:
            await asyncio.sleep(10)
            try:
                await ws.send(self._ack_frame())
            except Exception:
                return

    async def _handle(self, raw: bytes, emit) -> None:
        response, need_ack = decode_frame(raw)
        if not response:
            return
        if need_ack:
            d = field_dict(response)
            self._ack = d.get(5, [b""])[0] if d.get(5) else b""
        for msg in field_dict(response).get(1, []):
            md = field_dict(msg)
            method = _s(md.get(1, [b""])[0])
            payload = md.get(2, [b""])[0]
            if self.debug and method:
                print(f"[douyin] {method} {len(payload)}B")
            ev = parse_message(method, payload)
            if ev:
                if self.debug:
                    print("[douyin] ->", json.dumps(ev, ensure_ascii=False)[:160])
                await emit(ev)


def _enc_varint(v: int) -> bytes:
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        out.append(b | (0x80 if v else 0))
        if not v:
            return bytes(out)
