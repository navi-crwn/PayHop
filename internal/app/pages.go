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
description and canonical address, and with a plain summary of the page inside
the mount node. web/src/main.ts empties the node before the app mounts and the
summary is only displayed when scripts are off, so nothing changes on screen.

The words are the app's own: every entry of publicPages names keys of the
English dictionary (web/src/lib/i18n/en.json). Nothing is written here.
*/

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
}

var publicPages = []publicPage{
	{
		Path: "/", Nav: "nav.home", Title: "app.title", H1: []string{"hero.h1"}, Lead: "hero.lede",
		Items: []pageItem{
			{"home.b1_t", "home.b1_p"}, {"home.b2_t", "home.b2_p"}, {"home.b3_t", "home.b3_p"},
			{"home.b4_t", "home.b4_p"}, {"home.b5_t", "home.b5_p"}, {"home.b6_t", "home.b6_p"},
			{"", "hero.proof"},
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
		Path: "/terms", Nav: "terms.t", Title: "terms.t", Desc: "terms.p1", H1: []string{"terms.t"}, Lead: "terms.p1",
		Items: []pageItem{{"", "terms.p2"}, {"", "terms.p3"}, {"", "terms.p5"}, {"", "terms.p4"}},
	},
	{
		Path: "/privacy", Nav: "priv.t", Title: "priv.t", Desc: "priv.p1", H1: []string{"priv.t"}, Lead: "priv.p1",
		Items: []pageItem{{"", "priv.p2"}, {"", "priv.p5"}, {"", "priv.p3"}, {"", "priv.p4"}},
	},
}

// privatePrefixes are never for a search index; robots.txt keeps crawlers out of them too.
var privatePrefixes = []string{"/api/", "/auth/", "/hop/", "/account"}

const appCategory = "FinanceApplication"

const pageMount = `<div id="root"></div>`

// Hidden until scripts are known to be off, so the summary never flashes before the app mounts.
const pageStyle = `<style>.hop-static{display:none;max-width:44rem;margin:0 auto;padding:2rem 1.25rem;line-height:1.6}.hop-static a{color:inherit}</style>` +
	`<noscript><style>.hop-static{display:block}</style></noscript>`

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
	head := pageStyle
	if pageCanonRe.Match(b) {
		b = pageCanonRe.ReplaceAllLiteral(b, []byte(canonical))
	} else {
		head = canonical + "\n" + head
	}
	if p.App {
		head += "\n" + appData(b, origin)
	}
	b = bytes.Replace(b, []byte("</head>"), []byte(head+"\n</head>"), 1)

	var s strings.Builder
	s.WriteString(`<main class="hop-static"><h1>` + text(p.H1...) + `</h1>`)
	if v := text(p.Lead); v != "" {
		s.WriteString("<p>" + v + "</p>")
	}
	if v := text(p.ListTitle); v != "" {
		s.WriteString("<h2>" + v + "</h2>")
	}
	if len(p.Items) > 0 {
		s.WriteString("<ul>")
	}
	for _, it := range p.Items {
		v := text(it.Text)
		if v == "" {
			continue
		}
		if hd := text(it.Head); hd != "" {
			v = "<strong>" + hd + "</strong>: " + v
		}
		s.WriteString("<li>" + v + "</li>")
	}
	if len(p.Items) > 0 {
		s.WriteString("</ul>")
	}
	s.WriteString("<nav><ul>")
	for _, o := range publicPages {
		if v := text(o.Nav); v != "" && o.Path != p.Path {
			s.WriteString(`<li><a href="` + o.Path + `">` + v + `</a></li>`)
		}
	}
	s.WriteString("</ul></nav></main>")
	return bytes.Replace(b, []byte(pageMount), []byte(`<div id="root">`+s.String()+`</div>`), 1)
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

// shell is the HTML of an app route: a public one as built above, any other
// path the bare shell, marked so it is not indexed as a copy of the home page.
func (a *App) shell(name string, h http.Header) []byte {
	route := "/" + name
	if name == "index.html" {
		route = "/"
	}
	if p, ok := a.pages[route]; ok {
		return p
	}
	if route != "/" {
		h.Set("X-Robots-Tag", "noindex")
	}
	return a.index
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
