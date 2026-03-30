#!/usr/bin/env python3
"""Serve code-canvas from the parent directory so that relative paths like
../ctags/build-wasm/ resolve correctly.

Usage:
    python3 serve.py [--port PORT] [json_file]

Examples:
    python3 serve.py                         # start with empty canvas
    python3 serve.py my-notes.json           # load JSON on startup
    python3 serve.py --port 9000 my-notes.json
"""

import argparse
import http.server
import json
import os
import sys
import threading
import webbrowser

# Serve from the directory that contains both code-canvas/ and ctags/
SERVE_ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANVAS_PATH = '/code-canvas/canvas.html'
CANVAS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'canvas.html')

_initial_data_json = None  # JSON string injected into canvas.html, or None


def build_handler():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=SERVE_ROOT, **kwargs)

        def do_GET(self):
            # Intercept canvas.html to inject __initialData when a JSON file
            # was specified on the command line.
            if _initial_data_json is not None and self.path.split('?')[0] == CANVAS_PATH:
                self._serve_canvas_with_data()
            else:
                super().do_GET()

        def _serve_canvas_with_data(self):
            with open(CANVAS_FILE, 'rb') as f:
                html = f.read().decode('utf-8')

            injection = (
                f'<script>window.__initialData = {_initial_data_json};</script>\n'
            )
            html = html.replace('<script src="canvas.js">', injection + '<script src="canvas.js">', 1)
            body = html.encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def guess_type(self, path):
            if str(path).endswith('.wasm'):
                return 'application/wasm'
            return super().guess_type(path)

        def log_message(self, fmt, *args):
            # Show only non-200/304 responses to keep output clean
            code = args[1] if len(args) > 1 else '-'
            if code not in ('200', '304'):
                super().log_message(fmt, *args)

    return Handler


def open_browser(url):
    import time
    time.sleep(0.4)
    webbrowser.open(url)


def main():
    global _initial_data_json

    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--port', type=int, default=8765, metavar='PORT',
                        help='port to listen on (default: 8765)')
    parser.add_argument('json_file', nargs='?', metavar='json_file',
                        help='exported canvas JSON file to load on startup')
    args = parser.parse_args()

    if args.json_file:
        path = os.path.abspath(args.json_file)
        with open(path) as f:
            data = json.load(f)          # validate JSON
        _initial_data_json = json.dumps(data)
        print(f'Data : {path}')

    url = f'http://localhost:{args.port}{CANVAS_PATH}'
    print(f'Root : {SERVE_ROOT}')
    print(f'Open : {url}')
    print('Press Ctrl-C to stop.\n')

    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    with http.server.HTTPServer(('', args.port), build_handler()) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')


if __name__ == '__main__':
    main()
