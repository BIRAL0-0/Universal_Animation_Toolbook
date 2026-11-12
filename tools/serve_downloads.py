#!/usr/bin/env python3
"""Static file server for hand-off downloads.

The workspace file viewer opens binaries in-app but has no save affordance, so
deliverables were visible yet not retrievable. This serves a small directory over
the workspace preview with browser-friendly semantics:

  * threaded, so a video scrub + a parallel download never block each other
  * HTTP Range support, so <video> seeking works (Safari refuses without it)
  * ``?dl=1`` forces Content-Disposition: attachment
  * no host/origin allowlist and no X-Frame-Options, so it renders inside the
    preview iframe from any host it is proxied under

Usage:
    python3 tools/serve_downloads.py <directory> [--port 8080]
"""
from __future__ import annotations

import argparse
import os
import posixpath
import re
import urllib.parse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CHUNK = 1024 * 256


class DownloadHandler(SimpleHTTPRequestHandler):
    server_version = "DownloadServer/1.0"
    protocol_version = "HTTP/1.1"

    def end_headers(self) -> None:
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        self._serve(head_only=False)

    def do_HEAD(self) -> None:  # noqa: N802 - http.server API
        self._serve(head_only=True)

    # ------------------------------------------------------------------ internals

    def _local_path(self) -> str | None:
        parsed = urllib.parse.urlparse(self.path)
        rel = urllib.parse.unquote(parsed.path)
        rel = posixpath.normpath(rel).lstrip("/")
        if rel in ("", "."):
            rel = "index.html"
        full = os.path.join(os.getcwd(), rel)
        root = os.getcwd()
        if not os.path.abspath(full).startswith(root + os.sep) and os.path.abspath(full) != root:
            return None  # traversal attempt
        return full

    def _serve(self, *, head_only: bool) -> None:
        path = self._local_path()
        if path is None or not os.path.isfile(path):
            self._not_found()
            return

        parsed = urllib.parse.urlparse(self.path)
        force_dl = "dl=1" in parsed.query
        size = os.path.getsize(path)
        ctype = self.guess_type(path)

        rng = self.headers.get("Range")
        start, end = 0, size - 1
        partial = False
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:  # suffix range: bytes=-500
                    start = max(0, size - int(m.group(2)))
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                partial = True

        length = end - start + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT if partial else HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        if force_dl:
            name = os.path.basename(path)
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.end_headers()
        if head_only:
            return

        with open(path, "rb") as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                buf = fh.read(min(CHUNK, remaining))
                if not buf:
                    break
                try:
                    self.wfile.write(buf)
                except (BrokenPipeError, ConnectionResetError):
                    return  # client cancelled the download; nothing to clean up
                remaining -= len(buf)

    def _not_found(self) -> None:
        body = b"Not found"
        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("directory", nargs="?", default=".")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    os.chdir(args.directory)
    httpd = ThreadingHTTPServer(("0.0.0.0", args.port), DownloadHandler)
    httpd.daemon_threads = True
    print(f"serving {os.getcwd()} on 0.0.0.0:{args.port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
