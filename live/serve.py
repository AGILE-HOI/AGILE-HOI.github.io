#!/usr/bin/env python3
"""No-cache dev server for AGILE·Live.

Run from anywhere:   python3 live/serve.py   (optionally: python3 live/serve.py 8000)
Then open the printed URL. Every response is sent with no-cache headers, so a plain
refresh always loads your latest edits — no more stale-cache surprises.
Serves the repo root so the app's ../static/... asset paths resolve.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
# serve the repo root (parent of live/) so ../static resolves
os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


print(f"AGILE·Live (no-cache)  →  http://localhost:{PORT}/live/")
print("Just refresh the page after edits. Ctrl-C to stop.")
try:
    Server(("", PORT), NoCacheHandler).serve_forever()
except KeyboardInterrupt:
    print("\nstopped")
