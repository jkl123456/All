"""字幕 / 片头标题渲染：用 PIL 把文字画成透明 PNG，再由 ffmpeg 叠加。"""

from __future__ import annotations

import os
import re
import uuid

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = r"C:\Windows\Fonts"

FONT_CANDIDATES = [
    ("微软雅黑", "msyh.ttc"),
    ("微软雅黑 粗体", "msyhbd.ttc"),
    ("黑体", "simhei.ttf"),
    ("宋体", "simsun.ttc"),
    ("楷体", "simkai.ttf"),
    ("仿宋", "simfang.ttf"),
    ("等线", "Deng.ttf"),
    ("等线 粗体", "Dengb.ttf"),
    ("幼圆", "SIMYOU.TTF"),
    ("华文细黑", "STXIHEI.TTF"),
]

DEFAULT_FONT = "msyh.ttc"

# 每个字幕块的最大字数，超过就按标点继续切
MAX_CHUNK_CHARS = 42


def list_fonts() -> list[dict]:
    fonts = []
    for name, filename in FONT_CANDIDATES:
        path = os.path.join(FONT_DIR, filename)
        if os.path.exists(path):
            fonts.append({"name": name, "path": path.replace("\\", "/"), "file": filename})
    if not fonts:
        fonts.append({"name": "黑体（兜底）", "path": "", "file": ""})
    return fonts


def resolve_font(explicit: str | None) -> str:
    """优先用传入的字体（支持文件名或绝对路径），否则按候选顺序兜底。"""
    if explicit:
        raw = str(explicit).strip()
        if os.path.isabs(raw) and os.path.exists(raw):
            return raw
        candidate = os.path.join(FONT_DIR, raw)
        if os.path.exists(candidate):
            return candidate
    for _, filename in FONT_CANDIDATES:
        path = os.path.join(FONT_DIR, filename)
        if os.path.exists(path):
            return path
    return ""


def parse_color(value: str, default=(255, 255, 255, 255)) -> tuple[int, int, int, int]:
    text = str(value or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(c * 2 for c in text)
    if len(text) == 6:
        try:
            r, g, b = int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)
            return (r, g, b, 255)
        except ValueError:
            return default
    if len(text) == 8:  # RRGGBBAA
        try:
            r, g, b = int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)
            a = int(text[6:8], 16)
            return (r, g, b, a)
        except ValueError:
            return default
    return default


def split_chunks(text: str, limit: int = MAX_CHUNK_CHARS) -> list[str]:
    """按句号等切成适合一屏显示的字幕块。"""
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    sentences = [s.strip() for s in re.split(r"(?<=[。！？!?；;…])", text) if s.strip()]
    if not sentences:
        sentences = [text]

    chunks: list[str] = []
    for sentence in sentences:
        if len(sentence) <= limit:
            chunks.append(sentence)
            continue
        # 太长再按逗号切，并尽量均分
        pieces = [p.strip() for p in re.split(r"(?<=[，,、：:])", sentence) if p.strip()]
        buf = ""
        for piece in pieces:
            if not buf:
                buf = piece
            elif len(buf) + len(piece) <= limit:
                buf += piece
            else:
                chunks.append(buf)
                buf = piece
        if buf:
            if len(buf) <= limit:
                chunks.append(buf)
            else:
                for i in range(0, len(buf), limit):
                    chunks.append(buf[i:i + limit])
    return [c for c in chunks if c]


class SubtitleRenderer:
    def __init__(self, width: int, height: int, out_dir: str, log=None) -> None:
        self.width = width
        self.height = height
        self.out_dir = out_dir
        self.log = log
        os.makedirs(out_dir, exist_ok=True)
        self._scale = max(0.45, height / 1920.0)

    # ------------------------------------------------------------------
    def _font(self, path: str, size: int) -> ImageFont.FreeTypeFont:
        size = max(12, int(round(size * self._scale)))
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            try:
                return ImageFont.truetype(resolve_font(None), size)
            except Exception:
                return ImageFont.load_default()

    @staticmethod
    def _wrap(draw, text: str, font, max_width: int) -> list[str]:
        lines: list[str] = []
        for raw in str(text).split("\n"):
            raw = raw.strip()
            if not raw:
                lines.append("")
                continue
            current = ""
            for ch in raw:
                candidate = current + ch
                if not current or draw.textlength(candidate, font=font) <= max_width:
                    current = candidate
                else:
                    lines.append(current)
                    current = ch
            lines.append(current)
        return lines or [""]

    def render_block(self, text: str, style: dict) -> Image.Image:
        """渲染成整幅画布宽度的透明 PNG（文字居中）。"""
        font_path = resolve_font(style.get("font"))
        font = self._font(font_path, int(style.get("size") or 54))
        stroke_width = max(0, int(style.get("strokeWidth") or 0))
        pad = max(8, int(font.size * 0.28)) + stroke_width
        max_width = int(self.width * float(style.get("maxWidthRatio") or 0.86))

        probe = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        probe_draw = ImageDraw.Draw(probe)
        lines = self._wrap(probe_draw, text, font, max(40, max_width - 2 * pad))

        line_spacing = float(style.get("lineSpacing") or 1.25)
        line_h = int(font.size * line_spacing)
        block_h = line_h * len(lines) + 2 * pad

        img = Image.new("RGBA", (self.width, max(block_h, 1)), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        fill = parse_color(style.get("color"), (255, 255, 255, 255))
        stroke_fill = parse_color(style.get("strokeColor"), (0, 0, 0, 255))
        y = pad
        for line in lines:
            draw.text(
                (self.width // 2, y),
                line,
                font=font,
                fill=fill,
                anchor="ma",
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
            y += line_h
        return img

    def save_png(self, text: str, style: dict, prefix: str = "sub") -> tuple[str, int]:
        img = self.render_block(text, style)
        path = os.path.join(self.out_dir, f"{prefix}_{uuid.uuid4().hex[:8]}.png")
        img.save(path)
        return path, img.height

    def position_y(self, block_h: int, style: dict) -> int:
        margin = int(round(float(style.get("margin") or 0) * self._scale))
        position = (style.get("position") or "bottom").lower()
        if position == "top":
            return margin
        if position == "center":
            return max(0, (self.height - block_h) // 2)
        return max(0, self.height - block_h - margin)

    # ------------------------------------------------------------------
    def build_subtitles(self, text: str, style: dict, duration: float,
                        split: bool = True) -> list[dict]:
        """返回 [{path, y, start, end}]，按字数比例分配每句的显示时间。"""
        if not style.get("enabled", True):
            return []
        chunks = split_chunks(text) if split else ([str(text).strip()] if str(text).strip() else [])
        if not chunks:
            return []

        total_chars = sum(max(1, len(c)) for c in chunks)
        items: list[dict] = []
        cursor = 0.0
        for chunk in chunks:
            share = max(1, len(chunk)) / total_chars
            span = max(0.9, duration * share)
            start = cursor
            end = min(duration, cursor + span)
            path, height = self.save_png(chunk, style)
            items.append({
                "path": path,
                "y": self.position_y(height, style),
                "start": round(start, 3),
                "end": round(end, 3),
            })
            cursor = end
        # 最后一块对齐到结尾，避免时长抖动留下空隙
        if items:
            items[-1]["end"] = round(max(items[-1]["start"] + 0.5, duration), 3)
        return items

    def build_title(self, text: str, style: dict) -> dict | None:
        text = str(text or "").strip()
        if not text:
            return None
        path, height = self.save_png(text, style, prefix="title")
        return {"path": path, "y": self.position_y(height, style)}
