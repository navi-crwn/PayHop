package app

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/navi-crwn/PayHop/internal/db"
)

// The family announcement: one source, the hub's /announcements.json?app=payhop, fetched by the server.

// fakeHub answers /announcements.json with body and counts the requests (and the raw queries) it gets.
func fakeHub(t *testing.T, body string, delay time.Duration) (*httptest.Server, *atomic.Int32, *atomic.Value) {
	t.Helper()
	var n atomic.Int32
	var q atomic.Value
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/announcements.json" {
			http.NotFound(w, r)
			return
		}
		n.Add(1)
		q.Store(r.URL.RawQuery)
		time.Sleep(delay)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(body))
	}))
	t.Cleanup(h.Close)
	return h, &n, &q
}

func appWithHub(t *testing.T, hubURL string) *httptest.Server {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	a, err := New(Config{Version: "test", SSOClient: "payhop", SSOURL: hubURL}, d, testFiles())
	if err != nil {
		t.Fatal(err)
	}
	a.hubUp = func() bool { return true }
	srv := httptest.NewServer(a.Handler())
	t.Cleanup(srv.Close)
	return srv
}

func announcement(t *testing.T, srv *httptest.Server) (map[string]any, time.Duration) {
	t.Helper()
	start := time.Now()
	res, err := http.Get(srv.URL + "/api/v1/announcement")
	if err != nil {
		t.Fatal(err)
	}
	took := time.Since(start)
	if res.StatusCode != 200 {
		t.Fatalf("announcement: %d", res.StatusCode)
	}
	v := decode(t, res)
	item, _ := v["item"].(map[string]any)
	return item, took
}

const oneInfo = `{"version":1,"items":[{"id":"12","level":"info","title":"Scheduled maintenance","body":"Plain text <b>and</b> a tag.","url":"https://hel.ink/announcements/12","apps":["*"]}]}`

func TestAnnouncementShowsWhatTheHubPublishes(t *testing.T) {
	hub, n, q := fakeHub(t, oneInfo, 0)
	srv := appWithHub(t, hub.URL)
	item, _ := announcement(t, srv)
	if item == nil || item["title"] != "Scheduled maintenance" || item["id"] != "12" || item["url"] != "" { // the test hub is an IP address on http: no link may come from it (annLinkOK is tested on its own)
		t.Fatalf("item: %v", item)
	}
	if item["body"] != "Plain text <b>and</b> a tag." {
		t.Errorf("the body must reach the browser as plain text, untouched: %v", item["body"])
	}
	if q.Load() != "app=payhop" {
		t.Errorf("the hub must be asked for this app only: %v", q.Load())
	}
	// asked once, then kept for minutes
	announcement(t, srv)
	announcement(t, srv)
	if n.Load() != 1 {
		t.Errorf("the hub was asked %d times, want 1 (kept for five minutes)", n.Load())
	}
}

func TestAnnouncementPicksCriticalThenNewest(t *testing.T) {
	hub, _, _ := fakeHub(t, `{"version":1,"items":[
	  {"id":"3","level":"info","title":"Newest info","body":"b","url":"","apps":["*"]},
	  {"id":"2","level":"critical","title":"Critical","body":"b","url":"","apps":["payhop"]},
	  {"id":"1","level":"warning","title":"Old warning","body":"b","url":"","apps":["*"]}]}`, 0)
	item, _ := announcement(t, appWithHub(t, hub.URL))
	if item == nil || item["id"] != "2" || item["level"] != "critical" {
		t.Fatalf("critical must win: %v", item)
	}
	hub2, _, _ := fakeHub(t, `{"version":1,"items":[
	  {"id":"9","level":"info","title":"Newest","body":"b","apps":["*"]},{"id":"8","level":"warning","title":"Older","body":"b","apps":["*"]}]}`, 0)
	item, _ = announcement(t, appWithHub(t, hub2.URL))
	if item == nil || item["id"] != "9" {
		t.Fatalf("without a critical one the newest (first) wins: %v", item)
	}
}

func TestAnnouncementClipsTheBodyAndRefusesUnsafeLinks(t *testing.T) {
	long := strings.Repeat("é", 500)
	hub, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"5","level":"info","title":"T","body":"`+long+`","url":"javascript:alert(1)","apps":["*"]}]}`, 0)
	item, _ := announcement(t, appWithHub(t, hub.URL))
	if item == nil {
		t.Fatal("no item")
	}
	if n := len([]rune(item["body"].(string))); n > 301 { // 300 letters and an ellipsis
		t.Errorf("body is %d letters, want at most 300 (+ellipsis)", n)
	}
	if item["url"] != "" {
		t.Errorf("a javascript: link must be dropped: %v", item["url"])
	}
}

func TestAnnouncementIgnoresItemsWithoutIdOrTitleAndBadJSON(t *testing.T) {
	hub, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"","level":"info","title":"No id","body":"b"},{"id":"4","level":"info","title":"","body":"b"}]}`, 0)
	if item, _ := announcement(t, appWithHub(t, hub.URL)); item != nil {
		t.Errorf("an item without id or title must not show: %v", item)
	}
	bad, _, _ := fakeHub(t, `<html>502</html>`, 0)
	if item, _ := announcement(t, appWithHub(t, bad.URL)); item != nil {
		t.Errorf("garbage must mean no card: %v", item)
	}
	empty, _, _ := fakeHub(t, `{"version":1,"items":[]}`, 0)
	if item, _ := announcement(t, appWithHub(t, empty.URL)); item != nil {
		t.Errorf("no items, no card: %v", item)
	}
}

func TestAnnouncementHubDownMeansNoCardAndNoWait(t *testing.T) {
	hub, _, _ := fakeHub(t, oneInfo, 0)
	dead := hub.URL
	hub.Close() // nothing listens any more
	srv := appWithHub(t, dead)
	item, took := announcement(t, srv)
	if item != nil || took > 2500*time.Millisecond {
		t.Fatalf("dead hub: item %v after %v", item, took)
	}
}

func TestAnnouncementSlowHubIsGivenUpOnAfterTwoSecondsOnce(t *testing.T) {
	hub, n, _ := fakeHub(t, oneInfo, 4*time.Second)
	srv := appWithHub(t, hub.URL)
	item, took := announcement(t, srv)
	if item != nil || took > 2800*time.Millisecond {
		t.Fatalf("slow hub: item %v after %v, want nothing within about 2s", item, took)
	}
	// the next visits do not wait again: the failure is remembered for a minute
	_, again := announcement(t, srv)
	if again > 300*time.Millisecond || n.Load() != 1 {
		t.Errorf("second call took %v with %d hub requests, want instant and 1", again, n.Load())
	}
}

func TestAnnouncementKeepsTheLastCopyWhenTheHubDiesLater(t *testing.T) {
	hub, _, _ := fakeHub(t, oneInfo, 0)
	d, _ := db.Open(":memory:")
	t.Cleanup(func() { d.Close() })
	a, _ := New(Config{Version: "test", SSOClient: "payhop", SSOURL: hub.URL}, d, testFiles())
	a.ann.ttl = 10 * time.Millisecond
	if it := a.ann.Current(); it == nil {
		t.Fatal("first read failed")
	}
	hub.Close()
	time.Sleep(30 * time.Millisecond)
	if it := a.ann.Current(); it == nil || it.ID != "12" {
		t.Errorf("a dead hub must not take the last good copy away: %v", it)
	}
}

func TestAnnouncementWithoutAHubAddressAsksNobody(t *testing.T) {
	hub, n, _ := fakeHub(t, oneInfo, 0)
	_ = hub
	srv := appWithHub(t, "") // a stand-alone install: no hub address
	if item, _ := announcement(t, srv); item != nil {
		t.Errorf("stand-alone: %v", item)
	}
	if n.Load() != 0 {
		t.Errorf("a stand-alone install made %d outgoing requests", n.Load())
	}
}

func TestAnnouncementAnswersCarryNoCookieAndNoLongCache(t *testing.T) {
	hub, _, _ := fakeHub(t, oneInfo, 0)
	srv := appWithHub(t, hub.URL)
	res, _ := http.Get(srv.URL + "/api/v1/announcement")
	if res.Header.Get("Set-Cookie") != "" || res.Header.Get("Cache-Control") != "no-store" {
		t.Errorf("headers: %v", res.Header)
	}
}

func TestAnnouncementIDMustBeAShortPlainToken(t *testing.T) {
	long := strings.Repeat("a", 65)
	for _, id := range []string{long, "a b", "x/../y", `a"b`, "é", "<b>", "a:b"} {
		hub, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"`+id+`","level":"info","title":"T","body":"b"}]}`, 0)
		if item, _ := announcement(t, appWithHub(t, hub.URL)); item != nil {
			t.Errorf("id %q must be skipped, got %v", id, item)
		}
	}
	// a bad id is skipped, the next good item still shows
	hub, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"bad id","level":"info","title":"A"},{"id":"ok_1-x","level":"info","title":"B"}]}`, 0)
	if item, _ := announcement(t, appWithHub(t, hub.URL)); item == nil || item["id"] != "ok_1-x" {
		t.Errorf("the good item must show: %v", item)
	}
	ok64 := strings.Repeat("a", 64)
	hub2, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"`+ok64+`","level":"info","title":"T"}]}`, 0)
	if item, _ := announcement(t, appWithHub(t, hub2.URL)); item == nil {
		t.Error("a 64-character id is allowed")
	}
}

func TestAnnouncementLinkOnlyHttpsOnTheHubsOwnDomain(t *testing.T) {
	for _, tc := range []struct {
		raw, hub string
		want     bool
	}{
		{"https://hel.ink/announcements/12", "https://hub.hel.ink", true},
		{"https://hub.hel.ink/x", "https://hub.hel.ink", true},
		{"https://pay.hel.ink/x", "https://hub.hel.ink", true},
		{"http://hel.ink/x", "https://hub.hel.ink", false},
		{"https://evil.example.com/x", "https://hub.hel.ink", false},
		{"https://hel.ink.evil.com/x", "https://hub.hel.ink", false},
		{"https://evilhel.ink/x", "https://hub.hel.ink", false},
		{"https://user@hel.ink/x", "https://hub.hel.ink", false},
		{"javascript:alert(1)", "https://hub.hel.ink", false},
		{"//hel.ink/x", "https://hub.hel.ink", false},
		{"", "https://hub.hel.ink", false},
		{"https://127.0.0.1:9/x", "https://127.0.0.1:8", true}, // same host
		{"https://10.0.0.2/x", "https://127.0.0.1:8", false},   // an IP hub shares no domain
	} {
		if got := annLinkOK(tc.raw, tc.hub); got != tc.want {
			t.Errorf("annLinkOK(%q, %q) = %v, want %v", tc.raw, tc.hub, got, tc.want)
		}
	}
	// through the endpoint: a link to another site is shown as no link at all
	hub, _, _ := fakeHub(t, `{"version":1,"items":[{"id":"1","level":"info","title":"T","url":"https://evil.example.com/x"}]}`, 0)
	if item, _ := announcement(t, appWithHub(t, hub.URL)); item == nil || item["url"] != "" {
		t.Errorf("foreign link must be dropped: %v", item)
	}
}
