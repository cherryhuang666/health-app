# -*- coding: utf-8 -*-
"""
健康档案 · 多端同步后端（精简 Flask）。

PythonAnywhere
--------------
1. 上传整份站点（含本文件与其他静态文件）到账户目录。
2. Web → 「Code」中选择 WSGI 配置文件 → 修改为指向本模块：
     import sys
     path = '/home/你的用户名/health-app'   # 含 flask_app.py 的目录
     if path not in sys.path:
         sys.path.insert(0, path)
     from flask_app import app as application
3. Web → Environment variables 添加：
     HEALTH_SYNC_TOKEN = （在手机 App「同步码」里填的完全相同的一串密钥，建议 openssl rand -hex 32）

可选 HEALTH_SYNC_PATH：JSON 存档绝对路径（默认写在项目目录 .\_health_cloud.json，勿提交仓库）。

HTTPS 与同域时使用；若在其它域名打开前端仍可访问 API，已对 /api/* 放行简单 CORS。
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from flask import Flask, Response, abort, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent

TOKEN = (os.environ.get('HEALTH_SYNC_TOKEN') or '').strip()
DEFAULT_DATA_PATH = ROOT / "._health_cloud.json"
_raw_path = os.environ.get("HEALTH_SYNC_PATH") or ""
DATA_PATH = Path(_raw_path.strip()) if _raw_path.strip() else DEFAULT_DATA_PATH

app = Flask(__name__)


@app.after_request
def _cors(resp: Response):
    if request.path.startswith("/api/"):
        resp.headers.setdefault("Access-Control-Allow-Origin", "*")
        resp.headers.setdefault(
            "Access-Control-Allow-Headers", "Authorization, Content-Type"
        )
        resp.headers.setdefault("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
    return resp


@app.route("/api/health-sync", methods=["OPTIONS"])
def sync_options():
    return ("", 204)


def _auth_ok() -> bool:
    if not TOKEN:
        return False
    want = "Bearer " + TOKEN
    return request.headers.get("Authorization", "") == want


def _read_envelope() -> dict[str, Any] | None:
    try:
        if not DATA_PATH.is_file():
            return None
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return None
        return raw
    except (OSError, json.JSONDecodeError):
        return None


@app.route("/api/health-sync", methods=["GET"])
def sync_get():
    if not TOKEN:
        return (
            jsonify(
                {"error": "服务器未配置 HEALTH_SYNC_TOKEN，请在控制台设置环境变量"}
            ),
            503,
        )
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401
    env = _read_envelope()
    if not env:
        return jsonify({"savedAt": 0, "state": None})
    return jsonify(env)


@app.route("/api/health-sync", methods=["PUT"])
def sync_put():
    if not TOKEN:
        return (
            jsonify({"error": "服务器未配置 HEALTH_SYNC_TOKEN"}),
            503,
        )
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401
    st = request.get_json(silent=True)
    if st is None or not isinstance(st, dict):
        return jsonify({"error": "Expected JSON object"}), 400
    sa_raw = st.get("savedAt")
    try:
        saved_at = int(sa_raw) if sa_raw is not None else int(time.time() * 1000)
    except (TypeError, ValueError):
        saved_at = int(time.time() * 1000)
    envelope = {"savedAt": saved_at, "state": st}
    try:
        DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = DATA_PATH.with_suffix(DATA_PATH.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(envelope, f, ensure_ascii=False)
        os.replace(tmp, DATA_PATH)
    except OSError as e:
        return jsonify({"error": f"cannot write file: {e}"}), 500
    return jsonify({"ok": True, "savedAt": saved_at})


def _under_root(path: Path) -> bool:
    try:
        path.resolve().relative_to(ROOT.resolve())
        return True
    except ValueError:
        return False


@app.route("/", defaults={"fname": ""})
@app.route("/<path:fname>")
def static_site(fname: str):
    if fname.startswith("api/"):
        abort(404)
    if fname == "" or fname == "index.html":
        return send_from_directory(ROOT, "index.html")
    target = ROOT / fname
    if not _under_root(target):
        abort(404)
    if target.is_file():
        return send_from_directory(ROOT, fname)
    abort(404)


application = app
