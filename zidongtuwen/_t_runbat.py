"""跑一遍启动脚本的副本（不真的开浏览器），确认 cmd 能正确解析。"""
import subprocess

with open("启动.bat", "r", encoding="utf-8", newline="") as fp:
    text = fp.read()

text = text.replace('start "" "http://127.0.0.1:8849"', "echo SKIP_OPEN_BROWSER")
with open("_t_check.bat", "w", encoding="utf-8", newline="\r\n") as fp:
    fp.write(text)

proc = subprocess.run(["cmd", "/c", "_t_check.bat"], capture_output=True, text=True,
                      encoding="gbk", errors="replace")
print("---- output ----")
print(proc.stdout.strip())
print("---- exit:", proc.returncode)
