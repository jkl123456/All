"""任务编排：生图 / 配音 / 生视频 / 拼接。"""

from __future__ import annotations

import os
import re
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor

from .browser import BrowserError, BrowserManager, GenerationCancelled, QuotaError
from .stitch import Stitcher, StitchError
from .tts import TTS, TTSError


class UserError(Exception):
    pass


def _safe_name(text: str, fallback: str = "成片") -> str:
    text = re.sub(r"[\\/:*?\"<>|\r\n\t]", "", str(text or "")).strip()
    return text[:40] or fallback


class TaskCenter:
    def __init__(self, config, state, log) -> None:
        self.config = config
        self.state = state
        self.log = log
        self.browser = BrowserManager(config, log)
        self.tts = TTS(config, log)
        self.stitcher = Stitcher(config, log)

        self.lock = threading.RLock()
        self.runtime: dict[str, dict] = {}
        self.busy = {"running": False, "progress": 0.0, "label": ""}
        self.browser_task = {"running": False, "kind": "", "started": 0.0}
        self.cancel_event = threading.Event()
        self.browser_gate = threading.Lock()
        self.audio_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="tts")
        self._episode_watch = False
        self._episode_interrupts = 0
        self._episode_paused = False
        self._quota_paused = False
        self._quota_group: dict | None = None
        # 本次运行里已经提交过视频的行（重启后清空，每集重新提交人物设定 + 文案）
        self._submitted_rows: set[str] = set()

    # ------------------------------------------------------------------ 状态
    def _status(self, row_id: str, kind: str, state: str, msg: str = "") -> None:
        with self.lock:
            row_status = self.runtime.setdefault(row_id, {})
            row_status[kind] = {"state": state, "msg": msg, "ts": time.time()}

    def _status_all(self, rows: list[dict], kind: str, state: str, msg: str = "") -> None:
        for row in rows:
            self._status(row["id"], kind, state, msg)

    def _settle_running(self, rows: list[dict], state: str, msg: str) -> None:
        """把仍处于 running 的素材状态收尾，避免界面一直转圈。"""
        with self.lock:
            for row in rows:
                kinds = self.runtime.get(row["id"]) or {}
                for kind in ("image", "video", "audio"):
                    if (kinds.get(kind) or {}).get("state") == "running":
                        self._status(row["id"], kind, state, msg)

    def snapshot(self) -> dict:
        with self.lock:
            data = {
                "rows": {rid: dict(kinds) for rid, kinds in self.runtime.items()},
                "global": dict(self.busy),
                "task": dict(self.browser_task),
            }
        # 浏览器探活在锁外做，避免拖慢状态接口
        data["browser"] = self.browser.status()
        return data

    def clear_runtime(self) -> None:
        with self.lock:
            self.runtime.clear()

    def stop(self) -> None:
        self.cancel_event.set()
        self.browser.cancel()
        self.busy["label"] = "正在停止…"
        self.log.warn("收到停止指令，正在中断当前任务…")

    # ------------------------------------------------------------- 浏览器任务锁
    def _begin_browser_task(self, kind: str) -> None:
        """占用浏览器（同一时刻只允许一个浏览器任务），被占用时直接报错。"""
        with self.lock:
            if self.browser_task["running"]:
                raise UserError(
                    f"「{self.browser_task['kind']}」正在进行中，请先点「停止任务」再重试")
            if self.busy.get("running"):
                raise UserError("已有任务正在执行，请先点「停止任务」")
            self.browser_task.update({"running": True, "kind": kind, "started": time.time()})
        self.cancel_event.clear()
        self.browser.cancel_event.clear()

    def _end_browser_task(self) -> None:
        with self.lock:
            self.browser_task.update({"running": False, "kind": "", "started": 0.0})

    # ------------------------------------------------------------------ 浏览器
    def start_browser(self) -> None:
        def work():
            try:
                self.log.info("正在准备自动化浏览器…")
                self.browser.ensure_started(check_cancel=False)
                self.browser_open_doubao()
                self.log.ok("自动化浏览器就绪，若未登录请在窗口内完成登录")
            except BrowserError as exc:
                self.log.error(str(exc))
            except Exception as exc:  # pragma: no cover
                self.log.error(f"启动浏览器失败：{exc}")

        threading.Thread(target=work, daemon=True).start()

    def browser_open_doubao(self) -> None:
        with self.browser_gate:
            self.browser.ensure_started(check_cancel=False)
            self.browser._keep_single_window()  # 浏览器里只保留一个窗口，避免越开越多
            if self.browser.focus_existing_chat():
                return
            chat = str(self.state.settings.get("chatUrl") or "").strip()
            if "doubao.com/chat/" not in chat:
                chat = self.browser.guess_last_chat()
                if chat:
                    self.state.update_settings({"chatUrl": chat})
                    self.log.info(f"按上次使用的对话打开：{chat}")
            target = chat or (self.config.get("doubao_url") or "")
            self.browser.open_in_current_tab(target)

    # ------------------------------------------------------------------ 生图
    ASPECTS = {
        "1080x1920": "9:16（竖屏）",
        "1920x1080": "16:9（横屏）",
        "1080x1080": "1:1（方形）",
    }

    def _aspect(self) -> str:
        return self.ASPECTS.get(str(self.state.settings.get("canvas") or ""), "9:16（竖屏）")

    def _chat_target(self) -> str:
        """批量生图要回到的豆包会话；沿用同一会话便于追溯和追加修改。"""
        if not bool(self.state.settings.get("reuseChat", True)):
            return ""
        url = str(self.state.settings.get("chatUrl") or "").strip()
        return url if "doubao.com/chat/" in url else ""

    def _want_fresh_chat(self) -> bool:
        """还没绑定会话（新任务）且开了「每次生成前新开对话」时，必须开新会话。"""
        return bool(self.state.settings.get("freshChat", True)) and not self._chat_target()

    def _remember_chat(self) -> None:
        """把当前所在的豆包会话记下来，下次取图/重新生成直接用。"""
        try:
            current = self.browser.driver.current_url or ""
        except Exception:
            return
        if "doubao.com/chat/" not in current:
            return
        if current != str(self.state.settings.get("chatUrl") or ""):
            self.state.update_settings({"chatUrl": current})
            self.log.info(f"已记住本次会话：{current}")

    def _video_no_image(self) -> bool:
        """勾选后不再要求先生成图片，直接用文案 + 人物设定生成视频。"""
        return bool(self.state.settings.get("videoNoImage"))

    def _video_seconds(self) -> int:
        try:
            value = int(float(self.state.settings.get("videoSeconds") or 10))
        except (TypeError, ValueError):
            value = 10
        return max(2, min(60, value))

    # ---------------------------------------------------------- 人物设定
    @staticmethod
    def _character_words(item: dict) -> list[str]:
        """名字 + 别名（逗号分隔），用于在文案里匹配。"""
        words = [(item.get("name") or "").strip()]
        raw = str(item.get("aliases") or "").replace("，", ",").replace("、", ",")
        words += [w.strip() for w in raw.split(",")]
        return [w for w in words if w]

    def _characters_in(self, text: str) -> list[dict]:
        """文案里出现了哪些人物；名字/别名一起匹配，长词优先。"""
        raw = text or ""
        remaining = raw
        result: list[dict] = []
        candidates = []
        for item in self.state.characters():
            words = self._character_words(item)
            if words:
                candidates.append((item, words))
        candidates.sort(key=lambda pair: max(len(w) for w in pair[1]), reverse=True)
        for item, words in candidates:
            hit = ""
            for word in sorted(words, key=len, reverse=True):
                if word in remaining:
                    hit = word
                    break
            if not hit:
                continue
            result.append(item)
            remaining = remaining.replace(hit, "　")
        return result

    def _batch_characters(self, texts: list[str]) -> list[dict]:
        """整批（一集）里出现过的所有角色，按首次出现的顺序。"""
        seen: set[str] = set()
        result: list[dict] = []
        for text in texts:
            for item in self._characters_in(text):
                key = item.get("id") or item.get("name") or ""
                if key and key not in seen:
                    seen.add(key)
                    result.append(item)
        return result

    def _character_refs_of(self, chars: list[dict]) -> list[str]:
        paths: list[str] = []
        for item in chars:
            view = item.get("front") or item.get("side") or item.get("back")
            path = self.state.abs_media(view)
            if path and os.path.exists(path) and path not in paths:
                paths.append(path)
        return paths

    def _character_refs(self, texts: list[str]) -> list[str]:
        """整批文案命中的角色三视图（一张图含正/侧/背，去重保序）。"""
        return self._character_refs_of(self._batch_characters(texts))

    @staticmethod
    def _character_block(chars: list[dict]) -> str:
        lines = []
        for item in chars:
            name = (item.get("name") or "").strip()
            desc = (item.get("desc") or "").strip()
            view = item.get("front") or item.get("side") or item.get("back")
            line = f"人物 @{name}"
            if view:
                line += (f"（三视图参考图 @{os.path.basename(view)}，"
                         f"同一张图包含正面、侧面、背面）")
            if desc:
                line += f"：{desc}"
            lines.append(line)
        return "\n".join(lines)

    def _image_prompt_batch(self, texts: list[str], style: str) -> str:
        n = len(texts)
        info = self._character_block(self._batch_characters(texts))
        blocks = []
        for i, text in enumerate(texts):
            block = f"第{i + 1}张图：{text}"
            if info:
                block += (f"\n　人物设定（本集出现的人物，参照上传的三视图保持同一外观）："
                          f"{info}")
            blocks.append(block)
        lines = "\n".join(blocks)
        tail = f"{style}\n" if style else ""
        head = ""
        if info:
            head = ("另外上传的图片是人物三视图（正面/侧面/背面）参考图，不是要生成的分镜画面；"
                    "生成时请保持人物的长相、发型、服装前后一致。\n")
        return (
            f"请严格按照下面的要求，为我生成{n}张图片，每张图片对应一个段落的描述。\n"
            f"画面比例：{self._aspect()}，请按该比例出图。\n"
            f"{head}{tail}\n{lines}\n\n"
            f"要求：共 {n} 张，画面比例 {self._aspect()}，画面风格统一、画质清晰、构图完整；"
            f"直接输出图片，不要输出多余解释文字。"
        )

    def _image_prompt_single(self, text: str, style: str) -> str:
        tail = f"{style}\n" if style else ""
        info = self._character_block(self._characters_in(text))
        head = ""
        if info:
            head = ("上传的图片是人物三视图参考图，不是要生成的分镜画面；"
                    "请保持人物长相、发型、服装一致。\n"
                    f"人物设定：{info}\n")
        return (
            f"请根据下面的段落描述，生成 1 张配图。\n"
            f"画面比例：{self._aspect()}，请按该比例出图。\n"
            f"{head}{tail}\n段落：{text}\n\n"
            f"要求：画面比例 {self._aspect()}，画面完整、画质清晰；直接输出图片，不要输出多余解释文字。"
        )

    # ------------------------------------------------------------- 自愈辅助
    FATAL_HINTS = ("次数已用完", "额度不足", "余额不足", "未登录", "请登录", "违规", "不支持该")

    def _retry_verdict(self, kind: str, prompt: str, reply_text: str,
                       attempt: int, max_attempts: int) -> tuple[bool, str]:
        """让 AI 判断还能不能重试，返回 (是否重试, 追加提示)。"""
        text = reply_text or ""
        for hint in self.FATAL_HINTS:
            if hint in text:
                self.log.error(f"豆包提示「{hint}」，不再重试")
                return False, ""

        decision = self.browser.ai.judge_failure(kind, prompt, text, attempt, max_attempts)
        action = str(decision.get("action") or "retry").lower()
        reason = str(decision.get("reason") or "")[:120]
        hint = str(decision.get("hint") or "").strip()
        if action == "abort":
            self.log.error(f"AI 判断不再重试：{reason}")
            return False, ""
        self.log.warn(f"AI 判断可以重试：{reason}")
        return True, hint

    def _generate_image_with_retry(self, text: str, out_dir: str) -> str | None:
        """单张出图，失败时按 AI 建议重试（调用方需已持有 browser_gate）。"""
        style = (self.state.settings.get("imageStyle") or "").strip()
        prompt = self._image_prompt_single(text, style)
        refs = self._character_refs([text])
        attempts = max(1, int(self.config.get("max_auto_retries") or 2))

        for attempt in range(1, attempts + 1):
            if self.cancel_event.is_set():
                return None
            try:
                paths = self.browser.generate_images(
                    prompt, out_dir, count=1, refs=refs, fresh=self._want_fresh_chat(),
                    chat_url=self._chat_target())
                if paths:
                    return paths[0]
                error = "豆包没有返回图片"
            except GenerationCancelled:
                raise
            except Exception as exc:
                error = str(exc)

            self.log.warn(f"补图第 {attempt}/{attempts} 次失败：{error[:100]}")
            if attempt >= attempts:
                break
            ok, hint = self._retry_verdict("图片", prompt, self.browser._last_reply_text(),
                                           attempt, attempts)
            if not ok:
                break
            if hint:
                prompt = prompt + f"\n补充要求：{hint}"
                self.log.info(f"按 AI 建议调整提示：{hint}")
            time.sleep(2)
        return None

    def _use_pipeline(self, targets: list[dict]) -> bool:
        engine = str(self.config.get("video_engine") or "doubao").lower()
        return bool(self.config.get("video_pipeline", True)) and len(targets) > 1 and engine == "doubao"

    def _videos_pipelined(self, targets: list[dict],
                          context_rows: list[dict] | None = None,
                          segments: list[int] | None = None) -> int:
        """一次性提交全部视频任务，再统一收片（调用方需已持有 browser_gate）。

        segments 是这些分镜在整集里的原始段号（例如只补第 3~6 段时就是 3,4,5,6）。
        """
        no_image = self._video_no_image()
        # 按「一集」为单位确定本批涉及的人物，整批每一段都带上
        pending = []
        for idx, row in enumerate(targets):
            current = self.state.get_row(row["id"]) or row
            segment = segments[idx] if segments and idx < len(segments) else idx + 1
            pending.append((segment, row, current, (current.get("text") or "").strip()))
        # 人物按「整集」算：某一集里前几段已生成时，人物信息也不能丢
        char_texts = [(r.get("text") or "").strip()
                      for r in (context_rows or targets)]
        batch_chars = self._batch_characters(char_texts)
        batch_names = [c.get("name") or "" for c in batch_chars
                       if (c.get("name") or "").strip()]
        batch_block = self._character_block(batch_chars)
        batch_images = self._character_refs_of(batch_chars)
        if batch_names:
            self.log.info(f"本批涉及人物：{'、'.join(batch_names)}（三视图 {len(batch_images)} 张）")

        prepared = []
        for segment, row, current, text in pending:
            image_abs = self.state.abs_media(current.get("image"))
            if not image_abs or not os.path.exists(image_abs):
                if not no_image:
                    self._status(row["id"], "video", "error", "缺图片")
                    continue
                image_abs = ""
            prepared.append({
                "key": row["id"],
                "segment": segment,
                "text": text,
                "char_names": batch_names,
                "char_block": batch_block,
                "char_images": batch_images,
                "image": image_abs,
                "aspect": self._aspect(),
                "seconds": self._video_seconds(),
            })
        if not prepared:
            return 0

        for item in prepared:
            self._status(item["key"], "video", "running", "排队中")

        def on_event(kind: str, key: str, done: int, total: int, path: str = "") -> None:
            if kind == "submitted":
                self._submitted_rows.add(key)
                self._status(key, "video", "running", f"已提交（{done}/{total}）")
            elif kind == "skipped":
                self._status(key, "video", "error", "未提交（前一条未进入生成）")
            else:
                # 收到一个就立刻回填，右侧分镜马上能看到封面、能播放
                if path:
                    self.state.set_media(key, "video", path)
                self._status(key, "video", "done", "已生成")
            if kind != "skipped":
                self.busy["label"] = f"视频 {done}/{total}"

        videos_dir = self.config.path("data", "videos")
        oneshot = bool(self.config.get("video_one_shot", True)) and len(prepared) > 1
        if oneshot:
            self.log.info(
                f"{len(prepared)} 条视频尝试一次性提交：{len(prepared)} 张图一起上传，"
                f"一条文案按 @文件名 分段")
            assigned = self.browser.run_video_batch_oneshot(
                prepared, videos_dir, on_event=on_event, chat_url=self._chat_target())
            self._remember_chat()
            missing = [it for it in prepared if it["key"] not in assigned]
            if missing and not assigned:
                self.log.warn(f"一条视频都没拿到，改为逐条提交（共 {len(missing)} 条）")
                more = self.browser.run_video_batch(
                    missing, videos_dir, on_event=on_event, chat_url=self._chat_target())
                self._remember_chat()
                assigned.update(more)
            elif missing:
                self.log.warn(
                    f"{len(missing)} 条视频没回来，已按「催更」方式处理，不再逐条单独补；"
                    f"需要的话可以稍后重试")
        else:
            assigned = self.browser.run_video_batch(
                prepared, videos_dir, on_event=on_event, chat_url=self._chat_target())
            self._remember_chat()
        for key, path in assigned.items():
            self.state.set_media(key, "video", path)
        for item in prepared:
            if item["key"] in assigned:
                continue
            current = (self.runtime.get(item["key"]) or {}).get("video") or {}
            if current.get("state") not in ("error", "cancelled"):
                self._status(item["key"], "video", "error", "等待超时，可单条重试")
        return len(assigned)

    def _generate_video_with_retry(self, row: dict, out_dir: str) -> str:
        """单条视频生成，失败按 AI 建议重试（调用方需已持有 browser_gate）。"""
        current = self.state.get_row(row["id"]) or row
        image_abs = self.state.abs_media(current.get("image"))
        if not image_abs or not os.path.exists(image_abs):
            if not self._video_no_image():
                raise UserError("缺图片")
            image_abs = ""
        text = (current.get("text") or "").strip()
        char_block = self._character_block(self._characters_in(text))
        if char_block:
            text += f"\n人物设定（保持同一人物外观）：{char_block}"
        attempts = max(1, int(self.config.get("max_auto_retries") or 2))
        last_error = ""

        for attempt in range(1, attempts + 1):
            if self.cancel_event.is_set():
                raise GenerationCancelled("已取消")
            try:
                path = self.browser.generate_video(
                    text, image_abs, out_dir, aspect=self._aspect(),
                    seconds=self._video_seconds(), chat_url=self._chat_target())
                self._remember_chat()
                return path
            except GenerationCancelled:
                raise
            except Exception as exc:
                last_error = str(exc)
            self.log.warn(f"视频第 {attempt}/{attempts} 次失败：{last_error[:120]}")
            if attempt >= attempts:
                break
            ok, hint = self._retry_verdict("视频", text, self.browser._last_reply_text(),
                                           attempt, attempts)
            if not ok:
                break
            if hint:
                text = text + f"\n补充要求：{hint}"
                self.log.info(f"按 AI 建议调整视频提示：{hint}")
            time.sleep(3)
        raise BrowserError(last_error or "视频生成失败")

    def _batch_images(self, targets: list[dict]) -> int:
        """批量出图 + 数量不足时自动单张补齐（调用方需已持有 browser_gate）。"""
        if not targets:
            return 0
        style = (self.state.settings.get("imageStyle") or "").strip()
        texts = [(r.get("text") or "").strip() for r in targets]
        prompt = (self._image_prompt_single(texts[0], style) if len(targets) == 1
                  else self._image_prompt_batch(texts, style))
        out_dir = self.config.path("data", "images")
        refs = self._character_refs(texts)
        if refs:
            self.log.info(f"文案命中人物设定，带入 {len(refs)} 张三视图作为参考")
        self._status_all(targets, "image", "running", "生成中")

        paths: list[str] = []
        fatal = False
        try:
            paths = self.browser.generate_images(
                prompt, out_dir, count=len(targets), refs=refs,
                fresh=self._want_fresh_chat(),
                chat_url=self._chat_target())
            self._remember_chat()
        except GenerationCancelled:
            raise
        except Exception as exc:
            self.log.error(f"批量生图失败：{str(exc)[:150]}")
            ok, _ = self._retry_verdict("图片", prompt, self.browser._last_reply_text(), 1, 2)
            fatal = not ok

        for idx, row in enumerate(targets):
            if idx < len(paths):
                self.state.set_media(row["id"], "image", paths[idx])
                self._status(row["id"], "image", "done", "已生成")

        done = min(len(paths), len(targets))
        auto_fill = bool(self.config.get("auto_fill_images", False))
        if done < len(targets):
            if auto_fill:
                self.log.warn(f"本轮只拿到 {done}/{len(targets)} 张图片，开始在当前对话里补齐…")
            else:
                self.log.warn(
                    f"本轮只拿到 {done}/{len(targets)} 张图片，按要求先留空（不新开对话补图）；"
                    f"需要补图可单独点某行的「生成」")

        for i, row in enumerate(targets[done:], 1):
            if self.cancel_event.is_set():
                raise GenerationCancelled("已取消")
            current = self.state.get_row(row["id"]) or row
            if current.get("image"):
                # 这行本来就有图（可能是上一轮生成的），别把状态挂在“生成中”
                self._status(row["id"], "image", "done", "已就绪")
                continue
            if fatal:
                self._status(row["id"], "image", "error", "批量失败且不建议重试")
                continue
            if not auto_fill:
                self._status(row["id"], "image", "error", "未检测到图片（已留空）")
                continue
            self._status(row["id"], "image", "running", f"补生成 {i}/{len(targets) - done}")
            self.log.info(f"补齐配图 {i}/{len(targets) - done}…")
            path = self._generate_image_with_retry((current.get("text") or "").strip(), out_dir)
            if path:
                self.state.set_media(row["id"], "image", path)
                self._status(row["id"], "image", "done", "已生成")
                done += 1
            else:
                self._status(row["id"], "image", "error", "重试后仍未生成")

        if done >= len(targets):
            self.log.ok(f"配图完成，共 {done} 张")
        return done

    def scan_current_images(self, chat_url: str = "") -> None:
        """把当前豆包对话里已经生成的图片读回来，不重新生成。

        一个会话就是一批任务：每次都从对话开头滚到底部重新收集，
        数量对不上时浏览器端会自动再滚一遍并让 AI 判断是否漏扫。
        """
        rows = self.state.rows_with_text()
        if not rows:
            raise UserError("还没有分镜，请先导入文案")
        self._begin_browser_task("读取对话图片")

        def work():
            try:
                with self.browser_gate:
                    urls = self.browser.scan_images(chat_url, expected=len(rows))
                    if not urls:
                        # 扫不到图时不动现有配图，避免误伤已经生成好的素材
                        self.log.warn("当前对话里没有检测到图片；现有配图保持不变")
                        return
                    picked = urls[-len(rows):] if len(urls) > len(rows) else urls
                    if len(urls) > len(rows):
                        self.log.info(f"对话里有 {len(urls)} 张图，取最后 {len(rows)} 张依次匹配")
                    elif len(urls) < len(rows):
                        self.log.warn(f"对话里只有 {len(urls)} 张图（分镜 {len(rows)} 条），只填前 {len(urls)} 行，其余保留原图")
                    out_dir = self.config.path("data", "images")
                    paths = self.browser._download_images(picked, out_dir)
                    missing: list[int] = []
                    for idx, row in enumerate(rows):
                        if idx < len(paths):
                            self.state.set_media(row["id"], "image", paths[idx])
                            self._status(row["id"], "image", "done", "已从对话读取")
                        elif not (self.state.get_row(row["id"]) or {}).get("image"):
                            missing.append(idx + 1)
                            self._status(row["id"], "image", "error", "对话图片数量不足")
                    self.log.ok(f"已从对话读取 {len(paths)} 张图")
                    if missing:
                        self.log.warn(
                            f"第 {'、'.join(str(n) for n in missing)} 行没取到图"
                            f"（对话里图片只有 {len(paths)} 张），可单独点「生成」补")
                    try:
                        current = self.browser.driver.current_url or ""
                        if "doubao.com/chat/" in current:
                            self.state.update_settings({"chatUrl": current})
                    except Exception:
                        pass
            except GenerationCancelled:
                self.log.warn("已取消读取对话图片")
            except Exception as exc:
                self.log.error(f"读取对话图片失败：{exc}")
                self._status_all(rows, "image", "error", str(exc)[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    def scan_current_videos(self, chat_url: str = "") -> None:
        """把当前豆包对话里已经生成的视频读回来，不重新生成。

        以最后一条「我一次性上传了 N 张图片…」为起点往后找视频，
        按顺序回填到分镜；数量不足时只填前几行，其余保持原样。
        """
        rows = self.state.rows_with_text()
        if not rows:
            raise UserError("还没有分镜，请先导入文案")
        if not self.config.get("video_auto_enabled"):
            raise UserError("请先勾选左侧「视频模式用豆包自动生成视频」")
        self._begin_browser_task("读取对话视频")

        def work():
            try:
                with self.browser_gate:
                    urls = self.browser.scan_videos(chat_url, expected=len(rows))
                    if not urls:
                        self.log.warn("当前对话里没有找到视频；现有视频保持不变")
                        return
                    picked = urls[-len(rows):] if len(urls) > len(rows) else urls
                    if len(urls) > len(rows):
                        self.log.info(
                            f"对话里有 {len(urls)} 个视频，取最后 {len(rows)} 个依次匹配")
                    elif len(urls) < len(rows):
                        self.log.warn(
                            f"对话里只有 {len(urls)} 个视频（分镜 {len(rows)} 条），"
                            f"只填前 {len(urls)} 行，其余保留原视频")
                    out_dir = self.config.path("data", "videos")
                    paths = self.browser._download_videos(picked, out_dir)
                    missing: list[int] = []
                    for idx, row in enumerate(rows):
                        if idx < len(paths):
                            self.state.set_media(row["id"], "video", paths[idx])
                            self._status(row["id"], "video", "done", "已从对话读取")
                        elif not (self.state.get_row(row["id"]) or {}).get("video"):
                            missing.append(idx + 1)
                            self._status(row["id"], "video", "error", "对话视频数量不足")
                    self.log.ok(f"已从对话读取 {len(paths)} 个视频")
                    if missing:
                        self.log.warn(
                            f"第 {'、'.join(str(n) for n in missing)} 行没取到视频"
                            f"（对话里只有 {len(paths)} 个）")
                    try:
                        current = self.browser.driver.current_url or ""
                        if "doubao.com/chat/" in current:
                            self.state.update_settings({"chatUrl": current})
                    except Exception:
                        pass
            except GenerationCancelled:
                self.log.warn("已取消读取对话视频")
            except Exception as exc:
                self.log.error(f"读取对话视频失败：{exc}")
                self._status_all(rows, "video", "error", str(exc)[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    def run_images(self, rows: list[dict] | None = None) -> None:
        rows = rows or self.state.rows_with_text()
        if not rows:
            raise UserError("还没有文案，请先在右侧导入分镜")
        self._begin_browser_task("批量生图")

        def work():
            try:
                with self.browser_gate:
                    self._batch_images(rows)
            except GenerationCancelled:
                self._status_all(rows, "image", "cancelled", "已取消")
                self.log.warn("已取消批量生图，现在可以重新点击「批量生图」")
            except Exception as exc:
                msg = str(exc)
                self.log.error(f"生图失败：{msg}")
                self._status_all(rows, "image", "error", msg[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    def run_image_one(self, row_id: str) -> None:
        row = self.state.get_row(row_id)
        if not row or not (row.get("text") or "").strip():
            raise UserError("该分镜没有文案")
        self._begin_browser_task("单张生图")

        def work():
            try:
                with self.browser_gate:
                    self._status(row_id, "image", "running", "生成中")
                    out_dir = self.config.path("data", "images")
                    path = self._generate_image_with_retry((row.get("text") or "").strip(), out_dir)
                    if not path:
                        raise BrowserError("重试后仍未拿到图片")
                    self.state.set_media(row_id, "image", path)
                    self._remember_chat()
                    self._status(row_id, "image", "done", "已生成")
                    self.log.ok("单张配图已生成")
            except GenerationCancelled:
                self._status(row_id, "image", "cancelled", "已取消")
                self.log.warn("已取消生图")
            except Exception as exc:
                self.log.error(f"生图失败：{exc}")
                self._status(row_id, "image", "error", str(exc)[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------------ 配音
    def _do_audio(self, row: dict) -> bool:
        row_id = row["id"]
        text = (row.get("text") or "").strip()
        if not text:
            self._status(row_id, "audio", "error", "无文案")
            return False
        self._status(row_id, "audio", "running", "配音中")
        try:
            settings = self.state.settings
            out = os.path.join(self.config.path("data", "audios"),
                               f"aud_{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:5]}.mp3")
            self.tts.synthesize(
                text, out,
                voice=settings.get("voice"),
                speed=settings.get("speed"),
                volume=settings.get("volume"),
            )
            self.state.set_media(row_id, "audio", out)
            self._status(row_id, "audio", "done", "已生成")
            return True
        except (TTSError, Exception) as exc:
            self.log.error(f"配音失败：{exc}")
            self._status(row_id, "audio", "error", str(exc)[:120])
            return False

    def run_audios(self, rows: list[dict] | None = None) -> None:
        rows = rows or self.state.rows_with_text()
        if not rows:
            raise UserError("还没有文案，请先导入分镜")
        if not self.config.get("dashscope_api_key"):
            raise UserError("未配置 DashScope API Key，请在 config.json 中填写")

        def work():
            self._status_all(rows, "audio", "running", "排队中")
            futures = [self.audio_pool.submit(self._do_audio, row) for row in rows]
            ok = sum(1 for f in futures if f.result())
            self.log.ok(f"配音完成 {ok}/{len(rows)}")
            if ok < len(rows):
                self.log.warn("部分片段配音失败，请检查日志后重试")

        threading.Thread(target=work, daemon=True).start()

    def run_audio_one(self, row_id: str) -> None:
        row = self.state.get_row(row_id)
        if not row:
            raise UserError("分镜不存在")
        threading.Thread(target=self._do_audio, args=(row,), daemon=True).start()

    # ------------------------------------------------------------------ 生视频
    def run_videos(self, rows: list[dict] | None = None) -> None:
        if not self.config.get("video_auto_enabled"):
            raise UserError("请先勾选左侧「视频模式用豆包自动生成视频」")
        # 已经导入剧集时，「批量生视频」也按一集一集跑，避免 120 条塞进一条消息
        if rows is None and self._episode_groups():
            self.log.info("检测到剧集：改为逐集生成（已生成的自动跳过）")
            self.run_episodes()
            return
        rows = rows or self.state.rows_with_text()
        if not rows:
            raise UserError("还没有文案")
        if not self._video_no_image():
            ready = [r for r in rows if self.state.abs_media(r.get("image"))]
            if not ready:
                raise UserError(
                    "视频要以图片为底，请先「批量生图」再生成视频；"
                    "也可以勾选「生视频不要求底图」直接用文案生成")
        self._begin_browser_task("批量生视频")

        def work():
            try:
                with self.browser_gate:
                    if self._use_pipeline(rows):
                        self.log.info(f"{len(rows)} 条任务将一次性提交后统一收片")
                        ok = self._videos_pipelined(rows)
                        self.log.ok(f"视频完成 {ok}/{len(rows)}")
                    else:
                        out_dir = self.config.path("data", "videos")
                        for idx, row in enumerate(rows, 1):
                            if self.cancel_event.is_set() or self.browser.cancel_event.is_set():
                                raise GenerationCancelled("已取消")
                            self._status(row["id"], "video", "running", f"生成中 {idx}/{len(rows)}")
                            try:
                                path = self._generate_video_with_retry(row, out_dir)
                            except (QuotaError, GenerationCancelled):
                                raise
                            except UserError:
                                self._status(row["id"], "video", "error", "缺图片")
                                continue
                            except Exception as exc:
                                self.log.error(f"第 {idx} 段视频失败：{str(exc)[:150]}")
                                self._status(row["id"], "video", "error", str(exc)[:120])
                                continue
                            self.state.set_media(row["id"], "video", path)
                            self._status(row["id"], "video", "done", "已生成")
                self.log.info("批量生视频流程结束")
            except QuotaError as exc:
                self._episode_paused = True
                self._episode_watch = False
                self.log.error(f"豆包额度不足，批量生视频已暂停：{exc}")
                for row in rows:
                    status = (self.runtime.get(row["id"]) or {}).get("video") or {}
                    if status.get("state") == "running":
                        self._status(row["id"], "video", "error", "额度不足，已暂停")
            except GenerationCancelled:
                for row in rows:
                    status = (self.runtime.get(row["id"]) or {}).get("video") or {}
                    if status.get("state") == "running":
                        self._status(row["id"], "video", "cancelled", "已取消")
                self.log.warn("已取消图生视频")
            except Exception as exc:
                self.log.error(f"图生视频中断：{exc}")
                for row in rows:
                    status = (self.runtime.get(row["id"]) or {}).get("video") or {}
                    if status.get("state") == "running":
                        self._status(row["id"], "video", "error", str(exc)[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    def run_video_one(self, row_id: str) -> None:
        row = self.state.get_row(row_id)
        if not row:
            raise UserError("分镜不存在")
        image_abs = self.state.abs_media(row.get("image"))
        if not image_abs or not os.path.exists(image_abs):
            if not self._video_no_image():
                raise UserError("该分镜还没有图片")
            image_abs = ""
        self._begin_browser_task("单张图生视频")

        def work():
            try:
                with self.browser_gate:
                    self._status(row_id, "video", "running", "生成中")
                    text = (row.get("text") or "").strip()
                    char_block = self._character_block(self._characters_in(text))
                    if char_block:
                        text += f"\n人物设定（保持同一人物外观）：{char_block}"
                    path = self.browser.generate_video(
                        text, image_abs, self.config.path("data", "videos"),
                        aspect=self._aspect(), chat_url=self._chat_target())
                    self._remember_chat()
                    self.state.set_media(row_id, "video", path)
                    self._status(row_id, "video", "done", "已生成")
            except GenerationCancelled:
                self._status(row_id, "video", "cancelled", "已取消")
                self.log.warn("已取消视频生成")
            except Exception as exc:
                self.log.error(f"视频生成失败：{exc}")
                self._status(row_id, "video", "error", str(exc)[:120])
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------ 逐集生成
    def _episode_groups(self) -> list[dict]:
        """把带集号的分镜按集分组，按集号排序。"""
        groups: dict[int, dict] = {}
        for row in self.state.rows_with_text():
            no = row.get("episode")
            if no is None:
                continue
            try:
                key = int(no)
            except (TypeError, ValueError):
                continue
            group = groups.setdefault(key, {
                "no": key,
                "title": row.get("episodeTitle") or "",
                "rows": [],
            })
            group["rows"].append(row)
        return [groups[key] for key in sorted(groups)]

    def _episode_pending(self, rows: list[dict]) -> list[dict]:
        """这一集里还没有视频的分镜（已生成的跳过，省额度）。"""
        pending = []
        for row in rows:
            video = self.state.abs_media(row.get("video"))
            if video and os.path.exists(video):
                continue
            pending.append(row)
        return pending

    def _episode_label(self, group: dict) -> str:
        label = f"第 {group['no']} 集"
        if (group.get("title") or "").strip():
            label += f" {group['title'].strip()}"
        return label

    def _stitch_episode(self, group: dict) -> str | None:
        """这一集生成完就立刻合成，合成完再进下一集。"""
        rows = []
        for row in group["rows"]:
            current = self.state.get_row(row["id"]) or row
            rows.append({
                **current,
                "image_abs": self.state.abs_media(current.get("image")),
                "video_abs": self.state.abs_media(current.get("video")),
                "audio_abs": self.state.abs_media(current.get("audio")),
            })
        if not rows:
            return None
        settings = dict(self.state.settings)
        base = _safe_name(settings.get("outName") or "成片")
        name = f"{base}_第{int(group.get('no') or 0):02d}集"
        if (group.get("title") or "").strip():
            name += "_" + _safe_name(group["title"], "")
        out_dir = self.config.path("data", "output")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(
            out_dir, f"{_safe_name(name)}_{time.strftime('%Y%m%d_%H%M%S')}.mp4")
        label = self._episode_label(group)
        try:
            self.log.info(f"{label}：开始合成成片…")
            self.busy["label"] = f"{label} 合成中"
            info = self.stitcher.build(rows, "video", settings, out_path)
            self.state.set_result(info)
            final_path = info.get("path") or out_path
            self.log.ok(f"{label}：合成完成，已保存到本地 → {os.path.abspath(final_path)}")
            return final_path
        except Exception as exc:
            self.log.error(f"{label}：合成失败：{str(exc)[:150]}")
            return None

    def _run_single_videos(self, pending: list[dict], label: str) -> None:
        """没有一次性提交能力时的逐条生成兜底。"""
        out_dir = self.config.path("data", "videos")
        for idx, row in enumerate(pending, 1):
            if self.cancel_event.is_set() or self.browser.cancel_event.is_set():
                raise GenerationCancelled("已取消")
            self._status(row["id"], "video", "running", f"生成中 {idx}/{len(pending)}")
            try:
                path = self._generate_video_with_retry(row, out_dir)
            except GenerationCancelled:
                raise
            except UserError:
                self._status(row["id"], "video", "error", "缺图片")
                continue
            except Exception as exc:
                self.log.error(f"{label} 第 {idx} 段失败：{str(exc)[:120]}")
                self._status(row["id"], "video", "error", str(exc)[:120])
                continue
            self.state.set_media(row["id"], "video", path)
            self._status(row["id"], "video", "done", "已生成")

    def _session_confirming(self, segments: list[int], max_segment: int = 12) -> bool:
        """打开当前会话：豆包还在生成、或在等确认这几段，都不要重新提交。"""
        try:
            self.browser._open_chat(self._chat_target())
            if self.browser.session_generating():
                return True
            return self.browser.session_waiting_confirm_for(
                segments, max_segment=max_segment)
        except Exception:
            return False

    def _continue_episode_videos(self, group: dict, pending: list[dict],
                                 label: str, segments: list[int] | None = None) -> None:
        """不重新提交：在会话末尾催已经提交过的段，只收新片。"""
        self.busy["label"] = f"{label}（续收 {len(pending)} 段）"

        def on_resume(kind: str, key: str, done: int, total_: int,
                      path: str = "") -> None:
            if kind == "done":
                if path:
                    self.state.set_media(key, "video", path)
                self._status(key, "video", "done", "已生成")
                self.busy["label"] = f"{label} 视频 {done}/{total_}"

        items = []
        for idx, row in enumerate(pending):
            seg = segments[idx] if segments and idx < len(segments) else idx + 1
            items.append({
                "key": row["id"], "segment": seg,
                "seconds": self._video_seconds(),
            })
        self.browser.continue_video_batch(
            items, self.config.path("data", "videos"),
            on_event=on_resume, chat_url=self._chat_target())
        self._remember_chat()

    def _run_one_episode(self, group: dict, label: str) -> None:
        total = len(group["rows"])
        pending = self._episode_pending(group["rows"])
        if not pending:
            self.log.ok(f"{label}：{total} 段已全部生成，跳过生成，直接合成")
            self._stitch_episode(group)
            return
        self.log.info(
            f"{label}：开始生成 {len(pending)}/{total} 段"
            f"（已生成 {total - len(pending)} 段，自动跳过）")
        self.busy["label"] = f"{label}（{len(pending)} 段）"
        submitted = [r for r in pending if r["id"] in self._submitted_rows]
        fresh = [r for r in pending if r["id"] not in self._submitted_rows]
        pending_ids = {r["id"] for r in pending}
        positions = [i + 1 for i, r in enumerate(group["rows"])
                     if r["id"] in pending_ids]
        if pending and not fresh:
            # 这些段上次已经提交给豆包了：不重新上传图片/不重新生成，
            # 直接在会话末尾催它把没回来的视频补出来
            self.log.info(
                f"{label}：{len(pending)} 段上次已提交，改为在会话末尾继续催，不重复生成")
            self._continue_episode_videos(group, pending, label, positions)
        elif (submitted and self._session_confirming(
                positions, max_segment=len(group["rows"]))):
            self.log.info(
                f"{label}：豆包在会话里等确认"
                f"（第 {'、'.join(map(str, positions))} 段），直接接着生成，不重新提交")
            self._continue_episode_videos(group, pending, label, positions)
        elif submitted:
            self.log.info(
                f"{label}：{len(submitted)} 段已提交、{len(fresh)} 段待提交，"
                f"本集统一重新提交一次（人物设定 + 文案）")
            if self._use_pipeline(pending):
                self._videos_pipelined(pending, group["rows"], positions)
            else:
                self._run_single_videos(pending, label)
        elif self._use_pipeline(pending):
            self._videos_pipelined(pending, group["rows"], positions)
        else:
            self._run_single_videos(pending, label)
        left = len(self._episode_pending(group["rows"]))
        if left:
            self.log.warn(f"{label}：还有 {left} 段没有拿到视频")
        else:
            self.log.ok(f"{label}：全部完成")
        # 生成完这一集先合成，合成后再开始下一集
        self._stitch_episode(group)

    def _run_episode_loop(self, groups: list[dict]) -> None:
        for group in groups:
            if self.cancel_event.is_set() or self.browser.cancel_event.is_set():
                raise GenerationCancelled("已取消")
            label = self._episode_label(group)
            try:
                self._run_one_episode(group, label)
            except QuotaError as exc:
                # 额度不足：不终止整个任务，暂停在这一集，等用户清空会话后换新会话继续
                self._quota_paused = True
                self._quota_group = group
                self.log.error(
                    f"{label}：豆包额度不足，本集已暂停（{exc}）；"
                    f"清空「当前会话链接」后会自动换新会话，带上人物设定和文案重新提交")
                for row in self._episode_pending(group["rows"]):
                    self._status(row["id"], "video", "cancelled", "额度不足，等待新会话")
                return
        self.log.ok("剧集循环处理结束")

    def _episode_watchdog(self, groups: list[dict]) -> None:
        """每 N 分钟看一眼：还在跑就继续等；意外中断就从剩余段续生成。"""
        interval = max(60, int(self.config.get("episode_watch_interval") or 300))
        max_interrupts = max(1, int(self.config.get("episode_interrupt_max") or 3))
        while self._episode_watch:
            time.sleep(interval)
            if not self._episode_watch:
                return
            if self._quota_paused:
                chat = str(self.state.settings.get("chatUrl") or "").strip()
                if not chat:
                    self.log.info("额度等待：检测到会话已清空，换新会话继续当前集")
                    self._quota_paused = False
                    self._quota_group = None
                    self._submitted_rows.clear()
                    self._resume_episodes(groups)
                else:
                    self.log.info(
                        "额度等待：清空左侧「当前会话链接」后，会自动换新会话"
                        "（带上人物设定 + 文案）继续")
                continue
            if self._episode_paused:
                self.log.info("逐集监控：任务已暂停，结束监控")
                self._episode_watch = False
                return
            if self.cancel_event.is_set() or self.browser.cancel_event.is_set():
                self.log.info("逐集监控：检测到主动停止，结束监控")
                self._episode_watch = False
                return
            pending: list[dict] = []
            for group in groups:
                pending.extend(self._episode_pending(group["rows"]))
            if not pending:
                self.log.ok("逐集监控：所有剧集都已完成，结束监控")
                self._episode_watch = False
                return
            if self.browser_task.get("running") or self.busy.get("running"):
                self.log.info(
                    f"逐集监控：任务仍在进行中（还剩 {len(pending)} 段），继续等待")
                continue
            self._episode_interrupts += 1
            if self._episode_interrupts > max_interrupts:
                self.log.error(
                    f"逐集监控：已意外中断 {self._episode_interrupts - 1} 次，"
                    f"超过上限 {max_interrupts}，停止监控；剩余 {len(pending)} 段需要手动重试")
                self._episode_watch = False
                return
            self.log.warn(
                f"逐集监控：任务意外中断，还剩 {len(pending)} 段，"
                f"第 {self._episode_interrupts}/{max_interrupts} 次自动续生成…")
            self._resume_episodes(groups)

    def _resume_episodes(self, groups: list[dict]) -> None:
        if self.browser_task.get("running") or self.busy.get("running"):
            return
        self.cancel_event.clear()
        self.browser.cancel_event.clear()
        self._begin_browser_task("逐集生成（续）")

        def work():
            try:
                with self.browser_gate:
                    self._run_episode_loop(groups)
            except QuotaError as exc:
                self._quota_paused = True
                self.log.error(
                    f"豆包额度不足：{exc}；清空「当前会话链接」后会自动换新会话继续")
            except GenerationCancelled:
                self.log.warn("逐集续生成已取消")
            except Exception as exc:
                self.log.error(f"逐集续生成中断：{exc}")
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()

    def resume_after_quota(self) -> None:
        """额度不足暂停后，用户清空会话链接：换新会话带上人物设定和文案继续。"""
        if not self._quota_paused:
            return
        self._quota_paused = False
        self._quota_group = None
        self._submitted_rows.clear()
        groups = self._episode_groups()
        if not groups:
            return
        self.log.info("检测到当前会话已清空：换新会话，带上人物设定 + 文案继续生成")
        self._resume_episodes(groups)

    def run_episodes(self) -> None:
        """批量导入剧集后，一集一集生成；已生成的跳过，带意外中断监控。"""
        if not self.config.get("video_auto_enabled"):
            raise UserError("请先勾选左侧「视频模式用豆包自动生成视频」")
        if self.browser_task.get("running"):
            raise UserError(
                f"「{self.browser_task.get('kind') or '任务'}」正在进行中，请先点「停止任务」")
        groups = self._episode_groups()
        if not groups:
            raise UserError("还没有剧集，请先点「批量导入剧集」")
        self.cancel_event.clear()
        self.browser.cancel_event.clear()
        self._episode_interrupts = 0
        self._episode_watch = True
        self._episode_paused = False
        self._quota_paused = False
        self._quota_group = None
        # 用户重新点「逐集生成」：每集都重新提交一次人物设定 + 文案
        self._submitted_rows.clear()
        self._begin_browser_task("逐集生成")
        self.log.info(f"开始逐集生成：共 {len(groups)} 集，已生成的分镜会自动跳过")

        def work():
            try:
                with self.browser_gate:
                    self._run_episode_loop(groups)
            except QuotaError as exc:
                self._quota_paused = True
                self.log.error(
                    f"豆包额度不足：{exc}；清空「当前会话链接」后会自动换新会话继续")
            except GenerationCancelled:
                self.log.warn("已取消逐集生成")
            except Exception as exc:
                self.log.error(f"逐集生成中断：{exc}")
            finally:
                self._end_browser_task()

        threading.Thread(target=work, daemon=True).start()
        threading.Thread(target=self._episode_watchdog, args=(groups,), daemon=True).start()

    # ------------------------------------------------------------------ 拼接
    def _collect_rows(self) -> list[dict]:
        mode = self.state.mode
        result = []
        for row in self.state.rows_with_text():
            result.append({
                **row,
                "image_abs": self.state.abs_media(row.get("image")),
                "video_abs": self.state.abs_media(row.get("video")),
                "audio_abs": self.state.abs_media(row.get("audio")),
            })
        return result

    def run_stitch(self) -> None:
        rows = self._collect_rows()
        if not rows:
            raise UserError("还没有文案，请先导入分镜")

        def work():
            try:
                self.busy.update({"running": True, "progress": 0.02, "label": "准备合成"})
                mode = self.state.mode
                settings = dict(self.state.settings)
                name = _safe_name(settings.get("outName"))
                out_dir = self.config.path("data", "output")
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(
                    out_dir, f"{name}_{time.strftime('%Y%m%d_%H%M%S')}.mp4")

                self.log.info(f"开始拼接（{mode == 'video' and '视频模式' or '图文模式'}，{len(rows)} 段）…")

                def progress(done, total, label):
                    pct = 0.05 + 0.9 * (done / max(1, total))
                    self.busy.update({"progress": min(0.97, pct), "label": label})

                info = self.stitcher.build(
                    rows, mode, settings, out_path, progress,
                    should_stop=lambda: self.cancel_event.is_set())
                self.busy.update({"progress": 1.0, "label": "完成"})
                result = {
                    "path": out_path,
                    "file": os.path.basename(out_path),
                    "url": "/media/output/" + os.path.basename(out_path),
                    "duration": round(info.get("duration", 0), 2),
                    "segments": info.get("segments", 0),
                    "created": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                self.state.set_result(result)
                self.log.ok(
                    f"成片完成：{result['file']}（{result['segments']} 段 / {result['duration']} 秒）")
                for item in info.get("skipped") or []:
                    self.log.warn(item)
            except StitchError as exc:
                if self.cancel_event.is_set():
                    self.busy.update({"label": "已取消"})
                    self.log.warn("已取消拼接")
                else:
                    self.busy.update({"label": "拼接失败"})
                    self.log.error(f"拼接失败：{exc}")
            except Exception as exc:
                self.busy.update({"label": "拼接失败"})
                self.log.error(f"拼接失败：{exc}")
            finally:
                self.busy["running"] = False
                time.sleep(0.4)
                self.busy["progress"] = 0.0

        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------------ 全流程
    def run_all(self) -> None:
        if self.busy.get("running"):
            raise UserError("已有任务在执行中")
        if self.browser_task.get("running"):
            raise UserError(f"「{self.browser_task['kind']}」正在进行中，请先点「停止任务」")
        rows = self._collect_rows()
        if not rows:
            raise UserError("还没有文案，请先导入分镜")

        self.cancel_event.clear()
        self.browser.cancel_event.clear()
        self.busy.update({"running": True, "progress": 0.0, "label": "启动全流程"})

        def step_image(targets: list[dict]) -> int:
            with self.browser_gate:
                return self._batch_images(targets)

        def step_audio() -> int:
            self.busy["label"] = "生成配音"
            futures = [self.audio_pool.submit(self._do_audio, row) for row in rows]
            return sum(1 for f in futures if f.result())

        def step_video(targets: list[dict]) -> int:
            self.busy["label"] = f"生成视频（{len(targets)} 条）"
            with self.browser_gate:
                if self._use_pipeline(targets):
                    return self._videos_pipelined(targets)
                done = 0
                for idx, row in enumerate(targets, 1):
                    if self.cancel_event.is_set():
                        raise GenerationCancelled("已取消")
                    self._status(row["id"], "video", "running", f"生成中 {idx}/{len(targets)}")
                    try:
                        path = self._generate_video_with_retry(
                            row, self.config.path("data", "videos"))
                        self.state.set_media(row["id"], "video", path)
                        self._status(row["id"], "video", "done", "已生成")
                        done += 1
                    except (QuotaError, GenerationCancelled):
                        raise
                    except UserError:
                        self._status(row["id"], "video", "error", "缺图片")
                    except Exception as exc:
                        self.log.error(f"第 {idx} 段视频失败：{str(exc)[:150]}")
                        self._status(row["id"], "video", "error", str(exc)[:120])
                return done

        def work():
            try:
                self.log.info("──── 一键全流程开始 ────")
                mode = self.state.mode
                rows_now = self._collect_rows()
                missing_img = [r for r in rows_now
                               if not (r.get("image_abs") and os.path.exists(r["image_abs"]))]
                need_video = mode == "video" and bool(self.config.get("video_auto_enabled"))
                no_image = self._video_no_image()
                skip_image = need_video and no_image
                missing_vid = [r for r in rows_now
                               if not (r.get("video_abs") and os.path.exists(r["video_abs"]))]

                self.busy.update({"progress": 0.04, "label": "检查素材"})
                if missing_img and not skip_image:
                    self.log.info(f"检查：{len(missing_img)}/{len(rows_now)} 条还没有配图，先生成配图")
                elif skip_image:
                    self.log.info("已勾选「生视频不要求底图」，跳过生图，直接用文案生成视频")
                else:
                    self.log.ok(f"检查：{len(rows_now)} 条配图已齐全，跳过生图")

                if missing_img or (need_video and missing_vid):
                    self.busy.update({"progress": 0.06, "label": "启动浏览器"})
                    with self.browser_gate:
                        self.browser.ensure_started()

                if missing_img and not skip_image:
                    self.busy.update({"progress": 0.12, "label": "生成配图"})
                    count = step_image(missing_img)
                    self.log.ok(f"配图完成 {count}/{len(missing_img)}")
                if self.cancel_event.is_set():
                    raise UserError("已停止")

                if need_video:
                    if missing_vid:
                        self.busy.update({"progress": 0.45, "label": "用图片生成视频"})
                        self.log.info(f"{len(missing_vid)} 条分镜开始图生视频…")
                        video_ok = step_video(missing_vid)
                        self.log.ok(f"视频完成 {video_ok}/{len(missing_vid)}")
                    else:
                        self.log.ok(f"检查：{len(rows_now)} 条视频已齐全，跳过生视频")
                    if self.cancel_event.is_set():
                        raise UserError("已停止")
                elif mode == "video":
                    self.log.warn("未启用「自动生成视频」，拼接时这些分镜会用图片代替视频")

                self.busy.update({"progress": 0.72, "label": "生成配音"})
                audio_ok = step_audio()
                self.log.ok(f"配音完成 {audio_ok}/{len(rows_now)}")
                if self.cancel_event.is_set():
                    raise UserError("已停止")

                self.busy.update({"progress": 0.8, "label": "拼接成片"})
                fresh_rows = self._collect_rows()
                settings = dict(self.state.settings)
                name = _safe_name(settings.get("outName"))
                out_dir = self.config.path("data", "output")
                out_path = os.path.join(
                    out_dir, f"{name}_{time.strftime('%Y%m%d_%H%M%S')}.mp4")

                def progress(done, total, label):
                    pct = 0.8 + 0.18 * (done / max(1, total))
                    self.busy.update({"progress": min(0.98, pct), "label": label})

                info = self.stitcher.build(
                    fresh_rows, self.state.mode, settings, out_path, progress,
                    should_stop=lambda: self.cancel_event.is_set())
                result = {
                    "path": out_path,
                    "file": os.path.basename(out_path),
                    "url": "/media/output/" + os.path.basename(out_path),
                    "duration": round(info.get("duration", 0), 2),
                    "segments": info.get("segments", 0),
                    "created": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                self.state.set_result(result)
                self.busy.update({"progress": 1.0, "label": "完成"})
                self.log.ok(f"🎉 全流程完成：{result['file']}（{result['duration']} 秒）")
            except QuotaError as exc:
                self._episode_paused = True
                self._episode_watch = False
                self._settle_running(rows, "error", "额度不足，已暂停")
                self.log.error(f"豆包额度不足，全流程已暂停：{exc}")
            except GenerationCancelled:
                self._settle_running(rows, "cancelled", "已取消")
                self.log.warn("已取消全流程")
            except UserError as exc:
                self._settle_running(rows, "cancelled", "已取消")
                self.log.warn(f"全流程已停止：{exc}")
            except Exception as exc:
                self._settle_running(rows, "error", str(exc)[:120])
                self.log.error(f"全流程中断：{exc}")
                self.log.error(traceback.format_exc(limit=2))
            finally:
                self.busy["running"] = False
                time.sleep(0.6)
                self.busy["progress"] = 0.0

        threading.Thread(target=work, daemon=True).start()
