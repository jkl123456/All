"""名字合规审核：这个名字能不能在直播间大屏上写出来。

直播是**公开播出**的，把观众的名字原样写成书法大字，等于替他在公屏上喊话。
所以入队前过一道审：涉政、涉黄、辱骂、暴力、广告引流、违法违禁——都不写。

## 两层，先便宜后贵

1. **本地黑名单**（微秒级，不发网络）：广告引流（加微信/vx/qq 群）、赌博毒品、
   明显脏话的常见变体。这批词命中率高、误伤低，挡掉 90% 的麻烦。
2. **DeepSeek 判定**（约 0.6~1.5 秒）：本地规则表达不了的"语境"——
   "某某是傻逼"、"干死你"、擦边谐音、以及涉政敏感——交给模型。
   提示词要求它只回 JSON，且**必须承认自己不确定就放行**：
   误杀一个正常人（观众看不到自己的名字）比放行一个边缘词更伤直播体验。

## 网络挂了怎么办

`fail_open: true`（默认）：超时/报错就**放行**，并在日志里留一行警告。
理由是本地黑名单已经兜住了硬违规，而 AI 挂掉就卡住整条队列（名字全部写不出来）
是更严重的事故。要严格模式就设 `fail_open: false`，那时宁可少写一张。

结果按名字缓存，一场直播里同一个名字只问一次。
"""
from __future__ import annotations

import asyncio
import json
import re
import time

import httpx

SYSTEM = (
    "你是一个中国直播间的名字审核员。观众发来一个名字，会被写成书法大字显示在"
    "公开直播画面上。请判断这个名字是否可以公开展示。\n"
    "以下情况必须拒绝：涉及政治敏感、色情低俗、辱骂人身攻击、暴力威胁、民族地域歧视、"
    "违法犯罪（赌博毒品枪支）、广告引流（微信/QQ/网址/带货）、以及明显的脏话谐音。\n"
    "以下情况应当放行：普通人名、昵称、网名、英文名、拼音、含数字的昵称、"
    "带表情符号的昵称、只是看起来奇怪但没有实际冒犯含义的词。\n"
    "不确定时选择放行——误伤一个普通观众，比放过一个边缘词更糟。\n"
    '只输出 JSON，不要解释：{"ok": true 或 false, "reason": "极简理由（不超过12字）"}'
)

# 本地黑名单：只放命中率高、几乎不会误伤的。
# 故意不收录需要语境判断的词——那些交给模型，硬编码只会误杀。
LOCAL_PATTERNS = (
    # 广告引流
    r"加\s*微\s*信", r"加\s*v", r"\bvx\b", r"\bwx\b", r"扣\s*扣", r"qq\s*群",
    r"私\s*聊", r"代\s*练", r"刷\s*单", r"兼\s*职", r"日\s*赚", r"http", r"www\.",
    r"\.com", r"\.cn", r"公\s*众\s*号",
    # 违法违禁
    r"赌\s*博", r"博\s*彩", r"六\s*合", r"彩\s*票", r"毒\s*品", r"冰\s*毒",
    r"枪\s*支", r"炸\s*药", r"代\s*开",
    # 色情低俗（只收直白的）
    r"裸\s*聊", r"约\s*炮", r"嫖", r"卖\s*淫", r"色\s*情", r"a\s*v\s*女",
    # 辱骂（最常见的几种，含谐音变体）
    r"傻\s*[逼比bB]", r"操\s*你", r"草\s*你", r"日\s*你", r"滚\s*你",
    r"死\s*全\s*家", r"废\s*物", r"贱\s*人", r"婊",
)
_LOCAL_RE = re.compile("|".join(LOCAL_PATTERNS), re.I)


def _parse_json(txt: str) -> dict:
    """把模型返回的东西抠成 dict。

    推理模型的输出经常不老实：包一层 ```json 围栏、前面加一句"好的"、
    甚至在 JSON 后面补一段解释。所以不直接 json.loads，而是从第一个 { 开始截到
    最后一个 } 再解析。
    """
    t = (txt or "").strip()
    if not t:
        return {}
    try:
        return json.loads(t)
    except Exception:
        pass
    i, j = t.find("{"), t.rfind("}")
    if 0 <= i < j:
        try:
            return json.loads(t[i:j + 1])
        except Exception:
            pass
    return {}


class Moderator:
    def __init__(self, conf: dict | None = None):
        c = dict(conf or {})
        self.enabled = bool(c.get("enabled", True))
        self.key = str(c.get("api_key") or "")
        self.base = str(c.get("base_url") or "https://api.deepseek.com/v1").rstrip("/")
        self.model = str(c.get("model") or "deepseek-flash")
        self.timeout = float(c.get("timeout", 3.0))
        self.fail_open = bool(c.get("fail_open", True))
        self._cache: dict[str, tuple[bool, str]] = {}
        self._max = int(c.get("cache", 800))
        self.calls = 0
        self.blocked = 0
        self.errors = 0

    # ------------------------------------------------------------ 本地
    @staticmethod
    def local_hit(name: str) -> str:
        m = _LOCAL_RE.search(name or "")
        return f"命中本地规则「{m.group(0)}」" if m else ""

    # ------------------------------------------------------------ AI
    async def check(self, name: str) -> tuple[bool, str]:
        """返回 (能否展示, 理由)。任何异常都不抛，按 fail_open 决定。"""
        n = (name or "").strip()
        if not n:
            return False, "名字为空"
        if not self.enabled:
            return True, ""
        if n in self._cache:
            return self._cache[n]

        hit = self.local_hit(n)
        if hit:
            self.blocked += 1
            self._put(n, False, hit)
            return False, hit

        if not self.key:
            return True, ""

        ok, why = await self._ask(n)
        self._put(n, ok, why)
        if not ok:
            self.blocked += 1
        return ok, why

    async def _ask(self, name: str) -> tuple[bool, str]:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"名字：{name}"},
            ],
            "temperature": 0,
            # deepseek-flash 是**推理模型**：它会先写一段 reasoning_content 再给正文。
            # 给 60 token 的话推理就把额度吃光了，content 是空串、finish_reason=length
            # ——第一版就是这么踩的（返回空 → JSONDecodeError → 全部 fail_open 放行）。
            "max_tokens": 500,
            "response_format": {"type": "json_object"},
        }
        self.calls += 1
        t0 = time.time()
        try:
            # trust_env 保持默认（走系统代理）：外网 API 在这台机器上需要代理
            async with httpx.AsyncClient(timeout=self.timeout) as c:
                r = await c.post(f"{self.base}/chat/completions", json=body,
                                 headers={"Authorization": f"Bearer {self.key}"})
                if r.status_code >= 400:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:120]}")
                msg = ((r.json().get("choices") or [{}])[0].get("message") or {})
            d = _parse_json(msg.get("content") or "")
            if not isinstance(d, dict) or "ok" not in d:
                raise RuntimeError(f"没解析出判词：{(msg.get('content') or '')[:60]!r}")
            ok = bool(d.get("ok"))
            why = str(d.get("reason") or "")[:24]
            dt = (time.time() - t0) * 1000
            print(f"[审] 「{name}」{'放行' if ok else '拦下'}"
                  f"{('：' + why) if why else ''} {dt:.0f}ms", flush=True)
            return ok, why
        except Exception as e:
            self.errors += 1
            print(f"[审] 「{name}」审核失败({type(e).__name__}: {str(e)[:70]})，"
                  f"按 fail_open={self.fail_open} 处理", flush=True)
            return (self.fail_open, "" if self.fail_open else "审核服务不可用")

    def _put(self, name: str, ok: bool, why: str) -> None:
        if len(self._cache) >= self._max:
            for k in list(self._cache)[: self._max // 4]:
                self._cache.pop(k, None)
        self._cache[name] = (ok, why)

    def status(self) -> dict:
        return {"enabled": self.enabled, "model": self.model,
                "calls": self.calls, "blocked": self.blocked,
                "errors": self.errors, "cached": len(self._cache),
                "fail_open": self.fail_open}


_default: Moderator | None = None


def get(conf: dict | None = None) -> Moderator:
    """进程内单例：缓存要跨单子复用，不然同一个名字每次都问一遍 AI。"""
    global _default
    if _default is None or conf is not None:
        _default = Moderator(conf) if conf is not None else Moderator({})
    return _default


if __name__ == "__main__":  # 手测：python -m app.moderation 张三 傻逼
    import sys

    from .config import load

    m = get(dict(load().get("moderation") or {}))
    async def _run():
        for x in sys.argv[1:] or ["张三", "李雷", "加微信123"]:
            print(x, "->", await m.check(x))
    asyncio.run(_run())
