"""一次性生成语音祝福模板，写进 config.yaml 的 voice.templates。

为什么这么做：每个名字都让 AI 现写一句，等于每个名字烧一次 token，
而且推理模型还会把 max_tokens 吃光（正文空、白花钱）。
改成"生成 10 条带 {n} 的模板 → 固定下来 → 每次只换名字"，
之后彻底不联网，0 token，还能保留 AI 写出来的那股人味。

用法：
    python scripts/gen_voice_texts.py            # 生成并打印，不落盘
    python scripts/gen_voice_texts.py --apply    # 顺带写回 config.yaml
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "config.yaml"

SYSTEM = (
    "你在给一个手写签名的直播间写祝福语模板。名字会被替换进 {n} 的位置，"
    "整句会被 TTS 念出来，同一时刻屏幕上正在写这个名字。\n"
    "要求：\n"
    "1. 每句 18~26 个汉字（不含名字），用 {n} 开头代表名字，{n} 只出现一次；\n"
    "2. **{n} 后面必须紧跟一个中文逗号「，」**，再接正文，不要连写；\n"
    "3. **句中标点必须齐全**：两到三个短分句，分句之间用逗号隔开，"
    "最后用句号结尾。整句一个标点都没有的、一口气念不完的，一律不合格；\n"
    "4. 口语、温暖、具体，像主播亲口说的；不要堆四字成语，不要喊口号；\n"
    "5. 不要提直播、签名、主播、屏幕这些字眼；\n"
    "6. 10 句之间立意要错开：健康、事业、感情、钱、心态、家人、旅行、"
    "小确幸、考试/学业、日常起居，尽量不重复用词；\n"
    "7. 不要引号、括号、表情符号、序号、换行。\n"
    '只输出 json：{"plain": ["...", ...10 条], "gift": ["...", ...5 条]}\n'
    "gift 是给送礼观众的，句子更长更热情，22~32 个汉字。"
)


def _load_key() -> tuple[str, str, str]:
    txt = CFG.read_text(encoding="utf-8")
    m = re.search(r"^moderation:\s*$.*?^\s*api_key:\s*\"([^\"]+)\"", txt, re.S | re.M)
    if not m:
        sys.exit("config.yaml 里找不到 moderation.api_key")
    key = m.group(1)
    base = "https://api.deepseek.com/v1"
    mb = re.search(r"^moderation:\s*$.*?^\s*base_url:\s*\"([^\"]+)\"", txt, re.S | re.M)
    if mb:
        base = mb.group(1).rstrip("/")
    return key, base, "deepseek-flash"


def _clean(seq, lo: int, hi: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for s in seq or []:
        t = str(s).strip().strip("\"'“”‘’")
        t = re.sub(r"\s+", "", t)
        if t.count("{n}") != 1 or not t.startswith("{n}"):
            continue
        # 名字后面没有逗号，TTS 会把「张三愿你…」连读成一句，强行补一个
        if not t.startswith("{n}，"):
            t = "{n}，" + t[len("{n}"):].lstrip("，,、:：")
        body = t.replace("{n}", "")
        n = len(re.sub(r"[，。、！？,.!?]", "", body))
        if not (lo <= n <= hi):
            continue
        # 句末之外还要有分句逗号，否则一口气念完
        if len(re.findall(r"[，、；]", body)) < 2:
            continue
        if re.search(r"[直播签名主播屏幕]|[\"'“”‘’()（）【】\[\]]", t):
            continue
        if t[-1] not in "。！？":
            t += "。"
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def main() -> None:
    cached = ROOT / "data" / "voice" / "templates.json"
    if "--reuse" in sys.argv and cached.exists():
        d = json.loads(cached.read_text(encoding="utf-8"))
        plain = _clean(d.get("plain"), 14, 30)[:10]
        gift = _clean(d.get("gift"), 18, 36)[:5]
        print(f"[reuse] 直接沿用 {cached}（普通 {len(plain)} / 送礼 {len(gift)}）")
        for i, s in enumerate(plain, 1):
            print(f"  {i:2d}. {s}")
        for i, s in enumerate(gift, 1):
            print(f" 礼{i:2d}. {s}")
        _apply(plain, gift)
        return

    key, base, model = _load_key()
    body = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": "生成 10 条普通观众模板 + 5 条送礼模板。"}],
        "temperature": 1.15,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=120.0) as c:
        r = c.post(f"{base}/chat/completions", json=body,
                   headers={"Authorization": f"Bearer {key}"})
        r.raise_for_status()
        data = r.json()
    usage = data.get("usage") or {}
    content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    print(f"[usage] {usage}")
    if not content.strip():
        sys.exit("空响应 —— 加大 max_tokens 重试")
    try:
        d = json.loads(content)
    except json.JSONDecodeError as e:
        sys.exit(f"不是 JSON：{e}｜原文：{content[:300]}")

    plain = _clean(d.get("plain"), 14, 30)[:10]
    gift = _clean(d.get("gift"), 18, 36)[:5]
    print(f"\n普通 {len(plain)} 条：")
    for i, s in enumerate(plain, 1):
        print(f"  {i:2d}. {s}")
    print(f"\n送礼 {len(gift)} 条：")
    for i, s in enumerate(gift, 1):
        print(f"  {i:2d}. {s}")
    if len(plain) < 8:
        sys.exit("\n合格条目太少，别写回去")

    out = ROOT / "data" / "voice" / "templates.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"plain": plain, "gift": gift},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n已存 {out}")

    if "--apply" in sys.argv:
        _apply(plain, gift)


def _apply(plain: list[str], gift: list[str]) -> None:
    """把模板写回 config.yaml，并把 source 改成 template（不再联网）。"""
    txt = CFG.read_text(encoding="utf-8")

    def block(items):
        return "".join(f'    - "{s}"\n' for s in items)

    # 行尾可能带中文注释（templates: []   # 留空用内置的 14 句），
    # 所以整行替换，不能只匹配 "templates: []\n"
    txt, n1 = re.subn(r"^  templates:.*$",
                      "  templates:\n" + block(plain).rstrip("\n"),
                      txt, count=1, flags=re.M)
    txt, n2 = re.subn(r"^  gift_templates:.*$",
                      "  gift_templates:\n" + block(gift).rstrip("\n"),
                      txt, count=1, flags=re.M)
    txt, n3 = re.subn(r"^  source: ai\b.*$", "  source: template", txt,
                      count=1, flags=re.M)
    if not (n1 and n2):
        sys.exit(f"config.yaml 没找到 templates/gift_templates 字段（{n1},{n2}），未写入")
    CFG.write_text(txt, encoding="utf-8")
    print(f"\n已写回 config.yaml：模板 {n1}/{n2} 处，source 改写 {n3} 处")
    print("重启服务后生效（python run.py）")


if __name__ == "__main__":
    main()
