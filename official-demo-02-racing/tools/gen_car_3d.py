#!/usr/bin/env python
"""驱动 Hunyuan 3D 生成：用本地四视图直接调云端接口（多视角 + base64）。

用法:
  python tools/gen_car_3d.py --car car-01 --mode multiview --face-count 120000
  python tools/gen_car_3d.py --car car-01 --mode single
  python tools/gen_car_3d.py --status <job_id>
token 从 stdin 读取。
"""
import argparse
import base64
import importlib.util
import json
import os
import sys

SKILL = r"H:/anything/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/buddy-multimodal-generation/scripts/buddy-cloud.py"


def load_module():
    spec = importlib.util.spec_from_file_location("buddy_cloud", SKILL)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def upload_uguu(path, max_side=896, quality=90):
    """把本地图压到 ~120KB 后传到临时图床，返回公网 URL（服务端只接受 http(s) 地址）。"""
    import io
    import requests
    from PIL import Image

    im = Image.open(path).convert("RGB")
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    r = requests.post(
        "https://uguu.se/upload.php",
        files={"files[]": ("view.jpg", buf.getvalue(), "image/jpeg")},
        timeout=60,
    )
    r.raise_for_status()
    js = r.json()
    if not js.get("success"):
        raise RuntimeError("upload failed: %s" % js)
    return js["files"][0]["url"]


def b64(path, max_side=1024, quality=90):
    """读图 -> 缩放 -> JPEG -> base64，控制请求体积（服务端上限 10MB）。"""
    from PIL import Image
    import io

    im = Image.open(path).convert("RGB")
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def data_uri(path, max_side=1024):
    return "data:image/jpeg;base64," + b64(path, max_side)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--car", default="car-01")
    ap.add_argument("--mode", default="multiview", choices=["multiview", "single"])
    ap.add_argument("--face-count", type=int, default=120000)
    ap.add_argument("--pbr", action="store_true")
    ap.add_argument("--prompt", default="")
    ap.add_argument("--status", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    mod = load_module()
    token = sys.stdin.readline().strip()
    if not token:
        print(json.dumps({"error": "NO_TOKEN"}))
        return 2
    mod._ACTIVE_TOKEN = token

    endpoint = mod._DEFAULT_ENDPOINT
    cfg = mod._PROVIDER_MAP["3d"]

    if args.status:
        result = mod._call_api(endpoint, cfg["provider"], cfg["service"],
                               cfg["version"], cfg["query_action"],
                               {"JobId": args.status}, token)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "assets", "cars", args.car)
    body = {"Model": "3.1"}
    if args.prompt:
        body["Prompt"] = args.prompt

    if args.mode == "multiview":
        body["ImageBase64"] = b64(os.path.join(root, "front.png"), 896)
        views = [("right", "side.png"), ("back", "rear.png"), ("top", "top.png")]
        body["MultiViewImages"] = [
            {"ViewType": vt, "ViewImageUrl": upload_uguu(os.path.join(root, fn))}
            for vt, fn in views
        ]
        print("[INFO] multiview urls: %s" % [v["ViewImageUrl"] for v in body["MultiViewImages"]],
              file=sys.stderr)
    else:
        body["ImageBase64"] = b64(os.path.join(root, "side.png"), 1024)

    body["EnablePBR"] = bool(args.pbr)
    body["FaceCount"] = args.face_count
    body["GenerateType"] = "Normal"

    print("[INFO] payload MB=%.1f" % (len(json.dumps(body)) / 1048576.0), file=sys.stderr)
    resp = mod._call_api(endpoint, cfg["provider"], cfg["service"], cfg["version"],
                         cfg["submit_action"], body, token)
    print(json.dumps(resp, ensure_ascii=False, indent=2), file=sys.stderr)
    job = resp.get("JobId")
    if not job:
        print(json.dumps({"error": "NO_JOB_ID", "raw": resp}, ensure_ascii=False))
        return 1
    print("[INFO] job=%s" % job, file=sys.stderr)
    result = mod._poll_job(endpoint, cfg["provider"], cfg["service"], cfg["version"],
                           cfg["query_action"], job, token, 8, 900)
    out = {"job_id": job, "result": result}
    text = json.dumps(out, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
