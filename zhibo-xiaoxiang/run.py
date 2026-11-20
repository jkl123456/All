"""Launcher. python run.py [--source mock|external|douyin] [--sketch local|openai]"""
from __future__ import annotations

import argparse
import asyncio
import sys
import webbrowser

import uvicorn

from app import config, main

parser = argparse.ArgumentParser()
parser.add_argument("--source", help="mock | external | douyin")
parser.add_argument("--sketch", help="local | openai | command")
parser.add_argument("--no-browser", action="store_true")
parser.add_argument("--debug", action="store_true")
args = parser.parse_args()

if args.source:
    main.cfg["platform"]["type"] = args.source
    main.source = main.build_source(main.cfg)
if args.sketch:
    main.cfg["sketch"]["provider"] = args.sketch
    main.provider = main.sketch_mod.build_provider(main.cfg["sketch"])
if args.debug:
    main.cfg["platform"].setdefault("douyin", {})["debug"] = True

host = main.cfg["server"]["host"]
port = int(main.cfg["server"]["port"])
url = f"http://{host}:{port}/"
print(f"  叠加层预览: {url}")
print(f"  控制台:     {url}api/status")
print(f"  加一单:     {url}api/simulate?nickname=小明   （浏览器直接打开）")

if not args.no_browser:
    try:
        webbrowser.open(url)
    except Exception:
        pass

uvicorn.run(main.app, host=host, port=port, log_level="warning")
