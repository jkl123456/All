"""DashScope（CosyVoice）语音合成封装。"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import threading
import time

_PROXY_KEYS = (
    "http_proxy", "https_proxy", "all_proxy",
    "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY",
)
_proxy_lock = threading.Lock()


class TTSError(Exception):
    pass


# cosyvoice-v2 的可用音色（v1 的 longwan / longxiaochun 等在 v2 下会直接 418）
DEFAULT_VOICE = "longxiaochun_v2"
VOICE_ALIASES = {
    "longwan": "longwan_v2",
    "longxiaochun": "longxiaochun_v2",
    "longhua": "longhua_v2",
    "longshu": "longshu_v2",
}


def _resolve_voice(voice: str | None) -> str:
    name = str(voice or "").strip() or DEFAULT_VOICE
    return VOICE_ALIASES.get(name, name)


def _voice_error(exc: Exception) -> bool:
    """引擎返回 418 基本都是音色名对不上 cosyvoice-v2（原文是 Engine return error code: 418）。"""
    text = str(exc).lower()
    return "error code: 418" in text or "voice not exist" in text


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    return text


def _split_text(text: str, limit: int) -> list[str]:
    """按标点切成不超过 limit 字的片段，避免长文本单次合成失败。"""
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    buf = ""
    for piece in re.split(r"(?<=[。！？!?；;\n])", text):
        piece = piece.strip()
        if not piece:
            continue
        if len(buf) + len(piece) <= limit:
            buf += piece
        else:
            if buf:
                chunks.append(buf)
            if len(piece) <= limit:
                buf = piece
            else:
                for i in range(0, len(piece), limit):
                    chunks.append(piece[i:i + limit])
                buf = ""
    if buf:
        chunks.append(buf)
    return chunks or [text]


class TTS:
    def __init__(self, config, log) -> None:
        self.config = config
        self.log = log
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    def _synthesize_once(self, text: str, out_path: str, voice: str, speed: float, volume: int) -> None:
        import dashscope
        from dashscope.audio.tts_v2 import SpeechSynthesizer

        dashscope.api_key = self.config.get("dashscope_api_key")
        last_error = None
        for attempt in range(1, 4):
            try:
                synth = SpeechSynthesizer(
                    model=self.config.get("tts_model") or "cosyvoice-v2",
                    voice=voice,
                    speech_rate=float(speed),
                    volume=int(volume),
                )
                result = synth.call(text)
                if isinstance(result, bytes) and result:
                    with open(out_path, "wb") as fp:
                        fp.write(result)
                    return
                detail = ""
                try:
                    detail = str(result.get_response())
                except Exception:
                    detail = str(result)
                raise TTSError(f"语音合成失败：{detail[:300]}")
            except TTSError:
                raise
            except Exception as exc:
                if _voice_error(exc):
                    # 音色不对是确定性错误，重试没有意义
                    raise TTSError(f"音色不可用：{exc}")
                last_error = exc
                if attempt < 3:
                    self.log.warn(f"语音合成第 {attempt} 次失败（{exc}），1.5 秒后重试…")
                    time.sleep(1.5)
        raise TTSError(f"语音合成失败：{last_error}")

    def _concat(self, parts: list[str], out_path: str) -> None:
        ffmpeg = self.config.get("ffmpeg_path") or "ffmpeg"
        list_file = out_path + ".txt"
        with open(list_file, "w", encoding="utf-8") as fp:
            for part in parts:
                fp.write("file '%s'\n" % part.replace("\\", "/").replace("'", "'\\''"))
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", list_file,
            "-c:a", "libmp3lame", "-ar", "44100", "-ac", "2", "-b:a", "160k",
            out_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace",
                              creationflags=0x08000000 if os.name == "nt" else 0)
        try:
            os.remove(list_file)
        except OSError:
            pass
        if proc.returncode != 0:
            raise TTSError("音频拼接失败：" + (proc.stderr or "")[-400:])

    def _render(self, chunks: list[str], out_path: str, voice: str,
                speed: float, volume: int) -> None:
        if len(chunks) == 1:
            self._synthesize_once(chunks[0], out_path, voice, speed, volume)
            return
        self.log.info(f"文案较长，分 {len(chunks)} 段合成音频…")
        tmp_dir = tempfile.mkdtemp(prefix="tts_")
        parts = []
        try:
            for idx, chunk in enumerate(chunks):
                part = os.path.join(tmp_dir, f"{idx:03d}.mp3")
                self._synthesize_once(chunk, part, voice, speed, volume)
                parts.append(part)
            self._concat(parts, out_path)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    def synthesize(self, text: str, out_path: str, voice: str | None = None,
                   speed: float | None = None, volume: int | None = None) -> str:
        text = _clean_text(text)
        if not text:
            raise TTSError("文案为空，无法配音")
        if not self.config.get("dashscope_api_key"):
            raise TTSError("未配置 DashScope API Key（config.json → dashscope_api_key）")

        voice = _resolve_voice(voice)
        speed = 1.0 if speed is None else float(speed)
        volume = 80 if volume is None else int(volume)

        limit = int(self.config.get("tts_max_chars") or 480)
        chunks = _split_text(text, limit)

        with self._lock:
            env_backup = {}
            if self.config.get("tts_ignore_proxy", True):
                for key in _PROXY_KEYS:
                    if key in os.environ:
                        env_backup[key] = os.environ.pop(key)
            try:
                try:
                    self._render(chunks, out_path, voice, speed, volume)
                except TTSError as exc:
                    # 老配置里存的是 v1 音色名：自动换默认音色再试一次，别让整批配音全挂
                    if voice == DEFAULT_VOICE or not _voice_error(exc):
                        raise
                    self.log.warn(f"音色「{voice}」不可用，改用「{DEFAULT_VOICE}」重新合成…")
                    self._render(chunks, out_path, DEFAULT_VOICE, speed, volume)
            finally:
                os.environ.update(env_backup)

        if not os.path.exists(out_path) or os.path.getsize(out_path) < 512:
            raise TTSError("语音合成结果为空，请检查 API Key / 网络")
        return out_path
