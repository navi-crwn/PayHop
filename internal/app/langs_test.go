package app

import (
	"encoding/xml"
	"net/url"
	"regexp"
	"strings"
	"testing"
)

// One address per language: ?lang=<code> (KONTRAK-SEO-BAHASA). English is the bare address.

func linkOf(t *testing.T, body, rel string) string {
	t.Helper()
	m := regexp.MustCompile(`<link rel="`+rel+`" href="([^"]*)">`).FindAllStringSubmatch(body, -1)
	if len(m) != 1 {
		t.Fatalf("%d %s links, want 1", len(m), rel)
	}
	return m[0][1]
}

func TestCanonicalFollowsTheLangParameterOnly(t *testing.T) {
	srv := builtApp(t)
	for _, p := range sitemapRoutes() {
		bare := siteOrigin + p
		for q, want := range map[string]string{
			"":                          bare,
			"?lang=en":                  bare, // English lives at the bare address
			"?lang=de":                  bare + "?lang=de",
			"?lang=pt-BR":               bare + "?lang=pt-BR",
			"?lang=pt":                  bare + "?lang=pt-BR",
			"?lang=zh":                  bare + "?lang=zh-CN",
			"?lang=DE":                  bare + "?lang=de",
			"?lang=xx":                  bare,
			"?utm_source=x":             bare,
			"?lang=de&utm_source=x":     bare + "?lang=de",
			"?utm_source=x&lang=ja&a=b": bare + "?lang=ja",
		} {
			_, body := fetchPage(t, srv.URL+p+q)
			if got := linkOf(t, body, "canonical"); got != want {
				t.Errorf("%s%s: canonical %q, want %q", p, q, got, want)
			}
			if got := one(t, p+q, "og:url", body, regexp.MustCompile(`<meta property="og:url" content="([^"]*)">`)); got != want {
				t.Errorf("%s%s: og:url %q, want %q", p, q, got, want)
			}
		}
	}
}

func TestEveryPublicPageNamesItsNineLanguagesAndXDefault(t *testing.T) {
	srv := builtApp(t)
	for _, p := range sitemapRoutes() {
		for _, q := range []string{"", "?lang=ja", "?lang=en"} {
			_, body := fetchPage(t, srv.URL+p+q)
			links := regexp.MustCompile(`<link rel="alternate" hreflang="([^"]+)" href="([^"]*)">`).FindAllStringSubmatch(body, -1)
			if len(links) != 10 {
				t.Fatalf("%s%s: %d alternates, want 10", p, q, len(links))
			}
			for i, code := range pageLangs {
				want := siteOrigin + p
				if code != "en" {
					want += "?lang=" + code
				}
				if links[i][1] != code || links[i][2] != want {
					t.Errorf("%s%s: alternate %d is %q -> %q, want %q -> %q", p, q, i, links[i][1], links[i][2], code, want)
				}
			}
			if links[9][1] != "x-default" || links[9][2] != siteOrigin+p {
				t.Errorf("%s%s: x-default is %v", p, q, links[9])
			}
			if links[0][2] != links[9][2] {
				t.Errorf("%s%s: the en alternate and x-default must be the same address", p, q)
			}
		}
	}
}

func TestEachLanguageGetsItsOwnWordsAndLinksThatKeepIt(t *testing.T) {
	srv := builtApp(t)
	titles := map[string]string{}
	for _, code := range pageLangs {
		for _, p := range sitemapRoutes() {
			_, body := fetchPage(t, srv.URL+p+"?lang="+code)
			if !strings.Contains(body, `<html lang="`+code+`">`) {
				t.Errorf("%s ?lang=%s: <html lang> is not %s", p, code, code)
			}
			if p == "/" {
				title := one(t, p, "title", body, regexp.MustCompile(`<title>([^<]+)</title>`))
				if other, dup := titles[title]; dup {
					t.Errorf("the home title of %s is the same as %s: %q", code, other, title)
				}
				titles[title] = code
			}
			// the plain links of the first view stay in the same language, so a crawler (and a reader without scripts)
			// that follows them does not fall back to English
			if code != "en" {
				for _, o := range sitemapRoutes() {
					if o != p && !strings.Contains(body, `<a href="`+o+`?lang=`+code+`">`) {
						t.Errorf("%s ?lang=%s: the link to %s does not keep the language", p, code, o)
					}
				}
				if strings.Contains(body, `<a href="/generate">`) || strings.Contains(body, `<a href="/split">`) {
					t.Errorf("%s ?lang=%s: a first-view link drops the language", p, code)
				}
			}
		}
	}
	// the German home page really is German, in the head and in the heading
	_, de := fetchPage(t, srv.URL+"/?lang=de")
	if strings.Contains(de, "<title>PayHop: payment QR codes") {
		t.Errorf("the German home page still carries English words")
	}
	desc := one(t, "/", "description", de, regexp.MustCompile(`<meta name="description" content="([^"]*)">`))
	_, en := fetchPage(t, srv.URL+"/")
	if desc == one(t, "/", "description", en, regexp.MustCompile(`<meta name="description" content="([^"]*)">`)) {
		t.Errorf("the German description is the English one")
	}
}

func TestPrivateAndMissingPagesHaveNoLanguageAddresses(t *testing.T) {
	srv := builtApp(t)
	for _, p := range []string{"/account?lang=de", "/no-such-page?lang=de", "/api/v1/me?lang=de"} {
		_, body := fetchPage(t, srv.URL+p)
		if strings.Contains(body, "hreflang") {
			t.Errorf("%s: a noindex page must carry no hreflang", p)
		}
	}
}

type sitemapDoc struct {
	URLs []struct {
		Loc   string `xml:"loc"`
		Links []struct {
			Lang string `xml:"hreflang,attr"`
			Href string `xml:"href,attr"`
		} `xml:"link"`
	} `xml:"url"`
}

func TestSitemapGivesEachPageOnceWithItsNineAlternates(t *testing.T) {
	srv := builtApp(t)
	h, body := fetchPage(t, srv.URL+"/sitemap.xml")
	if ct := h.Get("Content-Type"); !strings.Contains(ct, "xml") {
		t.Errorf("sitemap Content-Type %q", ct)
	}
	if !strings.Contains(body, `xmlns:xhtml="http://www.w3.org/1999/xhtml"`) {
		t.Errorf("sitemap has no xhtml namespace")
	}
	var doc sitemapDoc
	if err := xml.Unmarshal([]byte(body), &doc); err != nil {
		t.Fatal(err)
	}
	routes := sitemapRoutes()
	if len(doc.URLs) != len(routes) {
		t.Fatalf("%d urls, want %d", len(doc.URLs), len(routes))
	}
	for i, u := range doc.URLs {
		p := routes[i]
		if u.Loc != siteOrigin+p {
			t.Errorf("url %d: %q, want the bare address %q", i, u.Loc, siteOrigin+p)
		}
		if len(u.Links) != 10 {
			t.Fatalf("%s: %d alternates, want 10", p, len(u.Links))
		}
		for j, code := range pageLangs {
			want := siteOrigin + p
			if code != "en" {
				want += "?lang=" + code
			}
			if u.Links[j].Lang != code || u.Links[j].Href != want {
				t.Errorf("%s: alternate %d = %v, want %s -> %s", p, j, u.Links[j], code, want)
			}
		}
		if u.Links[9].Lang != "x-default" || u.Links[9].Href != siteOrigin+p {
			t.Errorf("%s: x-default = %v", p, u.Links[9])
		}
		if _, err := url.Parse(u.Loc); err != nil {
			t.Error(err)
		}
	}
	if strings.Contains(body, "/account") {
		t.Errorf("the sitemap lists /account")
	}
}
