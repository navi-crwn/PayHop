package app

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/navi-crwn/PayHop/internal/hop"
)

// The manifest advertises revoke_sessions; these tests hold the route behind it.

func actionsFor(t *testing.T, srv *httptest.Server) []string {
	t.Helper()
	m := decode(t, signed(t, srv, "imperium", "GET", "/hop/manifest", nil))["data"].(map[string]any)
	var out []string
	for _, v := range m["actions"].(map[string]any)["user"].([]any) {
		out = append(out, v.(string))
	}
	return out
}

func seedSession(t *testing.T, a *App, sub, hash string) {
	t.Helper()
	u, err := a.db.UpsertUser(sub, sub+"@example.org", "Helena")
	if err != nil {
		t.Fatal(err)
	}
	if err := a.db.CreateSession(hash, u.ID, time.Hour); err != nil {
		t.Fatal(err)
	}
}

func hasSession(a *App, hash string) bool {
	u, err := a.db.UserBySession(hash)
	return err == nil && u != nil
}

func TestEveryAdvertisedUserActionHasARoute(t *testing.T) {
	a, srv := newTestApp(t, true)
	seedSession(t, a, "42", "h1")
	for _, act := range actionsFor(t, srv) {
		body := []byte(`{"action":"` + act + `","reason":"test"}`)
		res := signed(t, srv, "imperium", "POST", "/hop/users/42/actions", body)
		if res.StatusCode != 200 {
			t.Errorf("advertised action %q answered %d, want 200", act, res.StatusCode)
		}
	}
}

func TestRevokeSessionsEndsEverySessionOfThatUserOnly(t *testing.T) {
	a, srv := newTestApp(t, true)
	seedSession(t, a, "42", "h1")
	seedSession(t, a, "7", "h2")
	body := []byte(`{"action":"revoke_sessions","reason":"lost phone"}`)
	v := decode(t, signed(t, srv, "imperium", "POST", "/hop/users/42/actions", body))
	if v["ok"] != true {
		t.Fatalf("revoke: %v", v)
	}
	if hasSession(a, "h1") {
		t.Error("the user's session survived revoke_sessions")
	}
	if !hasSession(a, "h2") {
		t.Error("another user's session was ended")
	}
	if _, err := a.db.UserBySub("42"); err != nil {
		t.Errorf("the account itself must stay: %v", err)
	}
}

func TestUserActionRefusals(t *testing.T) {
	a, srv := newTestApp(t, true)
	seedSession(t, a, "42", "h1")
	good := []byte(`{"action":"revoke_sessions"}`)

	// no signature at all
	res, _ := http.Post(srv.URL+"/hop/users/42/actions", "application/json", bytes.NewReader(good))
	if res.StatusCode != 401 {
		t.Errorf("unsigned: %d, want 401", res.StatusCode)
	}
	// a caller that is not one of PAYHOP_HOP_CLIENTS
	if res := signed(t, srv, "stranger", "POST", "/hop/users/42/actions", good); res.StatusCode != 401 {
		t.Errorf("unknown app: %d, want 401", res.StatusCode)
	}
	// signed over a different body than the one sent (tampered)
	req, _ := http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader([]byte(`{"action":"revoke_sessions","x":1}`)))
	for k, v := range hop.Headers("imperium", testSecret, "t", "POST", "/hop/users/42/actions", good) {
		req.Header[k] = v
	}
	if res, _ := http.DefaultClient.Do(req); res.StatusCode != 401 {
		t.Errorf("tampered body: %d, want 401", res.StatusCode)
	}
	// signed for another user's path, sent to this one
	req, _ = http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader(good))
	for k, v := range hop.Headers("imperium", testSecret, "t", "POST", "/hop/users/7/actions", good) {
		req.Header[k] = v
	}
	if res, _ := http.DefaultClient.Do(req); res.StatusCode != 401 {
		t.Errorf("wrong path: %d, want 401", res.StatusCode)
	}
	// signed with the wrong secret
	req, _ = http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader(good))
	for k, v := range hop.Headers("imperium", "another-secret-that-is-long-enough-1234", "t", "POST", "/hop/users/42/actions", good) {
		req.Header[k] = v
	}
	if res, _ := http.DefaultClient.Do(req); res.StatusCode != 401 {
		t.Errorf("wrong secret: %d, want 401", res.StatusCode)
	}
	// a correct signature that is five minutes old
	old := strconv.FormatInt(time.Now().Add(-5*time.Minute).Unix(), 10)
	nonce := "0123456789abcdef0123"
	m := hmac.New(sha256.New, []byte(testSecret))
	m.Write([]byte(hop.StringToSign("imperium", old, nonce, "POST", "/hop/users/42/actions", good)))
	req, _ = http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader(good))
	req.Header.Set("X-HOP-App", "imperium")
	req.Header.Set("X-HOP-Timestamp", old)
	req.Header.Set("X-HOP-Nonce", nonce)
	req.Header.Set("X-HOP-Signature", hop.B64(m.Sum(nil)))
	res, _ = http.DefaultClient.Do(req)
	if res.StatusCode != 401 {
		t.Errorf("stale: %d, want 401", res.StatusCode)
	}
	// the same request replayed
	req, _ = http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader(good))
	for k, v := range hop.Headers("imperium", testSecret, "t", "POST", "/hop/users/42/actions", good) {
		req.Header[k] = v
	}
	hdr := req.Header.Clone()
	if res, _ := http.DefaultClient.Do(req); res.StatusCode != 200 {
		t.Fatalf("first use: %d, want 200", res.StatusCode)
	}
	seedSession(t, a, "42", "h3")
	req2, _ := http.NewRequest("POST", srv.URL+"/hop/users/42/actions", bytes.NewReader(good))
	req2.Header = hdr
	if res, _ := http.DefaultClient.Do(req2); res.StatusCode != 401 {
		t.Errorf("replay: %d, want 401", res.StatusCode)
	}
	if !hasSession(a, "h3") {
		t.Error("a replayed call ended a session")
	}
	// none of the refusals above touched the first session
	seedSession(t, a, "42", "h4")
	// unknown user: 404, nothing changes
	if res := signed(t, srv, "imperium", "POST", "/hop/users/999/actions", good); res.StatusCode != 404 {
		t.Errorf("unknown user: %d, want 404", res.StatusCode)
	}
	// unknown action, empty body, bad JSON: 400, nothing changes
	for name, b := range map[string]string{"unknown action": `{"action":"purge"}`, "no action": `{}`, "bad json": `nope`, "empty": ``} {
		if res := signed(t, srv, "imperium", "POST", "/hop/users/42/actions", []byte(b)); res.StatusCode != 400 {
			t.Errorf("%s: %d, want 400", name, res.StatusCode)
		}
	}
	if !hasSession(a, "h4") {
		t.Error("a refused call ended a session")
	}
	// sign-in off: the whole /hop surface is 404
	_, off := newTestApp(t, false)
	if res := signed(t, off, "imperium", "POST", "/hop/users/42/actions", good); res.StatusCode != 404 {
		t.Errorf("sso off: %d, want 404", res.StatusCode)
	}
}

func TestRefusedCallsNeverEndSessions(t *testing.T) {
	a, srv := newTestApp(t, true)
	seedSession(t, a, "42", "keep")
	body := []byte(`{"action":"revoke_sessions"}`)
	res, _ := http.Post(srv.URL+"/hop/users/42/actions", "application/json", bytes.NewReader(body))
	if res.StatusCode != 401 || !hasSession(a, "keep") {
		t.Fatalf("unsigned call: %d, session kept=%v", res.StatusCode, hasSession(a, "keep"))
	}
}
