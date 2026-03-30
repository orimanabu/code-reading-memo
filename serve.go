// serve.go — Simple HTTP server for code-canvas.
//
// Serves from the parent directory so that relative paths like
// ../ctags/build-wasm/ resolve correctly.
//
// Usage:
//
//	go run serve.go [--port PORT] [json_file]
//
// Examples:
//
//	go run serve.go                          # start with empty canvas
//	go run serve.go my-notes.json           # load JSON on startup
//	go run serve.go --port 9000 my-notes.json
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const canvasPath = "/code-canvas/canvas.html"

func main() {
	port := flag.Int("port", 8765, "port to listen on")
	flag.Parse()

	// Resolve paths relative to this source file's directory.
	_, selfFile, _, _ := runtime.Caller(0)
	selfDir := filepath.Dir(selfFile)

	// Serve from the directory containing both code-canvas/ and ctags/.
	serveRoot := filepath.Dir(selfDir)
	canvasFile := filepath.Join(selfDir, "canvas.html")

	// Optional: JSON file to inject on startup.
	var initialDataJSON string
	if flag.NArg() > 0 {
		jsonPath, err := filepath.Abs(flag.Arg(0))
		if err != nil {
			log.Fatalf("cannot resolve path: %v", err)
		}
		raw, err := os.ReadFile(jsonPath)
		if err != nil {
			log.Fatalf("cannot read JSON file: %v", err)
		}
		// Validate JSON.
		var v any
		if err := json.Unmarshal(raw, &v); err != nil {
			log.Fatalf("invalid JSON: %v", err)
		}
		// Re-encode to compact form.
		compact, _ := json.Marshal(v)
		initialDataJSON = string(compact)
		fmt.Printf("Data : %s\n", jsonPath)
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(serveRoot)))

	// Intercept canvas.html to inject __initialData when a JSON file was given.
	if initialDataJSON != "" {
		mux.HandleFunc(canvasPath, func(w http.ResponseWriter, r *http.Request) {
			html, err := os.ReadFile(canvasFile)
			if err != nil {
				http.Error(w, "cannot read canvas.html", http.StatusInternalServerError)
				return
			}
			injection := fmt.Sprintf(
				`<script>window.__initialData = %s;</script>`+"\n",
				initialDataJSON,
			)
			body := strings.Replace(
				string(html),
				`<script src="canvas.js">`,
				injection+`<script src="canvas.js">`,
				1,
			)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, body)
		})
	}

	// Wrap the mux to set the correct MIME type for .wasm files.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".wasm") {
			w.Header().Set("Content-Type", "application/wasm")
		}
		mux.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%d", *port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("cannot listen on %s: %v", addr, err)
	}

	url := fmt.Sprintf("http://localhost:%d%s", *port, canvasPath)
	fmt.Printf("Root : %s\n", serveRoot)
	fmt.Printf("Open : %s\n", url)
	fmt.Println("Press Ctrl-C to stop.")

	go func() {
		time.Sleep(400 * time.Millisecond)
		openBrowser(url)
	}()

	if err := http.Serve(ln, handler); err != nil {
		log.Fatal(err)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
