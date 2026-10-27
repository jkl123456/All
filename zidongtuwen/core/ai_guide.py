"""用 DeepSeek 分析豆包的回复，决定是否自动回话推进生成。"""

from __future__ import annotations

import json
import re
import time

import requests

SYSTEM_PROMPT = """你是浏览器自动化流程的调度助手，负责盯着豆包的回复。
用户让豆包生成【{kind}】，豆包最新的回复可能是：
1) 在等用户确认、或者在问参数 → 需要回一句让它立刻开始生成；
2) 报错（额度不足、未登录、不支持、内容被拒）→ 应当中止；
3) 正在生成中、或只是普通说明 → 不要打扰，继续等。

只输出一个 JSON 对象，不要输出其他内容：
{{"action":"reply|wait|abort","text":"要发送给豆包的中文指令","reason":"简短原因"}}

规则：
- reply：text 一句中文，直接命令它开始生成，不要提问、不要罗列参数，40 字以内。
- 如果豆包在问用什么参数/模型/时长，就在指令里给出默认值：竖屏 9:16、时长 5~15 秒、保留人物对白与环境声（不要静音）。
- 如果没有明确在等确认，用 wait。
- 报错、需要人工登录、额度不足时用 abort，reason 写清原因。
- 已经推动过 {pushed} 次仍不开始，就不要再 reply，用 wait。"""

FAILURE_PROMPT = """你是自动化流程的修复助手。用户让豆包生成【{kind}】，但这一轮没有拿到结果（没有产物、或数量不够、或等待超时）。
请判断下一步该怎么办。action 只能是 "retry" 或 "abort"，不允许其他取值。
只输出 JSON：
{{"action":"retry","hint":"重试时可以补一句什么提示，可为空","reason":"简短原因"}}

规则：
- 属于临时问题（加载慢、只完成了一部分、回复跑偏、被要求确认、只做了规划没执行）→ retry。
- 属于不可恢复问题（额度不足/次数用完、需要登录、内容违规被拒、明确不支持）→ abort，reason 写清原因。
- hint 用中文，20 字以内，例如「只输出图片」「按 9:16 竖屏生成」；没有就给空字符串。"""


SCAN_PROMPT = """你在帮用户从一段豆包对话里回收已经生成好的图片。
程序刚刚从对话开头一路滚到底部扫描，下面是最近几条回复的文字和实际扫到的图片张数。
只输出一个 JSON 对象：
{{"action":"rescan|accept","expect":0,"reason":"简短原因"}}

规则：
- 文字里能看出这次任务要求生成 N 张图（例如「共 5 张」「为你生成 5 张图片」），而实际扫到 M 张且 M < N → rescan（很可能还有图没加载出来，需要再从头滚一遍）。
- 文字里说明只生成了 M 张、或有失败/被拒/额度不足 → accept。
- expect 填文字里能推断出的应有张数，推断不出填 0。
- 拿不准时用 accept，不要让人反复重扫。"""


class AIGuide:
    def __init__(self, config, log) -> None:
        self.config = config
        self.log = log

    @property
    def enabled(self) -> bool:
        return bool(self.config.get("ai_guide_enabled", True)
                    and self.config.get("deepseek_api_key"))

    def _call(self, system: str, user: str, max_tokens: int = 300,
              allowed: tuple[str, ...] = ("reply", "wait", "abort")) -> dict | None:
        base = str(self.config.get("deepseek_base_url") or "https://api.deepseek.com").rstrip("/")
        model = self.config.get("deepseek_model") or "deepseek-flash"
        key = self.config.get("deepseek_api_key")
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        last_error = ""
        for attempt in range(2):
            try:
                started = time.time()
                resp = requests.post(
                    f"{base}/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json=payload, timeout=25,
                )
                if resp.status_code != 200:
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    raise RuntimeError(last_error)
                data = resp.json()
                content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
                result = self._parse(content, allowed)
                result["elapsed"] = round(time.time() - started, 2)
                return result
            except Exception as exc:
                last_error = str(exc)
                if attempt == 0:
                    time.sleep(1.0)
        self.log.warn(f"AI 判断失败（{last_error[:120]}），本次按默认策略处理")
        return None

    def decide(self, kind: str, prompt: str, reply_text: str, pushed: int) -> dict:
        """返回 {"action": "reply|wait|abort", "text": str, "reason": str}。"""
        if not self.enabled:
            return {"action": "wait", "reason": "AI 推进未启用"}

        max_replies = int(self.config.get("ai_guide_max_replies") or 3)
        if pushed >= max_replies:
            return {"action": "wait", "reason": "已达自动推进上限"}

        user_prompt = (
            f"任务类型：生成{kind}\n"
            f"原始要求（节选）：\n{prompt[:600]}\n\n"
            f"豆包最新回复：\n{reply_text[:1500]}\n\n"
            f"已经推动过 {pushed} 次。请判断如何处理。"
        )
        result = self._call(SYSTEM_PROMPT.format(kind=kind, pushed=pushed), user_prompt)
        if result is None:
            return {"action": "wait", "reason": "AI 调用失败"}
        return result

    def judge_failure(self, kind: str, prompt: str, reply_text: str,
                      attempt: int, max_attempts: int) -> dict:
        """这一轮没拿到产物时，判断要不要重试。"""
        if not self.enabled:
            return {"action": "retry", "hint": "", "reason": "未启用 AI，默认重试"}

        user_prompt = (
            f"任务类型：生成{kind}\n"
            f"要求（节选）：{prompt[:600]}\n\n"
            f"豆包最后回复（可能为空）：\n{(reply_text or '（无回复）')[:1200]}\n\n"
            f"这是第 {attempt}/{max_attempts} 次尝试。"
        )
        result = self._call(FAILURE_PROMPT.format(kind=kind), user_prompt)
        if result is None:
            return {"action": "retry", "hint": "", "reason": "AI 调用失败，默认重试"}
        if str(result.get("action") or "").lower() not in ("retry", "abort"):
            result["action"] = "retry"
        return result

    def scan_advice(self, texts: str, found: int, expected: int) -> dict:
        """扫图数量对不上时：判断是漏扫（再滚一遍）还是对话里确实只有这些图。"""
        default_action = "rescan" if expected and found < expected else "accept"
        if not self.enabled:
            return {"action": default_action, "expect": 0, "reason": "AI 未启用"}
        user_prompt = (
            f"程序应读到的图片张数：{expected or '未知'}\n"
            f"实际扫到：{found} 张\n\n"
            f"对话最近几条回复的文字：\n{(texts or '（无文字）')[:1800]}\n\n"
            "请判断是否需要再从头扫一遍。"
        )
        result = self._call(SCAN_PROMPT, user_prompt, max_tokens=200,
                            allowed=("rescan", "accept"))
        if result is None:
            return {"action": default_action, "expect": 0, "reason": "AI 调用失败"}
        action = str(result.get("action") or "").lower()
        return {
            "action": "rescan" if action == "rescan" else "accept",
            "expect": int(result.get("expect") or 0),
            "reason": str(result.get("reason") or "")[:200],
        }

    @staticmethod
    def _parse(content: str, allowed: tuple[str, ...] = ("reply", "wait", "abort")) -> dict:
        text = (content or "").strip()
        obj = None
        try:
            obj = json.loads(text)
        except Exception:
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                try:
                    obj = json.loads(match.group(0))
                except Exception:
                    obj = None
        fallback = "wait" if "wait" in allowed else allowed[-1]
        if not isinstance(obj, dict):
            return {"action": fallback, "reason": "返回不是 JSON"}

        action = str(obj.get("action") or fallback).lower()
        if action not in allowed:
            action = fallback
        reply = str(obj.get("text") or "").strip()
        if action == "reply" and not reply:
            action = "wait"
        try:
            expect = int(obj.get("expect") or 0)
        except (TypeError, ValueError):
            expect = 0
        return {
            "action": action,
            "text": reply[:120],
            "expect": expect if 1 <= expect <= 30 else 0,
            "reason": str(obj.get("reason") or "")[:200],
        }
