// Sprint Car Setup Lab launcher.
// Serves the embedded lab on 127.0.0.1 and opens it in an app window.
// The program exits when the window is closed.
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

//go:embed web
var webFS embed.FS

const appName = "Sprint Car Setup Lab"

func main() {
	noBrowser := flag.Bool("nobrowser", false, "serve only; print the address")
	// fixed default port so the window's saved data (help card, saved setups) survives restarts
	port := flag.Int("port", 47392, "port to serve on (0 = any free port)")
	flag.Parse()

	sub, _ := fs.Sub(webFS, "web")
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil && *port != 0 {
		// port taken: run anyway on a free one (saved setups won't show this session)
		ln, err = net.Listen("tcp", "127.0.0.1:0")
	}
	if err != nil {
		fatal("Could not start the lab's local server.\n\n" + err.Error())
	}
	url := fmt.Sprintf("http://%s/", ln.Addr().String())

	var mu sync.Mutex
	last := time.Time{}
	closed := false
	var byeAt time.Time
	beat := func() { mu.Lock(); last = time.Now(); closed = false; mu.Unlock() }

	mux := http.NewServeMux()
	files := http.FileServer(http.FS(sub))
	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		beat()
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/bye", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		closed = true
		byeAt = time.Now()
		mu.Unlock()
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if len(r.URL.Path) > 4 && r.URL.Path[len(r.URL.Path)-4:] == ".glb" {
			w.Header().Set("Content-Type", "model/gltf-binary")
		}
		files.ServeHTTP(w, r)
	})
	go http.Serve(ln, mux)

	if *noBrowser {
		fmt.Println(url)
		select {}
	}
	if err := openWindow(url); err != nil {
		fatal("Could not open a window for the lab.\n\n" + err.Error() +
			"\n\nYou can still use it by opening this address in Edge or Chrome:\n" + url)
	}

	// Exit rules: the page pings every 2 s and sends /bye when the window closes.
	// A reload also sends /bye, but its pings resume within a second or two.
	start := time.Now()
	for {
		time.Sleep(time.Second)
		mu.Lock()
		l, c, b := last, closed, byeAt
		mu.Unlock()
		switch {
		case l.IsZero() && time.Since(start) > 90*time.Second:
			fatal("The lab window did not start.\n\nTry opening this address in Edge or Chrome:\n" + url)
		case c && time.Since(b) > 6*time.Second:
			os.Exit(0)
		case !l.IsZero() && time.Since(l) > 45*time.Second:
			os.Exit(0)
		}
	}
}
