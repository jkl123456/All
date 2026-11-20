"""豆包网页版出图：在真浏览器里发一句话，等它把签名画完，再把图取回来。

不用 API Key，用的是 `.chrome-doubao/` 里的登录态——和 `zhibo`（画头像那个项目）
的 `scripts/doubao_grab.py` 是同一套做法，只是这里不需要上传参考图，纯文生图。

为什么不用方舟 images/generations：那条路要 `api_key` 且按张计费；豆包网页版已经
登录着，画一张只要十几秒，直播场景下"免费 + 够快"比"接口规范"重要。

取图的几个坑（都是画画那个项目踩出来的）：
* 输入框是 tiptap，合成 Enter 不生效，必须等发送按钮出现再点。
* 成图是 `<img src=...rc_gen_image...>`，在页面里 fetch 才拿得到 1536 原图
  （直接下载链接会被 CDN 的签名/防盗链拦）。
* 豆包会在右下角烧一行"豆包 AI 生成"，沙画签名里那行字很显眼，取回来就抹掉。
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import subprocess
import time
from pathlib import Path

import httpx

from ..config import ROOT
from ..netutil import ws_connect
from . import wordsheet
from .watermark import erase_watermark_file

CHROME_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
)

DOUBAO = "https://www.doubao.com/chat/"

# 关键：只让它写字。画面（海鸥、船、印章、标语）全部由模板负责，
# 让 AI 碰整张海报，它每次都会顺手重画一遍，"只换中间的字"从没成功过。
DEFAULT_PROMPT = (
    "请写「{name}」这几个字，深墨绿色毛笔书法，笔锋有力、有干湿飞白；"
    "纯白色背景，横排居中；不要画面、不要装饰、不要印章、不要边框、不要任何其它文字；"
    "字尽量大，占满画面，四周只留一点白边"
)

# 有模板图时走这条：图先传上去，再让它"只改那几个字"。
# 实测这么问，豆包会先回一句"只做标题替字，锁定原图的青绿色毛笔字质感"，
# 出来的整张图除字以外基本是原样（框外平均像素差 3/255，就是 JPEG 噪声）。
# 注意别写"中间那几个大字"这种描述：模型会自己找哪里像大字，有时改到标语上。
# 直接点名原图上的「智纪元」，它就知道只有这三处要换。
EDIT_PROMPT = (
    "参考这张图，图上的「智纪元」三个字替换成「{name}」，"
    "就换这三个字，位置、字号、颜色、笔触风格和原来的完全一致，看起来本来就画在里面。"
    "其余部分（天空、海面、小船、海鸥、印章、标语、边框、纸张质感、光照）"
    "全部保持原样，不要重画，也不要添加任何其它文字。"
)

# 一批一张：把队列里的 n 个名字一次写完，竖着排成一列。
# 只说"参考这张图的风格"，别说"替换"——它是往白纸上新写一列，不是改模板。
# 三个坑：
#   1) 光写"竖着写"它会写成一行（实测 5 个名字排成一条横线），必须明确
#      "一个名字占一行""不要写在同一行"；
#   2) 提示词里不要出现"横排""居中"这类讲单行内部排法的词：模型会把"横排"
#      读成"整张图横着一行"，正好撞上第 1 条。只描述行与行之间的上下关系。
#   3) 别在名字前面加序号，否则模型真的会把 1. 2. 3. 写到画面上，
#      切图时那些数字会被当成名字的一部分。
BATCH_PROMPT = (
    "参考这张图的字体风格（深墨绿色毛笔书法，笔锋有力、有干湿飞白、笔画偏粗）。"
    "图片规格：竖版，宽 1080、高 1920，高度明显大于宽度，整张图是竖着的长方形；"
    "不要横版，不要横长条，也不要正方形。"
    "现在把下面的 {n} 个名字写成一整列：一个名字占一行，从上到下依次排下来，"
    "一共 {n} 行，正好铺满这张竖图的高度；整列是竖着往下走的，"
    "名字与名字之间上下分开，不要左右并排，也不要把两个名字写在同一行。"
    "从上到下依次是：\n{names}\n"
    "每个名字在自己那一行里大小一致；字号、粗细、颜色、笔触风格和参考图完全一致；"
    "行距均匀，行与行之间留出明显空白。"
    "不要写序号，不要装饰、印章、边框，不要任何其它文字。"
)

# 只有一个名字时走这条：不排"几行一列"，就一句"照这张图换个字"。
# 短提示词在这种单字场景反而更稳：说"写成一列 1 行"模型会自己加排版，
# 说"替换"它就当成改字，笔迹和背景都跟着原图走。
SINGLE_PROMPT = (
    "模仿这张图上的文字，把文字替换为「{name}」，生成一张图片，"
    "笔触、颜色、粗细和原图一致，背景风格保持一致。"
    "图上只出现「{name}」这几个字，不要其它文字。"
)

# ------------------------------------------------------------------ 页面脚本
EDITOR_READY_JS = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).length;
  return {ed, locked: (document.body.innerText || '').includes('扫码登录')};
})()
"""

SEND_BTN_JS = """
(() => {
  const b = document.querySelector('[data-testid="chat_input_send_button"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return null;
  return {x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!b.disabled};
})()
"""

SENT_JS = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  const txt = ed ? ed.innerText.trim() : '';
  return {len: txt.length,
          btn: !!document.querySelector('[data-testid="chat_input_send_button"]')};
})()
"""

# 会话是复用的，页面里堆着以前所有成图。所以每次发话前先记下现有的图，
# 之后只认"新出现的那张"——否则会立刻把上一轮的结果当成这一轮的。
LIST_JS = """
(() => [...document.querySelectorAll('img')]
  .filter(e => /rc_gen_image/.test(e.src))
  .map(e => ({src: e.src, w: e.naturalWidth, h: e.naturalHeight})))()
"""

PULL_SRC_JS = """
(async () => {
  const src = SRC;
  try {
    const r = await fetch(src);
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    }
    return {ok: true, b64: btoa(s)};
  } catch (e) {
    return {ok: false, reason: String(e)};
  }
})()
"""

FAILED_JS = """
(() => {
  const t = document.body ? document.body.innerText : '';
  return {failed: t.includes('生成失败') || t.includes('无法生成')};
})()
"""

# 等图用这一支：图 + "还在生成"的标记一起读回来。
# 只按 LIST_JS 里"有张新图"就收工是不够的——豆包会先插一张模糊/占位的
# `rc_gen_image` 进去，naturalWidth 立刻过 500，那一刻取回来的是半成品，
# 于是"看着像生成完了、其实还没画完"。所以额外要求：图连着两次读到的 src 不变、
# 页面上的"生成中 / 停止生成"已经消失，才认为真画完了。
WAIT_STATE_JS = """
(() => {
  const imgs = [...document.querySelectorAll('img')]
    .filter(e => /rc_gen_image/.test(e.src))
    .map(e => ({src: e.src, w: e.naturalWidth, h: e.naturalHeight,
                done: !!e.complete && e.naturalWidth > 0}));
  const t = document.body ? document.body.innerText : '';
  const stop = document.querySelector('[data-testid="chat_input_stop_button"]')
            || document.querySelector('[data-testid="chat_input_loading_button"]')
            || document.querySelector('[aria-label="停止生成"]');
  const busy = !!stop || t.includes('生成中') || t.includes('正在生成')
            || t.includes('停止生成');
  return {imgs, busy,
          failed: t.includes('生成失败') || t.includes('无法生成')};
})()
"""


# ------------------------------------------------------------------ CDP
class _CDP:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}

    async def reader(self):
        try:
            async for raw in self.ws:
                m = json.loads(raw)
                if "id" in m:
                    fut = self._pending.pop(m["id"], None)
                    if fut and not fut.done():
                        fut.set_result(m.get("result") or {})
        finally:
            # 连接断了（浏览器被关掉 / 崩了）：把还在等的调用立刻打回去。
            # 不这么做的话，每个 CDP 调用都要干等到 120 秒超时，
            # 一批人在队列里空等好几分钟才等到"退回本地笔画"。
            for fut in list(self._pending.values()):
                if not fut.done():
                    try:
                        fut.set_exception(RuntimeError("浏览器连接已断开"))
                    except Exception:
                        pass
            self._pending.clear()

    async def call(self, method: str, **params) -> dict:
        self._id += 1
        mid = self._id
        fut = asyncio.get_running_loop().create_future()
        self._pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        return await asyncio.wait_for(fut, timeout=120)

    async def js(self, expression: str):
        r = await self.call("Runtime.evaluate", expression=expression,
                            returnByValue=True, awaitPromise=True)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print("  ! JS:", (res.get("description") or "")[:200], flush=True)
        return res.get("value")


def _find_chrome() -> str:
    for p in CHROME_CANDIDATES:
        if Path(p).exists():
            return p
    raise RuntimeError("找不到 Chrome")


async def _tabs(port: int) -> list[dict]:
    try:
        # trust_env=False：本机 CDP 端口不能走系统 HTTP_PROXY，否则 502
        async with httpx.AsyncClient(timeout=2, trust_env=False) as c:
            return (await c.get(f"http://127.0.0.1:{port}/json")).json()
    except Exception:
        return []


async def _ensure_page(port: int, profile: Path, show: bool) -> dict:
    tabs = await _tabs(port)
    if not tabs:
        profile.mkdir(parents=True, exist_ok=True)
        args = [_find_chrome(), f"--remote-debugging-port={port}",
                f"--user-data-dir={profile}", "--no-first-run",
                "--no-default-browser-check",
                "--disable-blink-features=AutomationControlled", DOUBAO]
        if not show:
            args.insert(1, "--headless=new")
        # 关键：浏览器必须**脱离调用方的进程树**，还要**脱离调用方的作业对象**。
        # 以前是普通 Popen，浏览器挂在主进程（或调试脚本）下面：一旦那个进程退出、
        # 被 Ctrl-C，或者沙箱按作业对象回收子进程，浏览器就跟着没了——
        # 表现就是"字还没写完/刚写完，窗口自己关了"，这一批图也就废了。
        #   DETACHED_PROCESS         让它自己成根，不受父进程控制台关闭影响；
        #   CREATE_NEW_PROCESS_GROUP 顺带免疫 Ctrl-C / CTRL_CLOSE 广播；
        #   CREATE_BREAKAWAY_FROM_JOB 即使调用方在作业对象里（taskkill /T、
        #                             WorkBuddy 后台任务托管都会这么干），也打不断它。
        # 作业对象不允许 breakaway 时 Popen 会直接抛 OSError，就退回前两个标志。
        kw: dict = {}
        if os.name == "nt":
            base = 0x00000008 | 0x00000200          # DETACHED | NEW_GROUP
            breakaway = 0x01000000                  # CREATE_BREAKAWAY_FROM_JOB
            kw["creationflags"] = base | breakaway
        else:
            kw["start_new_session"] = True
        try:
            subprocess.Popen(args, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, close_fds=True, **kw)
        except OSError:
            if os.name == "nt":
                kw["creationflags"] = 0x00000008 | 0x00000200
            subprocess.Popen(args, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, close_fds=True, **kw)
        for _ in range(120):
            await asyncio.sleep(0.3)
            tabs = await _tabs(port)
            if tabs:
                break
    # 复用一个已经停在豆包的标签页；不然会拿到 Chrome 启动时那个 about:blank
    page = next((t for t in tabs if "doubao.com" in (t.get("url") or "")), None)
    if page:
        return page
    page = next((t for t in tabs if t.get("type") == "page"), None)
    if not page:
        raise RuntimeError("豆包浏览器没有可用标签页")
    return page


# ------------------------------------------------------------------ 动作
async def _focus(cdp: _CDP) -> bool:
    box = await cdp.js("""
    (() => {
      const c = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
        .filter(e => e.offsetParent !== null);
      if (!c.length) return null;
      const el = c[c.length - 1];
      el.focus();
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    })()
    """)
    if not box:
        return False
    for t in ("mousePressed", "mouseReleased"):
        await cdp.call("Input.dispatchMouseEvent", type=t, x=box[0], y=box[1],
                       button="left", clickCount=1)
    return True


async def _ready(cdp: _CDP, timeout: float = 40) -> bool:
    """**沿用当前会话**，不再每张图都 Page.navigate 开一个新的。

    以前每次都开新会话，是为了避免"上一张的图被当成这一次的结果"；现在改成
    记下已有图的 src 集合、只认新出现的那张（LIST_JS），这条顾虑就没了。
    沿用会话既省掉一次整页加载（3~6 秒），也不会在侧边栏堆一长串"新对话"。
    只有当前页根本不是豆包（浏览器刚起来 / 被导航走）时才导航一次。
    """
    st = await cdp.js(EDITOR_READY_JS) or {}
    if st.get("locked"):
        raise RuntimeError("豆包网页未登录（profile 里没有登录态，先跑 --login）")
    if st.get("ed"):
        return True
    await cdp.call("Page.navigate", url=DOUBAO)
    t0 = time.time()
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.5)
        st = await cdp.js(EDITOR_READY_JS) or {}
        if st.get("locked"):
            raise RuntimeError("豆包网页未登录（profile 里没有登录态，先跑 --login）")
        if st.get("ed"):
            await asyncio.sleep(0.8)
            return True
    return False


# ------------------------------------------------------------------ 上传参考图
UPLOAD_STATE_JS = """
(() => {
  const imgs = [...document.querySelectorAll('img')]
    .filter(e => e.offsetParent && /^(blob:|data:)/.test(e.src));
  const btn = document.querySelector('[data-testid="chat_input_send_button"]');
  const t = document.body ? document.body.innerText : '';
  return {imgs: imgs.length, btn: !!btn && !btn.disabled,
          busy: t.includes('上传中') || t.includes('解析中')};
})()
"""


async def _upload(cdp: _CDP, path: Path) -> bool:
    """把图片塞进输入框的 file input。

    豆包的上传入口是一个一直挂着的 `<input type=file>`（class=hidden），
    所以不用点"+"再找弹窗，直接 DOM.setFileInputFiles 就行——这条路径不依赖
    坐标和焦点，页面弹什么浮层都不影响。
    """
    await cdp.call("DOM.enable")
    doc = await cdp.call("DOM.getDocument", depth=1)
    root = doc.get("root", {}).get("nodeId")
    if not root:
        return False
    nid = 0
    for sel in ('input[data-testid="upload-file-input"]', "input[type=file]"):
        r = await cdp.call("DOM.querySelector", nodeId=root, selector=sel)
        nid = r.get("nodeId") or 0
        if nid:
            break
    if not nid:
        print("[doubao] 找不到上传入口", flush=True)
        return False
    await cdp.call("DOM.setFileInputFiles", files=[str(path)], nodeId=nid)
    return True


async def _wait_upload(cdp: _CDP, base: int = 0, timeout: float = 45) -> bool:
    """等缩略图出现在输入框里。

    会话复用之后，页面上本来就挂着以前传过的图（blob:），所以不能只看"有没有"，
    要比上传前多出至少一张才算传完。
    """
    t0 = time.time()
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.6)
        st = await cdp.js(UPLOAD_STATE_JS) or {}
        if st.get("imgs", 0) > base and not st.get("busy"):
            await asyncio.sleep(0.8)
            return True
    return False


TYPE_JS = """
(function () {
  var e = document.querySelector('.ProseMirror')
       || document.querySelector('[contenteditable="true"]');
  if (!e) return 'no-editor';
  e.focus();
  var ok = document.execCommand('insertText', false, TEXT);
  var dt = new DataTransfer();
  dt.setData('text/plain', TEXT);
  e.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true,
                                               cancelable: true}));
  return JSON.stringify({exec: ok, len: (e.innerText || '').length});
})()
"""

SEND_CLICK_JS = """
(function () {
  var b = document.querySelector('[data-testid="chat_input_send_button"]');
  if (!b) return 'no-btn';
  if (b.disabled) return 'disabled';
  b.click();
  return 'clicked';
})()
"""


async def _typed(cdp: _CDP) -> str:
    v = await cdp.js("(function(){var e=document.querySelector('.ProseMirror');"
                     "return e?e.innerText:''})()")
    return v or ""


async def _send(cdp: _CDP, text: str, timeout: float = 25) -> bool:
    """填字 + 发送，全程在页面里用 JS 完成。

    以前是 CDP 鼠标点击坐标 + Input.insertText。豆包首页时不时弹一个"下载客户端"
    的浮层，坐标会漂、activeElement 会变成 body，insertText 就静默丢弃了。
    execCommand / paste 事件不依赖坐标，ProseMirror 也照收。
    """
    expr = TYPE_JS.replace("TEXT", json.dumps(text))
    await cdp.js(expr)

    # execCommand 没生效（有些版本被策略禁掉）就退回逐字打字
    for _ in range(6):
        if len(await _typed(cdp)) >= min(4, len(text)):
            break
        await asyncio.sleep(0.4)
    else:
        for ch in text:
            await cdp.call("Input.dispatchKeyEvent", type="char", text=ch)
        await asyncio.sleep(0.5)

    t0 = time.time()
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.4)
        r = await cdp.js(SEND_CLICK_JS)
        if r == "clicked":
            break
        if r == "no-btn":
            # 富文本还没同步，再补一次粘贴
            await cdp.js(TYPE_JS.replace("TEXT", json.dumps(text)))
    else:
        return False

    for _ in range(14):
        await asyncio.sleep(0.5)
        st = await cdp.js(SENT_JS) or {}
        if st.get("len", 1) == 0:
            return True
    return False


async def _wait_new_image(cdp: _CDP, known: set[str], timeout: float,
                          min_px: int = 500) -> str | None:
    """等这一轮的成图**真正画完**，返回它的 src。

    会话复用后页面上全是历史成图，所以必须拿发送前记下的 src 集合做差集。

    光"出现一张新图"不够（这是以前的老毛病，也是"才 20 秒就收工/窗口跟着关"
    的根因之一）：豆包会先塞一张模糊占位图进来，naturalWidth 立刻过 500，
    这时候取回来的是半成品。所以现在要同时满足三条才算画完：
      1. 新图已经 complete（字节加载完）；
      2. 连着两次轮询 src 没变（模型不会每隔一秒换一张）；
      3. 页面上的"生成中 / 停止生成"标记消失。
    第 3 条偶尔会因为页面残留文案一直为真，所以再加一条兜底：
    图连续 4 次（约 3 秒）没变就认为它画完了，别为了一个文案干等到超时。
    整个过程最多等 `timeout` 秒；等的时候每 5 秒打一行进度，方便判断到底卡在哪。
    """
    t0 = time.time()
    last = ""
    stable = 0
    next_log = 5.0
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.8)
        st = await cdp.js(WAIT_STATE_JS) or {}
        fresh = [i for i in (st.get("imgs") or [])
                 if i.get("src") and i["src"] not in known
                 and (i.get("w") or 0) >= min_px]
        cur = fresh[-1]["src"] if fresh else ""
        stable = stable + 1 if (cur and cur == last) else (1 if cur else 0)
        last = cur

        if cur:
            loaded = bool(fresh[-1].get("done"))
            if loaded and stable >= 2 and not st.get("busy"):
                await asyncio.sleep(1.2)          # 让 CDN 那边把原图也落定
                return cur
            if loaded and stable >= 4:
                return cur
        elif st.get("failed"):
            return None

        el = time.time() - t0
        if el >= next_log:
            next_log = el + 5
            print(f"[doubao] 等出图中… {el:.0f}s"
                  f"（{'页面标着生成中' if st.get('busy') else '页面已空闲'}，"
                  f"新图 {1 if cur else 0} 张）", flush=True)
    return None


async def _batch(names: list[str], conf: dict) -> list[dict | None]:
    """一次让豆包写 n 个名字（竖着一列），回来按行切成 n 份。

    返回和 names 等长的列表，每项 {"glyph", "full", "box", "w", "h"} 或 None。
    整批失败返回 []，调用方统一退回本地笔画。
    """
    names = [n for n in names if n]
    if not names:
        return []

    port = int(conf.get("port") or 9222)
    profile = Path(conf.get("profile") or (ROOT / ".chrome-doubao"))
    if not profile.is_absolute():
        profile = ROOT / profile
    show = bool(conf.get("show", True))
    # 等图总超时。豆包一张/一批实测 20~35 秒，偶尔排队会到 60 秒，
    # 所以下限压到 25 秒、默认给到 240 秒：宁可多等一会儿等到它画完，
    # 也不要早早判超时退回本地笔画（那就白跑了，观众看到的是另一套字）。
    timeout = max(25.0, float(conf.get("timeout") or 240))


    tpl_path = str(conf.get("template") or "").strip()
    plate_path = str(conf.get("plate") or "").strip()
    tpl_file = (ROOT / tpl_path) if tpl_path else None
    plate_file = (ROOT / plate_path) if plate_path else None
    if not (tpl_file and tpl_file.exists()):
        raise RuntimeError(f"缺风格模板图: {tpl_file}")
    if not (plate_file and plate_file.exists()):
        raise RuntimeError(f"缺底板图: {plate_file}")

    # 单个名字用短提示词（"照这张图换个字"），多个名字才用排版提示词。
    # 两者都能被 wordsheet.split 切开：单名整块当一个字，多名按行切。
    if len(names) == 1:
        prompt = (str(conf.get("single_prompt") or "").strip()
                  or SINGLE_PROMPT.format(name=names[0]))
    else:
        prompt = (str(conf.get("prompt") or "").strip()
                  or BATCH_PROMPT.format(n=len(names), names="\n".join(names)))
    out = ROOT / "data" / "signatures"
    out.mkdir(parents=True, exist_ok=True)
    sheets = ROOT / "data" / "cache" / "sheets"
    sheets.mkdir(parents=True, exist_ok=True)

    page = await _ensure_page(port, profile, show)
    async with ws_connect(page["webSocketDebuggerUrl"], max_size=64 << 20,
                          ping_interval=None) as ws:
        cdp = _CDP(ws)
        task = asyncio.create_task(cdp.reader())
        try:
            await cdp.call("Page.enable")
            await cdp.call("Runtime.enable")
            t0 = time.time()
            if not await _ready(cdp):
                raise RuntimeError("豆包页面没准备好")

            # 先记下会话里现有的成图，等下只认新出现的那张
            known = {i["src"] for i in (await cdp.js(LIST_JS) or []) if i.get("src")}

            # 每批都重新传一次模板：会话可能很长，上下文里那张图未必还在
            base_up = int((await cdp.js(UPLOAD_STATE_JS) or {}).get("imgs") or 0)
            if not await _upload(cdp, tpl_file):
                raise RuntimeError("模板图没传上去")
            if not await _wait_upload(cdp, base_up):
                raise RuntimeError("模板图上传没完成")
            print(f"[doubao] 模板已上传 {tpl_file.name}（沿用当前会话，"
                  f"{'单个名字' if len(names) == 1 else str(len(names)) + ' 个名字一批'}）",
                  flush=True)

            if not await _send(cdp, prompt):
                raise RuntimeError("提示词没发出去")
            src = await _wait_new_image(cdp, known, timeout)
            if not src:
                raise RuntimeError(f"等图超时/失败（{timeout:.0f}s）")
            v = await cdp.js(PULL_SRC_JS.replace("SRC", json.dumps(src)))
            if not v or not v.get("ok"):
                raise RuntimeError(f"取图失败 {v}")
            raw = base64.b64decode(v["b64"])
            # 到这儿图已经拿到手了，但浏览器**不关**：窗口、标签页、会话全部留着，
            # 下一批直接在同一个会话里接着写（省掉 3~6 秒加载，也不会掉登录态）。
            print(f"[doubao] 成图已取回，浏览器保持打开、会话沿用（不关窗口/不关标签页）",
                  flush=True)

            ts = time.strftime("%m%d_%H%M%S")
            sheet = sheets / f"sheet_{ts}.png"
            sheet.write_bytes(raw)
            # 右下角那行"豆包 AI 生成"会被当成最后一行字的墨迹，切之前先抹掉
            try:
                erase_watermark_file(sheet)
            except Exception as e:
                print(f"[doubao] 去水印失败（不影响使用）: {e}", flush=True)

            parts = wordsheet.split(sheet, names, out_dir=out,
                                    stem=f"ai_{ts}")
            if not parts:
                raise RuntimeError("成图里切不出字")
            if len(parts) != len(names):
                print(f"[doubao] 切出 {len(parts)} 份，期望 {len(names)} 份", flush=True)

            place = conf.get("place") or {}
            result: list[dict | None] = []
            for i, name in enumerate(names):
                if i >= len(parts):
                    result.append(None)
                    continue
                p = parts[i]
                box = wordsheet.place_box(p["w"], p["h"], place)
                full = out / f"ai_{ts}_b{i + 1}_{p['safe']}_full.jpg"
                wordsheet.compose(plate_file, p["glyph"], box, full)
                result.append({"glyph": p["glyph"], "full": full, "box": box,
                               "w": box[2] - box[0], "h": box[3] - box[1]})
            print(f"[doubao] {'单个' if len(names) == 1 else '一批 ' + str(len(names)) + ' 个'}名字 "
                  f"{time.time() - t0:.1f}s：{'、'.join(names)}", flush=True)
            return result
        finally:
            task.cancel()


def batch(names: list[str], conf: dict) -> list[dict | None]:
    """同步入口（主流程在线程里调用）。整批失败返回 []，交给本地笔画兜底。

    浏览器要是真被外面的东西关掉了（有人手动关窗口、taskkill /T 扫到它），
    `_CDP.reader` 会立刻抛"浏览器连接已断开"。这种情况不直接放弃：
    重新拉一次窗口（`_ensure_page` 会自动起 Chrome 并复用 profile 的登录态），
    再试一轮。只重试一次——真挂了就退回本地笔画，别把队列卡在那里。
    """
    for attempt in (1, 2):
        try:
            return asyncio.run(_batch(names, conf))
        except Exception as e:
            msg = f"{type(e).__name__}: {e}"
            print(f"[doubao] 批量出图失败(第 {attempt} 次): {msg}", flush=True)
            if attempt == 1 and ("断开" in msg or "连接" in msg or "标签页" in msg):
                print("[doubao] 浏览器没了，重新拉起窗口再试一次…", flush=True)
                prof = Path(conf.get("profile") or (ROOT / ".chrome-doubao"))
                if not prof.is_absolute():
                    prof = ROOT / prof
                try:
                    asyncio.run(_ensure_page(int(conf.get("port") or 9222), prof,
                                             bool(conf.get("show", True))))
                except Exception as e2:
                    print(f"[doubao] 重开浏览器失败: {e2}", flush=True)
                    return []
                continue
            return []
    return []


def generate(name: str, conf: dict) -> dict | None:
    """单个名字（手测用）：就是 batch 的特例。"""
    got = batch([name], conf)
    return got[0] if got else None


SIZES = (1000, 420)


def _imsize(p: Path) -> tuple[int, int]:
    import cv2
    import numpy as np

    img = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"读不出图: {p}")
    h, w = img.shape[:2]
    return h, w


async def login(port: int = 9222, profile: str = "") -> None:
    prof = Path(profile or (ROOT / ".chrome-doubao"))
    if not prof.is_absolute():
        prof = ROOT / prof
    page = await _ensure_page(port, prof, True)
    async with ws_connect(page["webSocketDebuggerUrl"], max_size=32 << 20,
                          ping_interval=None) as ws:
        cdp = _CDP(ws)
        task = asyncio.create_task(cdp.reader())
        try:
            await cdp.call("Page.enable")
            await cdp.call("Runtime.enable")
            await cdp.call("Page.navigate", url=DOUBAO)
        finally:
            task.cancel()


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="豆包网页版出图（手测入口）")
    ap.add_argument("name", nargs="?", default="张三")
    ap.add_argument("--login", action="store_true", help="打开豆包让扫码登录，登录态存进 profile")
    a = ap.parse_args()
    if a.login:
        asyncio.run(login())
        print(f"[doubao] 浏览器已打开，请扫码登录。登录态目录: {ROOT / '.chrome-doubao'}")
        input("[doubao] 登录完成后按回车结束…")
    else:
        print("->", generate(a.name, {}))
