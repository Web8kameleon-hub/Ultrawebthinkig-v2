#!/usr/bin/env python3
import json
import os
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.getenv("LAGTER_PORT", "9500"))
BLOG_PUBLISHER_URL = os.getenv("BLOG_PUBLISHER_URL", "http://blog_publisher:8041")
MIN_ARTICLES_PER_DAY = int(os.getenv("MIN_ARTICLES_PER_DAY", "5"))
MAX_ARTICLES_PER_DAY = int(os.getenv("MAX_ARTICLES_PER_DAY", "9"))
TARGET_QUALITY = float(os.getenv("TARGET_QUALITY", "0.90"))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def trigger_publish_batch() -> dict:
    url = f"{BLOG_PUBLISHER_URL.rstrip('/')}/api/v1/publish/batch"
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body) if body else {}
            return {"ok": True, "status_code": resp.status, "result": data}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, code: int = 200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path in ("/", "/health", "/status"):
            self._send_json(
                {
                    "service": "lagter",
                    "status": "healthy",
                    "publishing_window": f"{MIN_ARTICLES_PER_DAY}-{MAX_ARTICLES_PER_DAY}",
                    "target_quality": TARGET_QUALITY,
                    "blog_publisher_url": BLOG_PUBLISHER_URL,
                    "timestamp": _utc_now(),
                }
            )
            return
        self._send_json({"error": "not_found", "path": self.path, "timestamp": _utc_now()}, 404)

    def do_POST(self):
        if self.path in ("/publish", "/publish/batch"):
            result = trigger_publish_batch()
            self._send_json(
                {
                    "service": "lagter",
                    "action": "publish_batch",
                    "publishing_window": f"{MIN_ARTICLES_PER_DAY}-{MAX_ARTICLES_PER_DAY}",
                    "target_quality": TARGET_QUALITY,
                    "timestamp": _utc_now(),
                    **result,
                },
                200 if result.get("ok") else 502,
            )
            return
        self._send_json({"error": "not_found", "path": self.path, "timestamp": _utc_now()}, 404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Lagter stub running on :{PORT}", flush=True)
    server.serve_forever()
