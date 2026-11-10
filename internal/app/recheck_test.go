package app

import (
	"net/http"
	"net/url"
	"testing"
	"time"
)

// goStale ages every session past the re-check window and returns a restore func.
func goStale(t *testing.T) func() {
	t.Helper()
	old := recheckAfter
	recheckAfter = time.Millisecond
	time.Sleep(5 * time.Millisecond)
	return func() { recheckAfter = old }
}

// silentStart follows /auth/sso?prompt=none&next=…, checks that the hub is asked not to
// show a login page, and returns the state the hub must echo back.
func silentStart(t *testing.T, c *http.Client, base, next string) string {
	t.Helper()
	res := mustGet(t, c, base+"/auth/sso?prompt=none&next="+url.QueryEscape(next))
	loc, _ := url.Parse(res.Header.Get("Location"))
	if loc.Path != "/sso/payhop" || loc.Query().Get("prompt") != "none" || loc.Query().Get("state") == "" {
		t.Fatalf("silent start: %s", loc)
	}
	return loc.Query().Get("state")
}

func silentTicket(t *testing.T, c *http.Client, base, state, sub, name, jti string) *http.Response {
	t.Helper()
	now := time.Now().Unix()
	tk := ticket(t, map[string]any{"sub": sub, "aud": "payhop", "email": name + "@example.org", "name": name, "status": "active",
		"state": state, "iat": now, "exp": now + 120, "jti": jti, "v": 2})
	return mustGet(t, c, base+"/auth/sso/callback?ticket="+url.QueryEscape(tk))
}

func TestStaleSessionHubStillSignedInAsTheSameAccount(t *testing.T) {
	_, srv := newTestApp(t, true)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "r-1", "")
	restore := goStale(t)

	// the page is asked to re-check quietly; a guest (no cookie) is not
	if me := decode(t, mustGet(t, c, srv.URL+"/api/v1/me")); me["signed_in"] != false || me["stale"] != true || me["name"] != nil {
		t.Fatalf("stale me: %v", me)
	}
	if me := decode(t, mustGet(t, noRedirect(), srv.URL+"/api/v1/me")); me["stale"] == true {
		t.Fatalf("a guest must not be sent anywhere: %v", me)
	}
	restore()

	// the hub vouches for the same account: back to the page, session fresh
	state := silentStart(t, c, srv.URL, "/")
	res := silentTicket(t, c, srv.URL, state, "1", "Ana", "r-2")
	if res.Header.Get("Location") != "/?_rc=1" || meName(t, c, srv.URL) != "Ana" {
		t.Fatalf("after silent check: %s %v", res.Header.Get("Location"), meName(t, c, srv.URL))
	}
}

func TestStaleSessionHubHasAnotherAccount(t *testing.T) { // the owner's case
	a, srv := newTestApp(t, true)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Clowny", "r-3", "")
	restore := goStale(t)
	state := silentStart(t, c, srv.URL, "/account")
	restore()
	res := silentTicket(t, c, srv.URL, state, "2", "Ana", "r-4")
	if res.Header.Get("Location") != "/account?_rc=1" || meName(t, c, srv.URL) != "Ana" {
		t.Fatalf("switch: %s %v", res.Header.Get("Location"), meName(t, c, srv.URL))
	}
	if n, _ := a.db.DeleteSessions("1"); n != 0 {
		t.Fatalf("the old account still has %d sessions", n)
	}
}

func TestStaleSessionHubSignedOut(t *testing.T) {
	for _, tc := range []struct{ next, want string }{
		{"/", "/"}, // the public page stays public
		{"/account", "/auth/sso?next=%2Faccount"}, // the account page goes to the normal sign-in
	} {
		a, srv := newTestApp(t, true)
		c := noRedirect()
		signIn(t, c, srv.URL, "1", "Ana", "r-5", "")
		restore := goStale(t)
		state := silentStart(t, c, srv.URL, tc.next)
		restore()
		res := mustGet(t, c, srv.URL+"/auth/sso/callback?error=login_required&state="+url.QueryEscape(state))
		if res.StatusCode != 303 || res.Header.Get("Location") != tc.want {
			t.Fatalf("%s: %d %s", tc.next, res.StatusCode, res.Header.Get("Location"))
		}
		if meName(t, c, srv.URL) != nil {
			t.Fatalf("%s: the old account must be gone", tc.next)
		}
		if n, _ := a.db.DeleteSessions("1"); n != 0 {
			t.Fatalf("%s: session row survived", tc.next)
		}
		if me := decode(t, mustGet(t, c, srv.URL+"/api/v1/me")); me["stale"] == true {
			t.Fatalf("%s: no cookie left, nothing to re-check: %v", tc.next, me)
		}
	}
}

func TestSilentCheckAnswerIsValidated(t *testing.T) {
	a, srv := newTestApp(t, true)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "r-6", "")
	state := silentStart(t, c, srv.URL, "/")

	// wrong state, wrong error: refused, and the session stays
	for _, q := range []string{"error=login_required&state=wrong", "error=access_denied&state=" + url.QueryEscape(state), "error=login_required"} {
		if res := mustGet(t, c, srv.URL+"/auth/sso/callback?"+q); res.Header.Get("Location") != "/?auth=invalid" {
			t.Fatalf("%s: %s", q, res.Header.Get("Location"))
		}
		if meName(t, c, srv.URL) != "Ana" {
			t.Fatalf("%s: a forged answer must not end the session", q)
		}
		state = silentStart(t, c, srv.URL, "/") // each refusal clears the pending state
	}

	// error=login_required for a check that was not silent is refused as well
	res := mustGet(t, c, srv.URL+"/auth/sso?next=%2F")
	loc, _ := url.Parse(res.Header.Get("Location"))
	if loc.Query().Get("prompt") != "" {
		t.Fatalf("a normal start must not ask for prompt=none: %s", loc)
	}
	res = mustGet(t, c, srv.URL+"/auth/sso/callback?error=login_required&state="+url.QueryEscape(loc.Query().Get("state")))
	if res.Header.Get("Location") != "/?auth=invalid" {
		t.Fatalf("non-silent: %s", res.Header.Get("Location"))
	}
	if n, _ := a.db.DeleteSessions("1"); n != 1 {
		t.Fatalf("session should have survived, deleted %d", n)
	}
}

// Cookies refused: the hub round trip works but no session can be read back. The dashboard says so
// instead of going round again.
