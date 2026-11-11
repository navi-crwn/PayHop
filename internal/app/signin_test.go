package app

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

// signIn walks the sign-in flow the way a browser does, as the account sub, and returns the callback
// answer. next is the optional ?next= of the start.
func signIn(t *testing.T, c *http.Client, base, sub, name, jti, next string) *http.Response {
	t.Helper()
	start := base + "/auth/sso"
	if next != "" {
		start += "?next=" + url.QueryEscape(next)
	}
	loc, _ := url.Parse(mustGet(t, c, start).Header.Get("Location"))
	now := time.Now().Unix()
	tk := ticket(t, map[string]any{"sub": sub, "aud": "payhop", "email": name + "@example.org", "name": name, "status": "active",
		"state": loc.Query().Get("state"), "iat": now, "exp": now + 120, "jti": jti, "v": 2})
	return mustGet(t, c, base+"/auth/sso/callback?ticket="+url.QueryEscape(tk))
}

func meName(t *testing.T, c *http.Client, base string) any {
	t.Helper()
	me := decode(t, mustGet(t, c, base+"/api/v1/me"))
	if me["signed_in"] != true {
		return nil
	}
	return me["name"]
}

func TestTicketMustNameThisApp(t *testing.T) {
	for name, aud := range map[string]any{"missing aud": nil, "empty aud": "", "another app": "filehop"} {
		_, srv := newTestApp(t, true)
		c := noRedirect()
		loc, _ := url.Parse(mustGet(t, c, srv.URL+"/auth/sso").Header.Get("Location"))
		now := time.Now().Unix()
		claims := map[string]any{"sub": "9", "email": "x@example.org", "name": "X", "status": "active",
			"state": loc.Query().Get("state"), "iat": now, "exp": now + 120, "jti": "aud-" + strings.ReplaceAll(name, " ", "-"), "v": 2}
		if aud != nil {
			claims["aud"] = aud
		}
		res := mustGet(t, c, srv.URL+"/auth/sso/callback?ticket="+url.QueryEscape(ticket(t, claims)))
		if res.Header.Get("Location") != "/?auth=invalid" || meName(t, c, srv.URL) != nil {
			t.Errorf("%s: accepted (%s)", name, res.Header.Get("Location"))
		}
	}
	// and the right aud still works
	_, srv := newTestApp(t, true)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "ok-1", "")
	if meName(t, c, srv.URL) != "Ana" {
		t.Error("a ticket for payhop must sign in")
	}
}

func TestClipKeepsUTF8Valid(t *testing.T) {
	got := clip("ab"+"é"+"é", 3) // cuts inside the second é
	if got != "abé"[:3] && got != "ab" {
		t.Errorf("clip: %q", got)
	}
	for _, r := range got {
		if r == '�' {
			t.Errorf("invalid UTF-8 left: %q", got)
		}
	}
}

// The landing after sign-in: the hub's launcher (no page behind it) opens the account page; PayHop's own
// Sign in link returns to the page it came from. Only local paths are ever used.
func TestSignInLanding(t *testing.T) {
	for _, tc := range []struct{ name, start, want string }{
		{"launcher, hub default next=/", "/auth/sso?next=%2F", "/account?_rc=1"},
		{"launcher, no next", "/auth/sso", "/account?_rc=1"},
		{"launcher, account", "/auth/sso?next=%2Faccount", "/account?_rc=1"},
		{"launcher, deep page", "/auth/sso?next=%2Fgenerate", "/generate"},
		{"Sign in on the home page", "/auth/sso?back=1&next=%2F", "/"},
		{"Sign in on /split", "/auth/sso?back=1&next=%2Fsplit", "/split"},
		{"foreign next from the launcher", "/auth/sso?next=" + url.QueryEscape("https://evil.example.com/"), "/account?_rc=1"},
		{"foreign next from a page", "/auth/sso?back=1&next=%2F%2Fevil.example.com", "/"},
	} {
		_, srv := newTestApp(t, true)
		c := noRedirect()
		loc, _ := url.Parse(mustGet(t, c, srv.URL+tc.start).Header.Get("Location"))
		now := time.Now().Unix()
		tk := ticket(t, map[string]any{"sub": "1", "aud": "payhop", "email": "a@example.org", "name": "Ana", "status": "active",
			"state": loc.Query().Get("state"), "iat": now, "exp": now + 120, "jti": "land-1", "v": 2})
		res := mustGet(t, c, srv.URL+"/auth/sso/callback?ticket="+url.QueryEscape(tk))
		if res.StatusCode != 303 || res.Header.Get("Location") != tc.want {
			t.Errorf("%s: %d %s, want %s", tc.name, res.StatusCode, res.Header.Get("Location"), tc.want)
		}
	}
}

// Sign out here, then another account signs in in the same browser: PayHop's own session is gone before the
// hub is visited again, and the second account sees none of the first one's saved data.
func TestSecondAccountAfterSignOutSeesNothingOfTheFirst(t *testing.T) {
	_, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "so-1", "")
	if code, _ := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true)); code != 201 {
		t.Fatalf("save: %d", code)
	}
	// the hub's chained logout reaches this app: the session ends here, then the chain goes on
	res := mustGet(t, c, srv.URL+"/auth/sso/logout?next="+url.QueryEscape("https://hub.example.org/logout/next"))
	if res.Header.Get("Location") != "https://hub.example.org/logout/next" {
		t.Fatalf("logout next: %s", res.Header.Get("Location"))
	}
	if meName(t, c, srv.URL) != nil {
		t.Fatal("still signed in after the app's own logout step")
	}
	if code, _ := call(t, c, "GET", srv.URL+"/api/v1/saved", nil); code == 200 {
		t.Fatal("saved data readable after sign-out")
	}
	signIn(t, c, srv.URL, "2", "Bo", "so-2", "")
	if meName(t, c, srv.URL) != "Bo" {
		t.Fatalf("second account: %v", meName(t, c, srv.URL))
	}
	got := list(t, c, srv.URL)
	if ms, _ := got["methods"].([]any); len(ms) != 0 {
		t.Fatalf("second account sees the first one's methods: %v", got)
	}
	// and the first account still has its own when it comes back
	c1 := noRedirect()
	signIn(t, c1, srv.URL, "1", "Ana", "so-3", "")
	if ms, _ := list(t, c1, srv.URL)["methods"].([]any); len(ms) != 1 {
		t.Fatalf("first account lost its data: %v", ms)
	}
}
