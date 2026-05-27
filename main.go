package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pkg/browser"
)

//go:embed all:frontend/dist
var frontendFS embed.FS

const addr = "localhost:6276"

type FileEntry struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Path   string `json:"path"`
	Source string `json:"source"` // "cli" | "saved"
}

var (
	mu      sync.RWMutex
	entries []FileEntry
)

func savedDir() string {
	if d := os.Getenv("JSON_VIEWER_DIR"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".json_viewer", "files")
}

func templateDir() string {
	if d := os.Getenv("JSON_VIEWER_TEMPLATE_DIR"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".json_viewer", "templates")
}

type TemplateFile struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

func collectJSONPaths(arg string) []string {
	info, err := os.Stat(arg)
	if err != nil {
		return nil
	}
	if !info.IsDir() {
		return []string{arg}
	}
	var paths []string
	filepath.WalkDir(arg, func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(p, ".json") {
			paths = append(paths, p)
		}
		return nil
	})
	return paths
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func isServerRunning() bool {
	conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func main() {
	args := os.Args[1:]

	// Server mode (spawned by client)
	if len(args) > 0 && args[0] == "--server" {
		runServer(args[1:])
		return
	}

	// Client mode
	if isServerRunning() {
		// Add files to existing server
		for _, arg := range args {
			abs, err := filepath.Abs(arg)
			if err != nil {
				fmt.Fprintf(os.Stderr, "json_viewer: %v\n", err)
				continue
			}
			for _, p := range collectJSONPaths(abs) {
				resp, err := http.Post(
					"http://"+addr+"/api/add?path="+url.QueryEscape(p),
					"", nil,
				)
				if err != nil {
					fmt.Fprintf(os.Stderr, "json_viewer: %v\n", err)
					continue
				}
				resp.Body.Close()
			}
		}
		browser.OpenURL("http://" + addr)
		return
	}

	// Spawn server in background
	exe, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "json_viewer: %v\n", err)
		os.Exit(1)
	}

	serverArgs := []string{"--server"}
	for _, arg := range args {
		abs, err := filepath.Abs(arg)
		if err != nil {
			fmt.Fprintf(os.Stderr, "json_viewer: %v\n", err)
			os.Exit(1)
		}
		serverArgs = append(serverArgs, collectJSONPaths(abs)...)
	}

	cmd := exec.Command(exe, serverArgs...)
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "json_viewer: failed to start server: %v\n", err)
		os.Exit(1)
	}
	cmd.Process.Release()
}

func runServer(cliArgs []string) {
	// Load CLI files
	for _, arg := range cliArgs {
		entries = append(entries, FileEntry{
			ID:     newID(),
			Name:   filepath.Base(arg),
			Path:   arg,
			Source: "cli",
		})
	}

	// Load saved files
	dir := savedDir()
	if infos, err := os.ReadDir(dir); err == nil {
		for _, info := range infos {
			if info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
				continue
			}
			p := filepath.Join(dir, info.Name())
			entries = append(entries, FileEntry{
				ID:     newID(),
				Name:   info.Name(),
				Path:   p,
				Source: "saved",
			})
		}
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/files", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entries)
	})

	mux.HandleFunc("/api/content", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		mu.RLock()
		var entry *FileEntry
		for i := range entries {
			if entries[i].ID == id {
				entry = &entries[i]
				break
			}
		}
		mu.RUnlock()
		if entry == nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		data, err := os.ReadFile(entry.Path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})

	mux.HandleFunc("/api/add", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path required", http.StatusBadRequest)
			return
		}
		entry := FileEntry{
			ID:     newID(),
			Name:   filepath.Base(path),
			Path:   path,
			Source: "cli",
		}
		mu.Lock()
		entries = append(entries, entry)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entry)
	})

	mux.HandleFunc("/api/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var v any
		if err := json.Unmarshal(body, &v); err != nil {
			http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}

		name := r.URL.Query().Get("name")
		if name == "" {
			name = "snippet"
		}
		name = strings.TrimSuffix(name, ".json") + ".json"

		d := savedDir()
		if err := os.MkdirAll(d, 0755); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		base := strings.TrimSuffix(name, ".json")
		path := filepath.Join(d, name)
		for i := 1; ; i++ {
			if _, err := os.Stat(path); os.IsNotExist(err) {
				break
			}
			name = fmt.Sprintf("%s_%d.json", base, i)
			path = filepath.Join(d, name)
		}

		if err := os.WriteFile(path, body, 0644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		entry := FileEntry{
			ID:     newID(),
			Name:   name,
			Path:   path,
			Source: "saved",
		}
		mu.Lock()
		entries = append(entries, entry)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entry)
	})

	mux.HandleFunc("/api/templates", func(w http.ResponseWriter, r *http.Request) {
		dir := templateDir()
		var result []TemplateFile
		if infos, err := os.ReadDir(dir); err == nil {
			for _, info := range infos {
				if info.IsDir() || !strings.HasSuffix(info.Name(), ".yaml") {
					continue
				}
				p := filepath.Join(dir, info.Name())
				data, err := os.ReadFile(p)
				if err != nil {
					continue
				}
				result = append(result, TemplateFile{
					Filename: info.Name(),
					Content:  string(data),
				})
			}
		}
		if result == nil {
			result = []TemplateFile{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/api/delete", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		id := r.URL.Query().Get("id")
		mu.Lock()
		idx := -1
		for i := range entries {
			if entries[i].ID == id {
				idx = i
				break
			}
		}
		if idx == -1 {
			mu.Unlock()
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		entry := entries[idx]
		if entry.Source != "saved" {
			mu.Unlock()
			http.Error(w, "cannot delete cli files", http.StatusForbidden)
			return
		}
		entries = append(entries[:idx], entries[idx+1:]...)
		mu.Unlock()

		os.Remove(entry.Path)
		w.WriteHeader(http.StatusNoContent)
	})

	distFS, _ := fs.Sub(frontendFS, "frontend/dist")
	fileServer := http.FileServer(http.FS(distFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		f, err := distFS.Open(path)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "json_viewer: %v\n", err)
		os.Exit(1)
	}

	// Small delay to let the client exit first, then open browser
	go func() {
		time.Sleep(100 * time.Millisecond)
		browser.OpenURL("http://" + addr)
	}()

	http.Serve(ln, mux)
}
