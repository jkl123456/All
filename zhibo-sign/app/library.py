"""成图素材库：空场直接播已经生成好的图，一次都不叫豆包。

为什么不复用 `virtual.names` 现生成：
豆包一张要 15~20 秒，还得抢一个 Chrome 窗口。开播没人、改配置重启、OBS 刷新
这些时刻都会触发一次空场——真按"从名字池里取一个让 AI 画"走，额度全烧在
重复的"张三"上，而且每次开播都要等二十秒才有第一个画面。

`data/signatures` 里每次出图都会留两份文件：
    ai_<时间>_<名字>.png        豆包原始成图
    ..._glyph.png               抠出来的透明笔迹（播放用的就是它）
    ..._full.jpg                底板+新字的合成图（重连时的静态兜底）

所以空场要的东西这里全都有。唯一缺的是"笔迹该贴在哪儿"——也就是字框。
字框在生成时就丢掉了（当时只写进了内存），这里补回来：
优先读 `_library.json` 缓存；没有就用 `postercut.extract` 从原始成图重算一次
（0.3~1 秒/张，只在第一次启动时发生），算完写回缓存。
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from .pipeline import brush, wordsheet

# 批量出图的文件名形如 ai_1115_213000_b2_林晚_glyph.png：
# 时间戳后面可能带 b<序号>_（一批里的第几个人），名字要跳过这一段。
# ai_1115_213000_b2_林晚     AI 批量出的（b2 = 一批里第二个）
# up_1115_220500_张三        后台手动上传的
STEM_RE = re.compile(r"^(?:ai_\d{4}_\d{6}_(?:b\d+_)?|up_\d{4}_\d{6}_)(?P<name>.+)$")


def _cover(img, w: int, h: int):
    """等比缩放到铺满 w×h，再居中裁切（和 CSS background-size: cover 一致）。"""
    import cv2

    ih, iw = img.shape[:2]
    k = max(w / iw, h / ih)
    im = cv2.resize(img, (max(w, int(round(iw * k))), max(h, int(round(ih * k)))),
                    interpolation=cv2.INTER_AREA)
    nh, nw = im.shape[:2]
    x = max(0, (nw - w) // 2)
    y = max(0, (nh - h) // 2)
    return im[y:y + h, x:x + w]


def _imsize(p: Path) -> tuple[int, int]:
    import cv2
    import numpy as np

    img = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)
    return (img.shape[1], img.shape[0]) if img is not None else (0, 0)


class Library:
    """按文件名扫一遍成图，配好笔迹、字框、名字，随时可以拿出来播。"""

    def __init__(self, conf: dict | None, data_dir: Path, sig: dict | None = None):
        self.conf = conf or {}
        self.dir = data_dir
        self.sig = sig or {}
        self.items: list[dict] = []
        self.i = 0
        self._cache_path = data_dir / "_library.json"
        self._cache: dict[str, dict] = {}
        self._stamp: tuple = ()
        self._last_scan = 0.0
        self._name_rot: dict[str, int] = {}

    # ------------------------------------------------------------ 配置
    @property
    def enabled(self) -> bool:
        return bool(self.conf.get("library", True))

    @property
    def mode(self) -> str:
        """cycle=按名字顺序轮播（内容不重样）；repeat=一直播同一张。"""
        return str(self.conf.get("loop") or "cycle").lower()

    # ------------------------------------------------------------ 索引
    def _load_cache(self) -> None:
        try:
            self._cache = json.loads(self._cache_path.read_text("utf-8"))
        except Exception:
            self._cache = {}

    def _save_cache(self) -> None:
        try:
            self._cache_path.write_text(
                json.dumps(self._cache, ensure_ascii=False, indent=1), "utf-8")
        except Exception:
            pass

    def _place(self) -> dict:
        return dict((self.sig.get("doubao") or {}).get("place") or {})

    def _box(self, stem: str, glyph: Path) -> list[int] | None:
        """字框直接由"笔迹本身的宽高"推出来（见 wordsheet.place_box）。

        以前是拿成图和模板做差反推框——那套只适用于"AI 改整张海报"的老路子。
        现在 AI 只在一张白纸上写一列名字，笔迹是干净的透明 PNG，
        把它的宽高等比缩进背景中间那块留白，就是它的字位。
        缓存按笔迹尺寸校验，换了图或换了摆法会自动重算。
        """
        gw, gh = _imsize(glyph)
        if not gw or not gh:
            return None
        hit = self._cache.get(stem)
        if (isinstance(hit, dict) and hit.get("w") == gw and hit.get("h") == gh
                and len(hit.get("box") or []) == 4):
            return [int(v) for v in hit["box"]]
        box = wordsheet.place_box(gw, gh, self._place())
        self._cache[stem] = {"w": gw, "h": gh, "box": box}
        return box

    def _scan(self) -> list[dict]:
        out: list[dict] = []
        for full in sorted(self.dir.glob("*_full.jpg")):
            stem = full.name[: -len("_full.jpg")]
            if stem.startswith("_"):
                continue                      # _t_full.jpg 这类手测文件
            glyph = self.dir / f"{stem}_glyph.png"
            if not glyph.exists():
                continue
            m = STEM_RE.match(stem)
            name = (m.group("name") if m else stem).strip()
            if not name:
                continue
            out.append({"stem": stem, "name": name,
                        "full": full, "glyph": glyph,
                        "box": self._box(stem, glyph),
                        "ts": full.stat().st_mtime})
        # 新的排前面：观众刚看完的那张，空场先回放它最自然
        out.sort(key=lambda d: -d["ts"])
        return out

    def refresh(self, force: bool = False) -> None:
        now = time.time()
        if not force and now - self._last_scan < 5.0:
            return
        self._last_scan = now
        try:
            stamp = (len(list(self.dir.glob("*_full.jpg"))),
                     max((p.stat().st_mtime for p in self.dir.glob("*_full.jpg")),
                         default=0))
        except Exception:
            stamp = ()
        if not force and stamp == self._stamp and self.items:
            return
        if not self._cache:
            self._load_cache()
        was_empty = not self.items
        self.items = self._scan()
        if was_empty or stamp != self._stamp:
            self._save_cache()
        self._stamp = stamp

    # ------------------------------------------------------------ 播放
    def next_item(self) -> dict | None:
        self.refresh()
        if not self.items:
            return None
        if self.mode == "repeat":
            item = self.items[0]
        else:
            item = self.items[self.i % len(self.items)]
            self.i += 1
        return item

    def by_name(self, name: str) -> dict | None:
        """找一张正好写了这个名字的成图（演示数据用，省得为了假观众调 AI）。"""
        self.refresh()
        want = (name or "").strip()
        if not want:
            return None
        same = [d for d in self.items if d["name"].strip() == want]
        if not same:
            return None
        i = self._name_rot.get(want, 0)      # 同名多张时轮着播，别每次都一张
        self._name_rot[want] = i + 1
        return same[i % len(same)]

    def names(self) -> list[str]:
        self.refresh()
        seen: list[str] = []
        for d in self.items:
            if d["name"] not in seen:
                seen.append(d["name"])
        return seen

    def _full_view(self, item: dict) -> str:
        """"底板 + 这张笔迹"的合成图，给 overlay 收笔时淡入用。

        不能直接用 data/signatures 里那份 `_full.jpg`：那是老流程（AI 改整张海报）
        留下的，背景还是旧海报。现在按当前底板重新合一张，缓存在 data/cache/full。

        缓存文件名带**底板的指纹**（mtime + 大小）：后台换了背景，文件名就变了，
        自动重新合一张。以前是靠"删掉旧缓存"来失效，但一台机器上缓存几十张，
        批量删会被系统的删除保护拦住（甚至把进程带走）——换名是无声的，也更安全。
        """
        tpl = str((self.sig.get("doubao") or {}).get("plate") or "").strip()
        root = Path(__file__).resolve().parents[1]
        box = item.get("box")
        if not tpl or not box:
            return ""
        try:
            st = (root / tpl).stat()
            tag = f"{int(st.st_mtime)}_{st.st_size % 100000}"
        except OSError:
            tag = "0"
        out = self.dir.parent / "cache" / "full" / f"{item['stem']}.{tag}.jpg"
        try:
            if not (out.exists()
                    and out.stat().st_mtime >= item["glyph"].stat().st_mtime):
                if not wordsheet.compose(root / tpl, item["glyph"], box, out):
                    return ""
            return f"/data/cache/full/{out.name}"
        except Exception:
            return ""

    def payload(self, item: dict, tier: dict, seq: int = 0) -> dict:
        """拼成和 build_payload 一样的 payload，overlay 不用区分来源。"""
        box = item.get("box")
        name = item["name"]
        if box:
            mode, size = "ink", [box[2] - box[0], box[3] - box[1]]
        else:
            # 没有字框就整张渐显，也不会空场
            mode, size = "reveal", [1080, 1920]
        return {
            "nickname": name, "name": name, "kind": "virtual",
            "gift": "", "score": 96, "value": 0.0,
            "created": round(time.time() - 1, 1), "waited": 1, "seq": seq,
            "jump": False, "upgraded": False,
            "mode": mode,
            "art_url": f"/data/signatures/{item['glyph'].name}",
            "full_url": self._full_view(item),
            "box": box, "size": size,
            # 毛笔运笔路径（带缓存，第一次算 0.2~0.7 秒）；字数决定怎么切字排笔顺
            "writes": brush.writes_for(item["glyph"], len(name), name=name) if box else [],
            "tier": tier.get("key"), "tier_name": tier.get("name"),
            "duration_ms": int(float(tier.get("duration", 8)) * 1000),
            "hold_seconds": float(tier.get("hold_seconds", 3.0)),
            "provider": "library",
            "elapsed": 0.0,
        }

    def status(self) -> dict:
        self.refresh()
        return {"enabled": self.enabled, "count": len(self.items),
                "loop": self.mode, "next": self.i % max(1, len(self.items)),
                "names": [d["name"] for d in self.items[:6]]}

    # ------------------------------------------------------------ 后台管理
    def add(self, raw: bytes, name: str = "") -> dict | None:
        """把一张自己做好的成图加进空场轮播（后台"上传"）。

        两种图都收：
          * 整张海报（背景 + 写好的名字）：缩到 1080×1920，和底板做差，抠出笔迹；
          * 白底只有字（模板那种）：**按原尺寸**算 alpha，别先缩放——
            白底图常常是很宽的一条，硬拉成竖版会把字放大到只剩一两笔。
        抠不出字就返回 None，让后台报错，而不是塞一张空图进轮播。
        """
        import cv2
        import numpy as np

        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return None

        # 底板：整张海报型的图要拿它做差
        plate_path = str((self.sig.get("doubao") or {}).get("plate") or "").strip()
        root = Path(__file__).resolve().parents[1]
        plate = None
        if plate_path:
            plate = cv2.imdecode(np.fromfile(str(root / plate_path), np.uint8),
                                 cv2.IMREAD_COLOR)
            if plate is not None and plate.shape[:2] != (1920, 1080):
                plate = cv2.resize(plate, (1080, 1920), interpolation=cv2.INTER_AREA)

        light = float(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean())
        src = img
        if light > 205 or plate is None:          # 白底字：保持原尺寸
            a = wordsheet.alpha_from_light(img)
            if float(a.max()) < 0.2:
                return None
            mask = a > 0.10
            if mask.sum() < 400:
                return None
            ys, xs = np.where(mask)
            y0, y1 = max(0, int(ys.min()) - 4), int(ys.max()) + 5
            x0, x1 = max(0, int(xs.min()) - 4), int(xs.max()) + 5
            rgba = wordsheet._rgba(img[y0:y1, x0:x1], a[y0:y1, x0:x1])
        else:                                     # 整张海报：和底板做差
            src = _cover(img, 1080, 1920)
            diff = np.abs(src.astype(np.int16) - plate.astype(np.int16)).sum(axis=2)
            diff = cv2.GaussianBlur(diff.astype(np.float32), (3, 3), 0)
            mask = diff > 28
            if mask.sum() < 400:
                return None
            # 分位数当"实心墨"的强度，避免整体偏淡或偏浓
            hi = max(24.0, float(np.percentile(diff[mask], 92)))
            al = np.clip(diff / hi, 0.0, 1.0)
            al[al < 0.12] = 0.0
            ys, xs = np.where(al > 0.12)
            y0, y1 = max(0, int(ys.min()) - 4), min(1920, int(ys.max()) + 5)
            x0, x1 = max(0, int(xs.min()) - 4), min(1080, int(xs.max()) + 5)
            ca = al[y0:y1, x0:x1]
            crop = src[y0:y1, x0:x1].astype(np.float32)
            base = plate[y0:y1, x0:x1].astype(np.float32)
            f = np.maximum(ca[..., None], 1e-3)
            # 反预乘：img = a*墨 + (1-a)*底板 -> 墨 = (img - (1-a)*底板)/a
            ink = np.clip((crop - (1 - f) * base) / f, 0, 255)
            rgba = np.dstack([ink, ca * 255]).astype(np.uint8)
            rgba[ca < 0.02] = 0

        if rgba.shape[0] < 12 or rgba.shape[1] < 12:
            return None

        safe = "".join(ch for ch in (name or "") if ch.isalnum())[:12] or "sig"
        ts = time.strftime("%m%d_%H%M%S")
        stem = f"up_{ts}_{safe}"
        n = 1
        while (self.dir / f"{stem}_full.jpg").exists():   # 同一秒传两张
            n += 1
            stem = f"up_{ts}_{safe}{n}"
        glyph = self.dir / f"{stem}_glyph.png"
        full = self.dir / f"{stem}_full.jpg"
        wordsheet._imwrite(glyph, rgba)
        # full 要的是"背景 + 这个名字"，不是白底原图：有底板就用底板合一张，
        # 后台缩略图、OBS 重连兜底都靠它。
        box = wordsheet.place_box(rgba.shape[1], rgba.shape[0], self._place())
        done = None
        if plate is not None:
            done = wordsheet.compose(root / plate_path, glyph, box, full)
        if done is None:
            wordsheet._imwrite(full, _cover(src, 1080, 1920))
        self.refresh(True)
        for d in self.items:
            if d["stem"] == stem:
                return d
        return None

    def remove(self, stem: str) -> bool:
        """把一张图从轮播里删掉（连带笔迹、合成缓存和索引）。"""
        stem = (stem or "").strip()
        if not stem or "/" in stem or "\\" in stem or ".." in stem:
            return False
        hit = False
        for p in (self.dir / f"{stem}_full.jpg", self.dir / f"{stem}_glyph.png"):
            try:
                p.unlink()
                hit = True
            except FileNotFoundError:
                pass
            except OSError:
                pass
        cache = self.dir.parent / "cache" / "full" / f"{stem}.jpg"
        try:
            cache.unlink()
        except OSError:
            pass
        if not self._cache:
            self._load_cache()
        self._cache.pop(stem, None)
        self._save_cache()
        if hit:
            self.refresh(True)
        return hit

    def listing(self) -> list[dict]:
        """后台用的列表：名字、缩略图地址、大小。"""
        self.refresh()
        out = []
        for d in self.items:
            # 尺寸直接取字框缓存里的 w/h，别每张都读盘（后台轮询时很费）
            hit = self._cache.get(d["stem"]) or {}
            w, h = int(hit.get("w") or 0), int(hit.get("h") or 0)
            out.append({"stem": d["stem"], "name": d["name"],
                        "url": f"/data/signatures/{d['full'].name}",
                        "glyph": f"/data/signatures/{d['glyph'].name}",
                        "w": w, "h": h, "ts": int(d["ts"])})
        return out

