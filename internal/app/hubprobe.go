package app

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// hubProbe says whether the hub is up: one GET <hub>/up, which must answer 2xx within a short
// timeout, kept for about a minute. It serves the family rule for a hub that cannot be reached:
// a session this app already holds stays trusted, and nobody is sent to the hub (their browser
// would land on its own error page), signed out or turned into a guest.
type hubProbe struct {
	url     string
	ttl     time.Duration
	mu      sync.Mutex
	at      time.Time
	up      bool
	client  *http.Client
	started bool
}

const (
	hubProbeTTL     = time.Minute
	hubProbeTimeout = 1500 * time.Millisecond
)

func newHubProbe(hub string) *hubProbe {
	return &hubProbe{
		url: strings.TrimRight(hub, "/") + "/up",
		ttl: hubProbeTTL,
		client: &http.Client{Timeout: hubProbeTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
	}
}

// Up is the cached answer; it asks the hub again once the cached one is older than the ttl.
func (p *hubProbe) Up() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.started && time.Since(p.at) < p.ttl {
		return p.up
	}
	up := false
	if res, err := p.client.Get(p.url); err == nil {
		res.Body.Close()
		up = res.StatusCode >= 200 && res.StatusCode < 300
	}
	p.at, p.up, p.started = time.Now(), up, true
	return up
}
