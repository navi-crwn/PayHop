package app

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/navi-crwn/PayHop/internal/db"
	"github.com/navi-crwn/PayHop/web"
)

// The Feedback link is built in the browser from the hub address and the version this answer carries.
// It is a plain link: the server gets no new route and keeps nothing.
func TestMeCarriesVersionAndHubAddressForFeedbackLink(t *testing.T) {
	_, srv := newTestApp(t, true)
	me := decode(t, mustGet(t, noRedirect(), srv.URL+"/api/v1/me"))
	if me["version"] != "test" {
		t.Fatalf("version = %v, want test", me["version"])
	}
	if me["hub_url"] != "https://hub.example.org" {
		t.Fatalf("hub_url = %v", me["hub_url"])
	}
}

func TestMeWithoutHubAddressGivesNoHubAddress(t *testing.T) {
	_, srv := newTestApp(t, false)
	me := decode(t, mustGet(t, noRedirect(), srv.URL+"/api/v1/me"))
	if _, has := me["hub_url"]; has {
		t.Fatalf("hub_url present without a hub: %v", me["hub_url"])
	}
}

// builtAppWith serves the real web/dist (which states the site address, so the first views are written) with this config.
func builtAppWith(t *testing.T, cfg Config) *httptest.Server {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	a, err := New(cfg, d, web.Dist())
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(a.Handler())
	t.Cleanup(srv.Close)
	return srv
}

func privacyFirstView(t *testing.T, base, lang string) string {
	t.Helper()
	res, err := http.Get(base + "/privacy?lang=" + lang)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return string(b)
}

// The page the server writes for readers without scripts and for search engines carries the same Privacy
// sentence as the app, and only where the app shows the Feedback link (a hub address is set).
func TestPrivacyFirstViewHasTheFeedbackSentenceOnlyWithAHub(t *testing.T) {
	withHub := builtAppWith(t, Config{Version: "test", SSOClient: "payhop", SSOURL: "https://hub.example.org", SSOSecret: testSecret})
	noHub := builtAppWith(t, Config{Version: "test"})
	for _, lang := range pageLangs {
		body := privacyFirstView(t, withHub.URL, lang)
		if !strings.Contains(body, `id="feedbackNote"`) || !strings.Contains(body, `<a href="https://hub.example.org/privacy" rel="noopener">`) {
			t.Errorf("%s: the Feedback sentence with the hub privacy link is missing", lang)
		}
		if strings.Contains(body, "{link}") || strings.Contains(body, "hel.ink at") {
			t.Errorf("%s: placeholder left or a fixed address named", lang)
		}
		if strings.Contains(privacyFirstView(t, noHub.URL, lang), "feedbackNote") {
			t.Errorf("%s: the sentence is shown without a hub address", lang)
		}
	}
	en := privacyFirstView(t, withHub.URL, "en")
	if !strings.Contains(en, "The Feedback link opens a form on the HOP ID site this app is connected to.") || !strings.Contains(en, "Nothing is sent to our server") {
		t.Errorf("english first view: sentence or the existing promise missing")
	}
	for _, p := range []string{"/terms", "/generate"} {
		res, _ := http.Get(withHub.URL + p)
		b, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if strings.Contains(string(b), "feedbackNote") {
			t.Errorf("%s carries the Privacy sentence", p)
		}
	}
}

func TestFeedbackHubOnlyTakesHTTPAddresses(t *testing.T) {
	for in, want := range map[string]string{"https://hel.ink/": "https://hel.ink", "http://127.0.0.1:8617": "http://127.0.0.1:8617", "": "", "javascript:alert(1)": "", "hel.ink": "", "ftp://x.y": ""} {
		if got := feedbackHub(in); got != want {
			t.Errorf("feedbackHub(%q) = %q, want %q", in, got, want)
		}
	}
}
