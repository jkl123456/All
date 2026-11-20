"""排单队列。核心规则：送礼插队，插队时写"他弹幕里说过的名字"。

为什么需要记住名字：观众通常是先在弹幕里打「张三」，再送个礼物表示"给我写"。
礼物事件只带昵称、不带弹幕内容，如果直接拿昵称去写，画出来是「橘子汽水」而不是
「张三」——观众要的不是自己的 ID，是那个名字。

所以这里维护一张 `昵称 -> 名字` 的记忆表：任何一条弹幕被判定为名字就记下来，
送礼时优先取记忆，没有再退回昵称。这份记忆不分是否入队，因为观众可能先说了名字
但当时队列满了。

去重：一场直播里同一个名字只写一遍。以前只挡住了"同一个昵称 + 同一个名字同时
在队列里"这一种，实际会漏掉最常见的几种：
  - 不同观众打同一个名字（「张三」被八个人报名，写八遍）；
  - 名字正在写的时候又有人打；
  - 写完一分钟后同一个人再打一遍。
现在的判定：归一化名字（全角转半角、去空格、英文不分大小写）之后，
排队中 / 正在写 / 窗口期内刚写过 —— 都算重复。见 `_dup_reason`。
"""
from __future__ import annotations

import asyncio
import hashlib
import time
import unicodedata
from dataclasses import dataclass, field

from .pipeline.signature import clean_name


def name_key(name: str) -> str:
    """名字的比较键：全角转半角、去所有空白、英文不分大小写。

    「ＴＴ」「tt」「 T t 」在这里都是 "tt"——观众用全角键盘打出来的名字，
    和半角小写是同一件事，不该各写一遍。
    """
    s = unicodedata.normalize("NFKC", name or "").strip().casefold()
    return "".join(ch for ch in s if not ch.isspace())


@dataclass
class Order:
    nickname: str
    name: str                      # 真正要写的字
    seq: int
    kind: str = "chat"             # chat | gift | manual | virtual
    gift: str = ""
    value: float = 0.0             # 礼物价值（元），决定画多慢/多讲究
    created: float = field(default_factory=time.time)
    jump: bool = False             # 礼物插队进来的，overlay 会打标记
    upgraded: bool = False         # 本来是弹幕单，后来补了礼物，原地升级成插队
    demo: bool = False             # 来自 mock 的假观众：只播素材库，绝不叫 AI

    @property
    def score(self) -> int:
        """笔力分。纯装饰：直播间有个"评分"会显得这笔画得很认真。"""
        h = int(hashlib.md5(f"{self.name}{self.seq}".encode()).hexdigest()[:6], 16)
        return 88 + h % 12

    def brief(self) -> dict:
        return {"nickname": self.nickname, "name": self.name, "kind": self.kind,
                "gift": self.gift, "score": self.score,
                "value": self.value, "created": round(self.created, 1),
                "waited": int(time.time() - self.created), "seq": self.seq,
                "jump": self.jump, "upgraded": self.upgraded}


class QueueManager:
    def __init__(self, cfg):
        self.cfg = cfg
        self.items: list[Order] = []
        self.current: Order | None = None
        self.done: list[str] = []
        self.paused = False
        self._seq = 0
        self._event = asyncio.Event()
        # 昵称 -> 名字。这个记忆是本项目"写对名字"的关键。
        self.names: dict[str, str] = {}
        # ---- 去重状态
        dd = cfg.get("dedupe") or {}
        self.dd_window = float(dd.get("window", 1800))     # 写完多久内不再重写（秒）
        self.dd_across = str(dd.get("across", "name")).lower()   # name | user
        self.dd_gift_bypass = bool(dd.get("gift_bypass", True))
        self.written: dict[str, float] = {}    # key -> 写完的时刻
        self.active: dict[str, float] = {}     # key -> 入队/开写的时刻（排队中、正在写、已交豆包）
        self.skipped = 0                       # 一共挡掉多少个重复名字
        self.last_reject = ""                  # 最近一次拒绝原因（给日志用）
        # 已经从队列取走、正在等豆包出图的单。留在盘面上给右上角队列看，
        # 否则观众打完名字，图还在生成（20~30 秒），他的名字会从面板里凭空消失。
        self.pending: list[Order] = []

    # ---------------------------------------------------------- intake
    @property
    def prefix(self) -> str:
        return str(self.cfg.get("prefix") or "")

    def remember(self, nickname: str, name: str) -> None:
        if nickname and name:
            self.names[nickname] = name
            if len(self.names) > 4000:                 # 长时间直播别无限涨
                for k in list(self.names)[:1000]:
                    self.names.pop(k, None)

    def name_for(self, nickname: str) -> str:
        return self.names.get(nickname) or clean_name(nickname) or nickname

    # ---- 去重 -------------------------------------------------------
    def _ck(self, nickname: str, name: str) -> str:
        """去重用的键。across=name（默认）只看名字，across=user 才区分是谁打的。"""
        k = name_key(name)
        return f"{nickname}|{k}" if self.dd_across == "user" else k

    def dedupe_key(self, order: "Order") -> str:
        """外部（批量出图）用的去重键，保证和入队判定是同一把尺子。"""
        return self._ck(order.nickname, order.name)

    def _dup_reason(self, nickname: str, name: str, kind: str) -> str:
        """重复就返回原因，否则空串。"""
        if self.dd_window <= 0:                     # 窗口 0 = 关掉去重
            return ""
        if kind == "gift" and self.dd_gift_bypass:  # 花钱的单可以再写一次
            return ""
        k = self._ck(nickname, name)
        if not k:
            return ""
        now = time.time()
        t = self.active.get(k)
        if t is not None:
            if now - t <= self.dd_window:
                if self.current and self._ck(self.current.nickname,
                                             self.current.name) == k:
                    return "正在写这一张"
                return "已经在排队"
            self.active.pop(k, None)                # 在途太久，当作丢了
        t = self.written.get(k)
        if t is not None:
            if now - t <= self.dd_window:
                return f"刚写过（{int(now - t)} 秒前）"
            self.written.pop(k, None)
        return ""

    def _track(self, order: Order) -> None:
        self.active[self._ck(order.nickname, order.name)] = time.time()

    def _release(self, order: Order) -> None:
        """这一单彻底不在场上了（被删/被跳），把它从"在途"里摘掉。

        只有当队列里、以及正在写的都不是这个名字时才摘——同名可能还有别的单。
        """
        k = self._ck(order.nickname, order.name)
        if any(self._ck(o.nickname, o.name) == k for o in self.items):
            return
        if self.current and self._ck(self.current.nickname, self.current.name) == k:
            return
        self.active.pop(k, None)

    def _reject(self, nickname: str, name: str, kind: str = "chat") -> str:
        """返回空串表示接受，否则返回拒绝原因（给日志用）。"""
        self.last_reject = ""
        if not name:
            self.last_reject = "名字为空"
            return self.last_reject
        # 同一个昵称 + 同一个名字还在队里：不是重复单，是"还能补礼物"，交给 add_gift 升级
        if any(o.nickname == nickname and o.name == name for o in self.items):
            self.last_reject = "已经在队列里"
            return self.last_reject
        reason = self._dup_reason(nickname, name, kind)
        if reason:
            self.skipped += 1
            self.last_reject = reason
            return reason
        if len(self.items) >= int(self.cfg.get("max", 30)):
            self.last_reject = "队列已满"
            return self.last_reject
        return ""

    def add_chat(self, nickname: str, content: str) -> Order | None:
        name = clean_name(content, self.prefix)
        if not name:
            self.last_reject = ""
            return None
        self.remember(nickname, name)       # 先记住：哪怕这次没排上，送礼时也要用
        if self._reject(nickname, name, "chat"):
            return None
        return self._push(Order(nickname, name, self._next(), "chat"))

    def add_gift(self, nickname: str, gift: str = "", value: float = 0.0,
                 jump: bool = True) -> Order | None:
        name = self.name_for(nickname)
        if not name:
            return None
        want_jump = bool(jump) and bool(int(self.cfg.get("gift_jump", 1)))

        # 已经在队里等着的，不是"重复单"，是"补一张礼物票"：原地升级成礼签并挪到队首。
        # 不然最常见的顺序——先发弹幕报名、过几秒再送礼——会被去重吃掉，白送礼。
        # 比较用的是去重键，所以"别人先报了同一个名字、我送礼想写这个名"也会合并到那张单上，
        # 不会出现同一个名字写两遍。
        k = self._ck(nickname, name)
        for o in self.items:
            if self._ck(o.nickname, o.name) == k:
                o.kind = "gift"
                o.gift = gift or o.gift
                o.value = max(value, o.value)
                o.jump = True
                o.upgraded = True
                if want_jump:
                    self._to_front(o)
                else:
                    self._event.set()
                return o

        # 已经被取走、正在出图的那张也能升级——"先发名字、过几秒再送礼"是最常见的
        # 顺序，弹幕单往往在这几秒里就被 producer 取走了。只补档位，笔迹不重画，
        # 播放时 presenter 会按新的 value 重算书写时长（见 main.presenter）。
        for o in self.pending:
            if self._ck(o.nickname, o.name) == k:
                o.kind = "gift"
                o.gift = gift or o.gift
                o.value = max(value, o.value)
                o.jump = True
                o.upgraded = True
                self._event.set()
                return o

        # 窗口期内刚写完的：gift_bypass=True（默认）就允许再写一次，False 则挡掉
        reason = self._dup_reason(nickname, name, "gift")
        if reason:
            self.skipped += 1
            self.last_reject = reason
            return None
        if len(self.items) >= int(self.cfg.get("max", 30)):
            self.last_reject = "队列已满"
            return None
        order = Order(nickname, name, self._next(), "gift", gift, value, jump=want_jump)
        if want_jump:
            self._to_front(order)
            return order
        return self._push(order)

    def _to_front(self, order: Order) -> None:
        """插到"当前正在写的那一单"的下一位。

        当前正在写的单已经从 items 里拿出去了（挂在 current 上），
        所以 items[0] 就是下一位。`gift_after_current: true`（默认）时永远插 0，
        最新一次打赏最先被画；设成 false 就退回老规矩——排在已插队的礼物后面，
        先送的先画，更公平但新礼物要等。
        """
        if order in self.items:
            self.items.remove(order)
        if bool(self.cfg.get("gift_after_current", True)):
            i = 0
        else:
            i = 0
            while (i < len(self.items) and self.items[i].kind == "gift"
                   and self.items[i].jump):
                i += 1
        self.items.insert(i, order)
        self._track(order)
        self._event.set()

    def add_manual(self, nickname: str, name: str, kind: str = "manual",
                   gift: str = "", value: float = 0.0) -> Order:
        self.remember(nickname, name)
        return self._push(Order(nickname, name, self._next(), kind, gift, value))

    def add_virtual(self, nickname: str, name: str) -> Order:
        """空场保底。同一个人名会反复出现，所以绕过去重。"""
        order = Order(nickname, name, self._next(), "virtual")
        self.items.append(order)
        self._event.set()
        return order

    def ghost(self, nickname: str, name: str) -> Order:
        """不占队列的虚拟单：空场循环重播上一张时用。"""
        return Order(nickname, name, self._next(), "virtual")

    def _next(self) -> int:
        self._seq += 1
        return self._seq

    def _push(self, order: Order) -> Order:
        # 真人不排在假人后面
        idx = len(self.items)
        for i, o in enumerate(self.items):
            if o.kind == "virtual":
                idx = i
                break
        self.items.insert(idx, order)
        self._track(order)
        self._event.set()
        return order

    # ---------------------------------------------------------- consume
    def drop(self, seq: int) -> bool:
        for i, o in enumerate(self.items):
            if o.seq == seq:
                self._release(self.items.pop(i))
                return True
        for o in list(self.pending):          # 还在出图的也能删（写出来就没人播）
            if o.seq == seq:
                self.pending.remove(o)
                self._release(o)
                return True
        return False

    def bump(self, seq: int) -> bool:
        for i, o in enumerate(self.items):
            if o.seq == seq:
                self.items.insert(0, self.items.pop(i))
                return True
        return False

    def pop(self) -> Order | None:
        if self.paused or not self.items:
            return None
        return self.items.pop(0)

    def real_pending(self) -> int:
        """队列里还有几个真人单（演示数据和幽灵单不算）。

        生图节流要用它：明明没真人，就别去叫 AI 浪费额度。
        """
        return sum(1 for o in self.items
                   if o.kind != "virtual" and not getattr(o, "demo", False))

    def gift_waiting(self) -> bool:
        """队列里有没有还没开工的礼物单（要插队那种）。

        生成是 20 秒一批的节流，礼物要是也等这个窗口，"当前写完就写他"就落空了——
        观众刷完礼物看着别人先写，会以为钱白花了。producer 拿它开一条快速通道。
        """
        return any(o.kind == "gift" and o.jump for o in self.items)

    def pop_real(self, n: int) -> list[Order]:
        """一次取出最多 n 个"真人单"，给豆包批量出图用。

        只从队首连着拿，碰到空场幽灵单或演示数据就停——批量里混进假观众，
        会把一次 HTML 之外的额度浪费在演示名字上。
        """
        out: list[Order] = []
        if self.paused:
            return out
        while self.items and len(out) < n:
            o = self.items[0]
            if o.kind == "virtual" or getattr(o, "demo", False):
                break
            out.append(self.items.pop(0))
        # 记进"生成中"，右上角面板照样看得到；写完（finish）才摘掉
        self.pending.extend(out)
        return out

    def take_pending(self, order: "Order") -> None:
        """这一单已经播过了（或被跳过/删掉），别再挂在"生成中"。"""
        self.pending = [o for o in self.pending if o.seq != order.seq]

    def finish(self) -> None:
        if self.current:
            o = self.current
            self.done.append(o.name)
            # 记进"写过的名单"：窗口期内的重复报名都靠它挡
            k = self._ck(o.nickname, o.name)
            self.active.pop(k, None)
            if self.dd_window > 0:
                self.written[k] = time.time()
            self.take_pending(o)
            self.current = None

    def skip(self) -> None:
        if self.current:
            o = self.current
            self.current = None
            self.take_pending(o)          # 回到队列里，别同时挂着"生成中"
            self.items.insert(0, o)

    def snapshot(self) -> dict:
        # 十分钟还没轮到播的，多半是生成失败后被丢了，别一直挂在"生成中"
        now = time.time()
        self.pending = [o for o in self.pending if now - o.created < 600]
        return {
            "queue": [o.brief() for o in self.items],
            "pending": [o.brief() for o in self.pending],
            "current": self.current.brief() if self.current else None,
            "paused": self.paused,
            "done": len(self.done),
            "names_remembered": len(self.names),
            "skipped": self.skipped,
            "dedupe": {"window": self.dd_window, "across": self.dd_across,
                       "gift_bypass": self.dd_gift_bypass},
        }
