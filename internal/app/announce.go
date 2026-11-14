package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// The family announcement: one source for every HOP app, the hub's GET <hub>/announcements.json?app=payhop
// (public, no cookies). The browser never asks the hub (the CSP allows only this origin); this server does,
// waits at most two seconds, keeps the answer five minutes, and keeps the last good copy when the hub goes
// quiet. A hub that is down, slow or answers rubbish means no card: never an error, never a slow page, and
// after one failure nobody waits again for a minute. With no hub address (a stand-alone install) nothing is
// requested at all.

const (
	annTTL     = 5 * time.Minute
	annBackoff = time.Minute
	annTimeout = 2 * time.Second
	annMaxBody = 256 << 10
	annMaxText = 300
)

// annItem is what the browser receives: plain text only, it escapes it when drawing.
type annItem struct {
	ID    string `json:"id"`
	Level string `json:"level"`
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

type annCache struct {
	url     string // empty: ask nobody
	ttl     time.Duration
	backoff time.Duration
	client  *http.Client
	mu      sync.Mutex
	at      time.Time // last attempt
	ok      bool      // the last attempt worked
	item    *annItem  // the last good answer (nil: nothing to show)
	started bool
}

func newAnnCache(hub string) *annCache {
	c := &annCache{ttl: annTTL, backoff: annBackoff,
		client: &http.Client{Timeout: annTimeout, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	if hub = strings.TrimRight(hub, "/"); hub != "" {
		c.url = hub + "/announcements.json?app=payhop"
	}
	return c
}

// Current is the card to show, or nil. It is cheap: the hub is asked at most once per ttl (once per backoff after a failure).
func (c *annCache) Current() *annItem {
	if c.url == "" {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	wait := c.ttl
	if c.started && !c.ok {
		wait = c.backoff
	}
	if c.started && time.Since(c.at) < wait {
		return c.item
	}
	c.started = true
	c.at = time.Now()
	item, err := c.fetch()
	if err != nil {
		c.ok = false // keep the previous copy, if any
		return c.item
	}
	c.ok, c.item = true, item
	return c.item
}

func (c *annCache) fetch() (*annItem, error) {
	res, err := c.client.Get(c.url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, io.ErrUnexpectedEOF
	}
	var doc struct {
		Items []annItem `json:"items"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, annMaxBody)).Decode(&doc); err != nil {
		return nil, err
	}
	var pick *annItem
	for i := range doc.Items { // the hub lists the newest first; a critical one beats a newer calmer one
		it := doc.Items[i]
		it.ID, it.Title = strings.TrimSpace(it.ID), strings.TrimSpace(it.Title)
		if it.ID == "" || it.Title == "" {
			continue
		}
		if it.Level != "critical" && it.Level != "warning" {
			it.Level = "info"
		}
		if pick == nil || (it.Level == "critical" && pick.Level != "critical") {
			cp := it
			pick = &cp
		}
	}
	if pick == nil {
		return nil, nil
	}
	pick.Title = clip(pick.Title, 200)
	pick.Body = ellipsis(strings.TrimSpace(pick.Body), annMaxText)
	if u, err := url.Parse(pick.URL); err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		pick.URL = "" // only a web address may become a link
	}
	return pick, nil
}

func ellipsis(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n]) + "…"
}

func (a *App) apiAnnouncement(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"item": a.ann.Current()})
}
