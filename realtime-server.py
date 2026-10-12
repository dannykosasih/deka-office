"""Local realtime server for DeKa Office.

Serves this folder and pushes status.json to every open page the moment it changes
(Server-Sent Events on /events). Anything that writes status.json triggers it: the agent
hooks, set-status.sh, or a hand edit. No GitHub push needed.

    python realtime-server.py [port]        # default 8080, http://127.0.0.1:8080

It only listens on 127.0.0.1, so it is reachable from this computer only.
"""
import functools
import http.server
import json
import os
import queue
import sys
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
STATUS = os.path.join(ROOT, "status.json")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

clients = set()
clients_lock = threading.Lock()


def read_status():
    """status.json as compact JSON text, or None while it is half-written or invalid."""
    try:
        with open(STATUS, encoding="utf-8") as f:
            return json.dumps(json.load(f), separators=(",", ":"))
    except (OSError, ValueError):
        return None


def broadcast(text):
    with clients_lock:
        for q in clients:
            q.put(text)


def watch():
    """Poll the file's mtime and broadcast on change (portable; no extra packages)."""
    last = None
    while True:
        try:
            m = os.stat(STATUS).st_mtime_ns
        except OSError:
            m = None
        if m != last:
            last = m
            text = read_status()
            if text is not None:
                broadcast(text)
        time.sleep(0.2)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/events":
            return self.events()
        return super().do_GET()

    def events(self):
        q = queue.Queue()
        with clients_lock:
            clients.add(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            first = read_status()
            if first is not None:
                self.wfile.write(f"event: status\ndata: {first}\n\n".encode()); self.wfile.flush()
            while True:
                try:
                    text = q.get(timeout=15)
                    self.wfile.write(f"event: status\ndata: {text}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": keep-alive\n\n")  # also detects a closed tab
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            with clients_lock:
                clients.discard(q)

    def log_message(self, fmt, *args):
        if "/events" not in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    threading.Thread(target=watch, daemon=True).start()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=ROOT))
    server.daemon_threads = True
    print(f"DeKa Office realtime server: http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
