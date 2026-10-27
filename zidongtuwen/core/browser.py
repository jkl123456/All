"""Chrome 自动化：连接本地调试端口，在豆包中生成图片 / 视频（可选：即梦备用）。"""

from __future__ import annotations

import base64
import io
import os
import re
import subprocess
import threading
import time
import uuid
from datetime import datetime
from urllib.parse import urlparse

import requests

from .ai_guide import AIGuide

try:  # selenium 缺失时仍然允许网页启动，只是不能生图
    from selenium import webdriver
    from selenium.common.exceptions import (
        NoSuchElementException, TimeoutException, WebDriverException,
    )
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    SELENIUM_OK = True
except Exception:  # pragma: no cover
    SELENIUM_OK = False

if os.name == "nt":
    try:
        import win32clipboard
        import win32con
    except Exception:  # pragma: no cover
        win32clipboard = None
        win32con = None
else:  # pragma: no cover
    win32clipboard = None
    win32con = None

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
CREATE_BREAKAWAY_FROM_JOB = 0x01000000 if os.name == "nt" else 0

# 只取“已经真正加载完成”的图片，避免拿到占位图/半成品
JS_LOADED_IMAGES = """
const box = arguments[0];
if (!box) return [];
let imgs = Array.from(box.querySelectorAll("[data-testid='mdbox_image'] img"));
if (!imgs.length) {
    imgs = Array.from(box.querySelectorAll("img")).filter(i => (i.naturalWidth || 0) >= 200);
}
return imgs
    .filter(i => {
        const src = i.currentSrc || i.src || "";
        return src.indexOf("http") === 0 && i.complete && (i.naturalWidth || 0) > 100;
    })
    .map(i => i.currentSrc || i.src)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
"""

# 找出承载消息列表的可滚动容器（豆包是虚拟滚动：只渲染视口附近的楼层）
JS_SCROLL_BOX = """
const blocks = document.querySelectorAll("[data-testid='receive_message']");
if (!blocks.length) return null;
let node = blocks[0];
while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const oy = (style.overflowY || "").toLowerCase();
    if ((oy === "auto" || oy === "scroll" || oy === "overlay")
        && node.scrollHeight > node.clientHeight + 40) {
        return node;
    }
    node = node.parentElement;
}
return null;
"""

DOUBAO_INPUTS = [
    "//div[@data-testid='chat_input_input']//div[@contenteditable='true']",
    "//div[contains(@class,'ProseMirror')]",
    "//div[@data-testid='chat_input_input']//textarea",
    "//div[@data-testid='chat_input_input']",
    "//textarea[contains(@placeholder, '输入')]",
    "//textarea",
]
DOUBAO_SEND = [
    "//*[@id='flow-end-msg-send']",
    "//button[@data-testid='chat_input_send_button']",
]
REPLY_BLOCK = "//div[@data-testid='receive_message']"
IMG_IN_REPLY = ".//div[@data-testid='mdbox_image']//picture/img"
IMG_ANY = ".//img[contains(@src, 'http')]"
GENERATING = "//div[@data-testid='message_image_content' and @data-finished='false']"
SUGGEST_LIST = "//div[@data-testid='suggest_message_list']"
# 输入框上方的附件区（一次可以放多张图）
ATTACH_CARD = "//*[@data-testid='attachment-image-card']"
ATTACH_AREA = "//*[@data-testid='attachment_area']"
# 一条消息 = 一个 union_message，里面可能是用户发送（send_message）或豆包回复（receive_message）
UNION_BLOCK = "[data-testid='union_message']"
SEND_BLOCK = "//div[@data-testid='send_message']"

# 从「我一次性上传了 N 张图片…」那条消息往后收集视频（按 DOM 顺序）
JS_COLLECT_VIDEOS_AFTER_PROMPT = """
const nodes = Array.from(document.querySelectorAll("[data-testid='union_message']"));
let start = -1;
nodes.forEach((n, i) => {
  const t = n.innerText || "";
  if (/一次性上传了\\s*\\d+\\s*张图片/.test(t) || /第\\s*1\\s*个视频\\s*@/.test(t)) start = i;
});
const from = start >= 0 ? start : 0;
const urls = [];
for (let i = from; i < nodes.length; i++) {
  nodes[i].querySelectorAll("video").forEach(v => {
    const s = v.currentSrc || v.src || "";
    if (s && (s.indexOf("http") === 0 || s.indexOf("blob:") === 0) && urls.indexOf(s) < 0) {
      urls.push(s);
    }
  });
}
return {prompt: start >= 0, urls: urls};
"""


class BrowserError(Exception):
    pass


class GenerationCancelled(Exception):
    """用户主动取消生成任务。"""


class QuotaError(BrowserError):
    """豆包明确提示额度不足/不能继续生成：整个任务应该暂停，而不是继续催。"""


class BrowserManager:
    def __init__(self, config, log) -> None:
        self.config = config
        self.log = log
        self.driver = None
        self.lock = threading.RLock()
        self._tabs: dict[str, str] = {}
        self._chrome_proc = None
        self._last_message = "未启动"
        self._stopping = False
        self.cancel_event = threading.Event()
        self._needs_fresh = False
        self.ai = AIGuide(config, log)

    # ------------------------------------------------------------------ 取消
    def cancel(self) -> None:
        self.cancel_event.set()
        # 取消后页面里可能还残留未完成的对话，下次任务强制新开对话
        self._needs_fresh = True

    def _check_cancel(self) -> None:
        if self.cancel_event.is_set():
            raise GenerationCancelled("已取消")

    # ------------------------------------------------------------------ 状态
    def status(self) -> dict:
        """用调试端口探活，避免浏览器已退出时 window_handles 长时间阻塞界面轮询。"""
        port = int(self.config.get("chrome_debug_port") or 9333)
        alive = self.driver is not None and self._port_ready(port, 1.2)
        if not alive and self.driver is not None:
            self._last_message = "连接已断开（浏览器已关闭）"
        if self.driver is None:
            self._last_message = self._last_message if not alive else "已连接"
        return {
            "connected": alive,
            "message": self._last_message,
            "port": port,
        }

    def _alive(self) -> bool:
        port = int(self.config.get("chrome_debug_port") or 9333)
        return self.driver is not None and self._port_ready(port, 1.5, 1)

    def _dispose_driver(self) -> None:
        """丢弃失效会话。

        注意：这里是附着（attach）模式，`driver.quit()` 会把整个 Chrome 关掉，
        用户正在用的对话页会一起消失。所以只停掉 chromedriver 进程，不碰浏览器。
        """
        driver, self.driver = self.driver, None
        self._tabs.clear()
        if driver is None:
            return

        def _close_session():
            service = getattr(driver, "service", None)
            try:
                if service is not None:
                    service.stop()
            except Exception:
                pass
        threading.Thread(target=_close_session, daemon=True).start()

    # ------------------------------------------------------------------ 启动
    def ensure_started(self, check_cancel: bool = True) -> None:
        """确保浏览器可用：没开就拉起 Chrome，连不上就重连；必要时重新打开豆包。"""
        with self.lock:
            port = int(self.config.get("chrome_debug_port") or 9333)
            if check_cancel:
                self._check_cancel()

            if self._port_ready(port, 1.5):
                if self.driver is None:
                    self.log.info(f"检测到 Chrome 正在运行（端口 {port}），直接连接…")
                    self._connect()
                else:
                    self._last_message = f"已连接（端口 {port}）"
                return

            # 端口不通：说明浏览器没开或已崩溃，先丢掉旧会话再重新拉起
            if self.driver is not None:
                self.log.warn("浏览器已关闭，重新启动…")
                self._dispose_driver()
            else:
                self.log.info("浏览器未运行，正在启动…")
            self._start_chrome(check_cancel=check_cancel)
            if check_cancel:
                self._check_cancel()
            self._connect()
            self._last_message = "已连接（新启动）"

    def _port_ready(self, port: int, timeout: float = 3.0, retries: int = 3) -> bool:
        """探测调试端口。Chrome 在加载页面时可能响应慢，多试几次避免误判成“没启动”。"""
        for attempt in range(max(1, retries)):
            try:
                # 必须绕开系统代理：本机探测走代理会误判
                resp = requests.get(f"http://127.0.0.1:{port}/json/version", timeout=timeout,
                                    proxies={"http": None, "https": None})
                if resp.ok:
                    return True
            except Exception:
                pass
            if attempt < retries - 1:
                time.sleep(0.5)
        return False

    def _start_chrome(self, check_cancel: bool = True) -> None:
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium，请先执行 pip install -r requirements.txt")

        port = int(self.config.get("chrome_debug_port") or 9333)
        if self._port_ready(port):
            self._last_message = f"复用已运行的 Chrome（端口 {port}）"
            self.log.info(self._last_message)
            return

        chrome = self.config.resolve(str(self.config.get("chrome_path") or ""))
        if not chrome or not os.path.exists(chrome):
            raise BrowserError(f"Chrome 路径不存在：{chrome}，请在 config.json 中修改 chrome_path")

        profile = self.config.resolve(str(self.config.get("chrome_profile") or "data/chrome_profile"))
        os.makedirs(profile, exist_ok=True)
        args = [
            chrome,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled",
            "--restore-last-session",
            "--window-size=1440,960",
        ]
        self.log.info(f"启动自动化 Chrome（端口 {port}）…")
        # 尽量让 Chrome 脱离本进程所在的作业对象：服务被结束/重启时浏览器窗口不会被一起带走
        flags = 0
        if os.name == "nt":
            flags = subprocess.CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB
        try:
            self._chrome_proc = subprocess.Popen(args, close_fds=True, creationflags=flags)
        except OSError:
            self._chrome_proc = subprocess.Popen(args, close_fds=True)

        deadline = time.time() + 30
        while time.time() < deadline:
            if check_cancel:
                self._check_cancel()
            if self._port_ready(port):
                self._last_message = f"Chrome 已启动（端口 {port}）"
                self.log.ok(self._last_message)
                return
            time.sleep(0.8)
        raise BrowserError(
            f"Chrome 启动超时，端口 {port} 未就绪。若该 Chrome 用户目录已被占用，请先关闭残留的自动化窗口。"
        )

    def _connect(self) -> None:
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        port = int(self.config.get("chrome_debug_port") or 9333)
        options = Options()
        options.add_experimental_option("debuggerAddress", f"127.0.0.1:{port}")
        try:
            self.driver = webdriver.Chrome(options=options)
        except Exception as exc:
            raise BrowserError(f"连接 Chrome 调试端口失败：{exc}") from exc
        try:
            self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            })
        except Exception:
            pass
        try:
            self.driver.set_page_load_timeout(60)
            self.driver.set_script_timeout(30)
        except Exception:
            pass
        # 给所有 WebDriver 命令设置超时，浏览器假死时不会无限阻塞
        try:
            self.driver.command_executor._client_config.timeout = 30
        except Exception:
            pass
        self._tabs.clear()
        self._last_message = "已连接"
        self.log.ok(f"已连接 Chrome 调试端口 {port}")

    def stop(self) -> None:
        self.cancel()
        self._dispose_driver()
        self._last_message = "已断开"
        self.log.info("已断开自动化浏览器")

    # ------------------------------------------------------------------ 标签页
    def _ensure_tab(self, name: str, url: str) -> None:
        """切到目标页面；已有同类页面就复用，实在没有才新建，避免标签页越开越多。"""
        handle = self._tabs.get(name)
        if handle:
            try:
                if handle in self.driver.window_handles:
                    self.driver.switch_to.window(handle)
                    current = self.driver.current_url or ""
                    if urlparse(current).netloc != urlparse(url).netloc:
                        self.driver.get(url)
                    return
            except WebDriverException:
                pass
        # 记录的句柄失效（比如服务重启过）：先在已开的页面里找同类站点
        try:
            for existing in reversed(self.driver.window_handles):
                self.driver.switch_to.window(existing)
                if urlparse(self.driver.current_url or "").netloc == urlparse(url).netloc:
                    self._tabs[name] = existing
                    return
        except WebDriverException:
            pass
        self.driver.switch_to.new_window("tab")
        self.driver.get(url)
        self._tabs[name] = self.driver.current_window_handle
        time.sleep(1.2)
        self.log.info(f"已打开{('豆包' if name == 'doubao' else name)}页面")

    # ------------------------------------------------------------------ 工具
    def _editable(self, element):
        """把容器节点换成真正可编辑的节点（豆包是 ProseMirror 富文本）。"""
        try:
            inner = element.find_elements(By.XPATH, ".//*[@contenteditable='true']")
            if inner:
                return inner[0]
        except Exception:
            pass
        return element

    def _clear_input(self, element) -> None:
        """清空输入框里可能残留的提示词，避免重复叠加。"""
        try:
            edit = self._editable(element)
            text = (edit.get_attribute("innerText") or edit.get_attribute("value") or "").strip()
            if not text:
                return
            edit.send_keys(Keys.CONTROL, "a")
            edit.send_keys(Keys.DELETE)
            time.sleep(0.3)
        except Exception:
            pass

    def _paste_text(self, element, text: str) -> bool:
        """向输入框写入文本：优先走剪贴板粘贴，其次 send_keys，最后 JS insertText。"""
        errors: list[str] = []
        element = self._editable(element)
        try:
            self.driver.execute_script(
                "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", element)
            self.driver.execute_script("arguments[0].focus();", element)
            time.sleep(0.2)
        except Exception as exc:
            errors.append(f"focus:{exc}")

        if win32clipboard is not None:
            try:
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
                win32clipboard.CloseClipboard()
                element.send_keys(Keys.CONTROL, "v")
                time.sleep(0.5)
                return True
            except Exception as exc:
                errors.append(f"clip:{str(exc)[:80]}")
                try:
                    win32clipboard.CloseClipboard()
                except Exception:
                    pass

        try:
            element.send_keys(text)
            time.sleep(0.3)
            return True
        except Exception as exc:
            errors.append(f"keys:{str(exc)[:80]}")

        try:
            self.driver.execute_script(
                "const el=arguments[0], t=arguments[1];"
                "el.focus();"
                "document.execCommand('insertText', false, t);",
                element, text)
            time.sleep(0.5)
            return True
        except Exception as exc:
            errors.append(f"js:{str(exc)[:80]}")

        self.log.warn("文本写入失败：" + " | ".join(errors))
        return False

    def _first(self, xpaths: list[str], timeout: float = 20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            self._check_cancel()
            for xp in xpaths:
                try:
                    found = self.driver.find_elements(By.XPATH, xp)
                except WebDriverException:
                    found = []
                for el in found:
                    try:
                        if el.is_displayed():
                            return el
                    except Exception:
                        continue
            time.sleep(0.4)
        return None

    def _click_send(self, input_el=None) -> bool:
        """等待发送按钮可用后点击；按钮未渲染时退回回车发送。"""
        deadline = time.time() + 8
        while time.time() < deadline:
            for xp in DOUBAO_SEND:
                try:
                    els = self.driver.find_elements(By.XPATH, xp)
                except WebDriverException:
                    els = []
                for el in els:
                    try:
                        if not el.is_displayed():
                            continue
                        if (el.get_attribute("aria-disabled") or "").lower() == "true":
                            continue
                        self.driver.execute_script("arguments[0].click();", el)
                        return True
                    except Exception:
                        continue
            time.sleep(0.35)
        try:
            target = input_el or self.driver.find_element(By.TAG_NAME, "body")
            target.send_keys(Keys.ENTER)
            return True
        except Exception:
            return False

    def _reply_count(self) -> int:
        try:
            return len(self.driver.find_elements(By.XPATH, REPLY_BLOCK))
        except WebDriverException:
            return 0

    def _login_prompt_visible(self) -> bool:
        markers = [
            "//*[contains(text(),'扫码登录')]",
            "//*[contains(text(),'登录后即可')]",
            "//*[contains(text(),'请先登录')]",
            "//*[contains(text(),'手机号登录')]",
        ]
        for xpath in markers:
            try:
                for el in self.driver.find_elements(By.XPATH, xpath):
                    if el.is_displayed():
                        return True
            except WebDriverException:
                continue
        return False

    # ------------------------------------------------------------------ AI 推进
    QUOTA_HINTS = (
        "额度不足", "额度不够", "额度已用完", "免费额度已用完", "今日额度",
        "次数已用完", "生成次数已达上限", "余额不足", "积分不足", "无法继续生成",
    )

    SOFT_QUOTA_HINTS = ("付费额度", "是否继续生成", "消耗付费", "确认生成")

    def _check_quota(self) -> None:
        """豆包最后一条回复明确说额度不够时，抛 QuotaError 让任务暂停。"""
        text = (self._last_reply_text() or "").strip()
        if not text:
            return
        # 「免费额度已用完，本次将消耗付费额度，是否继续生成」+「确认生成」按钮：
        # 这是可以用付费额度继续的，应该点按钮，不算额度不足
        if any(k in text for k in self.SOFT_QUOTA_HINTS):
            fatal = ("余额不足", "积分不足", "无法继续生成", "生成次数已达上限", "欠费")
        else:
            fatal = self.QUOTA_HINTS
        for hint in fatal:
            if hint in text:
                self.log.error(f"豆包提示「{hint}」：额度不足，任务应该暂停")
                raise QuotaError(f"豆包额度不足（{hint}），任务已暂停")

    def session_generating(self) -> bool:
        """豆包页面上是否还有「生成中」占位。"""
        try:
            return bool(self.driver.find_elements(By.XPATH, GENERATING))
        except WebDriverException:
            return False

    def session_waiting_confirm_for(self, segments: list[int],
                                    max_segment: int = 0) -> bool:
        """会话最后一条回复是在等确认，并且提到的段号属于这一集。"""
        text = self._last_reply_text() or ""
        if not text:
            return False
        if not any(k in text for k in ("确认后", "请确认", "是否继续", "确认无误",
                                       "是否开始", "确认一下", "等你确认")):
            return False
        # 回复里提到 120 段这种明显不是本集的批量请求，不能当成「本集在等确认」
        numbers = [int(n) for n in re.findall(r"第\s*(\d+)\s*段", text)]
        if numbers and max_segment and max(numbers) > max_segment + 2:
            return False
        for number in segments:
            if f"第 {number} 段" in text or f"第{number}段" in text:
                return True
        return False

    def _last_reply_text(self) -> str:
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
            if not blocks:
                return ""
            return (blocks[-1].text or "").strip()
        except WebDriverException:
            return ""

    def _send_followup(self, text: str) -> bool:
        input_el = self._first(DOUBAO_INPUTS, timeout=10)
        if input_el is None:
            return False
        self._clear_input(input_el)
        # 推进指令不要带附件，避免把残留图片又发出去
        self._clear_attachments()
        if not self._paste_text(input_el, text):
            return False
        time.sleep(0.6)
        return self._click_send(input_el)

    # 需要主动点击的确认按钮文案（从具体到宽泛）
    CONFIRM_STRICT = ("确认生成", "确认并生成", "确定生成", "立即生成", "开始生成视频", "开始生成", "继续生成")
    CONFIRM_LOOSE = ("确认", "确定")
    # 豆包真正进入生成阶段的标志
    STARTED_HINTS = ("预计等待", "主动发送给你", "本次使用", "正在生成", "已开始生成", "生成中，请稍候")

    def _click_confirm_button(self, state: dict) -> bool:
        """回复里出现「确认生成」这类按钮时自动点掉，避免卡在确认页。"""
        if state.get("clicks", 0) >= int(state.get("max_clicks") or 3):
            return False
        if time.time() - state.get("last_click", 0) < 8:
            return False

        last = None
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
            last = blocks[-1] if blocks else None
        except WebDriverException:
            last = None

        scopes = []
        if last is not None:
            scopes.append((last, self.CONFIRM_STRICT + self.CONFIRM_LOOSE))
        scopes.append((None, self.CONFIRM_STRICT))

        for root, texts in scopes:
            for text in texts:
                for expr in (f"normalize-space(text())='{text}'", f"normalize-space(.)='{text}'"):
                    prefix = ".//*" if root is not None else "//*"
                    xpath = (f"{prefix}[self::button or self::div or self::span or self::a "
                             f"or @role='button'][{expr}]")
                    try:
                        els = (root.find_elements(By.XPATH, xpath) if root is not None
                               else self.driver.find_elements(By.XPATH, xpath))
                    except WebDriverException:
                        els = []
                    for el in els:
                        try:
                            if not el.is_displayed():
                                continue
                            rect = el.rect or {}
                            if rect.get("width", 0) < 20 or rect.get("height", 0) < 14:
                                continue
                            self.driver.execute_script(
                                "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", el)
                            time.sleep(0.3)
                            self.driver.execute_script("arguments[0].click();", el)
                            state["clicks"] = state.get("clicks", 0) + 1
                            state["last_click"] = time.time()
                            self.log.ok(f"检测到「{text}」按钮，已自动点击")
                            time.sleep(2.0)
                            return True
                        except Exception:
                            continue
        return False

    def _wait_generation_started(self, before: int, confirm_text: str,
                                 timeout: int = 180, state: dict | None = None,
                                 prompt: str = "") -> bool:
        """等豆包真正开始生成（出现「预计等待/主动发送给你」或新回复），等不到就不能提交下一条。"""
        state = state if state is not None else {}
        deadline = time.time() + timeout
        started_at = time.time()
        clicked_at = 0.0
        last_guide = 0.0
        while time.time() < deadline:
            self._check_cancel()
            self._check_quota()
            count = self._reply_count()
            text = self._last_reply_text()
            if count >= before + 2:
                return True
            if any(hint in text for hint in self.STARTED_HINTS):
                return True
            if self._click_confirm_button(state):
                clicked_at = time.time()
                continue
            # 点不到按钮时，20 秒后让 AI 判断要不要补一句「直接开始生成」
            if (prompt and time.time() - started_at > 20
                    and time.time() - last_guide > 20 and text):
                last_guide = time.time()
                if self._guide_once("视频", prompt, text, state):
                    continue
            if clicked_at and time.time() - clicked_at > 15 and text and text != confirm_text:
                # 点过确认且回复内容已经变了，视为已进入生成
                return True
            time.sleep(2.0)
        return False

    def _guide_once(self, kind: str, prompt: str, reply_text: str, state: dict) -> bool:
        """豆包只回文字不干活时，用 AI 判断要不要推一句。"""
        if not self.ai.enabled:
            return False
        now = time.time()
        if now - state.get("last_at", 0) < 15:
            return False
        asked = state.setdefault("asked", set())
        replies = int(state.get("replies") or 0)
        key = str(hash(reply_text))
        if key in asked:
            return False
        asked.add(key)
        state["last_at"] = now

        decision = self.ai.decide(kind, prompt, reply_text, replies)
        action = decision.get("action")
        if action == "abort":
            reason = decision.get("reason") or "豆包没有继续生成"
            self.log.error(f"AI 判断需要中止：{reason}")
            raise BrowserError(f"豆包未继续：{reason}")
        if action == "reply":
            self.log.info(f"AI 判断豆包在等确认，自动回复：{decision['text']}")
            if self._send_followup(decision["text"]):
                state["replies"] += 1
                state["last_at"] = time.time()
                self.log.ok("已发送推进指令，继续等待…")
                return True
            self.log.warn("推进指令发送失败")
            return False

        self.log.info(f"AI 判断继续等待：{decision.get('reason', '')}")
        return False

    # ------------------------------------------------------------------ 豆包生图
    def generate_images(self, prompt: str, out_dir: str, count: int = 1,
                        timeout: int | None = None, fresh: bool | None = None,
                        chat_url: str = "", refs: list[str] | None = None) -> list[str]:
        """把提示词发给豆包，等待出图并下载到 out_dir。返回本地绝对路径列表。

        chat_url 非空时先回到这个豆包会话（同一任务沿用同一会话，方便追溯和追加修改）。
        """
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium，无法使用浏览器自动化")
        timeout = int(timeout or self.config.get("image_timeout") or 420)
        if fresh is None:
            fresh = bool(self.config.get("fresh_chat_each_task", True))
        fresh = fresh or self._needs_fresh
        chat_url = (chat_url or "").strip()
        if chat_url:
            fresh = False
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            if fresh:
                # 新任务：关掉其它窗口，只留一个并打开新对话
                self._reset_to_single_chat()
            elif chat_url and "doubao.com/chat/" in chat_url:
                self._open_chat(chat_url)
            else:
                # 复用当前页：同样先收敛成一个窗口，再确认在豆包页面上
                self._keep_single_window()
                self._ensure_tab("doubao", self.config.get("doubao_url"))
            self._check_cancel()

            input_el = self._first(DOUBAO_INPUTS, timeout=25)
            if input_el is None:
                raise BrowserError(
                    "找不到豆包输入框。请在自动化 Chrome 中打开 doubao.com 完成登录，然后重试。"
                )
            self._clear_input(input_el)
            # 人物三视图作为参考图，和提示词一起发给豆包
            refs = [os.path.abspath(p) for p in (refs or [])
                    if p and os.path.exists(p)]
            if refs:
                self._clear_attachments()
                uploaded = self._upload_images(refs)
                if uploaded != len(refs):
                    self.log.warn(
                        f"人物三视图上传不完整（{uploaded}/{len(refs)}），按已上传的继续")
                else:
                    self.log.info(f"已上传 {len(refs)} 张人物三视图作为参考图")

            before = self._reply_count()
            self.log.info(f"提交生图任务（提示词 {len(prompt)} 字，目标 {count} 张）…")
            if not self._paste_text(input_el, prompt):
                raise BrowserError("提示词输入失败")
            time.sleep(0.8)
            self._check_cancel()
            if not self._click_send(input_el):
                raise BrowserError("点击发送按钮失败")

            # 等待出现新的回复
            deadline = time.time() + 60
            login_seen = 0
            while time.time() < deadline:
                self._check_cancel()
                if self._reply_count() > before:
                    break
                if self._login_prompt_visible():
                    login_seen += 1
                    if login_seen >= 3:
                        raise BrowserError("豆包需要登录：请在自动化 Chrome 窗口里登录豆包账号后重试")
                else:
                    login_seen = 0
                time.sleep(1.0)
            else:
                raise BrowserError("豆包没有响应：可能是网络问题，或账号未登录")

            urls = self._wait_images(timeout, prompt, before, count)
            if not urls:
                raise BrowserError("等待超时，豆包未返回图片")
            self.log.ok(f"收到 {len(urls)} 张图片，开始下载…")
            paths = self._download_images(urls, out_dir)
            if not paths:
                raise BrowserError("图片下载失败")
            return paths

    def _use_existing_doubao_tab(self) -> bool:
        """优先切到已经打开的豆包对话页（可能是用户手动生成的那个），不新建对话。"""
        try:
            handles = self.driver.window_handles
        except WebDriverException:
            return False
        fallback = ""
        # 从最近打开的标签往回找，优先具体的 /chat/<id> 对话页，其次是豆包首页
        for handle in reversed(handles):
            try:
                self.driver.switch_to.window(handle)
                url = self.driver.current_url or ""
            except WebDriverException:
                continue
            if "doubao.com" not in url:
                continue
            if re.search(r"/chat/\d", url):
                self._tabs["doubao"] = handle
                return True
            if not fallback:
                fallback = handle
        if fallback:
            try:
                self.driver.switch_to.window(fallback)
                self._tabs["doubao"] = fallback
                return True
            except WebDriverException:
                return False
        return False

    def guess_last_chat(self) -> str:
        """从 Chrome 历史里找最近访问的豆包对话，重启浏览器后用它回到原对话。"""
        import shutil
        import sqlite3
        import tempfile

        profile = self.config.resolve(str(self.config.get("chrome_profile") or "data/chrome_profile"))
        src = os.path.join(profile, "Default", "History")
        if not os.path.exists(src):
            return ""
        tmp = os.path.join(tempfile.gettempdir(), "zdwt_history.db")
        try:
            shutil.copy2(src, tmp)
            con = sqlite3.connect(tmp)
            rows = con.execute(
                "SELECT url FROM urls WHERE url LIKE 'https://www.doubao.com/chat/%' "
                "ORDER BY last_visit_time DESC LIMIT 30").fetchall()
            con.close()
        except Exception:
            return ""
        for (url,) in rows:
            if re.search(r"/chat/\d{6,}", url or ""):
                return url
        return ""

    def focus_existing_chat(self) -> bool:
        """把一个已打开的豆包页面切到前台，成功返回 True（不会导航、不会新建）。"""
        if not self._use_existing_doubao_tab():
            return False
        try:
            self.driver.execute_cdp_cmd("Page.bringToFront", {})
        except Exception:
            pass
        try:
            current = self.driver.current_url
        except WebDriverException:
            current = ""
        self.log.ok(f"已切换到现有豆包页面：{current}")
        return True

    def open_in_current_tab(self, url: str) -> None:
        try:
            self.driver.get(url)
            self._tabs["doubao"] = self.driver.current_window_handle
            time.sleep(1.5)
            self.log.info(f"已打开页面：{url}")
        except WebDriverException as exc:
            raise BrowserError(f"打开页面失败：{exc}")

    def _keep_single_window(self, prefer: str = "") -> str | None:
        """只保留一个标签页：优先 prefer 指向的页面，其次最后一个豆包页，再次当前页。"""
        self.ensure_started(check_cancel=False)
        try:
            handles = list(self.driver.window_handles)
        except WebDriverException:
            return None
        if not handles:
            return None

        keep = None
        for handle in reversed(handles):
            try:
                self.driver.switch_to.window(handle)
                url = self.driver.current_url or ""
            except WebDriverException:
                continue
            if prefer and url.startswith(prefer):
                keep = handle
                break
            if not prefer and "doubao.com" in url:
                keep = handle
                break
        if keep is None:
            try:
                current = self.driver.current_window_handle
            except WebDriverException:
                current = ""
            keep = current if current in handles else handles[-1]

        closed = 0
        for handle in handles:
            if handle == keep:
                continue
            try:
                self.driver.switch_to.window(handle)
                self.driver.close()
                closed += 1
            except WebDriverException:
                continue
        try:
            self.driver.switch_to.window(keep)
        except WebDriverException:
            pass
        if closed:
            self.log.info(f"已关闭 {closed} 个多余标签页，只保留一个窗口")
        return keep

    def _open_chat(self, chat_url: str = "") -> str:
        """切到当前任务的豆包会话；没有绑定会话（新任务）就新开一个对话页。

        不管哪条路径，执行前都会把多余标签页关掉，浏览器里始终只有一个窗口。
        """
        chat_url = (chat_url or "").strip()
        keep = self._keep_single_window(prefer=chat_url)
        if keep is None:
            try:
                self.driver.switch_to.new_window("tab")
                keep = self.driver.current_window_handle
            except WebDriverException:
                raise BrowserError("无法打开浏览器标签页")
        if "doubao.com/chat/" not in chat_url:
            return self._reset_to_single_chat(keep)
        try:
            current = self.driver.current_url or ""
        except WebDriverException:
            current = ""
        if current.startswith(chat_url):
            self._tabs["doubao"] = keep
            self.log.info(f"沿用当前任务的豆包会话：{current}")
            return current
        self.driver.get(chat_url)
        self._tabs["doubao"] = keep
        time.sleep(2.5)
        self.log.info(f"沿用当前任务的豆包会话：{chat_url}")
        return self.driver.current_url or ""

    def _reset_to_single_chat(self, keep: str | None = None) -> str:
        """新任务：在唯一保留的窗口里打开一个新的豆包对话。"""
        if keep is None:
            keep = self._keep_single_window()
        if keep is None:
            try:
                self.driver.switch_to.new_window("tab")
                keep = self.driver.current_window_handle
            except WebDriverException:
                pass
        self.driver.get(str(self.config.get("doubao_url") or ""))
        if keep:
            self._tabs["doubao"] = keep
        time.sleep(2.2)
        self._needs_fresh = False
        self.log.info("新任务：打开一个新的豆包对话…")
        return self.driver.current_url or ""

    def _expected_image_count(self) -> int:
        """从最近几条回复的文字里推断这次一共出了几张图（豆包常写「共 5 张」）。"""
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
        except WebDriverException:
            return 0
        text = " ".join((b.text or "") for b in blocks[-6:])
        if not text:
            return 0
        nums: list[int] = []
        for pat in (r"共\s*(\d{1,2})\s*张", r"一共\s*(\d{1,2})\s*张",
                    r"总共\s*(\d{1,2})\s*张", r"生成\s*(\d{1,2})\s*张",
                    r"(\d{1,2})\s*张(?:图|图片|配图|画面)"):
            for hit in re.findall(pat, text):
                try:
                    nums.append(int(hit))
                except ValueError:
                    pass
        nums = [n for n in nums if 1 <= n <= 20]
        return max(nums) if nums else 0

    # ------------------------------------------------------ 从头到底扫整段对话
    def _scroll_box(self):
        """消息列表的滚动容器；找不到时返回 None（回退到逐条滚动）。"""
        try:
            return self.driver.execute_script(JS_SCROLL_BOX)
        except WebDriverException:
            return None

    def _box_state(self, box) -> tuple[float, float, float] | None:
        try:
            top, client, total = self.driver.execute_script(
                "return [arguments[0].scrollTop, arguments[0].clientHeight,"
                " arguments[0].scrollHeight];", box)
            return float(top), float(client), float(total)
        except (WebDriverException, TypeError):
            return None

    def _box_scroll_to(self, box, pos: float) -> bool:
        try:
            self.driver.execute_script("arguments[0].scrollTop = arguments[1];", box, pos)
            return True
        except WebDriverException:
            return False

    def _goto_conversation_top(self, box) -> None:
        """顶到对话开头：向上滚动时豆包会继续加载更早的消息，反复顶到高度不再变化。"""
        last_total = -1.0
        for _ in range(8):
            self._check_cancel()
            if not self._box_scroll_to(box, 0):
                return
            time.sleep(0.9)
            info = self._box_state(box)
            if info is None:
                return
            top, _, total = info
            if top <= 2 and abs(total - last_total) < 8:
                self.log.info("已回到对话开头，开始向下扫描…")
                return
            last_total = total

    def _goto_conversation_bottom(self, box) -> None:
        """滚到对话最底部：向下滚会继续加载更新的消息，反复顶到底部不再变化。"""
        last_total = -1.0
        for _ in range(10):
            self._check_cancel()
            info = self._box_state(box)
            if info is None:
                return
            _top, _client, total = info
            if not self._box_scroll_to(box, total + 10000):
                return
            time.sleep(0.9)
            info = self._box_state(box)
            if info is None:
                return
            top, client, total = info
            if top + client >= total - 4 and abs(total - last_total) < 8:
                self.log.info("已回到对话底部，开始向上查找最后一次批量提交…")
                return
            last_total = total

    def _box_scroll_by(self, box, delta: float) -> float | None:
        """按像素下滚，返回滚动后的位置；容器被重建（stale）时返回 None。"""
        try:
            return float(self.driver.execute_script(
                "const el = arguments[0];"
                "el.scrollTop = el.scrollTop + arguments[1];"
                "return el.scrollTop;", box, delta))
        except (WebDriverException, TypeError):
            return None

    def _load_images_one_by_one(self, seed: list[str], want: int,
                                budget: float = 60) -> list[str]:
        """逐张把图片滚进可视区并等它加载完：豆包图片是懒加载，滑太快会漏。"""
        collected = list(seed)
        deadline = time.time() + max(10.0, budget)
        pos = 0
        while time.time() < deadline:
            self._check_cancel()
            try:
                imgs = self.driver.find_elements(
                    By.XPATH, "//div[@data-testid='mdbox_image']//img")
            except WebDriverException:
                break
            if pos >= len(imgs):
                break
            img = imgs[pos]
            try:
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", img)
            except WebDriverException:
                pos += 1
                time.sleep(0.3)
                continue
            for _ in range(20):  # 最多等 4 秒让这张图下载完
                try:
                    loaded = self.driver.execute_script(
                        "return !!arguments[0].complete && (arguments[0].naturalWidth||0) > 100;",
                        img)
                except WebDriverException:
                    break
                if loaded:
                    break
                time.sleep(0.2)
            collected = list(dict.fromkeys(collected + self._collect_urls(0)))
            if want and len(collected) >= want:
                return collected
            pos += 1
            time.sleep(0.2)
        return collected

    def _sweep_conversation(self, seed: list[str], want: int, budget: float = 90) -> list[str]:
        """从对话开头一路滚到底，边滚边收集图片（只滚动，不发送任何消息）。"""
        collected = list(seed)
        box = self._scroll_box()
        if box is None:
            self.log.warn("没找到消息滚动容器，改用逐条滚动的兜底方式")
            try:
                blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
            except WebDriverException:
                blocks = []
            for block in blocks:
                self._check_cancel()
                try:
                    self.driver.execute_script(
                        "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", block)
                except WebDriverException:
                    continue
                time.sleep(0.45)
                collected = list(dict.fromkeys(collected + self._collect_urls(0)))
                if want and len(collected) >= want:
                    break
            return collected

        self._goto_conversation_top(box)
        box = self._scroll_box() or box  # 滚到顶部后容器可能被重建
        deadline = time.time() + max(20.0, budget)
        no_move = 0
        stable = 0
        steps = 0
        while time.time() < deadline:
            self._check_cancel()
            merged = list(dict.fromkeys(collected + self._collect_urls(0)))
            grew = len(merged) > len(collected)
            collected = merged
            if want and len(collected) >= want:
                self.log.info(f"已收集到 {len(collected)}/{want} 张，停止滚动")
                return collected
            stable = 0 if grew else stable + 1

            info = self._box_state(box)
            if info is None:
                box = self._scroll_box()
                if box is None:
                    break
                time.sleep(0.4)
                continue
            top, client, _total = info
            new_top = self._box_scroll_by(box, max(200.0, client * 0.6))
            if new_top is None:
                box = self._scroll_box()
                if box is None:
                    break
                time.sleep(0.4)
                continue
            if new_top <= top + 2:
                # 没滚动：要么到底了，要么虚拟列表在等加载
                no_move += 1
                if no_move >= 3 and stable >= 2:
                    self.log.info(f"已滚到对话底部（位置 {int(new_top)}），共收集 {len(collected)} 张")
                    break
                time.sleep(1.0)
                continue
            no_move = 0
            steps += 1
            time.sleep(0.6)
            if steps % 10 == 0:
                self.log.info(f"正在从头往下扫描对话…已收集 {len(collected)} 张")

        # 懒加载兜底：逐张滚进视野并等它加载完
        collected = self._load_images_one_by_one(collected, want)
        return list(dict.fromkeys(collected + self._collect_urls(0)))

    def _scan_texts(self, limit: int = 8) -> str:
        """取最近几条回复的文字，供 AI 判断这次到底应有几张图。"""
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
            texts = [(b.text or "").strip() for b in blocks[-limit:]]
        except WebDriverException:
            return ""
        return "\n---\n".join(t for t in texts if t)[:2000]

    def _scan_advice(self, urls: list[str], want: int) -> tuple[bool, int]:
        """数量对不上时让 AI 看一眼对话文字：是漏扫了，还是确实只出了这么多。"""
        found = len(urls)
        decision = self.ai.scan_advice(self._scan_texts(), found, want)
        try:
            expect = int(decision.get("expect") or 0)
        except (TypeError, ValueError):
            expect = 0
        if expect and expect != want:
            self.log.info(f"AI 从对话文字判断应有 {expect} 张图")
            want = expect
        reason = str(decision.get("reason") or "")[:120]
        if str(decision.get("action") or "").lower() == "rescan":
            self.log.warn(f"AI 认为可能还有漏扫的图，再从头滚一遍：{reason}")
            return True, want
        self.log.info(f"AI 认为对话里就是这 {found} 张图：{reason}")
        return False, want

    def scan_images(self, chat_url: str = "", expected: int = 0) -> list[str]:
        """把当前豆包会话里已经生成的图片全部读回来：只滚动，不发送任何消息。

        一个会话就是一批任务，所以每次都从对话开头滚到底部（豆包是虚拟列表，
        只渲染视口附近的楼层，直接滚到底会漏掉中间/开头的图）。
        扫完数量仍少于应有张数时，让 AI 看回复文字判断是否漏扫，最多再扫一遍。
        """
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        self.cancel_event.clear()
        with self.lock:
            self.ensure_started(check_cancel=True)
            chat_url = (chat_url or "").strip()
            if chat_url and "doubao.com" in chat_url:
                self.log.info(f"打开指定对话：{chat_url}")
                self.driver.get(chat_url)
                self._tabs["doubao"] = self.driver.current_window_handle
                time.sleep(2.5)
                self._first(DOUBAO_INPUTS, timeout=20)
            elif not self._use_existing_doubao_tab():
                self._ensure_tab("doubao", self.config.get("doubao_url"))
            self.log.info(f"开始扫描当前对话：{self.driver.current_url}")

            want = self._expected_image_count()
            if expected > want:
                want = expected
            if want:
                self.log.info(f"这次应读到 {want} 张图，从对话开头向下扫描到底")

            collected: list[str] = []
            passes = 2
            for attempt in range(1, passes + 1):
                before = len(collected)
                collected = self._sweep_conversation(collected, want, budget=90)
                got = f"{len(collected)}/{want}" if want else str(len(collected))
                self.log.info(f"第 {attempt} 遍从头到底扫描完成：{got} 张")
                if want and len(collected) >= want:
                    break
                if attempt >= passes:
                    break
                rescan, want = self._scan_advice(collected, want)
                if not rescan:
                    break
                if len(collected) == before:
                    self.log.warn("再滚一遍也没有新图片，可能是豆包确实少发了")
                    break
                time.sleep(1.0)

            self.log.ok(f"当前对话共检测到 {len(collected)} 张图片")
            return collected

    def scan_videos(self, chat_url: str = "", expected: int = 0) -> list[str]:
        """把当前会话里已经生成的视频读回来：只滚动，不发送、不重新生成。

        以「我一次性上传了 N 张图片…」这条用户消息为起点，只收集它后面的视频，
        避免把会话里上一批任务的视频也算进来。
        """
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        self.cancel_event.clear()
        with self.lock:
            self.ensure_started(check_cancel=True)
            chat_url = (chat_url or "").strip()
            if chat_url and "doubao.com" in chat_url:
                self.log.info(f"打开指定对话：{chat_url}")
                self.driver.get(chat_url)
                self._tabs["doubao"] = self.driver.current_window_handle
                time.sleep(2.5)
                self._first(DOUBAO_INPUTS, timeout=20)
            elif not self._use_existing_doubao_tab():
                self._ensure_tab("doubao", self.config.get("doubao_url"))
            self.log.info(f"从当前对话里查找视频：{self.driver.current_url}")

            urls = self._sweep_videos(expected, budget=150)
            if not urls:
                # 兜底：文案可能已被虚拟列表卸载，直接取当前页面最后几个视频
                try:
                    urls = self.driver.execute_script("""
                    const out = [];
                    document.querySelectorAll("video").forEach(v => {
                      const s = v.currentSrc || v.src || "";
                      if (s && (s.indexOf("http") === 0 || s.indexOf("blob:") === 0)
                          && out.indexOf(s) < 0) out.push(s);
                    });
                    return out;
                    """) or []
                except WebDriverException:
                    urls = []
                if urls and expected:
                    urls = urls[-expected:]
            self.log.ok(f"当前对话共找到 {len(urls)} 个视频")
            return urls

    def _sweep_videos(self, want: int = 0, budget: float = 150) -> list[str]:
        """从对话底部往上找到「最后一次批量提交」，再按它之后的顺序返回视频。

        豆包是虚拟列表，从顶部往下滚会把前面批次的视频也算进来，顺序也会乱。
        改成：先滚到底 → 一屏一屏往上 → 遇到「我一次性上传了 N 张图片…」就停，
        每屏收集到的视频前插到结果前面，最后就是第 1/2/3/4 个的顺序。
        """
        box = self._scroll_box()
        if box is None:
            try:
                res = self.driver.execute_script(JS_COLLECT_VIDEOS_AFTER_PROMPT) or {}
            except WebDriverException:
                return []
            urls = list(dict.fromkeys(
                [u for u in (res.get("urls") or []) if isinstance(u, str)]))
            if res.get("prompt"):
                return urls
            return urls[-want:] if want else urls

        self._goto_conversation_bottom(box)
        box = self._scroll_box() or box
        deadline = time.time() + max(60.0, budget)
        result: list[str] = []
        no_move = 0
        steps = 0
        while time.time() < deadline:
            self._check_cancel()
            # 当前视口里的视频封面先 hover 出来（豆包默认只给封面图）
            try:
                blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
            except WebDriverException:
                blocks = []
            for block in blocks:
                self._reveal_videos_in(block)

            try:
                res = self.driver.execute_script(JS_COLLECT_VIDEOS_AFTER_PROMPT) or {}
            except WebDriverException:
                res = {}
            window = [u for u in (res.get("urls") or []) if isinstance(u, str)]
            if window:
                # 向上滚时先拿到的是靠下的视频，前插才能保持从上到下的顺序
                result = list(dict.fromkeys(window + result))
            if res.get("prompt"):
                self.log.info(
                    f"已找到最后一次批量提交，它之后共有 {len(result)} 个视频")
                break
            if want and len(result) >= want:
                break

            info = self._box_state(box)
            if info is None:
                box = self._scroll_box()
                if box is None:
                    break
                time.sleep(0.4)
                continue
            top, client, _total = info
            new_top = self._box_scroll_by(box, -max(150.0, client * 0.5))
            if new_top is None:
                box = self._scroll_box()
                if box is None:
                    break
                time.sleep(0.4)
                continue
            if new_top >= top - 2:
                no_move += 1
                if no_move >= 3:
                    self.log.info("已滚到对话开头，没有碰到批量提交文案，按现有结果处理")
                    break
                time.sleep(1.2)
                continue
            no_move = 0
            steps += 1
            time.sleep(0.9)
            if steps % 6 == 0:
                self.log.info(
                    f"正在从下往上查找最后一次批量提交…已找到 {len(result)} 个视频")
        return result[-want:] if want and len(result) > want else result

    def _download_videos(self, urls: list[str], out_dir: str) -> list[str]:
        """按顺序下载视频；单个失败不影响后面的。"""
        if not urls:
            return []
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        paths: list[str] = []
        for idx, url in enumerate(urls, 1):
            self._check_cancel()
            name = (f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    f"_{idx:02d}_{uuid.uuid4().hex[:4]}.mp4")
            path = os.path.join(out_dir, name)
            try:
                self._download_media(url, path)
            except Exception as exc:
                self.log.warn(f"下载第 {idx} 个视频失败：{str(exc)[:100]}")
                continue
            if not os.path.exists(path) or os.path.getsize(path) < 2048:
                self.log.warn(f"第 {idx} 个视频文件异常，跳过")
                continue
            paths.append(path)
            self.log.info(f"已保存视频 {idx}/{len(urls)} → {os.path.basename(path)}")
        return paths

    def _wait_images(self, timeout: int, prompt: str = "", start_index: int = 0,
                     expected: int = 1) -> list[str]:
        """盯着整段对话（不只最后一条回复）收集图片，滚动触发懒加载。"""
        deadline = time.time() + timeout
        last_count = -1
        stable = 0
        state = {"asked": set(), "replies": 0, "last_at": 0.0}
        text_sig, text_since = "", time.time()
        last_loaded: list[str] = []

        while time.time() < deadline:
            self._check_cancel()
            try:
                generating = bool(self.driver.find_elements(By.XPATH, GENERATING))
            except WebDriverException:
                generating = False
            if generating:
                last_count, stable = -1, 0
                text_since = time.time()
                time.sleep(2.0)
                continue

            try:
                blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
                if not blocks:
                    time.sleep(1.5)
                    continue
                last = blocks[-1]
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({block:'end', behavior:'instant'});", last)
                loaded = self._collect_urls(start_index)
                count_now = len(loaded)
                last_loaded = loaded
                reply_text = (last.text or "").strip()
            except (WebDriverException, NoSuchElementException):
                time.sleep(1.5)
                continue

            if reply_text != text_sig:
                text_sig, text_since = reply_text, time.time()

            if count_now == 0:
                # 出现「确认生成」这类按钮 / 只回文字，先点按钮，再让 AI 判断要不要推一句
                if self._click_confirm_button(state):
                    text_since, last_count, stable = time.time(), -1, 0
                    continue
                if reply_text and time.time() - text_since > 6:
                    if self._guide_once("图片", prompt, reply_text, state):
                        text_since, last_count, stable = time.time(), -1, 0
                        continue
                time.sleep(1.5)
                continue

            if count_now != last_count:
                last_count, stable = count_now, 0
                self.log.info(f"已检测到 {count_now}/{expected} 张图片，继续等待…")
                time.sleep(2.0)
                continue

            stable += 1
            has_suggest = False
            try:
                has_suggest = bool(self.driver.find_elements(By.XPATH, SUGGEST_LIST))
            except WebDriverException:
                pass
            if count_now >= expected and (stable >= 2 or has_suggest):
                break
            if stable >= 12:  # 约 24 秒数量不再增长，先按已有结果处理
                self.log.warn(f"图片数量停在 {count_now}/{expected}，先按已有结果处理")
                break
            time.sleep(2.0)

        self._scroll_blocks(start_index)
        final = self._collect_urls(start_index)
        return final or last_loaded

    def _scroll_blocks(self, start_index: int = 0) -> None:
        """把这一批回复逐条滚到可视区，触发懒加载。"""
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
        except WebDriverException:
            return
        for pos, block in enumerate(blocks):
            if pos < start_index:
                continue
            try:
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", block)
                time.sleep(0.25)
            except WebDriverException:
                continue

    def _loaded_image_urls(self, block) -> list[str]:
        """返回该回复里已经加载完成的图片地址（未加载完的不算）。"""
        try:
            urls = self.driver.execute_script(JS_LOADED_IMAGES, block) or []
            return [u for u in urls if isinstance(u, str) and u.startswith("http")]
        except Exception:
            return []

    def _collect_urls(self, start_index: int = 0) -> list[str]:
        """收集这一批回复里所有已加载完成的图片（豆包可能把多张图拆成多条消息）。"""
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
        except WebDriverException:
            return []
        urls: list[str] = []
        for pos, block in enumerate(blocks):
            if pos < start_index:
                continue
            urls.extend(self._loaded_image_urls(block))
        return list(dict.fromkeys(urls))

    def _session_for(self, referer: str) -> requests.Session:
        session = requests.Session()
        session.trust_env = False
        try:
            for cookie in self.driver.get_cookies():
                session.cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain"))
        except Exception:
            pass
        try:
            ua = self.driver.execute_script("return navigator.userAgent;")
        except Exception:
            ua = "Mozilla/5.0"
        session.headers.update({"User-Agent": ua, "Referer": referer})
        return session

    @staticmethod
    def _guess_ext(content: bytes, url: str) -> str:
        if content[:3] == b"\xff\xd8\xff":
            return ".jpg"
        if content[:8] == b"\x89PNG\r\n\x1a\n":
            return ".png"
        if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return ".webp"
        if content[:6] in (b"GIF87a", b"GIF89a"):
            return ".gif"
        path = urlparse(url).path
        ext = os.path.splitext(path)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            return ext
        return ".jpg"

    def _download_images(self, urls: list[str], out_dir: str) -> list[str]:
        session = self._session_for("https://www.doubao.com/")
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        paths: list[str] = []
        for idx, url in enumerate(urls, 1):
            self._check_cancel()
            try:
                if url.startswith("data:"):
                    header, b64 = url.split(",", 1)
                    content = base64.b64decode(b64)
                    ext = ".png" if "png" in header else ".jpg"
                else:
                    resp = session.get(url, timeout=60)
                    resp.raise_for_status()
                    content = resp.content
                    ext = self._guess_ext(content, url)
                name = f"img_{stamp}_{idx:02d}_{uuid.uuid4().hex[:4]}{ext}"
                path = os.path.join(out_dir, name)
                with open(path, "wb") as fp:
                    fp.write(content)
                paths.append(path)
                self.log.info(f"已保存图片 {idx}/{len(urls)} → {os.path.basename(path)}")
            except Exception as exc:
                self.log.warn(f"下载第 {idx} 张图片失败：{exc}")
        return paths

    # ------------------------------------------------------------------ 豆包视频
    def _copy_image_to_clipboard(self, image_path: str) -> None:
        if win32clipboard is None:
            raise BrowserError("当前系统不支持图片剪贴板粘贴")
        from PIL import Image

        image = Image.open(image_path)
        output = io.BytesIO()
        image.convert("RGB").save(output, "BMP")
        data = output.getvalue()[14:]
        output.close()
        win32clipboard.OpenClipboard()
        try:
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(win32con.CF_DIB, data)
        finally:
            win32clipboard.CloseClipboard()

    def _try_enter_video_mode(self) -> bool:
        """尽量点击页面上的「视频生成」入口，失败就算了。"""
        candidates = [
            "//*[self::button or self::div or self::span][normalize-space(text())='视频生成']",
        ]
        for xpath in candidates:
            try:
                els = self.driver.find_elements(By.XPATH, xpath)
            except WebDriverException:
                els = []
            for el in els[:3]:
                try:
                    if el.is_displayed():
                        self.driver.execute_script("arguments[0].click();", el)
                        time.sleep(2.5)
                        return True
                except Exception:
                    continue
        return False

    def _find_video_url(self) -> str:
        try:
            blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
        except WebDriverException:
            return ""
        if not blocks:
            return ""
        try:
            last = blocks[-1]
            for video in last.find_elements(By.XPATH, ".//video"):
                src = video.get_attribute("src") or ""
                if src.startswith("http") or src.startswith("blob:"):
                    return src
                try:
                    source = video.find_element(By.XPATH, ".//source")
                    src2 = source.get_attribute("src") or ""
                    if src2.startswith("http") or src2.startswith("blob:"):
                        return src2
                except Exception:
                    pass
        except WebDriverException:
            pass
        return ""

    def _fetch_blob_b64(self, url: str) -> str:
        script = """
        const url = arguments[0];
        const done = arguments[arguments.length - 1];
        fetch(url).then(r => r.blob()).then(b => {
            const fr = new FileReader();
            fr.onload = () => done(String(fr.result || '').split(',')[1] || '');
            fr.onerror = () => done('');
            fr.readAsDataURL(b);
        }).catch(() => done(''));
        """
        old = None
        try:
            old = self.driver.timeouts.script
        except Exception:
            pass
        try:
            self.driver.set_script_timeout(180)
            return self.driver.execute_async_script(script, url) or ""
        finally:
            if old:
                try:
                    self.driver.set_script_timeout(old)
                except Exception:
                    pass

    def _download_media(self, url: str, out_path: str) -> str:
        if url.startswith("blob:"):
            b64 = self._fetch_blob_b64(url)
            if not b64:
                raise BrowserError("视频是 blob 地址且读取失败，请重试")
            with open(out_path, "wb") as fp:
                fp.write(base64.b64decode(b64))
            return out_path

        session = self._session_for("https://www.doubao.com/")
        resp = session.get(url, timeout=600, stream=True)
        resp.raise_for_status()
        with open(out_path, "wb") as fp:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                if chunk:
                    fp.write(chunk)
        return out_path

    def generate_video(self, prompt: str, image_path: str, out_dir: str,
                       timeout: int | None = None, aspect: str = "",
                       seconds: int = 10, chat_url: str = "") -> str:
        """按配置选择视频引擎（默认豆包）。chat_url 用于把视频接在同一任务的会话里。"""
        engine = str(self.config.get("video_engine") or "doubao").lower()
        if engine == "jimeng":
            return self.generate_video_jimeng(prompt, image_path, out_dir, timeout)
        return self.generate_video_doubao(prompt, image_path, out_dir, timeout,
                                          aspect, seconds, chat_url)

    # ------------------------------------------------------------------ 批量：先提交后收片
    @staticmethod
    def _video_prompt(text: str, aspect: str, seconds: int = 10,
                      char_block: str = "", has_image: bool = True) -> str:
        extra = (f"\n人物设定（保持同一人物外观、发型、服装）：{char_block}"
                 if (char_block or "").strip() else "")
        opening = ("请用这张图片生成一段" if has_image
                   else "请根据下面的文案生成一段（没有底图，按文字描述出画面）")
        return (
            f"{opening} {int(seconds)} 秒的短视频：画面自然流畅、有轻微运镜，"
            f"保留人物对白与环境声，不要静音。视频比例：{aspect}，时长 {int(seconds)} 秒。\n"
            f"内容参考：{text}{extra}"
        )

    def _file_input(self):
        """豆包的文件选择控件（multiple，可一次选多张图）。"""
        for xpath in ("//input[@data-testid='upload-file-input']",
                      "//input[@type='file' and @multiple]"):
            try:
                els = self.driver.find_elements(By.XPATH, xpath)
            except WebDriverException:
                els = []
            for el in els:
                try:
                    if (el.get_attribute("type") or "").lower() == "file":
                        return el
                except Exception:
                    continue
        return self.driver.find_element(By.XPATH, "//input[@type='file']")

    def _attachment_count(self) -> int:
        try:
            return len(self.driver.find_elements(By.XPATH, ATTACH_CARD))
        except WebDriverException:
            return 0

    def _wait_attachments(self, expected: int, timeout: int = 180) -> bool:
        """等附件全部上传完成（豆包上传中卡片上会显示百分比）。"""
        deadline = time.time() + timeout
        stable = 0
        while time.time() < deadline:
            self._check_cancel()
            try:
                cards = self.driver.find_elements(By.XPATH, ATTACH_CARD)
            except WebDriverException:
                cards = []
            ready = len(cards) >= expected
            if ready:
                for card in cards:
                    try:
                        if "%" in (card.text or ""):
                            ready = False
                            break
                    except Exception:
                        continue
            stable = stable + 1 if ready else 0
            if stable >= 2:
                return True
            time.sleep(1.0)
        return self._attachment_count() >= expected

    def _pointer_move(self, x: float, y: float) -> None:
        self.driver.execute_cdp_cmd("Input.dispatchMouseEvent", {
            "type": "mouseMoved", "x": float(x), "y": float(y), "buttons": 0})

    def _pointer_click(self, x: float, y: float) -> None:
        for kind in ("mousePressed", "mouseReleased"):
            self.driver.execute_cdp_cmd("Input.dispatchMouseEvent", {
                "type": kind, "x": float(x), "y": float(y),
                "button": "left", "clickCount": 1})

    def _delete_last_attachment(self) -> bool:
        """删掉最后一张附件卡片；返回是否真的少了一张。"""
        try:
            cards = self.driver.find_elements(By.XPATH, ATTACH_CARD)
        except WebDriverException:
            return False
        if not cards:
            return True
        before = len(cards)
        try:
            pos = self.driver.execute_script(
                "const r = arguments[0].getBoundingClientRect();"
                "return [r.x + r.width / 2, r.y + r.height / 2, r.right - 8, r.y + 8];",
                cards[-1])
            # 删除按钮只在悬停时显示：先悬停卡片，再点右上角的小叉
            self._pointer_move(pos[0], pos[1])
            time.sleep(0.35)
            self._pointer_move(pos[2], pos[3])
            time.sleep(0.25)
            self._pointer_click(pos[2], pos[3])
        except Exception:
            pass
        time.sleep(0.5)
        if self._attachment_count() < before:
            return True
        # 兜底：直接用 JS 在删除按钮上派发点击
        try:
            self.driver.execute_script("""
            const cards = document.querySelectorAll("[data-testid='attachment-image-card']");
            if (!cards.length) return;
            const card = cards[cards.length - 1];
            card.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const btn = card.querySelector("[data-testid='attachment-delete-btn']");
            if (btn) {
                (btn.parentElement || btn).dispatchEvent(
                    new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
            }
            """)
        except Exception:
            pass
        time.sleep(0.5)
        return self._attachment_count() < before

    def _clear_attachments(self, limit: int = 24) -> int:
        """清空输入框里残留的图片附件，避免上一批的图串到这一批。"""
        removed = 0
        for _ in range(limit):
            if self._attachment_count() == 0:
                break
            if not self._delete_last_attachment():
                break
            removed += 1
        left = self._attachment_count()
        if left:
            self.log.warn(f"输入框里还有 {left} 张附件删不掉（本次清掉 {removed} 张）")
        elif removed:
            self.log.info(f"已清理 {removed} 张输入框残留附件")
        return removed

    def _set_files_cdp(self, selector: str, paths: list[str]) -> bool:
        """用 CDP 直接给 file input 塞文件（send_keys 在豆包页面上经常静默失效）。"""
        try:
            doc = self.driver.execute_cdp_cmd("DOM.getDocument", {"depth": 0})
            node = self.driver.execute_cdp_cmd("DOM.querySelector", {
                "nodeId": doc["root"]["nodeId"], "selector": selector})
            node_id = int(node.get("nodeId") or 0)
            if not node_id:
                return False
            self.driver.execute_cdp_cmd("DOM.setFileInputFiles", {
                "nodeId": node_id, "files": [os.path.abspath(p) for p in paths]})
            return True
        except Exception as exc:
            self.log.warn(f"CDP 上传失败（{selector}）：{str(exc)[:100]}")
            return False

    def _upload_images(self, paths: list[str]) -> int:
        """一次性把多张图片放进同一条消息；返回本次真正新增的附件张数。"""
        paths = [os.path.abspath(p) for p in paths if p and os.path.exists(p)]
        if not paths:
            return 0
        base = self._attachment_count()
        ok = self._set_files_cdp("input[data-testid='upload-file-input']", paths)
        if not ok:
            ok = self._set_files_cdp("input[type='file']", paths)
        if not ok:
            try:
                self._file_input().send_keys("\n".join(paths))
                ok = True
            except Exception as exc:
                self.log.warn(f"批量上传图片失败：{str(exc)[:120]}")
                return 0
        self._wait_attachments(base + len(paths), timeout=max(120, 25 * len(paths)))
        return self._attachment_count() - base

    def _upload_image(self, image_path: str) -> bool:
        return self._upload_images([image_path]) == 1

    def _wait_reply_growth(self, before: int, timeout: int = 60) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            self._check_cancel()
            if self._reply_count() > before:
                return True
            time.sleep(1.0)
        return False

    def _find_videos_in(self, block) -> list[str]:
        urls: list[str] = []
        try:
            for video in block.find_elements(By.XPATH, ".//video"):
                src = video.get_attribute("src") or ""
                if src.startswith("http") or src.startswith("blob:"):
                    urls.append(src)
                    continue
                try:
                    src2 = video.find_element(By.XPATH, ".//source").get_attribute("src") or ""
                    if src2.startswith("http") or src2.startswith("blob:"):
                        urls.append(src2)
                except Exception:
                    pass
        except WebDriverException:
            pass
        return urls

    def _reveal_videos_in(self, block) -> list[str]:
        """豆包视频默认只渲染封面图，hover 一下才会真正创建 <video>。"""
        urls = self._find_videos_in(block)
        if urls:
            return urls
        try:
            wrappers = block.find_elements(
                By.XPATH, ".//*[contains(@class,'video-player-wrapper')]")
        except WebDriverException:
            wrappers = []
        if not wrappers:
            return []
        for wrapper in wrappers:
            self._check_cancel()
            try:
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center', behavior:'instant'});", wrapper)
                time.sleep(0.25)
                ActionChains(self.driver).move_to_element(wrapper).perform()
                time.sleep(1.0)
            except Exception:
                continue
        try:
            self.driver.execute_script(
                "arguments[0].querySelectorAll('video').forEach("
                "v => { try { v.pause(); v.muted = true; } catch (e) {} });", block)
        except Exception:
            pass
        return self._find_videos_in(block)

    @staticmethod
    def _pick_submission(submissions: list[dict], pos: int, assigned: set) -> dict | None:
        """回片对回提交项：优先按回复块位置精确匹配，否则按提交顺序依次分配。"""
        for item in submissions:
            if item["key"] not in assigned and item["index"] == pos:
                return item
        for item in sorted(submissions, key=lambda x: x["index"]):
            if item["key"] not in assigned:
                return item
        return None

    @staticmethod
    def _oneshot_prompt(items: list[dict], aspect: str, seconds: int = 10) -> str:
        """把 N 条分镜合并成一条文案：有底图的标 @文件名，没底图的直接写文案。"""
        total = len(items)
        with_image = [it for it in items if it.get("image")]
        char_views: list[str] = []
        char_names: list[str] = []
        for item in items:
            for name in item.get("char_names") or []:
                if name and name not in char_names:
                    char_names.append(name)
            for path in item.get("char_images") or []:
                name = os.path.basename(path)
                if name and name not in char_views:
                    char_views.append(name)

        seg_list = [str(it.get("segment") or (i + 1)) for i, it in enumerate(items)]
        seg_text = "第 " + "、".join(seg_list) + " 段"
        lines: list[str] = []
        if with_image:
            lines.append(
                f"我一次性上传了 {len(with_image)} 张分镜底图（按上传顺序对应下面的段落），"
                f"请只生成{seg_text}，一共 {total} 个视频；其他段已经完成，不要重复生成。")
        else:
            lines.append(
                f"请只生成{seg_text}，一共 {total} 个独立的 {int(seconds)} 秒短视频"
                f"（没有底图，按文字描述直接生成画面）；其他段已经完成，不要重复生成。")
        if char_views:
            lines.append(
                f"另外还上传了 {len(char_views)} 张人物三视图（"
                f"{'、'.join('@' + n for n in char_views)}），它们只作为人物长相、发型、服装的参考，"
                "不要把这些三视图当成视频画面，也不要在视频里出现拼图或多视角画面。")
        lines.append(
            "每个视频单独生成、单独输出，不要把几个视频合成一个；画面自然流畅、有轻微运镜，"
            f"保留人物对白与环境声，不要静音；视频比例：{aspect}，单段时长 {int(seconds)} 秒。")
        lines.append("视频与文案的对应关系：")
        for idx, item in enumerate(items, 1):
            segment = item.get("segment") or idx
            name = os.path.basename(item.get("image") or "")
            text = (item.get("text") or "").strip().replace("\n", " ")
            head = f"第 {segment} 段" + (f" @{name}" if name else "")
            block = f"{head}：{text}"
            extra = (item.get("char_block") or "").strip().replace("\n", "；")
            if extra:
                block += f"\n　人物设定（三视图参考图已上传，保持同一人物外观）：{extra}"
            lines.append(block)
        if char_names:
            lines.append(f"本批涉及人物：{'、'.join(char_names)}，同一人物在各段之间必须保持一致。")
        return "\n".join(lines)

    def run_video_batch_oneshot(self, items: list[dict], out_dir: str,
                                timeout: int | None = None, on_event=None,
                                chat_url: str = "") -> dict:
        """一次性上传全部图片 + 一条合并文案（@文件名）发送，再按顺序收片。

        豆包常一次只回 2 个视频，程序会在空闲 1 分钟后催一句「还有剩下的呢」，
        让它继续生成剩余分镜，不走逐条单独补视频。返回字典里是已经拿到的 key → 本地路径。
        """
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        if not items:
            return {}
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()

        aspect = str(items[0].get("aspect") or "9:16（竖屏）")
        seconds = int(items[0].get("seconds") or 10)
        base_timeout = int(timeout or self.config.get("video_batch_timeout")
                           or self.config.get("video_timeout") or 3600)
        # 批量生视频整体最多等 60 分钟（可见 config.json 的 video_batch_timeout）
        collect_timeout = min(3600, base_timeout)

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            self._open_chat(chat_url)
            self._check_cancel()

            if self.config.get("doubao_video_click_entry"):
                if self._try_enter_video_mode():
                    self.log.info("已点击豆包「视频生成」入口")

            input_el = self._first(DOUBAO_INPUTS, timeout=30)
            if input_el is None:
                raise BrowserError("找不到豆包输入框，请先在自动化 Chrome 里登录豆包")
            self._clear_input(input_el)
            # 输入框必须干净：残留的图会混进这条消息，导致「4 张图传出 7 张」
            left = self._attachment_count()
            if left:
                self._clear_attachments()
                left = self._attachment_count()
            if left:
                self.log.warn(f"输入框有 {left} 张残留附件删不掉，改开一个新对话提交")
                self._reset_to_single_chat()
                input_el = self._first(DOUBAO_INPUTS, timeout=30)
                if input_el is None:
                    raise BrowserError("新对话里找不到豆包输入框")
                self._clear_input(input_el)
                left = self._attachment_count()
                if left:
                    self.log.warn(f"新对话里仍有 {left} 张附件，改回逐条提交")
                    return {}

            # 底图在前，人物三视图在后（提示词里用文件名区分）
            images: list[str] = []
            for it in items:
                path = it.get("image") or ""
                if not path:
                    continue
                path = os.path.abspath(path)
                if os.path.exists(path) and path not in images:
                    images.append(path)
            char_images: list[str] = []
            for it in items:
                for path in it.get("char_images") or []:
                    path = os.path.abspath(path)
                    if (os.path.exists(path) and path not in images
                            and path not in char_images):
                        char_images.append(path)
            refs = images + char_images

            uploaded = 0
            if refs:
                self.log.info(
                    f"一次性上传 {len(images)} 张分镜底图 + {len(char_images)} 张人物三视图"
                    f"（输入框现有 {left} 张）…")
                uploaded = self._upload_images(refs)
                if uploaded != len(refs):
                    self.log.warn(
                        f"上传数量不对：期望新增 {len(refs)} 张，实际新增 {uploaded} 张，改回逐条提交")
                    self._clear_attachments()
                    return {}
            else:
                self.log.info("本条没有底图也没有人物三视图，按纯文案生成")

            text = self._oneshot_prompt(items, aspect, seconds)
            before = self._reply_count()
            # 豆包是虚拟列表，回复块索引会随滚动变化，不能用 block 下标做基线；
            # 改成记住提交前页面上已有的视频地址，收片时只认新出现的地址。
            seen: set[str] = set()
            try:
                for block in self.driver.find_elements(By.XPATH, REPLY_BLOCK):
                    seen.update(self._find_videos_in(block))
            except WebDriverException:
                pass
            if not self._paste_text(input_el, text):
                self._clear_attachments()
                raise BrowserError("合并视频文案输入失败")
            time.sleep(0.8)
            self._check_cancel()
            if not self._click_send(input_el):
                self._clear_attachments()
                raise BrowserError("合并视频消息发送失败")
            self.log.ok(
                f"已一次性发送 {len(items)} 条视频要求（附 {uploaded} 张图，文案用 @文件名 关联）")

            if on_event:
                for idx, item in enumerate(items, 1):
                    on_event("submitted", item["key"], idx, len(items))

            # 一条消息里可能要连点多次「确认生成」，上限按分镜数放宽
            confirm_state = {
                "max_clicks": max(3, len(items) + 1),
                "asked": set(), "replies": 0, "last_at": 0.0,
            }
            started = self._wait_generation_started(before, "", 180, confirm_state, text)
            if not started:
                # 豆包常见反应是「确认后我再开始批量生成 N 个视频」，需要回一句把它推下去
                self.log.warn(f"豆包还在等确认，自动回复「开始生成全部 {len(items)} 个视频」")
                self._send_followup(
                    f"确认，请按上面的要求开始生成全部 {len(items)} 个视频。")
                time.sleep(2.0)

            deadline = time.time() + collect_timeout
            assigned: dict[str, str] = {}
            last_new = time.time()
            last_nudge = 0.0
            last_guide = 0.0
            last_note = time.time()
            confirmed_texts: set[str] = set()
            nudges = 0
            nudge_max = max(1, int(self.config.get("video_nudge_max") or 4))

            while time.time() < deadline and len(assigned) < len(items):
                self._check_cancel()
                self._check_quota()
                # 一个视频都还没出来时：点「确认生成」按钮，或让 AI 回一句推进
                if not assigned:
                    if self._click_confirm_button(confirm_state):
                        last_new = time.time()
                        continue
                    if time.time() - last_guide > 20:
                        last_guide = time.time()
                        reply_text = self._last_reply_text()
                        pushed = bool(reply_text and self._guide_once(
                            "视频", text, reply_text, confirm_state))
                        key = (reply_text or "")[:80]
                        if (not pushed and reply_text and key not in confirmed_texts
                                and any(k in reply_text for k in
                                        ("确认后", "请确认", "是否继续", "确认无误", "是否开始"))):
                            confirmed_texts.add(key)
                            self.log.info("检测到豆包在等确认，直接回复继续生成")
                            pushed = self._send_followup(
                                "确认无误，请立刻继续生成剩余的视频。")
                        if pushed:
                            last_new = time.time()
                            continue
                try:
                    blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
                except WebDriverException:
                    blocks = []
                for block in blocks:
                    for src in self._reveal_videos_in(block):
                        if src in seen:
                            continue
                        seen.add(src)
                        idx = len(assigned)
                        if idx >= len(items):
                            break
                        name = (f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                                f"_{uuid.uuid4().hex[:4]}.mp4")
                        path = os.path.join(out_dir, name)
                        try:
                            self._download_media(src, path)
                        except Exception as exc:
                            self.log.warn(f"视频下载失败：{str(exc)[:100]}")
                            continue
                        if not os.path.exists(path) or os.path.getsize(path) < 2048:
                            self.log.warn("视频文件异常，跳过")
                            continue
                        key = items[idx]["key"]
                        assigned[key] = path
                        last_new = time.time()
                        self.log.ok(
                            f"收到视频 {len(assigned)}/{len(items)} → {os.path.basename(path)}")
                        if on_event:
                            on_event("done", key, len(assigned), len(items), path)

                # 豆包是两个两个出片：收到一批就立刻催剩下的，不再等一分钟
                if (assigned and len(assigned) < len(items)
                        and nudges < nudge_max and time.time() - last_nudge > 15):
                    pending = [str(it.get("segment") or (i + 1))
                               for i, it in enumerate(items)
                               if it["key"] not in assigned]
                    segments = "、".join(f"第 {n} 段" for n in pending)
                    last_text = self._last_reply_text() or ""
                    # 豆包说「排队中/正在生成」时不要催，等它自己出片
                    if any(k in last_text for k in
                           ("排队", "正在生成", "生成中", "请稍候", "处理中")):
                        time.sleep(5.0)
                        continue
                    waiting = any(k in last_text for k in
                                  ("确认后", "请确认", "是否继续", "确认无误",
                                   "是否开始", "确认一下", "等你确认"))
                    if waiting:
                        key = last_text[:80]
                        if key in confirmed_texts:
                            # 这条已经确认过，继续等它生成，不要重复催
                            time.sleep(5.0)
                            continue
                        confirmed_texts.add(key)
                        self.log.info("豆包在等确认，先回「确认」而不是催更")
                        if self._send_followup("确认无误，请立刻开始生成剩余的视频。"):
                            nudges += 1
                            last_nudge = time.time()
                            continue
                    msg = (f"还有剩下的 {len(pending)} 个视频呢？请继续生成{segments}，"
                           f"同样是 {int(seconds)} 秒竖屏，保留人物对白与环境声。")
                    self.log.info(
                        f"已收到 {len(assigned)}/{len(items)}，立即催剩余 {len(pending)} 个…")
                    if self._send_followup(msg):
                        nudges += 1
                        last_nudge = time.time()
                        continue

                # 催促次数用完、又长时间没新片，就收下已有结果（不回退逐条补）
                if (assigned and nudges >= nudge_max
                        and time.time() - max(last_new, last_nudge) > 30):
                    self.log.warn(
                        f"已催 {nudges} 次仍有 {len(items) - len(assigned)} 个没回，"
                        f"先收下这 {len(assigned)}/{len(items)} 条")
                    break

                if time.time() - last_note > 60:
                    last_note = time.time()
                    self.log.info(f"仍在等待回片…已收到 {len(assigned)}/{len(items)}")

                try:
                    last = blocks[-1] if blocks else None
                    if last is not None:
                        self.driver.execute_script(
                            "arguments[0].scrollIntoView({block:'end', behavior:'instant'});", last)
                except WebDriverException:
                    pass
                time.sleep(5.0)

            missing = [it["key"] for it in items if it["key"] not in assigned]
            if missing:
                self.log.warn(f"{len(missing)} 个视频没等到（已按催更方式处理）")
            return assigned

    def continue_video_batch(self, items: list[dict], out_dir: str,
                             timeout: int | None = None, on_event=None,
                             chat_url: str = "") -> dict:
        """续生成：不重新上传图片，在会话末尾催豆包把没完成的视频补出来。"""
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        if not items:
            return {}
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()
        seconds = int(items[0].get("seconds") or 10)
        base_timeout = int(timeout or self.config.get("video_batch_timeout") or 1200)
        nudge_max = max(1, int(self.config.get("video_nudge_max") or 4))

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            self._open_chat(chat_url)

            input_el = self._first(DOUBAO_INPUTS, timeout=30)
            if input_el is None:
                raise BrowserError("找不到豆包输入框，请先确认自动化 Chrome 已登录豆包")

            seen: set[str] = set()
            try:
                for block in self.driver.find_elements(By.XPATH, REPLY_BLOCK):
                    seen.update(self._find_videos_in(block))
            except WebDriverException:
                pass
            self.log.info(f"续生成：会话里已有 {len(seen)} 个视频，先排除，只等新片")

            pending = "、".join(
                f"第 {it.get('segment') or (i + 1)} 段" for i, it in enumerate(items))
            last_text = self._last_reply_text() or ""
            if any(k in last_text for k in ("确认后", "请确认", "是否继续", "确认无误",
                                            "是否开始", "确认一下", "等你确认")):
                # 豆包上一轮就在等确认：直接确认，让它继续生成，不重新提交
                msg = "确认无误，请立刻生成剩余的视频。"
            else:
                msg = (f"请继续生成还没完成的视频：{pending}，按之前上传的图片顺序，"
                       f"同样是 {seconds} 秒竖屏，保留人物对白与环境声。")
            self.log.info(f"在会话末尾继续催：{msg}")
            if not self._send_followup(msg):
                raise BrowserError("续生成消息发送失败")

            deadline = time.time() + base_timeout
            assigned: dict[str, str] = {}
            last_new = time.time()
            last_nudge = time.time()
            nudges = 0
            confirm_state = {"clicks": 0, "max_clicks": 6}
            while time.time() < deadline and len(assigned) < len(items):
                self._check_cancel()
                self._check_quota()
                if not assigned and self._click_confirm_button(confirm_state):
                    last_new = time.time()
                    continue
                try:
                    blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
                except WebDriverException:
                    blocks = []
                for block in blocks:
                    for src in self._find_videos_in(block):
                        if src in seen:
                            continue
                        seen.add(src)
                        idx = len(assigned)
                        if idx >= len(items):
                            break
                        name = (f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                                f"_{uuid.uuid4().hex[:4]}.mp4")
                        path = os.path.join(out_dir, name)
                        try:
                            self._download_media(src, path)
                        except Exception as exc:
                            self.log.warn(f"视频下载失败：{str(exc)[:100]}")
                            continue
                        if not os.path.exists(path) or os.path.getsize(path) < 2048:
                            continue
                        key = items[idx]["key"]
                        assigned[key] = path
                        last_new = time.time()
                        self.log.ok(
                            f"收到视频 {len(assigned)}/{len(items)} → {os.path.basename(path)}")
                        if on_event:
                            on_event("done", key, len(assigned), len(items), path)

                if (assigned and len(assigned) < len(items)
                        and nudges < nudge_max and time.time() - last_nudge > 300):
                    nudges += 1
                    last_nudge = time.time()
                    self.log.info(f"5 分钟没有新片，再催一次（{nudges}/{nudge_max}）")
                    self._send_followup(
                        f"还有 {len(items) - len(assigned)} 个视频没生成，请继续生成剩余的视频。")
                try:
                    last = blocks[-1] if blocks else None
                    if last is not None:
                        self.driver.execute_script(
                            "arguments[0].scrollIntoView({block:'end', behavior:'instant'});",
                            last)
                except WebDriverException:
                    pass
                time.sleep(5.0)

        return assigned

    def run_video_batch(self, items: list[dict], out_dir: str, timeout: int | None = None,
                        on_event=None, chat_url: str = "") -> dict:
        """在一次会话里把多条视频任务依次提交，再统一收片。返回 {key: 本地路径}。"""
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        if not items:
            return {}
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()

        aspect = str(items[0].get("aspect") or "9:16（竖屏）")
        base_timeout = int(timeout or self.config.get("video_batch_timeout")
                           or self.config.get("video_timeout") or 900)
        collect_timeout = min(3600, base_timeout + 120 * max(0, len(items) - 1))

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            self._open_chat(chat_url)
            self._check_cancel()

            submissions: list[dict] = []
            baseline = self._reply_count()
            # 虚拟列表会让 block 下标漂移，用「提交前已有视频地址」做基线更可靠
            seen: set[str] = set()
            try:
                for block in self.driver.find_elements(By.XPATH, REPLY_BLOCK):
                    seen.update(self._find_videos_in(block))
            except WebDriverException:
                pass
            for i, item in enumerate(items, 1):
                self._check_cancel()
                self._check_quota()
                input_el = self._first(DOUBAO_INPUTS, timeout=30)
                if input_el is None:
                    raise BrowserError("找不到豆包输入框，请先在自动化 Chrome 里登录豆包")
                self._clear_input(input_el)
                self._clear_attachments()
                left = self._attachment_count()
                if left:
                    self.log.warn(
                        f"第 {i} 条提交前输入框还有 {left} 张残留图，这条消息可能带上多余图片")
                before = self._reply_count()

                refs: list[str] = []
                image = item.get("image") or ""
                if image and os.path.exists(image):
                    refs.append(os.path.abspath(image))
                for path in item.get("char_images") or []:
                    path = os.path.abspath(path)
                    if os.path.exists(path) and path not in refs:
                        refs.append(path)
                uploaded = 0
                if refs:
                    uploaded = self._upload_images(refs)
                    if uploaded != len(refs):
                        self.log.warn(
                            f"第 {i} 条参考图上传不完整（{uploaded}/{len(refs)}）")
                else:
                    self.log.info(f"第 {i} 条没有底图，按纯文案生成")
                text = self._video_prompt(item.get("text") or "", aspect,
                                          item.get("seconds") or 10,
                                          item.get("char_block") or "",
                                          has_image=bool(uploaded))
                if not self._paste_text(input_el, text):
                    raise BrowserError(f"第 {i} 条视频提示词输入失败")
                time.sleep(0.8)
                self._check_cancel()
                if not self._click_send(input_el):
                    raise BrowserError(f"第 {i} 条视频发送失败")

                self._wait_reply_growth(before, 60)
                confirm_text = self._last_reply_text()
                self.log.info(f"第 {i}/{len(items)} 条已发送，等待豆包进入生成阶段…")
                if not self._wait_generation_started(before, confirm_text, 180, {}, text):
                    self.log.error(
                        f"第 {i} 条没有确认成功、未进入生成阶段；为保证顺序，暂停提交后面的任务")
                    if on_event:
                        for rest in items[i - 1:]:
                            on_event("skipped", rest["key"], i - 1, len(items))
                    break

                submissions.append({"key": item["key"], "index": before})
                self.log.ok(f"第 {i}/{len(items)} 条已开始生成")
                if on_event:
                    on_event("submitted", item["key"], i, len(items))
                time.sleep(0.8)

            self.log.ok(f"{len(submissions)} 条视频任务已全部提交，开始等待回片…")
            deadline = time.time() + collect_timeout
            assigned: dict[str, str] = {}
            last_note = time.time()

            while time.time() < deadline and len(assigned) < len(submissions):
                self._check_cancel()
                try:
                    blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
                except WebDriverException:
                    blocks = []
                for pos, block in enumerate(blocks):
                    for src in self._reveal_videos_in(block):
                        if src in seen:
                            continue
                        seen.add(src)
                        item = self._pick_submission(submissions, pos, set(assigned))
                        if item is None:
                            continue
                        name = f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}.mp4"
                        path = os.path.join(out_dir, name)
                        try:
                            self._download_media(src, path)
                        except Exception as exc:
                            self.log.warn(f"视频下载失败：{str(exc)[:100]}")
                            continue
                        if not os.path.exists(path) or os.path.getsize(path) < 2048:
                            self.log.warn("视频文件异常，跳过")
                            continue
                        assigned[item["key"]] = path
                        self.log.ok(f"收到视频 {len(assigned)}/{len(submissions)} → {os.path.basename(path)}")
                        if on_event:
                            on_event("done", item["key"], len(assigned),
                                     len(submissions), path)

                if time.time() - last_note > 60:
                    last_note = time.time()
                    self.log.info(f"仍在等待回片…已收到 {len(assigned)}/{len(submissions)}")

                try:
                    last = blocks[-1] if blocks else None
                    if last is not None:
                        self.driver.execute_script(
                            "arguments[0].scrollIntoView({block:'end', behavior:'instant'});", last)
                except WebDriverException:
                    pass
                time.sleep(5.0)

            missing = [it["key"] for it in submissions if it["key"] not in assigned]
            if missing:
                self.log.warn(f"有 {len(missing)} 条视频未在等待时间内返回")
            return assigned

    def generate_video_doubao(self, prompt: str, image_path: str, out_dir: str,
                              timeout: int | None = None, aspect: str = "",
                              seconds: int = 10, chat_url: str = "") -> str:
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        timeout = int(timeout or self.config.get("video_timeout") or 600)
        aspect = aspect or "9:16（竖屏）"
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            self._open_chat(chat_url)
            self._check_cancel()

            if self.config.get("doubao_video_click_entry"):
                if self._try_enter_video_mode():
                    self.log.info("已点击豆包「视频生成」入口")

            input_el = self._first(DOUBAO_INPUTS, timeout=25)
            if input_el is None:
                raise BrowserError("找不到豆包输入框，请先在自动化 Chrome 里登录豆包")
            self._clear_input(input_el)
            before = self._reply_count()

            uploaded = False
            if image_path and os.path.exists(image_path):
                try:
                    file_input = self.driver.find_element(By.XPATH, "//input[@type='file']")
                    file_input.send_keys(os.path.abspath(image_path))
                    uploaded = True
                    time.sleep(3.0)
                except Exception:
                    uploaded = False
                if not uploaded:
                    try:
                        self._copy_image_to_clipboard(image_path)
                        self._editable(input_el).click()
                        time.sleep(0.3)
                        input_el.send_keys(Keys.CONTROL, "v")
                        time.sleep(2.5)
                        uploaded = True
                    except Exception as exc:
                        self.log.warn(f"参考图上传失败（继续尝试纯文本生成）：{exc}")
            else:
                self.log.info("这条没有底图，按纯文案生成视频")

            text = self._video_prompt(prompt, aspect, seconds, has_image=uploaded)
            if not self._paste_text(input_el, text):
                raise BrowserError("视频提示词输入失败")
            time.sleep(0.8)
            self._check_cancel()
            if not self._click_send(input_el):
                raise BrowserError("点击发送失败")

            deadline = time.time() + 90
            while time.time() < deadline:
                self._check_cancel()
                if self._reply_count() > before:
                    break
                if self._login_prompt_visible():
                    raise BrowserError("豆包需要登录：请先在自动化 Chrome 里登录豆包")
                time.sleep(1.0)

            self.log.info(f"已提交豆包视频任务（{aspect}），等待出片…")
            url, stable, last_note = "", 0, time.time()
            state = {"asked": set(), "replies": 0, "last_at": 0.0}
            text_sig, text_since = "", time.time()
            deadline = time.time() + timeout
            while time.time() < deadline:
                self._check_cancel()
                candidate = self._find_video_url()
                if candidate:
                    if candidate == url:
                        stable += 1
                    else:
                        url, stable = candidate, 0
                    if stable >= 2:
                        break
                else:
                    try:
                        blocks = self.driver.find_elements(By.XPATH, REPLY_BLOCK)
                        if blocks:
                            self.driver.execute_script(
                                "arguments[0].scrollIntoView({block:'end', behavior:'instant'});",
                                blocks[-1])
                    except WebDriverException:
                        pass
                    reply_text = self._last_reply_text()
                    if reply_text != text_sig:
                        text_sig, text_since = reply_text, time.time()
                    # 有「确认生成」按钮就直接点，比让 AI 回话更可靠
                    if self._click_confirm_button(state):
                        url, stable, text_since, last_note = "", 0, time.time(), time.time()
                        continue
                    # 豆包只回了文字（常见：先确认参数），交给 AI 判断要不要推一句
                    if reply_text and time.time() - text_since > 8:
                        if self._guide_once("视频", text, reply_text, state):
                            text_since, last_note = time.time(), time.time()
                            continue
                if time.time() - last_note > 60:
                    last_note = time.time()
                    self.log.info("仍在等待豆包出视频…（若长时间无响应，可在浏览器里确认是否已进入视频生成模式）")
                time.sleep(4.0)

            if not url:
                raise BrowserError(
                    "豆包没有返回视频。可尝试：1) 在自动化 Chrome 里手动切到「视频生成」；"
                    "2) config.json 打开 doubao_video_click_entry；3) 确认账号额度"
                )

            name = f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}.mp4"
            path = os.path.join(out_dir, name)
            self._download_media(url, path)
            if not os.path.exists(path) or os.path.getsize(path) < 2048:
                raise BrowserError("视频下载失败或文件为空")
            self.log.ok(f"视频已保存 → {os.path.basename(path)}")
            return path

    # ------------------------------------------------------------------ 即梦图生视频（备用）
    def generate_video_jimeng(self, prompt: str, image_path: str, out_dir: str,
                       timeout: int | None = None) -> str:
        if not SELENIUM_OK:
            raise BrowserError("未安装 selenium")
        timeout = int(timeout or self.config.get("video_timeout") or 900)
        out_dir = os.path.abspath(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        self.cancel_event.clear()

        with self.lock:
            self._check_cancel()
            self.ensure_started()
            self._check_cancel()
            self._ensure_tab("jimeng", self.config.get("jimeng_url"))
            self.driver.get(self.config.get("jimeng_url"))
            time.sleep(3.0)

            container = "//div[@id='dreamina-ui-configuration-content-wrapper']"
            upload = self._first([
                "//div[contains(@class,'reference-upload-eclumn') and .//div[text()='首帧']]//input[@type='file']",
                "//input[@type='file']",
            ], timeout=25)
            if upload is None:
                raise BrowserError("即梦页面找不到图片上传控件，请先在浏览器中登录即梦后重试")
            upload.send_keys(os.path.abspath(image_path))
            time.sleep(3.0)

            textarea = self._first([
                f"{container}//textarea[contains(@class,'prompt-textarea')]",
                "//textarea[contains(@class,'prompt-textarea')]",
                "//textarea",
            ], timeout=20)
            if textarea is None:
                raise BrowserError("即梦页面找不到提示词输入框")
            textarea.clear()
            textarea.send_keys(prompt)
            time.sleep(0.6)

            submit = self._first([
                f"{container}//button[contains(@class,'submit-button')][not(@disabled)]",
                "//button[contains(@class,'submit-button')][not(@disabled)]",
            ], timeout=20)
            if submit is None:
                raise BrowserError("即梦页面提交按钮不可用")
            self.log.info("已提交即梦图生视频任务，等待生成…")
            submit.click()
            time.sleep(2.0)

            deadline = time.time() + timeout
            video_url = ""
            while time.time() < deadline:
                self._check_cancel()
                try:
                    busy = self.driver.find_elements(By.XPATH, "//div[contains(@class,'progress-badge')]")
                except WebDriverException:
                    busy = []
                if not busy:
                    try:
                        videos = self.driver.find_elements(
                            By.XPATH, "(//div[contains(@class,'item-iDi3CC')])[1]//video")
                        if videos:
                            src = videos[0].get_attribute("src") or ""
                            if src.startswith("http"):
                                video_url = src
                                break
                    except WebDriverException:
                        pass
                time.sleep(4.0)

            if not video_url:
                raise BrowserError("即梦视频生成超时")

            session = self._session_for("https://jimeng.jianying.com/")
            resp = session.get(video_url, timeout=300)
            resp.raise_for_status()
            name = f"vid_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}.mp4"
            path = os.path.join(out_dir, name)
            with open(path, "wb") as fp:
                fp.write(resp.content)
            self.log.ok(f"视频已保存 → {os.path.basename(path)}")
            return path
