#!/usr/bin/env python3
"""Minimal Scenario (scenario.gg) API client for art tests.

Credentials come from SCENARIO_API_KEY / SCENARIO_API_SECRET (never commit them).
See docs/art/scenario-tests/README.md for the workflow.

Usage:
  scenario.py upload IMAGE                       -> prints asset id
  scenario.py run MODEL_ID INPUTS.json OUT_DIR   -> runs a generation, downloads outputs
  scenario.py model MODEL_ID                     -> prints the model's inputs

INPUTS.json may reference local files as "@path/to/file.png"; they are uploaded
first and replaced by their asset id (lists of them work too).
"""

import base64
import json
import mimetypes
import os
import sys
import time
import urllib.request

API = "https://api.cloud.scenario.com/v1"


def _auth():
    key, secret = os.environ["SCENARIO_API_KEY"], os.environ["SCENARIO_API_SECRET"]
    return "Basic " + base64.b64encode(f"{key}:{secret}".encode()).decode()


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": _auth(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()[:500]}")


def upload(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    data = base64.b64encode(open(path, "rb").read()).decode()
    res = call("POST", "/assets", {"image": f"data:{mime};base64,{data}", "name": os.path.basename(path)})
    return res["asset"]["id"]


def _resolve(value):
    if isinstance(value, str) and value.startswith("@"):
        return upload(value[1:])
    if isinstance(value, list):
        return [_resolve(v) for v in value]
    return value


def run(model_id, inputs, out_dir):
    inputs = {k: _resolve(v) for k, v in inputs.items()}
    job = call("POST", f"/generate/custom/{model_id}", inputs)["job"]
    job_id = job["jobId"]
    print("job", job_id, flush=True)
    while True:
        job = call("GET", f"/jobs/{job_id}")["job"]
        status = job["status"]
        if status in ("success", "failure", "canceled"):
            break
        print(" ", status, job.get("progress"), flush=True)
        time.sleep(10)
    if status != "success":
        sys.exit(f"job {job_id} {status}: {json.dumps(job)[:800]}")
    os.makedirs(out_dir, exist_ok=True)
    meta = job.get("metadata", {})
    asset_ids = meta.get("assetIds") or job.get("assetIds") or []
    saved = []
    for aid in asset_ids:
        asset = call("GET", f"/assets/{aid}")["asset"]
        url = asset["url"]
        ext = os.path.splitext(url.split("?")[0])[1] or mimetypes.guess_extension(asset.get("mimeType", "")) or ""
        dest = os.path.join(out_dir, f"{aid}{ext}")
        urllib.request.urlretrieve(url, dest)
        saved.append(dest)
        print("saved", dest, asset.get("mimeType"), flush=True)
    json.dump(
        {"model": model_id, "inputs": inputs, "jobId": job_id, "assets": saved, "creditUnits": (job.get("billing") or {}).get("cuCost")},
        open(os.path.join(out_dir, "job.json"), "w"),
        indent=2,
    )
    return saved


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "upload":
        print(upload(sys.argv[2]))
    elif cmd == "run":
        run(sys.argv[2], json.load(open(sys.argv[3])), sys.argv[4])
    elif cmd == "model":
        for i in call("GET", f"/models/{sys.argv[2]}")["model"].get("inputs", []):
            print(i.get("name"), i.get("type"), i.get("default"), (i.get("description") or "")[:100])
