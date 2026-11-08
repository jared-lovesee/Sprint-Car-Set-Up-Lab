# Static file server that also saves PUT bodies into ./out/ (local scratch use only).
import http.server, os, sys
root, port = sys.argv[1], int(sys.argv[2])
os.chdir(root)
os.makedirs('out', exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def do_PUT(self):
        name = os.path.basename(self.path.split('?')[0])
        n = int(self.headers.get('Content-Length', 0))
        with open(os.path.join('out', name), 'wb') as f:
            f.write(self.rfile.read(n))
        self.send_response(204); self.end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
