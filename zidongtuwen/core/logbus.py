"""进程内日志总线：前端按序号增量拉取。"""

from __future__ import annotations

import threading
import time


class LogBus:
    def __init__(self, maxlen: int = 1000) -> None:
        self._items: list[dict] = []
        self._seq = 0
        self._lock = threading.Lock()
        self._maxlen = maxlen

    def log(self, message: str, level: str = "info") -> dict:
        with self._lock:
            self._seq += 1
            item = {
                "seq": self._seq,
                "t": time.strftime("%H:%M:%S"),
                "level": level,
                "msg": str(message),
            }
            self._items.append(item)
            if len(self._items) > self._maxlen:
                self._items = self._items[-self._maxlen:]
            return item

    def info(self, message: str) -> dict:
        return self.log(message, "info")

    def ok(self, message: str) -> dict:
        return self.log(message, "ok")

    def warn(self, message: str) -> dict:
        return self.log(message, "warn")

    def error(self, message: str) -> dict:
        return self.log(message, "error")

    def since(self, seq: int) -> tuple[list[dict], int]:
        with self._lock:
            items = [i for i in self._items if i["seq"] > seq]
            return items, self._seq

    def tail(self, n: int = 200) -> list[dict]:
        with self._lock:
            return self._items[-n:]
