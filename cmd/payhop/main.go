// PayHop server: serves the browser app (payment QR generator and split bill)
// from web/dist with its CSP, signs people in with HOP ID and answers the
// family's signed /hop/* protocol. It never handles money. Settings come from the environment
// (deploy/payhop.env.example); flags override the two that matter locally.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/navi-crwn/PayHop/internal/app"
	"github.com/navi-crwn/PayHop/internal/db"
	"github.com/navi-crwn/PayHop/web"
)

// version is set at build time: go build -ldflags "-X main.version=0.2.0".
var version = "dev"

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func list(key, def string) []string {
	var out []string
	for _, v := range strings.Split(env(key, def), ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func main() {
	addr := flag.String("addr", env("PAYHOP_ADDR", "127.0.0.1:8105"), "listen address")
	dbPath := flag.String("db", env("PAYHOP_DB", "payhop.db"), "SQLite database file")
	static := flag.String("static", env("PAYHOP_STATIC", ""), "serve the browser app from this folder instead of the embedded copy (development)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}

	base := strings.TrimRight(env("PAYHOP_BASE_URL", "http://localhost:8105"), "/")
	secure := strings.HasPrefix(base, "https://")
	if v := os.Getenv("PAYHOP_SECURE_COOKIES"); v != "" {
		secure = v == "1" || v == "true"
	}
	cfg := app.Config{
		Version:       version,
		BaseURL:       base,
		SSOURL:        strings.TrimRight(env("PAYHOP_SSO_URL", ""), "/"),
		SSOSecret:     env("PAYHOP_SSO_SECRET", ""),
		SSOClient:     env("PAYHOP_SSO_CLIENT", "payhop"),
		HopClients:    list("PAYHOP_HOP_CLIENTS", "imperium,helink"),
		SecureCookies: secure,
	}
	if cfg.SSOURL != "" && !cfg.SSOEnabled() {
		log.Fatal("PAYHOP_SSO_URL is set but PAYHOP_SSO_SECRET is shorter than 32 characters")
	}

	d, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer d.Close()

	var files fs.FS = web.Dist()
	if *static != "" {
		files = os.DirFS(*static)
	}
	a, err := app.New(cfg, d, files)
	if err != nil {
		log.Fatalf("app: %v (run `npm run build` first)", err)
	}

	srv := &http.Server{
		Addr:              *addr,
		Handler:           a.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := d.PurgeExpired(72 * time.Hour); err != nil {
					log.Printf("purge: %v", err)
				}
			}
		}
	}()
	go func() {
		<-ctx.Done()
		sh, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(sh)
	}()

	sso := "off"
	if cfg.SSOEnabled() {
		sso = cfg.SSOURL + "/sso/" + cfg.SSOClient
	}
	log.Printf("PayHop %s on http://%s (base %s, sign-in %s)", version, *addr, base, sso)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
