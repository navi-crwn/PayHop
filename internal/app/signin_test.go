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
