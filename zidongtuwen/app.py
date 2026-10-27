"""自动视频图文工坊 —— Web 服务入口。

启动： python app.py
访问： http://127.0.0.1:8848
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser

from flask import Flask, jsonify, request, send_from_directory

from core.config import Config
from core.logbus import LogBus
from core.pipeline import TaskCenter, UserError
from core.state import StateStore
from core.subtitle import list_fonts

config = Config()
log = LogBus()
store = StateStore(config, log)
center = TaskCenter(config, store, log)

WEB_DIR = os.path.join(config.root, "web")

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024 * 1024
app.config["JSON_AS_ASCII"] = False


# ---------------------------------------------------------------------- 工具
def ok(**payload):
    payload.setdefault("ok", True)
    return jsonify(payload)


def fail(message: str, code: int = 400):
    return jsonify({"ok": False, "error": str(message)}), code


def row_json(row: dict) -> dict:
    return {
        "id": row["id"],
        "text": row.get("text") or "",
        "image": store.media_url(row.get("image")),
        "video": store.media_url(row.get("video")),
        "audio": store.media_url(row.get("audio")),
        "episode": row.get("episode"),
        "episodeTitle": row.get("episodeTitle") or "",
    }


EPISODE_HEAD = re.compile(r"^\s*#{0,3}\s*第\s*(\d+)\s*集[\s:：]*(.*)$")
EPISODE_HEAD_ALT = re.compile(r"^\s*【第\s*(\d+)\s*集】\s*(.*)$")


def parse_episodes(raw: str, per: int = 6) -> list[dict]:
    """把整部剧的文本拆成集：支持「## 第 01 集 标题」，没有集头就每 per 行一集。"""
    episodes: list[dict] = []
    current = None
    plain: list[str] = []
    for line in str(raw or "").splitlines():
        text = line.strip()
        match = EPISODE_HEAD.match(text) or EPISODE_HEAD_ALT.match(text)
        if match:
            if current and current["texts"]:
                episodes.append(current)
            current = {
                "no": int(match.group(1)),
                "title": (match.group(2) or "").strip(),
                "texts": [],
            }
            continue
        if not text:
            continue
        if text.startswith(("---", ">", "|", "**", "# ")):
            continue
        if current is not None:
            current["texts"].append(text)
        else:
            plain.append(text)
    if current and current["texts"]:
        episodes.append(current)
    if not episodes and plain:
        step = max(1, int(per or 6))
        for i in range(0, len(plain), step):
            episodes.append({
                "no": i // step + 1,
                "title": "",
                "texts": plain[i:i + step],
            })
    return episodes


def parse_episode_files(files: list[dict]) -> list[dict]:
    """按文件名解析分集：第01集_拆收音机的孩子.txt → 第 1 集 + 标题。"""
    episodes = []
    for idx, item in enumerate(files, 1):
        name = str(item.get("name") or "")
        stem = os.path.splitext(os.path.basename(name))[0]
        match = re.match(r"^第\s*0*(\d+)\s*集[\s_\-]*(.*)$", stem)
        no = int(match.group(1)) if match else idx
        title = (match.group(2).strip() if match else stem).strip()
        lines = [ln.strip() for ln in str(item.get("text") or "").splitlines()
                 if ln.strip()]
        if lines:
            episodes.append({"no": no, "title": title, "texts": lines})
    episodes.sort(key=lambda ep: ep["no"])
    return episodes


def character_json(item: dict) -> dict:
    return {
        "id": item["id"],
        "name": item.get("name") or "",
        "aliases": item.get("aliases") or "",
        "desc": item.get("desc") or "",
        "front": store.media_url(item.get("front")),
        "side": store.media_url(item.get("side")),
        "back": store.media_url(item.get("back")),
    }


def state_payload(since: int = 0) -> dict:
    logs, seq = log.since(since)
    rows = [row_json(r) for r in store.rows()]
    result = store.data.get("result")
    return {
        "mode": store.mode,
        "settings": store.settings,
        "rows": rows,
        "characters": [character_json(c) for c in store.characters()],
        "result": result,
        "runtime": center.snapshot(),
        "logs": logs,
        "seq": seq,
        "videoAuto": bool(config.get("video_auto_enabled")),
        "videoOneShot": bool(config.get("video_one_shot", True)),
        "aiGuide": bool(config.get("ai_guide_enabled", True) and config.get("deepseek_api_key")),
        "ttsReady": bool(config.get("dashscope_api_key")),
    }


# ---------------------------------------------------------------------- 页面
@app.get("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@app.get("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(WEB_DIR, filename)


@app.get("/media/<path:filename>")
def media(filename: str):
    return send_from_directory(store.data_dir, filename, conditional=True)


# ---------------------------------------------------------------------- 状态
@app.get("/api/fonts")
def api_fonts():
    return ok(fonts=list_fonts())


@app.get("/api/state")
def api_state():
    since = request.args.get("seq", type=int) or 0
    return jsonify(state_payload(since))


@app.post("/api/mode")
def api_mode():
    data = request.get_json(silent=True) or {}
    store.set_mode(data.get("mode"))
    return ok(mode=store.mode)


@app.post("/api/settings")
def api_settings():
    data = request.get_json(silent=True) or {}
    values = data.get("settings") if "settings" in data else data
    if not isinstance(values, dict):
        return fail("参数错误")
    updated = store.update_settings(values)
    # 额度不足暂停时，用户清空「当前会话链接」= 换新会话继续
    if not str(updated.get("chatUrl") or "").strip():
        center.resume_after_quota()
    return ok(settings=updated)


@app.post("/api/rows/import")
def api_import_rows():
    data = request.get_json(silent=True) or {}
    raw = data.get("text") or ""
    replace = bool(data.get("replace"))
    texts = [line.strip() for line in raw.splitlines() if line.strip()]
    if not texts:
        return fail("没有可导入的文案")
    empty_before = not store.rows()
    added = store.add_rows(texts, replace=replace)
    center.clear_runtime()
    if replace or empty_before:
        # 一个任务一个会话：新导入的文案算新任务，必须断开上一轮的会话链接
        store.update_settings({"chatUrl": ""})
        log.info("已开始新任务：下次生图会自动新开豆包会话")
    log.ok(f"已导入 {len(added)} 条文案")
    return ok(rows=[row_json(r) for r in store.rows()])


@app.post("/api/episodes/import")
def api_import_episodes():
    data = request.get_json(silent=True) or {}
    raw = data.get("text") or ""
    replace = bool(data.get("replace"))
    try:
        per = int(data.get("per") or 6)
    except (TypeError, ValueError):
        per = 6
    files = data.get("files")
    if isinstance(files, list) and files:
        episodes = parse_episode_files(files)
    else:
        episodes = parse_episodes(raw, per)
    if not episodes:
        return fail("没有解析到剧集内容，请检查格式")
    keep_first = bool(data.get("keep_first"))
    existing = store.rows_with_text()
    empty_before = not store.rows()
    if keep_first and existing:
        marked = store.mark_existing_as_episode(1)
        log.info(f"现有 {marked} 条分镜已标记为第 1 集")
        episodes = [e for e in episodes if int(e.get("no") or 0) != 1]
        if not episodes:
            return fail("导入内容里除了第 1 集没有其它剧集，已保留现有分镜")
        added = store.add_episode_rows(episodes, replace=False)
    else:
        added = store.add_episode_rows(episodes, replace=replace)
    center.clear_runtime()
    if replace or empty_before:
        store.update_settings({"chatUrl": ""})
        log.info("已开始新任务：下次生图会自动新开豆包会话")
    log.ok(f"已导入 {len(episodes)} 集，共 {len(added)} 条分镜")
    return ok(
        episodes=[{"no": e["no"], "title": e["title"], "count": len(e["texts"])}
                  for e in episodes],
        rows=[row_json(r) for r in store.rows()],
    )


@app.post("/api/rows")
def api_add_row():
    data = request.get_json(silent=True) or {}
    empty_before = not store.rows()
    store.add_row(data.get("text") or "")
    if empty_before:
        store.update_settings({"chatUrl": ""})
        log.info("已开始新任务：下次生图会自动新开豆包会话")
    return ok(rows=[row_json(r) for r in store.rows()])


@app.patch("/api/rows/<row_id>")
def api_patch_row(row_id: str):
    data = request.get_json(silent=True) or {}
    if "text" in data:
        store.set_text(row_id, data.get("text") or "")
    return ok()


@app.delete("/api/rows/<row_id>")
def api_delete_row(row_id: str):
    store.delete_row(row_id)
    return ok(rows=[row_json(r) for r in store.rows()])


@app.post("/api/rows/<row_id>/move")
def api_move_row(row_id: str):
    data = request.get_json(silent=True) or {}
    store.move_row(row_id, int(data.get("offset") or 0))
    return ok(rows=[row_json(r) for r in store.rows()])


@app.post("/api/rows/<row_id>/duplicate")
def api_duplicate_row(row_id: str):
    store.duplicate_row(row_id)
    return ok(rows=[row_json(r) for r in store.rows()])


@app.delete("/api/rows")
def api_clear_rows():
    store.clear_rows()
    center.clear_runtime()
    store.set_result(None)
    store.update_settings({"chatUrl": ""})
    return ok(rows=[])


# ---------------------------------------------------------------------- 上传
@app.post("/api/rows/<row_id>/media")
def api_upload_media(row_id: str):
    kind = request.form.get("kind") or ""
    if kind not in ("image", "video", "audio"):
        return fail("媒体类型错误")
    file = request.files.get("file")
    if file is None or not file.filename:
        return fail("没有收到文件")
    if store.get_row(row_id) is None:
        return fail("分镜不存在")
    tmp_dir = config.path("data", "uploads")
    os.makedirs(tmp_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    tmp = os.path.join(tmp_dir, f"tmp_{int(time.time() * 1000)}_{kind}{ext}")
    file.save(tmp)
    try:
        dst = store.local_copy(tmp, kind, prefix="up")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    store.set_media(row_id, kind, dst)
    center._status(row_id, kind, "done", "已上传")
    return ok(rows=[row_json(r) for r in store.rows()])


@app.delete("/api/rows/<row_id>/media/<kind>")
def api_delete_media(row_id: str, kind: str):
    store.clear_media(row_id, kind)
    return ok(rows=[row_json(r) for r in store.rows()])


# ---------------------------------------------------------------------- 人物
@app.post("/api/characters")
def api_add_character():
    data = request.get_json(silent=True) or {}
    store.add_character(data.get("name") or "", data.get("desc") or "")
    return ok(characters=[character_json(c) for c in store.characters()])


@app.patch("/api/characters/<char_id>")
def api_update_character(char_id: str):
    data = request.get_json(silent=True) or {}
    name = data.get("name") if "name" in data else None
    desc = data.get("desc") if "desc" in data else None
    aliases = data.get("aliases") if "aliases" in data else None
    if store.update_character(char_id, name, desc, aliases) is None:
        return fail("人物不存在")
    return ok(characters=[character_json(c) for c in store.characters()])


@app.delete("/api/characters/<char_id>")
def api_delete_character(char_id: str):
    store.delete_character(char_id)
    return ok(characters=[character_json(c) for c in store.characters()])


@app.post("/api/characters/<char_id>/images/<slot>")
def api_upload_character_image(char_id: str, slot: str):
    if slot not in ("front", "side", "back"):
        return fail("图片位置错误")
    if store.get_character(char_id) is None:
        return fail("人物不存在")
    file = request.files.get("file")
    if file is None or not file.filename:
        return fail("没有收到文件")
    tmp_dir = config.path("data", "uploads")
    os.makedirs(tmp_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    tmp = os.path.join(tmp_dir, f"char_{int(time.time() * 1000)}_{slot}{ext}")
    file.save(tmp)
    try:
        dst = store.local_copy(tmp, "image", prefix=f"char_{slot}")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    store.set_character_image(char_id, slot, dst)
    return ok(characters=[character_json(c) for c in store.characters()])


@app.delete("/api/characters/<char_id>/images/<slot>")
def api_delete_character_image(char_id: str, slot: str):
    if slot not in ("front", "side", "back"):
        return fail("图片位置错误")
    store.set_character_image(char_id, slot, None)
    return ok(characters=[character_json(c) for c in store.characters()])


@app.post("/api/settings/bgm")
def api_upload_bgm():
    file = request.files.get("file")
    if file is None or not file.filename:
        return fail("没有收到文件")
    tmp_dir = config.path("data", "uploads")
    os.makedirs(tmp_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() or ".mp3"
    tmp = os.path.join(tmp_dir, f"bgm_{int(time.time())}{ext}")
    file.save(tmp)
    dst = store.local_copy(tmp, "audio", prefix="bgm")
    try:
        os.remove(tmp)
    except OSError:
        pass
    rel = os.path.relpath(dst, store.data_dir).replace("\\", "/")
    store.update_settings({"bgm": os.path.join("data", rel.replace("/", os.sep))})
    return ok(settings=store.settings)


@app.delete("/api/settings/bgm")
def api_delete_bgm():
    store.update_settings({"bgm": None})
    return ok(settings=store.settings)


# ---------------------------------------------------------------------- 生成
def _run(handler, *args, **kwargs):
    try:
        handler(*args, **kwargs)
        return ok()
    except UserError as exc:
        return fail(str(exc))
    except Exception as exc:  # pragma: no cover
        log.error(f"执行失败：{exc}")
        return fail(str(exc), 500)


@app.post("/api/scan/images")
def api_scan_images():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    return _run(center.scan_current_images, url)


@app.post("/api/scan/videos")
def api_scan_videos():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    return _run(center.scan_current_videos, url)


@app.post("/api/generate/images")
def api_gen_images():
    return _run(center.run_images)


@app.post("/api/generate/images/<row_id>")
def api_gen_image_one(row_id: str):
    return _run(center.run_image_one, row_id)


@app.post("/api/generate/audios")
def api_gen_audios():
    return _run(center.run_audios)


@app.post("/api/generate/audios/<row_id>")
def api_gen_audio_one(row_id: str):
    return _run(center.run_audio_one, row_id)


@app.post("/api/generate/videos")
def api_gen_videos():
    return _run(center.run_videos)


@app.post("/api/generate/episodes")
def api_gen_episodes():
    return _run(center.run_episodes)


@app.post("/api/generate/videos/<row_id>")
def api_gen_video_one(row_id: str):
    return _run(center.run_video_one, row_id)


@app.post("/api/stitch")
def api_stitch():
    return _run(center.run_stitch)


@app.post("/api/run")
def api_run_all():
    return _run(center.run_all)


@app.post("/api/stop")
def api_stop():
    center.stop()
    return ok()


# ---------------------------------------------------------------------- 浏览器
@app.post("/api/browser/start")
def api_browser_start():
    center.start_browser()
    return ok()


@app.post("/api/browser/stop")
def api_browser_stop():
    center.browser.stop()
    return ok()


@app.get("/api/browser/status")
def api_browser_status():
    return ok(browser=center.browser.status())


@app.get("/api/debug/dom")
def api_debug_dom():
    """排查选择器是否失效：返回关键元素命中数量。"""
    try:
        from selenium.webdriver.common.by import By
        browser = center.browser
        browser.ensure_started()
        browser._ensure_tab("doubao", config.get("doubao_url"))
        checks = {
            "chat_input": "//div[@data-testid='chat_input_input']",
            "textarea": "//textarea",
            "contenteditable": "//div[@contenteditable='true']",
            "send_button": "//*[@id='flow-end-msg-send']",
            "receive_message": "//div[@data-testid='receive_message']",
            "mdbox_image": "//div[@data-testid='mdbox_image']//img",
            "login_text": "//*[contains(text(),'登录')]",
        }
        counts = {}
        for key, xpath in checks.items():
            try:
                counts[key] = len(browser.driver.find_elements(By.XPATH, xpath))
            except Exception as exc:
                counts[key] = f"err:{exc}"
        body = ""
        try:
            body = browser.driver.find_element(By.TAG_NAME, "body").text[:300]
        except Exception:
            pass
        node = {}
        try:
            el = browser.driver.find_element(By.XPATH, "//div[@data-testid='chat_input_input']")
            node = {
                "tag": el.tag_name,
                "contenteditable": el.get_attribute("contenteditable"),
                "role": el.get_attribute("role"),
                "class": (el.get_attribute("class") or "")[:120],
                "html": (el.get_attribute("outerHTML") or "")[:700],
            }
        except Exception as exc:
            node = {"error": str(exc)[:120]}
        return ok(url=browser.driver.current_url, title=browser.driver.title,
                  counts=counts, body=body, node=node)
    except Exception as exc:
        return fail(f"诊断失败：{exc}")


@app.get("/api/debug/scan")
def api_debug_scan():
    """排查「从会话取图」：看消息列表能不能滚动、当前渲染了多少楼层和图片。"""
    try:
        from selenium.webdriver.common.by import By
        browser = center.browser
        if not browser.status().get("connected"):
            browser.ensure_started(check_cancel=False)
        browser._use_existing_doubao_tab()
        info = {"url": browser.driver.current_url,
                "blocks": len(browser.driver.find_elements(By.XPATH, "//div[@data-testid='receive_message']"))}
        box = browser._scroll_box()
        if box is None:
            info["scroller"] = None
        else:
            state = browser.driver.execute_script(
                "return [arguments[0].scrollTop, arguments[0].clientHeight,"
                " arguments[0].scrollHeight, arguments[0].className];", box)
            info["scroller"] = {"top": state[0], "client": state[1],
                                "total": state[2], "class": str(state[3])[:120]}
        info["images"] = len(browser._collect_urls(0))
        info["expected"] = browser._expected_image_count()
        if request.args.get("run"):
            rows = store.rows_with_text()
            urls = browser.scan_images("", expected=len(rows))
            info["rows"] = len(rows)
            info["scanned"] = len(urls)
            info["head"] = [u[:90] for u in urls[:3]]
        return ok(**info)
    except Exception as exc:
        return fail(f"诊断失败：{exc}")


@app.post("/api/output/open")
def api_open_output():
    folder = config.path("data", "output")
    os.makedirs(folder, exist_ok=True)
    try:
        if os.name == "nt":
            os.startfile(folder)  # type: ignore[attr-defined]
        elif os.name == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])
        return ok()
    except Exception as exc:
        return fail(f"打开文件夹失败：{exc}")


@app.post("/api/config")
def api_config():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return fail("参数错误")
    config.set_many(data)
    return ok(config={k: config.get(k) for k in data.keys()})


@app.get("/api/config")
def api_get_config():
    return ok(config={
        "chrome_path": config.get("chrome_path"),
        "chrome_debug_port": config.get("chrome_debug_port"),
        "video_auto_enabled": config.get("video_auto_enabled"),
        "video_one_shot": config.get("video_one_shot"),
        "tts_model": config.get("tts_model"),
        "has_api_key": bool(config.get("dashscope_api_key")),
    })


def _already_running(url: str) -> bool:
    """检测端口上是否已经有本程序在跑（避免重复启动端口冲突）。"""
    try:
        import urllib.request
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url + "/api/state", timeout=2) as resp:
            body = resp.read(200)
            return resp.status == 200 and b"settings" in body
    except Exception:
        return False


def _cleanup_temp() -> None:
    """清掉上次被强行中断时残留的合成临时目录。"""
    out_dir = config.path("data", "output")
    if not os.path.isdir(out_dir):
        return
    now = time.time()
    for name in os.listdir(out_dir):
        if not name.startswith("_tmp_"):
            continue
        path = os.path.join(out_dir, name)
        try:
            if now - os.path.getmtime(path) > 3600:
                shutil.rmtree(path, ignore_errors=True)
        except OSError:
            pass


def _tee_log() -> None:
    """把控制台输出同时写入 _server.log，窗口最小化或关掉后仍能查错。"""
    path = os.path.join(config.root, "_server.log")
    try:
        fp = open(path, "a", encoding="utf-8", buffering=1)
    except OSError:
        return

    # 后台运行时 stdout 是管道，父进程不读就会把管道写满并卡死请求，所以只在真控制台下回显
    console = None
    try:
        raw = sys.__stdout__
        if raw is not None and hasattr(raw, "isatty") and raw.isatty():
            console = raw
    except Exception:
        console = None

    class _Tee:
        def __init__(self, echoes):
            self.echoes = echoes

        def write(self, text):
            for stream in self.echoes:
                try:
                    stream.write(text)
                    stream.flush()
                except Exception:
                    pass
            return len(text)

        def flush(self):
            for stream in self.echoes:
                try:
                    stream.flush()
                except Exception:
                    pass

    tee = _Tee(([console] if console is not None else []) + [fp])
    sys.stdout = tee
    sys.stderr = tee


def bootstrap() -> None:
    host = config.get("host") or "127.0.0.1"
    port = int(config.get("port") or 8848)
    url = f"http://{host}:{port}"
    _tee_log()
    _cleanup_temp()
    if _already_running(url):
        print(f"服务已在运行：{url}（已为你打开页面）")
        webbrowser.open(url)
        return
    log.ok(f"服务已启动：{url}")
    if config.get("open_browser_on_start", True):
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        app.run(host=host, port=port, threaded=True, use_reloader=False)
    except OSError as exc:
        print(f"\n[启动失败] 端口 {port} 无法监听：{exc}")
        print("可能是端口被占用，或上一个服务没退干净。")
        raise SystemExit(1)


if __name__ == "__main__":
    bootstrap()
