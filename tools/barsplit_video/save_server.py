# Serves the app's web folder and saves POSTed images: POST /save/<name> with a data URL body.
import base64, http.server, os, sys
WEB, OUT, PORT = sys.argv[1], sys.argv[2], int(sys.argv[3])
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=WEB, **k)
    def do_POST(s):
        name = os.path.basename(s.path)
        body = s.rfile.read(int(s.headers['Content-Length'])).decode()
        open(os.path.join(OUT, name), 'wb').write(base64.b64decode(body.split(',', 1)[1]))
        s.send_response(200); s.end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
