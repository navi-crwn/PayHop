package app

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/navi-crwn/PayHop/internal/db"
	"github.com/navi-crwn/PayHop/web"
)

const siteOrigin = "https://pay.hel.ink"

// builtApp serves the real web/dist, so these tests read the HTML a crawler gets.
func builtApp(t *testing.T) *httptest.Server {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	a, err := New(Config{Version: "test"}, d, web.Dist())
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(a.Handler())
	t.Cleanup(srv.Close)
	return srv
}

func fetchPage(t *testing.T, url string) (http.Header, string) {
	t.Helper()
	res, err := noRedirect().Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.Header, string(b)
}

func one(t *testing.T, path, what, body string, re *regexp.Regexp) string {
	t.Helper()
	m := re.FindAllStringSubmatch(body, -1)
	if len(m) != 1 {
		t.Errorf("%s: %d %s, want 1", path, len(m), what)
		return ""
	}
	return m[0][len(m[0])-1]
}

func sitemapRoutes() []string {
	var out []string
	for _, p := range publicPages {
		out = append(out, p.Path)
	}
	return out
}

func TestPublicPagesAreReadableWithoutScripts(t *testing.T) {
	srv := builtApp(t)
	titles := map[string]string{}
	for _, path := range sitemapRoutes() {
		h, body := fetchPage(t, srv.URL+path+"?utm_source=x")
		if h.Get("X-Robots-Tag") != "" {
			t.Errorf("%s: a public page says %q", path, h.Get("X-Robots-Tag"))
		}
		one(t, path, "h1", body, regexp.MustCompile(`<h1[ >]`))
		if got := one(t, path, "canonical", body, regexp.MustCompile(`<link rel="canonical" href="([^"]*)">`)); got != siteOrigin+path {
			t.Errorf("%s: canonical %q", path, got)
		}
		if got := one(t, path, "og:url", body, regexp.MustCompile(`<meta property="og:url" content="([^"]*)">`)); got != siteOrigin+path {
			t.Errorf("%s: og:url %q", path, got)
		}
		if one(t, path, "description", body, regexp.MustCompile(`<meta name="description" content="([^"]+)">`)) == "" {
			t.Errorf("%s: no description", path)
		}
		title := one(t, path, "title", body, regexp.MustCompile(`<title>([^<]+)</title>`))
		if other, dup := titles[title]; dup || title == "" {
			t.Errorf("%s: title %q is also the title of %s", path, title, other)
		}
		titles[title] = path
		if strings.Contains(body, "hreflang") {
			t.Errorf("%s: hreflang without one address per language", path)
		}
	}
	for _, p := range publicPages {
		_, body := fetchPage(t, srv.URL+p.Path)
		if !strings.Contains(body, `<div id="root"><header class="top">`) || !strings.Contains(body, `<main class="hop-static">`) {
			t.Errorf("%s: no first view inside the mount node", p.Path)
		}
		for _, o := range publicPages {
			if o.Path != p.Path && !strings.Contains(body, `<a href="`+o.Path+`">`) {
				t.Errorf("%s: no plain link to %s", p.Path, o.Path)
			}
		}
	}
}

// Round 2: the first view is visible by default (round 1 hid it and showed it only with scripts off), it is drawn
// with the app's own classes, its h1 is the app's heading, and the only thing for scripts-off readers is one sentence.
func TestFirstViewIsVisibleAndSaysWhatTheAppSays(t *testing.T) {
	srv := builtApp(t)
	dict := englishStrings()
	tags := regexp.MustCompile(`<[^>]*>`)
	for _, p := range publicPages {
		_, body := fetchPage(t, srv.URL+p.Path)
		if strings.Contains(body, "display:none") || strings.Contains(body, "<noscript><style>") || strings.Contains(body, "<style>.hop-static") {
			t.Errorf("%s: the first view is hidden or restyled by an inline style", p.Path)
		}
		h1 := one(t, p.Path, "h1", body, regexp.MustCompile(`<h1[^>]*>(.*?)</h1>`))
		want := dict[p.H1[0]]
		if p.Path == "/" {
			want = dict["hero.h1"] // the app draws it as h1_pre <em>h1_accent</em>
		}
		if got := strings.Join(strings.Fields(tags.ReplaceAllString(h1, "")), " "); got != strings.Join(strings.Fields(want), " ") {
			t.Errorf("%s: h1 %q, the app's heading is %q", p.Path, got, want)
		}
		if n := strings.Count(body, "<noscript>"); n != 1 {
			t.Errorf("%s: %d noscript blocks, want 1", p.Path, n)
		}
		ns := one(t, p.Path, "noscript", body, regexp.MustCompile(`<noscript>(.*?)</noscript>`))
		if got := strings.TrimSpace(tags.ReplaceAllString(ns, "")); got != dict["nojs.note"] || strings.Count(got, ".") != 1 || !strings.Contains(got, "JavaScript") {
			t.Errorf("%s: noscript says %q, want the one sentence %q", p.Path, got, dict["nojs.note"])
		}
		if strings.Contains(strings.SplitN(body, `<div id="root">`, 2)[1], "<style") {
			t.Errorf("%s: a style block inside the first view", p.Path)
		}
	}
	// the home page draws the hero's pictures; the app's brand.ts names the same two files (tools/seo.test.mjs checks that)
	_, home := fetchPage(t, srv.URL+"/")
	for _, f := range []string{brandStillLight, brandStillDark, brandMark} {
		if !strings.Contains(home, `src="`+f+`"`) {
			t.Errorf("home: no %s in the first view", f)
		}
	}
}

func TestUnknownRouteGetsTheBareShell(t *testing.T) {
	srv := builtApp(t)
	for _, path := range []string{"/no-such-page", "/account", "/generate/extra"} {
		h, body := fetchPage(t, srv.URL+path)
		if !strings.Contains(body, `<div id="root"></div>`) || strings.Contains(body, "hop-static") {
			t.Errorf("%s: should be the bare shell", path)
		}
		if h.Get("X-Robots-Tag") != "noindex" {
			t.Errorf("%s: X-Robots-Tag %q", path, h.Get("X-Robots-Tag"))
		}
	}
}

func TestPublicPagesUseTheAppsOwnWords(t *testing.T) {
	dict := englishStrings()
	for _, p := range publicPages {
		keys := append([]string{p.Title, p.Lead, p.Nav, "nojs.note", "nav.main", "nav.generate", "nav.split", "legal.updated"}, p.H1...)
		if p.Kind == "home" {
			keys = append(keys, "hero.h1_pre", "hero.h1_accent", "hero.cta_qr", "hero.cta_split", "hero.proof", "hero.h1")
		}
		for _, o := range []string{p.Desc, p.ListTitle} {
			if o != "" {
				keys = append(keys, o)
			}
		}
		for _, it := range p.Items {
			keys = append(keys, it.Text)
			if it.Head != "" {
				keys = append(keys, it.Head)
			}
		}
		for _, k := range keys {
			if strings.TrimSpace(dict[k]) == "" {
				t.Errorf("%s: %q is not in the English dictionary", p.Path, k)
			}
		}
	}
}

func TestHomeDescribesTheAppAsData(t *testing.T) {
	srv := builtApp(t)
	re := regexp.MustCompile(`<script type="application/ld\+json">(.*?)</script>`)
	h, body := fetchPage(t, srv.URL+"/")
	var v struct {
		Context   string `json:"@context"`
		Type      string `json:"@type"`
		Name      string `json:"name"`
		URL       string `json:"url"`
		Desc      string `json:"description"`
		Category  string `json:"applicationCategory"`
		OS        string `json:"operatingSystem"`
		Offers    struct{ Price string }
		Publisher struct {
			Type string `json:"@type"`
			Name string
			URL  string
		}
	}
	if err := json.Unmarshal([]byte(one(t, "/", "data block", body, re)), &v); err != nil {
		t.Fatal(err)
	}
	if v.Context != "https://schema.org" || v.Type != "WebApplication" || v.Name == "" || v.URL != siteOrigin+"/" || v.Desc == "" ||
		v.Category != appCategory || v.OS != "Any" || v.Offers.Price != "0" ||
		v.Publisher.Type != "Organization" || v.Publisher.Name != "HEL.ink" || v.Publisher.URL != "https://hel.ink" {
		t.Errorf("data block: %+v", v)
	}
	// a data block is not a script: the CSP still allows scripts from this origin only
	if csp := h.Get("Content-Security-Policy"); !strings.Contains(csp, "script-src 'self'") || strings.Contains(strings.SplitN(strings.SplitN(csp, "script-src", 2)[1], ";", 2)[0], "unsafe-inline") {
		t.Errorf("CSP %q", csp)
	}
	if strings.Count(body, "<script") != strings.Count(body, "<script type=\"module\"")+strings.Count(body, "<script src=")+1 {
		t.Errorf("an inline script besides the data block: %s", body)
	}
	if _, other := fetchPage(t, srv.URL+publicPages[1].Path); re.MatchString(other) {
		t.Errorf("%s repeats the home page's data block", publicPages[1].Path)
	}
}

func TestPrivateAndUnknownRoutesAreNotIndexed(t *testing.T) {
	srv := builtApp(t)
	paths := []string{"/no-such-page"}
	for _, pre := range privatePrefixes {
		paths = append(paths, pre+"x")
	}
	paths = append(paths, strings.TrimSuffix(privatePrefixes[len(privatePrefixes)-1], "/"))
	for _, path := range paths {
		if h, _ := fetchPage(t, srv.URL+path); h.Get("X-Robots-Tag") != "noindex" {
			t.Errorf("%s: X-Robots-Tag %q, want noindex", path, h.Get("X-Robots-Tag"))
		}
	}
}

func TestSitemapListsEveryPublicPageAndNothingElse(t *testing.T) {
	b, err := fs.ReadFile(web.Dist(), "sitemap.xml")
	if err != nil {
		t.Fatal(err)
	}
	var got, want []string
	for _, m := range regexp.MustCompile(`<loc>([^<]+)</loc>`).FindAllStringSubmatch(string(b), -1) {
		got = append(got, m[1])
	}
	for _, r := range sitemapRoutes() {
		want = append(want, siteOrigin+r)
	}
	sort.Strings(got)
	sort.Strings(want)
	if strings.Join(got, " ") != strings.Join(want, " ") {
		t.Errorf("sitemap.xml lists %v, want %v", got, want)
	}
	robots, err := fs.ReadFile(web.Dist(), "robots.txt")
	if err != nil {
		t.Fatal(err)
	}
	for _, pre := range privatePrefixes {
		if !regexp.MustCompile(`(?m)^Disallow: ` + regexp.QuoteMeta(pre) + `$`).Match(robots) {
			t.Errorf("robots.txt does not keep crawlers out of %s", pre)
		}
	}
}
