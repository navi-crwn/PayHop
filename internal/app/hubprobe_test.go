package app

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// hubStub answers GET /up with whatever status is set (0 = hang past the probe's timeout) and counts the calls.
type hubStub struct {
	status atomic.Int32
	calls  atomic.Int32
	path   atomic.Value
	method atomic.Value
	srv    *httptest.Server
}

func newHubStub(t *testing.T, status int) *hubStub {
	h := &hubStub{}
	h.status.Store(int32(status))
	h.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.calls.Add(1)
		h.path.Store(r.URL.Path)
		h.method.Store(r.Method)
		if s := int(h.status.Load()); s == 0 {
			time.Sleep(400 * time.Millisecond)
			w.WriteHeader(200)
		} else {
			w.WriteHeader(s)
		}
	}))
	t.Cleanup(h.srv.Close)
	return h
}

func fastProbe(url string) *hubProbe {
	p := newHubProbe(url)
	p.client.Timeout = 100 * time.Millisecond
	p.ttl = 150 * time.Millisecond
	return p
}

func TestProbeAsksGetUpAndNeedsA2xx(t *testing.T) {
	for status, want := range map[int]bool{200: true, 204: true, 301: false, 404: false, 500: false, 502: false, 503: false} {
		h := newHubStub(t, status)
		p := fastProbe(h.srv.URL)
		if got := p.Up(); got != want {
			t.Errorf("hub answering %d: Up() = %v, want %v", status, got, want)
		}
		if h.path.Load() != "/up" || h.method.Load() != "GET" {
			t.Errorf("probe asked %v %v, want GET /up", h.method.Load(), h.path.Load())
		}
	}
}

func TestProbeTimeoutCountsAsDownAndRecovers(t *testing.T) {
	h := newHubStub(t, 0) // hangs
	p := fastProbe(h.srv.URL)
	start := time.Now()
	if p.Up() {
		t.Fatal("a hub that does not answer in time must count as down")
	}
	if time.Since(start) > 300*time.Millisecond {
		t.Fatalf("the probe waited %v: the timeout must be short", time.Since(start))
	}
	h.status.Store(200)
	if p.Up() {
		t.Fatal("the answer is cached: still down until the ttl passes")
	}
	time.Sleep(200 * time.Millisecond)
	if !p.Up() {
		t.Fatal("recovered hub must count as up after the cache expires")
	}
}

func TestProbeCachesForTheTTL(t *testing.T) {
	h := newHubStub(t, 200)
	p := newHubProbe(h.srv.URL) // the real one-minute ttl
	for i := 0; i < 20; i++ {
		p.Up()
	}
	if h.calls.Load() != 1 {
		t.Fatalf("20 questions made %d requests to the hub, want 1", h.calls.Load())
	}
	if p.ttl != time.Minute {
		t.Fatalf("ttl %v", p.ttl)
	}
}

func TestProbeConnectionRefusedIsDown(t *testing.T) {
	h := newHubStub(t, 200)
	url := h.srv.URL
	h.srv.Close()
	if fastProbe(url).Up() {
		t.Fatal("a closed port is a hub that is down")
	}
}

// The family rule, through the real handlers: hub 502, then timeout, then back.
func TestHubDownKeepsTheExistingSessionTrusted(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	hub := newHubStub(t, 200)
	probe := fastProbe(hub.srv.URL)
	a.hubUp = probe.Up
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	restore := goStale(t) // the session is older than the re-check window
	defer restore()

	expire := func() { time.Sleep(200 * time.Millisecond) }
	check := func(label string, wantSignedIn, wantStale bool) {
		t.Helper()
		me := decode(t, mustGet(t, c, srv.URL+"/api/v1/me"))
		if (me["signed_in"] == true) != wantSignedIn || (me["stale"] == true) != wantStale {
			t.Fatalf("%s: /api/v1/me = %v, want signed_in=%v stale=%v", label, me, wantSignedIn, wantStale)
		}
		code, _ := call(t, c, "GET", srv.URL+"/api/v1/saved", nil)
		if wantSignedIn && code != 200 {
			t.Fatalf("%s: saved list answered %d for a trusted session", label, code)
		}
		if !wantSignedIn && code != 401 {
			t.Fatalf("%s: saved list answered %d for a session that must be re-checked", label, code)
		}
	}

	check("hub up, session stale", false, true) // one quiet trip through the hub is right
	hub.status.Store(502)
	expire()
	check("hub 502", true, false) // trusted: not a guest, not stale, nothing to redirect to
	hub.status.Store(0)
	expire()
	check("hub times out", true, false)
	// the session survived the outage: it is still the same signed-in account, in the database
	if u, _ := a.db.UserBySub("1"); u == nil {
		t.Fatal("the account vanished")
	}
	hub.status.Store(200)
	expire()
	check("hub recovered", false, true) // back to asking the hub, once
}

func TestHubDownDoesNotTrustAnUnknownCookie(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	hub := newHubStub(t, 502)
	a.hubUp = fastProbe(hub.srv.URL).Up
	guest := noRedirect()
	if me := decode(t, mustGet(t, guest, srv.URL+"/api/v1/me")); me["signed_in"] == true {
		t.Fatalf("a guest became signed in because the hub is down: %v", me)
	}
	if code, _ := call(t, guest, "GET", srv.URL+"/api/v1/saved", nil); code != 401 {
		t.Fatalf("guest read saved data during an outage: %d", code)
	}
}
