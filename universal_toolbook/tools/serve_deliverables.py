#!/usr/bin/env python3
"""Tiny static server with HTTP Range support (needed for video seeking)."""
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else ".")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

MIME = {
    ".html": "text/html; charset=utf-8",
    ".mp4": "video/mp4",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _resolve(self):
        path = unquote(urlparse(self.path).path)
        if path.endswith("/"):
            path += "index.html"
        full = os.path.abspath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT):
            return None
        return full if os.path.isfile(full) else None

    def _headers(self, size, ctype, extra=None):
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-cache")
        for k, v in (extra or {}).items():
            self.send_header(k, v)

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        full = self._resolve()
        if not full:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        size = os.path.getsize(full)
        ctype = MIME.get(os.path.splitext(full)[1].lower(), "application/octet-stream")
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:
                start = max(0, size - int(m.group(2)))
                end = size - 1
            start = min(start, size - 1)
            end = min(end, size - 1)
            length = max(0, end - start + 1)
            self.send_response(206)
            self._headers(length, ctype, {"Content-Range": f"bytes {start}-{end}/{size}"})
            self.end_headers()
            if head_only:
                return
            with open(full, "rb") as fh:
                fh.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = fh.read(min(256 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
            return
        self.send_response(200)
        self._headers(size, ctype)
        self.end_headers()
        if head_only:
            return
        with open(full, "rb") as fh:
            while True:
                chunk = fh.read(256 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"serving {ROOT} on 0.0.0.0:{PORT}", flush=True)
    srv.serve_forever()
