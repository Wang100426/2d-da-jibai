"""Start the Flask application for the Electron desktop client."""
import json
import sys
import threading

from werkzeug.serving import make_server

from app import app


def main():
    server = make_server("0.0.0.0", 0, app, threaded=True)
    print(json.dumps({"event": "ready", "port": server.server_port}), flush=True)
    threading.Thread(target=lambda: (sys.stdin.read(), server.shutdown()), daemon=True).start()
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
