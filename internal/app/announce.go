package app

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
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
	hub     string // the hub address: a link may only point at its own domain
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
		c.hub = hub
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
		if !annIDRe.MatchString(it.ID) || it.Title == "" { // the id becomes a storage key in the browser: a short plain token only
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
	if !annLinkOK(pick.URL, c.hub) {
		pick.URL = "" // only an https address on the hub's own domain may become a link
	}
	return pick, nil
}

var annIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// annLinkOK: only https, and only the hub's own host or a host under the same two-label domain (hel.ink for hub.hel.ink).
// An IP-address hub shares a domain with nobody but itself.
func annLinkOK(raw, hub string) bool {
	u, err := url.Parse(raw)
	h, err2 := url.Parse(hub)
	if err != nil || err2 != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || h.Hostname() == "" {
		return false
	}
	dom := func(host string) string {
		p := strings.Split(strings.ToLower(host), ".")
		if len(p) <= 2 {
			return strings.Join(p, ".")
		}
		return strings.Join(p[len(p)-2:], ".")
	}
	uh, hh := u.Hostname(), h.Hostname()
	return strings.EqualFold(uh, hh) || (net.ParseIP(hh) == nil && strings.Contains(hh, ".") && dom(uh) == dom(hh))
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
