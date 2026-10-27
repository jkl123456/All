"""分镜数据（文案 / 图片 / 视频 / 音频）的持久化存储。"""

from __future__ import annotations

import json
import os
import shutil
import threading
import time
import uuid

DATA_DIR = "data"

DEFAULT_SETTINGS = {
    "voice": "longsanshu",
    "speed": 1.0,
    "volume": 80,
    "freshChat": True,
    "imageStyle": "画面风格统一：真实感摄影风格，光线自然，色彩干净通透，构图讲究，细节丰富；"
                  "人物容貌保持一致；整组画面有叙事连贯感。",
    "canvas": "1080x1920",
    "fill": "blur",
    "zoom": False,
    "defaultDur": 3.0,
    "videoSeconds": 10,
    "videoNoImage": False,
    "useOriginalAudio": False,
    "outName": "成片",
    "bgm": None,
    "bgmVolume": 0.2,
    "autoVideo": False,
    "chatUrl": "",
    "reuseChat": True,
    "subtitle": {
        "enabled": True,
        "font": "msyh.ttc",
        "size": 54,
        "color": "#FFFFFF",
        "strokeColor": "#000000",
        "strokeWidth": 3,
        "position": "bottom",
        "margin": 110,
        "lineSpacing": 1.25,
        "split": True,
    },
    "title": {
        "enabled": False,
        "text": "",
        "duration": 3,
        "overlay": True,
        "bg": "#101522",
        "font": "msyhbd.ttc",
        "size": 82,
        "color": "#FFFFFF",
        "strokeColor": "#000000",
        "strokeWidth": 0,
        "position": "center",
        "margin": 0,
        "lineSpacing": 1.3,
    },
}

MEDIA_KINDS = ("image", "video", "audio")


def new_id() -> str:
    return "r" + uuid.uuid4().hex[:10]


class StateStore:
    def __init__(self, config, log=None) -> None:
        self.config = config
        self.log = log
        self.lock = threading.RLock()
        self.data_dir = config.path(DATA_DIR)
        self.path = os.path.join(self.data_dir, "state.json")
        for sub in ("images", "audios", "videos", "output", "uploads"):
            os.makedirs(os.path.join(self.data_dir, sub), exist_ok=True)
        self.data = self._load()

    # ------------------------------------------------------------------ 读写
    def _default(self) -> dict:
        return {
            "mode": "image_text",
            "settings": dict(DEFAULT_SETTINGS),
            "rows": [],
            "characters": [],
            "result": None,
        }

    def _load(self) -> dict:
        if not os.path.exists(self.path):
            return self._default()
        try:
            with open(self.path, "r", encoding="utf-8") as fp:
                saved = json.load(fp)
        except Exception:
            return self._default()
        data = self._default()
        if isinstance(saved, dict):
            if saved.get("mode") in ("image_text", "video"):
                data["mode"] = saved["mode"]
            if isinstance(saved.get("settings"), dict):
                for key, value in saved["settings"].items():
                    if key in ("subtitle", "title") and isinstance(value, dict):
                        merged = dict(DEFAULT_SETTINGS[key])
                        merged.update(value)
                        data["settings"][key] = merged
                    else:
                        data["settings"][key] = value
            rows = saved.get("rows")
            if isinstance(rows, list):
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    data["rows"].append({
                        "id": row.get("id") or new_id(),
                        "text": row.get("text") or "",
                        "image": row.get("image"),
                        "video": row.get("video"),
                        "audio": row.get("audio"),
                        "episode": row.get("episode"),
                        "episodeTitle": row.get("episodeTitle") or "",
                        "videoSubmitted": row.get("videoSubmitted"),
                    })
            chars = saved.get("characters")
            if isinstance(chars, list):
                for item in chars:
                    if not isinstance(item, dict):
                        continue
                    data["characters"].append({
                        "id": item.get("id") or ("c" + uuid.uuid4().hex[:10]),
                        "name": item.get("name") or "",
                        "aliases": item.get("aliases") or "",
                        "desc": item.get("desc") or "",
                        "front": item.get("front"),
                        "side": item.get("side"),
                        "back": item.get("back"),
                    })
            if isinstance(saved.get("result"), dict):
                data["result"] = saved["result"]
        return data

    def save(self) -> None:
        with self.lock:
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fp:
                json.dump(self.data, fp, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)

    # ------------------------------------------------------------------ 模式
    @property
    def mode(self) -> str:
        return self.data["mode"]

    @property
    def settings(self) -> dict:
        return self.data["settings"]

    def set_mode(self, mode: str) -> None:
        if mode not in ("image_text", "video"):
            return
        with self.lock:
            self.data["mode"] = mode
            self.save()

    def update_settings(self, values: dict) -> dict:
        with self.lock:
            for key, value in values.items():
                if key not in DEFAULT_SETTINGS:
                    continue
                current = self.data["settings"].get(key)
                if isinstance(value, dict) and isinstance(current, dict):
                    merged = dict(current)
                    merged.update(value)
                    self.data["settings"][key] = merged
                else:
                    self.data["settings"][key] = value
            self.save()
            return dict(self.data["settings"])

    # ------------------------------------------------------------------ 行
    def rows(self) -> list[dict]:
        with self.lock:
            return list(self.data["rows"])

    def rows_with_text(self) -> list[dict]:
        return [r for r in self.rows() if (r.get("text") or "").strip()]

    def get_row(self, row_id: str) -> dict | None:
        with self.lock:
            for row in self.data["rows"]:
                if row["id"] == row_id:
                    return row
        return None

    def add_row(self, text: str = "") -> dict:
        """新增一行（允许空白行，方便先占位再填文案）。"""
        with self.lock:
            row = {"id": new_id(), "text": text or "", "image": None, "video": None,
                   "audio": None, "episode": None, "episodeTitle": ""}
            self.data["rows"].append(row)
            self.save()
            return row

    def add_rows(self, texts: list[str], replace: bool = False) -> list[dict]:
        with self.lock:
            if replace:
                self.data["rows"] = []
            added = []
            for text in texts:
                text = (text or "").strip()
                if not text:
                    continue
                row = {"id": new_id(), "text": text, "image": None, "video": None,
                       "audio": None, "episode": None, "episodeTitle": ""}
                self.data["rows"].append(row)
                added.append(row)
            self.save()
            return added

    def mark_existing_as_episode(self, no: int, title: str = "") -> int:
        """把还没集号的现有分镜标记成某一集（用于「现有分镜当做第一集」）。"""
        count = 0
        with self.lock:
            for row in self.data["rows"]:
                if not (row.get("text") or "").strip():
                    continue
                if row.get("episode") is not None:
                    continue
                row["episode"] = int(no)
                if title:
                    row["episodeTitle"] = title
                count += 1
            if count:
                self.save()
        return count

    def add_episode_rows(self, episodes: list[dict], replace: bool = False) -> list[dict]:
        """episodes: [{"no": 1, "title": "拆收音机的孩子", "texts": [...]}, ...]"""
        with self.lock:
            if replace:
                self.data["rows"] = []
            added = []
            for ep in episodes:
                no = int(ep.get("no") or 0)
                title = (ep.get("title") or "").strip()
                for text in ep.get("texts") or []:
                    text = (text or "").strip()
                    if not text:
                        continue
                    row = {
                        "id": new_id(), "text": text,
                        "image": None, "video": None, "audio": None,
                        "episode": no, "episodeTitle": title,
                    }
                    self.data["rows"].append(row)
                    added.append(row)
            self.save()
            return added

    def set_text(self, row_id: str, text: str) -> None:
        with self.lock:
            row = self._find(row_id)
            if row is not None:
                row["text"] = text
                self.save()

    def delete_row(self, row_id: str) -> None:
        with self.lock:
            self.data["rows"] = [r for r in self.data["rows"] if r["id"] != row_id]
            self.save()

    def clear_rows(self) -> None:
        with self.lock:
            self.data["rows"] = []
            self.save()

    def move_row(self, row_id: str, offset: int) -> None:
        with self.lock:
            rows = self.data["rows"]
            for idx, row in enumerate(rows):
                if row["id"] == row_id:
                    target = max(0, min(len(rows) - 1, idx + offset))
                    if target != idx:
                        rows.insert(target, rows.pop(idx))
                        self.save()
                    return

    def duplicate_row(self, row_id: str) -> dict | None:
        with self.lock:
            rows = self.data["rows"]
            for idx, row in enumerate(rows):
                if row["id"] == row_id:
                    clone = {
                        "id": new_id(),
                        "text": row.get("text") or "",
                        "image": row.get("image"),
                        "video": row.get("video"),
                        "audio": row.get("audio"),
                    }
                    rows.insert(idx + 1, clone)
                    self.save()
                    return clone
        return None

    def _find(self, row_id: str) -> dict | None:
        for row in self.data["rows"]:
            if row["id"] == row_id:
                return row
        return None

    # ------------------------------------------------------------------ 媒体
    def set_media(self, row_id: str, kind: str, abs_path: str | None) -> str | None:
        """abs_path 为绝对路径，内部转成相对 data 目录的路径保存。"""
        if kind not in MEDIA_KINDS:
            return None
        rel = None
        if abs_path:
            abs_path = os.path.abspath(abs_path)
            try:
                rel = os.path.relpath(abs_path, self.data_dir).replace("\\", "/")
            except ValueError:
                rel = abs_path.replace("\\", "/")
        with self.lock:
            row = self._find(row_id)
            if row is None:
                return None
            row[kind] = rel
            if kind == "video":
                row["videoSubmitted"] = None
            self.save()
        return rel

    def mark_video_submitted(self, row_id: str, when: float | None = None) -> None:
        """记住这条视频已经提交给豆包，续生成时不再重复提交。"""
        with self.lock:
            row = self._find(row_id)
            if row is None:
                return
            row["videoSubmitted"] = when if when is not None else time.time()
            self.save()

    # ------------------------------------------------------------------ 人物
    def characters(self) -> list[dict]:
        with self.lock:
            return [dict(c) for c in (self.data.get("characters") or [])]

    def get_character(self, char_id: str) -> dict | None:
        with self.lock:
            for item in self.data.get("characters") or []:
                if item["id"] == char_id:
                    return dict(item)
        return None

    def add_character(self, name: str = "", desc: str = "") -> dict:
        with self.lock:
            item = {
                "id": "c" + uuid.uuid4().hex[:10],
                "name": str(name or "")[:60],
                "aliases": "",
                "desc": str(desc or "")[:2000],
                "front": None,
                "side": None,
                "back": None,
            }
            self.data.setdefault("characters", []).append(item)
            self.save()
            return dict(item)

    def update_character(self, char_id: str, name=None, desc=None,
                         aliases=None) -> dict | None:
        with self.lock:
            for item in self.data.get("characters") or []:
                if item["id"] != char_id:
                    continue
                if name is not None:
                    item["name"] = str(name)[:60]
                if aliases is not None:
                    item["aliases"] = str(aliases)[:200]
                if desc is not None:
                    item["desc"] = str(desc)[:2000]
                self.save()
                return dict(item)
        return None

    def set_character_image(self, char_id: str, slot: str,
                            abs_path: str | None) -> str | None:
        """slot: front（正面，必须）/ side（侧面）/ back（背面）。"""
        if slot not in ("front", "side", "back"):
            return None
        rel = None
        if abs_path:
            abs_path = os.path.abspath(abs_path)
            try:
                rel = os.path.relpath(abs_path, self.data_dir).replace("\\", "/")
            except ValueError:
                rel = abs_path.replace("\\", "/")
        with self.lock:
            for item in self.data.get("characters") or []:
                if item["id"] == char_id:
                    item[slot] = rel
                    self.save()
                    return rel
        return None

    def delete_character(self, char_id: str) -> None:
        with self.lock:
            items = self.data.get("characters") or []
            self.data["characters"] = [c for c in items if c["id"] != char_id]
            self.save()

    def clear_media(self, row_id: str, kind: str) -> None:
        if kind not in MEDIA_KINDS:
            return
        with self.lock:
            row = self._find(row_id)
            if row is None:
                return
            row[kind] = None
            self.save()

    def abs_media(self, rel_path: str | None) -> str | None:
        if not rel_path:
            return None
        if os.path.isabs(rel_path):
            return rel_path
        return os.path.normpath(os.path.join(self.data_dir, rel_path.replace("/", os.sep)))

    # ------------------------------------------------------------------ 输出
    def set_result(self, result: dict | None) -> None:
        with self.lock:
            self.data["result"] = result
            self.save()

    def media_url(self, rel_path: str | None) -> str | None:
        if not rel_path:
            return None
        rel = rel_path.replace("\\", "/")
        if os.path.isabs(rel):
            return None
        return "/media/" + rel

    def local_copy(self, src: str, kind: str, prefix: str = "up") -> str:
        """把外部文件复制进 data 目录，返回绝对路径。"""
        folder = {"image": "images", "video": "videos", "audio": "audios"}[kind]
        ext = os.path.splitext(src)[1].lower() or ".bin"
        name = f"{prefix}_{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}{ext}"
        dst = os.path.join(self.data_dir, folder, name)
        shutil.copyfile(src, dst)
        return dst
