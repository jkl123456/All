"""临时：重新拆分分集 txt（覆盖旧文件）。"""
import io
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

base = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(base, "wenan", "中国版马斯克_20集短剧.md")
out_dir = os.path.join(base, "wenan", "分集")
os.makedirs(out_dir, exist_ok=True)

with open(src, "r", encoding="utf-8") as fp:
    text = fp.read()

parts = re.split(r"^## 第\s*(\d+)\s*集\s*(.+?)\s*$", text, flags=re.M)
count = 0
for i in range(1, len(parts), 3):
    num = parts[i].strip()
    title = parts[i + 1].strip()
    body = parts[i + 2] if i + 2 < len(parts) else ""
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    if len(lines) != 6:
        print(f"[WARN] 第 {num} 集有 {len(lines)} 段")
    name = f"第{num.zfill(2)}集_{title}.txt"
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    dialogues = sum(1 for ln in lines if "：" in ln or ":" in ln)
    print(f"{name} -> {len(lines)} 段，含台词段 {dialogues}")
    count += 1

print("total episodes:", count)
