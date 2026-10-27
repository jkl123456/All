"""配置加载与保存。"""

from __future__ import annotations

import json
import os
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "config.json")

DEFAULTS = {
    "host": "127.0.0.1",
    "port": 8848,
    "open_browser_on_start": True,
    "chrome_path": "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "chrome_debug_port": 9333,
    "chrome_profile": "data/chrome_profile",
    "doubao_url": "https://www.doubao.com/chat/",
    "jimeng_url": "https://jimeng.jianying.com/ai-tool/generate?type=video",
    "fresh_chat_each_task": True,
    "image_timeout": 420,
    "auto_fill_images": False,
    "video_timeout": 900,
    "video_engine": "doubao",
    "doubao_video_click_entry": False,
    "video_pipeline": True,
    "video_one_shot": True,
    "video_batch_timeout": 1200,
    "video_nudge_idle": 60,
    "video_nudge_max": 4,
    "episode_watch_interval": 300,
    "episode_interrupt_max": 3,
    "deepseek_api_key": "",
    "deepseek_base_url": "https://api.deepseek.com",
    "deepseek_model": "deepseek-flash",
    "ai_guide_enabled": True,
    "ai_guide_max_replies": 3,
    "max_auto_retries": 2,
    "dashscope_api_key": "",
    "tts_model": "cosyvoice-v2",
    "tts_ignore_proxy": True,
    "tts_max_chars": 480,
    "ffmpeg_path": "ffmpeg",
    "ffprobe_path": "ffprobe",
    "video_auto_enabled": False,
}


class Config:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.data = dict(DEFAULTS)
        self.load()

    # ------------------------------------------------------------------ 基础
    def load(self) -> dict:
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as fp:
                    saved = json.load(fp)
                if isinstance(saved, dict):
                    merged = dict(DEFAULTS)
                    merged.update(saved)
                    self.data = merged
            except Exception:
                pass
        return self.data

    def save(self) -> None:
        with self._lock:
            tmp = CONFIG_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fp:
                json.dump(self.data, fp, ensure_ascii=False, indent=2)
            os.replace(tmp, CONFIG_PATH)

    def get(self, key: str, default=None):
        return self.data.get(key, DEFAULTS.get(key, default))

    def set_many(self, values: dict) -> None:
        with self._lock:
            for key, value in values.items():
                if key in DEFAULTS:
                    self.data[key] = value
            self.save()

    # ------------------------------------------------------------------ 路径
    def path(self, *parts: str) -> str:
        """把配置里的相对路径解析成绝对路径。"""
        raw = os.path.join(*parts)
        if os.path.isabs(raw):
            return raw
        return os.path.normpath(os.path.join(ROOT, raw))

    def resolve(self, raw: str) -> str:
        if not raw:
            return ""
        if os.path.isabs(raw):
            return raw
        return os.path.normpath(os.path.join(ROOT, raw))

    @property
    def root(self) -> str:
        return ROOT
