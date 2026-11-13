package app

import (
	"bytes"
	"encoding/json"
	"html"
	"net/http"
	"regexp"
	"strings"

	"github.com/navi-crwn/PayHop/web"
)

/*
The app shell is an empty <div id="root">: a crawler that does not run scripts
reads nothing in it. So every public route is served with its own title,
description and canonical address, and with a first view inside the mount node:
a top bar, the page heading and its facts, drawn with the app's own classes
(web/src/app.css), so it looks like the app and is visible at once, in the
reader's theme. web/src/main.ts empties the node and mounts the app in the same
task, so the app takes its place with nothing in between.

The words are the app's own: every entry of publicPages names keys of the
English dictionary (web/src/lib/i18n/en.json). Nothing is written here, except
the two constants below that mirror the app (tools/seo.test.mjs keeps them equal).
*/

// The home hero's pictures and the date on the legal pages, as in web/src/lib/brand.ts and pages/Legal.svelte.
const (
	brandMark       = "/hop-assets/v9/apps/payhop/mark.svg"
	brandStillLight = "/hop-assets/v9/home/payhop-light.webp"
	brandStillDark  = "/hop-assets/v9/home/payhop-dark.webp"
	legalUpdated    = "2026-11-11"
)

type pageItem struct{ Head, Text string }

type publicPage struct {
	Path      string
	Title     string     // <title> and og:title
	Desc      string     // description; "" keeps the one written in index.html
	H1        []string   // joined with a space
	Lead      string     // the paragraph under the heading
	ListTitle string     // heading of the list; "" for none
	Items     []pageItem // what the page does
	Nav       string     // what the other pages call this one in their links
	App       bool       // carries the WebApplication description (the home page)
	Kind      string     // "home" (hero), "legal" (updated line and one card), "" (heading, then a card)
}

var publicPages = []publicPage{
	{
		Path: "/", Nav: "nav.home", Title: "app.title", H1: []string{"hero.h1"}, Lead: "hero.lede", Kind: "home",
		Items: []pageItem{
			{"home.b1_t", "home.b1_p"}, {"home.b2_t", "home.b2_p"}, {"home.b3_t", "home.b3_p"},
			{"home.b4_t", "home.b4_p"}, {"home.b5_t", "home.b5_p"}, {"home.b6_t", "home.b6_p"},
		},
		App: true,
	},
	{
		Path: "/generate", Nav: "hero.cta_qr", Title: "gen.title", Desc: "gen.sub", H1: []string{"gen.title"}, Lead: "gen.sub", ListTitle: "home.th_holds",
		Items: []pageItem{
			{"", "home.holds_paypal"}, {"", "home.holds_cashapp"}, {"", "home.holds_venmo"}, {"", "home.holds_solana"},
			{"", "home.holds_upi"}, {"", "home.holds_epc"}, {"", "home.holds_promptpay"}, {"", "home.holds_vietqr"},
		},
	},
	{
		Path: "/split", Nav: "nav.split", Title: "split.title", Desc: "split.sub", H1: []string{"split.title"}, Lead: "split.sub",
		Items: []pageItem{{"", "home.b3_p"}, {"", "split.round_hint"}, {"", "hero.proof"}},
	},
	{Path: "/changelog", Nav: "nav.changelog", Title: "cl.title", Desc: "cl.sub", H1: []string{"cl.title"}, Lead: "cl.sub"},
	{
		Path: "/terms", Kind: "legal", Nav: "terms.t", Title: "terms.t", Desc: "terms.p1", H1: []string{"terms.t"}, Lead: "terms.p1",
		Items: []pageItem{{"", "terms.p2"}, {"", "terms.p3"}, {"", "terms.p5"}, {"", "terms.p4"}},
	},
	{
		Path: "/privacy", Kind: "legal", Nav: "priv.t", Title: "priv.t", Desc: "priv.p1", H1: []string{"priv.t"}, Lead: "priv.p1",
		Items: []pageItem{{"", "priv.p2"}, {"", "priv.p5"}, {"", "priv.p3"}, {"", "priv.p4"}},
	},
}

// privatePrefixes are never for a search index; robots.txt keeps crawlers out of them too.
var privatePrefixes = []string{"/api/", "/auth/", "/hop/", "/account"}

// appRoutes are the extension-less addresses the browser app owns: the public
// pages above plus "/" and the private "/account" — exactly the ROUTES of
// web/src/lib/router.svelte.ts. Any other extension-less address is not part of
// the app and is answered with a real 404 (see shell).
var appRoutes = func() map[string]bool {
	m := map[string]bool{"/": true, "/account": true}
	for _, p := range publicPages {
		m[p.Path] = true
	}
	return m
}()

const appCategory = "FinanceApplication"

const pageMount = `<div id="root"></div>`

var (
	pageTitleRe   = regexp.MustCompile(`<title>[^<]*</title>`)
	pageDescRe    = regexp.MustCompile(`<meta name="description" content="([^"]*)">`)
	pageOGTitleRe = regexp.MustCompile(`<meta property="og:title" content="[^"]*">`)
	pageOGDescRe  = regexp.MustCompile(`<meta property="og:description" content="[^"]*">`)
	pageOGURLRe   = regexp.MustCompile(`<meta property="og:url" content="[^"]*">`)
	pageSiteRe    = regexp.MustCompile(`<meta property="og:site_name" content="([^"]*)">`)
	pageCanonRe   = regexp.MustCompile(`<link rel="canonical" href="[^"]*">`)
	pageOriginRe  = regexp.MustCompile(`<(?:link rel="canonical" href|meta property="og:url" content)="(https?://[^/"]+)/?">`)
)

// buildPages is the shell as each public route is served. The site's address is
// the one index.html already states; without it the shell is served as it is.
func buildPages(index []byte, dict map[string]string) map[string][]byte {
	m := pageOriginRe.FindSubmatch(index)
	if m == nil {
		return nil
	}
	out := map[string][]byte{}
	for _, p := range publicPages {
		out[p.Path] = renderPage(index, string(m[1]), p, dict)
	}
	return out
}

func renderPage(index []byte, origin string, p publicPage, dict map[string]string) []byte {
	text := func(keys ...string) string {
		var parts []string
		for _, k := range keys {
			if v := strings.TrimSpace(dict[k]); v != "" {
				parts = append(parts, html.EscapeString(v))
			}
		}
		return strings.Join(parts, " ")
	}
	url := origin + p.Path
	b := index
	t := text(p.Title)
	if site := pageSiteRe.FindSubmatch(index); t != "" && !p.App && site != nil {
		t += " — " + string(site[1]) // "Split a bill — PayHop"; the title of the home page names the app already
	}
	if t != "" {
		b = pageTitleRe.ReplaceAllLiteral(b, []byte("<title>"+t+"</title>"))
		b = pageOGTitleRe.ReplaceAllLiteral(b, []byte(`<meta property="og:title" content="`+t+`">`))
	}
	if d := text(p.Desc); d != "" {
		b = pageDescRe.ReplaceAllLiteral(b, []byte(`<meta name="description" content="`+d+`">`))
		b = pageOGDescRe.ReplaceAllLiteral(b, []byte(`<meta property="og:description" content="`+d+`">`))
	}
	b = pageOGURLRe.ReplaceAllLiteral(b, []byte(`<meta property="og:url" content="`+url+`">`))

	canonical := `<link rel="canonical" href="` + url + `">`
	head := ""
	if pageCanonRe.Match(b) {
		b = pageCanonRe.ReplaceAllLiteral(b, []byte(canonical))
	} else {
		head = canonical + "\n" + head
	}
	if p.App {
		head += "\n" + appData(b, origin)
	}
	b = bytes.Replace(b, []byte("</head>"), []byte(head+"\n</head>"), 1)

	return bytes.Replace(b, []byte(pageMount), []byte(`<div id="root">`+firstView(p, text)+`</div>`), 1)
}

// firstView is what the page shows before the app takes over: the app's own top bar and heading, with its classes.
func firstView(p publicPage, text func(...string) string) string {
	var s strings.Builder
	cur := func(path string) string {
		if path == p.Path {
			return ` aria-current="page"`
		}
		return ""
	}
	s.WriteString(`<header class="top"><div class="wrap"><a class="brand" href="/"><img src="` + brandMark + `" alt="" width="28" height="28"><span class="pname hop-name-payhop">PayHop</span></a>`)
	s.WriteString(`<nav class="nav" aria-label="` + text("nav.main") + `"><a href="/generate"` + cur("/generate") + `>` + text("nav.generate") + `</a><a href="/split"` + cur("/split") + `>` + text("nav.split") + `</a></nav></div></header>`)
	s.WriteString(`<main class="hop-static">`)

	items := func(class string) {
		var li strings.Builder
		for _, it := range p.Items {
			v := text(it.Text)
			if v == "" {
				continue
			}
			if hd := text(it.Head); hd != "" {
				v = "<strong>" + hd + "</strong> " + v
			}
			li.WriteString("<li>" + v + "</li>")
		}
		if li.Len() > 0 {
			s.WriteString(`<ul class="` + class + `">` + li.String() + "</ul>")
		}
	}

	switch p.Kind {
	case "home":
		// the hero as web/src/lib/pages/Home.svelte draws it, then the six things it does
		s.WriteString(`<section class="hero"><div class="wrap"><div><h1 class="big">` + text("hero.h1_pre") + ` <em>` + text("hero.h1_accent") + `</em></h1>`)
		s.WriteString(`<p class="lede">` + text(p.Lead) + `</p><div class="cta"><a class="btn btn--primary btn--lg" href="/generate">` + text("hero.cta_qr") + `</a><a class="btn btn--outline btn--lg" href="/split">` + text("hero.cta_split") + `</a></div>`)
		s.WriteString(`<p class="proof">` + text("hero.proof") + `</p>`)
		s.WriteString(`<p class="sample-line">` + text("home.sample_pre") + ` <a href="/generate?sample=1">` + text("home.sample_link") + `</a></p></div>`)
		s.WriteString(`<figure class="hero-art" aria-hidden="true" style="margin:0"><img class="still lt" src="` + brandStillLight + `" alt="" width="380" height="380"><img class="still dk" src="` + brandStillDark + `" alt="" width="380" height="380"></figure></div></section>`)
		s.WriteString(`<section class="blk"><div class="wrap">`)
		items("hop-static-list")
		s.WriteString(`</div></section>`)
	case "legal":
		s.WriteString(`<div class="wrap page legal"><div class="page-head"><h1>` + text(p.H1...) + `</h1><p>` + strings.ReplaceAll(text("legal.updated"), "{date}", legalUpdated) + `</p></div><div class="card">`)
		for _, it := range append([]pageItem{{"", p.Lead}}, p.Items...) {
			s.WriteString("<p>" + text(it.Text) + "</p>")
		}
		s.WriteString(`</div></div>`)
	default:
		s.WriteString(`<div class="wrap page"><div class="page-head"><h1>` + text(p.H1...) + `</h1>`)
		if v := text(p.Lead); v != "" {
			s.WriteString("<p>" + v + "</p>")
		}
		s.WriteString(`</div>`)
		if len(p.Items) > 0 {
			s.WriteString(`<div class="card">`)
			if v := text(p.ListTitle); v != "" {
				s.WriteString("<h2>" + v + "</h2>")
			}
			items("hop-static-facts")
			s.WriteString(`</div>`)
		}
		s.WriteString(`</div>`)
	}

	s.WriteString(`<div class="wrap"><nav class="hop-static-links"><ul>`)
	for _, o := range publicPages {
		if v := text(o.Nav); v != "" && o.Path != p.Path {
			s.WriteString(`<li><a href="` + o.Path + `">` + v + `</a></li>`)
		}
	}
	s.WriteString(`</ul></nav></div>`)
	// the only sentence for readers whose browser runs no scripts: the app itself needs them
	s.WriteString(`<noscript><div class="wrap"><p class="note">` + text("nojs.note") + `</p></div></noscript>`)
	s.WriteString(`</main>`)
	return s.String()
}

// appData describes the app to search engines (schema.org WebApplication). It is
// a data block, not a script: the browser never runs it, so the CSP is untouched.
func appData(page []byte, origin string) string {
	find := func(re *regexp.Regexp) string {
		if m := re.FindSubmatch(page); m != nil {
			return html.UnescapeString(string(m[1]))
		}
		return ""
	}
	js, err := json.Marshal(map[string]any{
		"@context":            "https://schema.org",
		"@type":               "WebApplication",
		"name":                find(pageSiteRe),
		"url":                 origin + "/",
		"description":         find(pageDescRe),
		"applicationCategory": appCategory,
		"operatingSystem":     "Any",
		"offers":              map[string]any{"@type": "Offer", "price": "0", "priceCurrency": "USD"},
		"publisher":           map[string]any{"@type": "Organization", "name": "HEL.ink", "url": "https://hel.ink"},
	})
	if err != nil {
		return ""
	}
	return `<script type="application/ld+json">` + string(js) + `</script>`
}

// shell is the HTML of an app route and the status it is served with: a public
// one as built above, "/" and "/account" as the bare shell, both 200. Any other
// address is not a route of the app: it gets the bare shell with a real 404, so
// crawlers and caches see the truth while the app still mounts and draws its
// own not-found view. The shell is marked so it is not indexed as a copy of the
// home page.
func (a *App) shell(name string, h http.Header) ([]byte, int) {
	route := "/" + name
	if name == "" || name == "index.html" {
		route = "/"
	}
	if p, ok := a.pages[route]; ok {
		return p, http.StatusOK
	}
	if appRoutes[route] {
		// / and /account, and every app route when index.html states no site address
		return a.index, http.StatusOK
	}
	h.Set("X-Robots-Tag", "noindex")
	return a.index, http.StatusNotFound
}

func privatePath(p string) bool {
	for _, pre := range privatePrefixes {
		if strings.HasPrefix(p, pre) {
			return true
		}
	}
	return false
}

// englishStrings is the app's English dictionary (web/src/lib/i18n/en.json).
func englishStrings() map[string]string {
	var d map[string]string
	_ = json.Unmarshal(web.English, &d)
	return d
}
