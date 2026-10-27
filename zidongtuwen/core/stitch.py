"""ffmpeg 合成：静图/视频 + 音频 + 字幕/片头 → 分段 → 拼接成片。"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import time

from .subtitle import SubtitleRenderer

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


class StitchError(Exception):
    pass


def _run(cmd: list[str], timeout: int = 3600) -> str:
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        creationflags=CREATE_NO_WINDOW, timeout=timeout,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-8:]
        raise StitchError("ffmpeg 执行失败：" + " | ".join(tail))
    return proc.stdout or ""


def _ff_color(value: str, fallback: str = "0x101522") -> str:
    text = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", text):
        return "0x" + text[1:]
    if re.fullmatch(r"#[0-9a-fA-F]{3}", text):
        return "0x" + "".join(c * 2 for c in text[1:])
    if re.fullmatch(r"0x[0-9a-fA-F]{6}", text):
        return text
    return fallback


class Stitcher:
    def __init__(self, config, log) -> None:
        self.config = config
        self.log = log
        self.ffmpeg = config.get("ffmpeg_path") or "ffmpeg"
        self.ffprobe = config.get("ffprobe_path") or "ffprobe"

    # ------------------------------------------------------------------
    def probe_duration(self, path: str) -> float:
        if not path or not os.path.exists(path):
            return 0.0
        cmd = [self.ffprobe, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", path]
        try:
            out = _run(cmd, timeout=120).strip()
            return max(0.0, float(out.splitlines()[0]))
        except Exception:
            return 0.0

    def has_audio(self, path: str) -> bool:
        """视频里有没有音轨；没有就补静音，避免拼接后没有音频流。"""
        if not path or not os.path.exists(path):
            return False
        cmd = [self.ffprobe, "-v", "error", "-select_streams", "a:0",
               "-show_entries", "stream=index", "-of", "csv=p=0", path]
        try:
            return bool(_run(cmd, timeout=60).strip())
        except Exception:
            return False

    def _probe_size(self, path: str) -> tuple[int, int]:
        cmd = [self.ffprobe, "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height", "-of", "csv=p=0", path]
        try:
            out = _run(cmd, timeout=120).strip()
            parts = out.splitlines()[0].split(",")
            return int(parts[0]), int(parts[1])
        except Exception:
            return 0, 0

    # ------------------------------------------------------------------ 滤镜
    def _image_filter(self, w: int, h: int, fps: int, fill: str, zoom: bool,
                      label: str = "b0") -> str:
        base = f"scale={w}:{h}:force_original_aspect_ratio=decrease"
        if zoom:
            w2, h2 = w * 2, h * 2
            return (
                f"[0:v]scale={w2}:{h2}:force_original_aspect_ratio=increase,"
                f"crop={w2}:{h2},"
                f"zoompan=z='min(zoom+0.0012,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d=1:s={w}x{h}:fps={fps},setsar=1[{label}]"
            )
        if fill == "cover":
            return (
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h},setsar=1,fps={fps}[{label}]"
            )
        if fill == "blur":
            return (
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
                f"gblur=sigma=40,eq=brightness=-0.06[bg];"
                f"[0:v]{base}[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps={fps}[{label}]"
            )
        color = "white" if fill == "white" else "black"
        return (
            f"color=c={color}:s={w}x{h}:r={fps}[bg];"
            f"[0:v]{base}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[{label}]"
        )

    @staticmethod
    def _overlay_chain(first_label: str, overlays: list[dict], first_index: int = 2) -> tuple[list[str], str]:
        parts: list[str] = []
        last = first_label
        for i, item in enumerate(overlays):
            nxt = f"v{i + 1}"
            start = float(item.get("start") or 0)
            end = float(item.get("end") or 0)
            y = int(item.get("y") or 0)
            parts.append(
                f"[{last}][{first_index + i}:v]overlay=x=0:y={y}"
                f":enable='between(t,{start:.3f},{end:.3f})'[{nxt}]"
            )
            last = nxt
        return parts, last

    def _overlay_inputs(self, overlays: list[dict]) -> list[str]:
        args: list[str] = []
        for item in overlays:
            args += ["-loop", "1", "-i", item["path"]]
        return args

    # ------------------------------------------------------------------ 分段
    def image_segment(self, image: str, audio: str | None, out: str,
                      w: int, h: int, fps: int, fill: str, zoom: bool,
                      duration: float, overlays: list[dict] | None = None) -> float:
        dur = max(0.5, float(duration or 3.0))
        overlays = overlays or []
        parts = [self._image_filter(w, h, fps, fill, zoom, "b0")]
        chain, last = self._overlay_chain("b0", overlays)
        parts += chain
        parts.append(f"[{last}]format=yuv420p[v]")

        cmd = [self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
               "-loop", "1", "-framerate", str(fps), "-i", image]
        if audio:
            cmd += ["-i", audio]
        else:
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
        cmd += self._overlay_inputs(overlays)
        cmd += [
            "-filter_complex", ";".join(parts),
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-r", str(fps), "-g", str(fps * 2),
            "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
            "-t", f"{dur:.3f}", "-movflags", "+faststart", out,
        ]
        _run(cmd)
        return dur

    def video_segment(self, video: str, audio: str | None, out: str,
                      w: int, h: int, fps: int, duration: float,
                      video_dur: float, audio_dur: float,
                      overlays: list[dict] | None = None) -> float:
        dur = max(0.5, float(duration or 0))
        overlays = overlays or []
        pad = max(0.0, float(audio_dur or 0) - float(video_dur or 0)) if audio else 0.0
        chain = (
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},setsar=1,fps={fps}"
        )
        if pad > 0.05:
            chain += f",tpad=stop_mode=clone:stop_duration={pad:.3f}"

        # 音频来源优先级：配音 > 视频原声 > 静音
        use_audio = bool(audio)
        native_audio = False
        if use_audio:
            audio_args = ["-i", audio]
            audio_map = "1:a"
            overlay_start = 2
        elif self.has_audio(video):
            native_audio = True
            audio_args = []
            audio_map = "0:a"
            overlay_start = 1
        else:
            audio_args = ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
            audio_map = "1:a"
            overlay_start = 2

        parts = [chain + "[b0]"]
        overlays_chain, last = self._overlay_chain("b0", overlays, overlay_start)
        parts += overlays_chain
        parts.append(f"[{last}]format=yuv420p[v]")

        cmd = [self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", video]
        cmd += audio_args
        cmd += self._overlay_inputs(overlays)
        cmd += ["-filter_complex", ";".join(parts), "-map", "[v]", "-map", audio_map]
        if native_audio:
            cmd += ["-af", "apad"]
        elif use_audio and float(audio_dur or 0) < float(video_dur or 0) - 0.05:
            cmd += ["-af", "apad"]
        cmd += [
            "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-r", str(fps), "-g", str(fps * 2),
            "-t", f"{dur:.3f}", "-movflags", "+faststart", out,
        ]
        _run(cmd)
        return dur

    def title_segment(self, png: str, y: int, bg: str, duration: float, out: str,
                      w: int, h: int, fps: int) -> float:
        dur = max(0.5, float(duration or 3.0))
        color = _ff_color(bg)
        cmd = [
            self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}:r={fps}",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-loop", "1", "-i", png,
            "-filter_complex",
            f"[0:v][2:v]overlay=x=0:y={int(y)}:format=auto,format=yuv420p[v]",
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-r", str(fps), "-g", str(fps * 2),
            "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
            "-t", f"{dur:.3f}", "-movflags", "+faststart", out,
        ]
        _run(cmd)
        return dur

    # ------------------------------------------------------------------
    def concat(self, segments: list[str], out: str) -> None:
        list_path = out + ".txt"
        with open(list_path, "w", encoding="utf-8") as fp:
            for seg in segments:
                fp.write("file '%s'\n" % os.path.abspath(seg).replace("\\", "/").replace("'", "'\\''"))
        try:
            _run([self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                  "-f", "concat", "-safe", "0", "-i", list_path,
                  "-c", "copy", "-movflags", "+faststart", out])
        except StitchError:
            self.log.warn("快速拼接失败，改用重新编码拼接…")
            _run([self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                  "-f", "concat", "-safe", "0", "-i", list_path,
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2",
                  "-b:a", "192k", "-movflags", "+faststart", out])
        finally:
            try:
                os.remove(list_path)
            except OSError:
                pass

    def mix_bgm(self, video: str, bgm: str, out: str, volume: float = 0.2) -> None:
        volume = max(0.0, min(1.5, float(volume)))
        chain = (
            f"[1:a]volume={volume:.2f}[bg];"
            f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]"
        )
        _run([self.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
              "-i", video, "-stream_loop", "-1", "-i", bgm,
              "-filter_complex", chain, "-map", "0:v", "-map", "[a]",
              "-c:v", "copy", "-c:a", "aac", "-ar", "44100", "-ac", "2",
              "-b:a", "192k", "-shortest", "-movflags", "+faststart", out])

    # ------------------------------------------------------------------
    def build(self, rows: list[dict], mode: str, settings: dict, out_path: str,
              progress=None, should_stop=None) -> dict:
        w, h = self._parse_canvas(settings.get("canvas"))
        fps = 30
        fill = settings.get("fill") or "blur"
        zoom = bool(settings.get("zoom"))
        default_dur = float(settings.get("defaultDur") or 3.0)

        sub_cfg = dict(settings.get("subtitle") or {})
        title_cfg = dict(settings.get("title") or {})
        # 勾选「视频用原声」时不配音、不烧字幕，直接用视频自带音轨
        use_original = bool(settings.get("useOriginalAudio"))
        if use_original:
            sub_cfg["enabled"] = False

        tmp_dir = os.path.join(os.path.dirname(out_path), f"_tmp_{int(time.time())}")
        os.makedirs(tmp_dir, exist_ok=True)
        renderer = SubtitleRenderer(w, h, tmp_dir, self.log)

        segments: list[str] = []
        skipped: list[str] = []
        title_text = str(title_cfg.get("text") or "").strip()
        title_active = bool(title_cfg.get("enabled")) and bool(title_text)
        title_overlay = bool(title_cfg.get("overlay", True))
        title_png = None
        total = max(1, len(rows)) + (1 if title_active and not title_overlay else 0)

        try:
            if title_active:
                title_png = renderer.build_title(title_text, title_cfg)
                # 独立片头：单独加一段背景
                if title_png and not title_overlay:
                    if progress:
                        progress(0, total, "合成片头标题")
                    seg = os.path.join(tmp_dir, "seg_title.mp4")
                    self.title_segment(
                        title_png["path"], title_png["y"], title_cfg.get("bg") or "#101522",
                        float(title_cfg.get("duration") or 3), seg, w, h, fps)
                    segments.append(seg)
                    self.log.info(f"片头标题 {title_cfg.get('duration')} 秒（独立背景）")
                elif title_png:
                    self.log.info(f"片头标题将悬浮在首段画面上 {title_cfg.get('duration')} 秒")

            for idx, row in enumerate(rows):
                if should_stop and should_stop():
                    raise StitchError("已取消拼接")
                offset = 1 if segments else 0
                if progress:
                    progress(idx + offset, total, f"合成第 {idx + 1}/{total - offset} 段")
                seg = os.path.join(tmp_dir, f"seg_{idx:03d}.mp4")
                image = row.get("image_abs")
                video = row.get("video_abs")
                audio = None if use_original else row.get("audio_abs")

                audio_dur = self.probe_duration(audio) if audio else 0.0
                video_dur = self.probe_duration(video) if video else 0.0

                if mode == "video" and video:
                    duration = max(video_dur, audio_dur or 0.0)
                elif image:
                    duration = audio_dur if audio_dur > 0.2 else default_dur
                elif video:
                    duration = max(video_dur, audio_dur or 0.0)
                else:
                    skipped.append(f"第 {idx + 1} 段缺少图片/视频")
                    continue

                overlays = []
                if str(sub_cfg.get("enabled", True)) not in ("False", "false", "0"):
                    overlays = renderer.build_subtitles(
                        row.get("text") or "", sub_cfg, duration,
                        split=bool(sub_cfg.get("split", True)))

                # 悬浮片头：叠在第一段画面上（放在最后，图层在最上面）
                if title_png and title_overlay and idx == 0:
                    end = min(float(title_cfg.get("duration") or 3),
                              max(0.6, duration - 0.03))
                    overlays.append({
                        "path": title_png["path"],
                        "y": title_png["y"],
                        "start": 0.0,
                        "end": round(end, 3),
                    })

                if mode == "video" and video:
                    self.log.info(f"[{idx + 1}/{len(rows)}] 视频片段 {os.path.basename(video)}"
                                  + (f"（字幕 {len(overlays)} 句）" if overlays else ""))
                    self.video_segment(video, audio, seg, w, h, fps, duration,
                                       video_dur, audio_dur, overlays)
                elif image:
                    self.log.info(f"[{idx + 1}/{len(rows)}] 图片片段 {os.path.basename(image)}"
                                  + (f"（字幕 {len(overlays)} 句）" if overlays else ""))
                    self.image_segment(image, audio, seg, w, h, fps, fill, zoom,
                                       duration, overlays)
                else:
                    self.log.info(f"[{idx + 1}/{len(rows)}] 仅视频片段 {os.path.basename(video)}")
                    self.video_segment(video, audio, seg, w, h, fps, duration,
                                       video_dur, audio_dur, overlays)

                if os.path.exists(seg) and os.path.getsize(seg) > 1024:
                    segments.append(seg)
                else:
                    skipped.append(f"第 {idx + 1} 段合成失败")

            if not segments:
                raise StitchError("没有可用的片段，请先生成或上传图片/视频")

            if progress:
                progress(total, total, "拼接所有片段")
            self.log.info(f"拼接 {len(segments)} 个片段…")
            self.concat(segments, out_path)

            bgm = settings.get("bgm")
            if bgm:
                bgm_abs = self.config.resolve(bgm) if not os.path.isabs(bgm) else bgm
                if os.path.exists(bgm_abs):
                    self.log.info("混入背景音乐…")
                    mixed = out_path + ".bgm.mp4"
                    self.mix_bgm(out_path, bgm_abs, mixed, settings.get("bgmVolume", 0.2))
                    os.replace(mixed, out_path)
                else:
                    self.log.warn("背景音乐文件不存在，已跳过")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        return {
            "path": out_path,
            "duration": self.probe_duration(out_path),
            "segments": len(segments),
            "skipped": skipped,
            "size": os.path.getsize(out_path) if os.path.exists(out_path) else 0,
        }

    @staticmethod
    def _parse_canvas(canvas: str | None) -> tuple[int, int]:
        if canvas and re.match(r"^\d+x\d+$", str(canvas)):
            w, h = str(canvas).split("x")
            return int(w), int(h)
        return 1080, 1920
