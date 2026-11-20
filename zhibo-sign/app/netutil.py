"""websocket 连接的小工具（只为绕开一个版本坑）。

## 坑长什么样

本机端口（弹幕桥 9000、CDP 9223）不能走系统 HTTP_PROXY，否则 502/连不上，
所以要传 `proxy=None`。但这个名字只有 websockets>=14 认；13 及以前没有这个参数。

关键区别在**什么时候报错**：

    # 采集器里这么写，能兜住
    try:
        self.ws = await websockets.connect(url, proxy=None)
    except TypeError:
        self.ws = await websockets.connect(url)      # 退回老写法

    # 换成这样，兜不住
    try:
        conn = websockets.connect(url, proxy=None)   # 这里只是造了个对象，没连
    except TypeError:
        ...
    async with conn:                                 # 真正的 TypeError 在这里抛

websockets<14 的 connect() 是把不认识的参数透传给 `loop.create_connection`，
而建连是**懒执行**的，所以 try 包在 connect() 外面时什么都抓不到，
表现就是每 5 秒刷一行 "create_connection() got an unexpected keyword argument 'proxy'"。

这里直接读函数签名，一次决定用不用这个参数，两种写法都不会再踩。
"""
from __future__ import annotations

import inspect

import websockets


def _supports(fn, name: str) -> bool:
    try:
        return name in inspect.signature(fn).parameters
    except (TypeError, ValueError):
        return False


WS_PROXY_OK = _supports(websockets.connect, "proxy")


def ws_connect(url: str, **kw):
    """按当前 websockets 版本决定要不要带 proxy=None。"""
    if WS_PROXY_OK:
        kw.setdefault("proxy", None)
    return websockets.connect(url, **kw)
