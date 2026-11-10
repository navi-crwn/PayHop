package app

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/navi-crwn/PayHop/internal/db"
	"github.com/navi-crwn/PayHop/internal/vault"
)

const secretIBAN = "DE89370400440532013000"

func randKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// newSavedApp is a test app with sign-in on and a vault key set.
func newSavedApp(t *testing.T) (*App, *httptest.Server, string) {
	t.Helper()
	a, srv := newTestApp(t, true)
	key := randKey(t)
	v, err := vault.New(key, "")
	if err != nil {
		t.Fatal(err)
	}
	a.cfg.Vault = v
	return a, srv, key
}

// call sends a JSON request the way the browser app does (with the header writes need).
func call(t *testing.T, c *http.Client, method, url string, body any) (int, map[string]any) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, url, rd)
	if method != http.MethodGet {
		req.Header.Set("X-Requested-With", "payhop")
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func epcMethod(consent bool) map[string]any {
	return map[string]any{"format": "epc", "label": "Rent", "consent": consent,
		"values": map[string]string{"name": "Ana Souza", "iban": secretIBAN, "amount": "12.34"}}
}

func list(t *testing.T, c *http.Client, base string) map[string]any {
	t.Helper()
	code, out := call(t, c, "GET", base+"/api/v1/saved", nil)
	if code != 200 {
		t.Fatalf("saved: %d %v", code, out)
	}
	return out
}

func TestMethodRoundTripAndSealedAtRest(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")

	code, out := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	if code != 201 || out["id"] == nil {
		t.Fatalf("save: %d %v", code, out)
	}
	got := list(t, c, srv.URL)
	ms := got["methods"].([]any)
	if got["enabled"] != true || len(ms) != 1 {
		t.Fatalf("list: %v", got)
	}
	m := ms[0].(map[string]any)
	if m["format"] != "epc" || m["label"] != "Rent" || m["values"].(map[string]any)["iban"] != secretIBAN {
		t.Fatalf("method came back wrong: %v", m)
	}

	// what is on disk is ciphertext: no IBAN, name, label or amount in the row
	u, _ := a.db.UserBySub("1")
	rows, err := a.db.ListMethods(u.ID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("rows: %v %v", rows, err)
	}
	for _, plain := range []string{secretIBAN, "Ana Souza", "Rent", "12.34", "iban"} {
		if bytes.Contains(rows[0].Data, []byte(plain)) {
			t.Fatalf("the stored row contains %q", plain)
		}
	}
	if rows[0].Format != "epc" || rows[0].ConsentAt == 0 {
		t.Fatalf("row meta: %+v", rows[0])
	}
}

func TestConsentIsRequiredPerMethod(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	code, out := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(false))
	if code != 400 || out["error"] != "consent_required" {
		t.Fatalf("no consent: %d %v", code, out)
	}
	// a body without the field at all is the same as unticked
	b := epcMethod(true)
	delete(b, "consent")
	if code, _ := call(t, c, "POST", srv.URL+"/api/v1/methods", b); code != 400 {
		t.Fatalf("missing consent: %d", code)
	}
	if code, _ := call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "payload": "BCD", "consent": false}); code != 400 {
		t.Fatalf("bill without consent: %d", code)
	}
	if s, _ := a.db.SavedCounts(); s.Methods != 0 || s.Bills != 0 {
		t.Fatalf("something was stored without consent: %+v", s)
	}
}

func TestGuestNeverWrites(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	guest := noRedirect()
	for _, tc := range []struct{ m, p string }{
		{"GET", "/api/v1/saved"}, {"POST", "/api/v1/methods"}, {"DELETE", "/api/v1/methods/1"}, {"DELETE", "/api/v1/methods"},
		{"POST", "/api/v1/bills"}, {"DELETE", "/api/v1/bills/1"}, {"DELETE", "/api/v1/bills"},
	} {
		var body any
		if tc.m == "POST" {
			body = epcMethod(true)
		}
		if code, out := call(t, guest, tc.m, srv.URL+tc.p, body); code != 401 || out["error"] != "signin" {
			t.Errorf("guest %s %s: %d %v", tc.m, tc.p, code, out)
		}
	}
	if s, _ := a.db.SavedCounts(); s.Methods != 0 || s.Bills != 0 {
		t.Fatalf("a guest left rows behind: %+v", s)
	}
}

func TestWritesNeedTheHeaderAndAFreshSession(t *testing.T) {
	_, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	b, _ := json.Marshal(epcMethod(true))
	res, _ := c.Post(srv.URL+"/api/v1/methods", "text/plain", bytes.NewReader(b)) // what a cross-site form can send
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatalf("no header: %d", res.StatusCode)
	}
	restore := goStale(t)
	defer restore()
	if code, _ := call(t, c, "GET", srv.URL+"/api/v1/saved", nil); code != 401 {
		t.Fatalf("a session the hub has not vouched for lately must not read saved data: %d", code)
	}
}

func TestKeyNotSetTurnsSavingOffNotTheApp(t *testing.T) {
	a, srv := newTestApp(t, true) // no vault
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	if me := decode(t, mustGet(t, c, srv.URL+"/api/v1/me")); me["signed_in"] != true {
		t.Fatalf("sign-in must still work: %v", me)
	}
	got := list(t, c, srv.URL)
	if got["enabled"] != false || len(got["methods"].([]any)) != 0 {
		t.Fatalf("list without key: %v", got)
	}
	code, out := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	if code != 503 || out["error"] != "storage_off" {
		t.Fatalf("save without key: %d %v", code, out)
	}
	if code, _ := call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "payload": "x", "consent": true}); code != 503 {
		t.Fatalf("bill without key: %d", code)
	}
	if s, _ := a.db.SavedCounts(); s.Methods != 0 {
		t.Fatal("stored without a key")
	}
	res, _ := http.Get(srv.URL + "/generate")
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("the shell: %d", res.StatusCode)
	}
}

func TestMethodLimitIsTwenty(t *testing.T) {
	_, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	for i := 0; i < MaxMethods; i++ {
		m := epcMethod(true)
		m["label"] = fmt.Sprintf("m%d", i)
		if code, out := call(t, c, "POST", srv.URL+"/api/v1/methods", m); code != 201 {
			t.Fatalf("method %d: %d %v", i, code, out)
		}
	}
	code, out := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	if code != 409 || out["error"] != "limit_methods" {
		t.Fatalf("21st method: %d %v", code, out)
	}
	// the limit is per account
	other := noRedirect()
	signIn(t, other, srv.URL, "2", "Bo", "j-2", "")
	if code, _ := call(t, other, "POST", srv.URL+"/api/v1/methods", epcMethod(true)); code != 201 {
		t.Fatalf("another account: %d", code)
	}
	// deleting one frees a place
	ms := list(t, c, srv.URL)["methods"].([]any)
	id := int(ms[0].(map[string]any)["id"].(float64))
	if code, _ := call(t, c, "DELETE", fmt.Sprintf("%s/api/v1/methods/%d", srv.URL, id), nil); code != 200 {
		t.Fatalf("delete: %d", code)
	}
	if code, _ := call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true)); code != 201 {
		t.Fatalf("after delete: %d", code)
	}
}

func TestBillHistoryKeepsTheLast200(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	for i := 0; i < KeepBills+5; i++ {
		b := map[string]any{"format": "epc", "receiver": fmt.Sprintf("bill-%03d", i), "amount": "1.00", "currency": "EUR", "payload": "BCD\n002", "consent": true}
		if code, out := call(t, c, "POST", srv.URL+"/api/v1/bills", b); code != 201 {
			t.Fatalf("bill %d: %d %v", i, code, out)
		}
	}
	bills := list(t, c, srv.URL)["bills"].([]any)
	if len(bills) != KeepBills {
		t.Fatalf("kept %d bills, want %d", len(bills), KeepBills)
	}
	newest := bills[0].(map[string]any)["receiver"]
	oldest := bills[len(bills)-1].(map[string]any)["receiver"]
	if newest != fmt.Sprintf("bill-%03d", KeepBills+4) || oldest != "bill-005" {
		t.Fatalf("kept the wrong ones: newest %v oldest %v", newest, oldest)
	}
	// the trim is per account
	other := noRedirect()
	signIn(t, other, srv.URL, "2", "Bo", "j-2", "")
	call(t, other, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "payload": "x", "consent": true})
	if s, _ := a.db.SavedCounts(); s.Bills != int64(KeepBills)+1 {
		t.Fatalf("bills in the database: %d", s.Bills)
	}
}

func TestDeleteOneAndAllAndOwnership(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	ana, bo := noRedirect(), noRedirect()
	signIn(t, ana, srv.URL, "1", "Ana", "j-1", "")
	signIn(t, bo, srv.URL, "2", "Bo", "j-2", "")
	for i := 0; i < 3; i++ {
		call(t, ana, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
		call(t, ana, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "payload": "x", "consent": true})
	}
	call(t, bo, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	id := int(list(t, ana, srv.URL)["methods"].([]any)[0].(map[string]any)["id"].(float64))

	// somebody else's id is "not found", and nothing changes
	if code, _ := call(t, bo, "DELETE", fmt.Sprintf("%s/api/v1/methods/%d", srv.URL, id), nil); code != 404 {
		t.Fatalf("deleting another account's method: %d", code)
	}
	if n := len(list(t, ana, srv.URL)["methods"].([]any)); n != 3 {
		t.Fatalf("Ana has %d methods", n)
	}
	if code, _ := call(t, ana, "DELETE", srv.URL+"/api/v1/methods/abc", nil); code != 404 {
		t.Fatalf("bad id: %d", code)
	}
	if code, _ := call(t, ana, "DELETE", fmt.Sprintf("%s/api/v1/methods/%d", srv.URL, id), nil); code != 200 {
		t.Fatal("delete one")
	}
	if code, _ := call(t, ana, "DELETE", fmt.Sprintf("%s/api/v1/methods/%d", srv.URL, id), nil); code != 404 {
		t.Fatalf("second delete: %d", code)
	}
	bid := int(list(t, ana, srv.URL)["bills"].([]any)[0].(map[string]any)["id"].(float64))
	if code, _ := call(t, ana, "DELETE", fmt.Sprintf("%s/api/v1/bills/%d", srv.URL, bid), nil); code != 200 {
		t.Fatal("delete one bill")
	}

	_, out := call(t, ana, "DELETE", srv.URL+"/api/v1/methods", nil)
	if out["deleted"] != float64(2) {
		t.Fatalf("delete all methods: %v", out)
	}
	_, out = call(t, ana, "DELETE", srv.URL+"/api/v1/bills", nil)
	if out["deleted"] != float64(2) {
		t.Fatalf("delete all bills: %v", out)
	}
	if s, _ := a.db.SavedCounts(); s.Methods != 1 || s.Bills != 0 {
		t.Fatalf("Bo's method must survive: %+v", s)
	}
}

func TestDeleteWorksWithoutAKey(t *testing.T) {
	// someone can still remove what they saved even if the key was lost or removed later
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	a.cfg.Vault = nil
	if _, out := call(t, c, "DELETE", srv.URL+"/api/v1/methods", nil); out["deleted"] != float64(1) {
		t.Fatalf("delete all without key: %v", out)
	}
}

func TestHubAccountDeletedRemovesEverything(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	ana, bo := noRedirect(), noRedirect()
	signIn(t, ana, srv.URL, "1", "Ana", "j-1", "")
	signIn(t, bo, srv.URL, "2", "Bo", "j-2", "")
	for i := 0; i < 2; i++ {
		call(t, ana, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
		call(t, ana, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "payload": "x", "consent": true})
	}
	call(t, bo, "POST", srv.URL+"/api/v1/methods", epcMethod(true))

	ev, _ := json.Marshal(map[string]any{"id": "evt-1", "type": "account.deleted", "at": "2026-11-11T00:00:00Z", "data": map[string]any{"sub": "1"}})
	res := signed(t, srv, "helink", "POST", "/hop/events", ev)
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("event: %d", res.StatusCode)
	}
	if s, _ := a.db.SavedCounts(); s.Methods != 1 || s.Bills != 0 {
		t.Fatalf("after account.deleted: %+v (only Bo's method should remain)", s)
	}
}

func TestWrongKeyReadsNothingAndLeaksNothing(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "receiver": "Ana", "payload": "x", "consent": true})

	wrong, _ := vault.New(randKey(t), "")
	a.cfg.Vault = wrong
	got := list(t, c, srv.URL)
	if len(got["methods"].([]any)) != 0 || len(got["bills"].([]any)) != 0 || got["unreadable"] != float64(2) {
		t.Fatalf("wrong key: %v", got)
	}
}

func TestRotationKeepsOldRowsReadableThenReencrypts(t *testing.T) {
	a, srv, oldKey := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "receiver": "Ana", "payload": "x", "consent": true})

	newKey := randKey(t)
	rot, err := vault.New(newKey, oldKey)
	if err != nil {
		t.Fatal(err)
	}
	a.cfg.Vault = rot
	if n := len(list(t, c, srv.URL)["methods"].([]any)); n != 1 {
		t.Fatalf("old row not readable with PREV set: %d", n)
	}
	rewritten, current, err := Reencrypt(a.db, rot)
	if err != nil || rewritten != 2 || current != 0 {
		t.Fatalf("reencrypt: %d %d %v", rewritten, current, err)
	}
	// new row after rotation, then again: everything is current, nothing is rewritten
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	rewritten, current, err = Reencrypt(a.db, rot)
	if err != nil || rewritten != 0 || current != 3 {
		t.Fatalf("second reencrypt: %d %d %v", rewritten, current, err)
	}
	// the old key can go now
	only, _ := vault.New(newKey, "")
	a.cfg.Vault = only
	got := list(t, c, srv.URL)
	if len(got["methods"].([]any)) != 2 || len(got["bills"].([]any)) != 1 || got["unreadable"] != float64(0) {
		t.Fatalf("after rotation: %v", got)
	}
	// without the new key's help a row that cannot be opened stops the run and changes nothing
	lost, _ := vault.New(randKey(t), "")
	if _, _, err := Reencrypt(a.db, lost); err == nil {
		t.Fatal("reencrypt with an unrelated key must fail")
	}
	if _, _, err := Reencrypt(a.db, nil); err == nil {
		t.Fatal("reencrypt without a key must fail")
	}
	a.cfg.Vault = only
	if n := len(list(t, c, srv.URL)["methods"].([]any)); n != 2 {
		t.Fatalf("a failed reencrypt changed rows: %d", n)
	}
}

func TestNothingPersonalInLogsOrHop(t *testing.T) {
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(io.Discard)

	a, srv, key := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	call(t, c, "POST", srv.URL+"/api/v1/methods", map[string]any{"format": "nope", "consent": true, "values": map[string]string{"iban": secretIBAN}})
	call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "receiver": "Ana Souza", "amount": "99.99", "payload": "BCD " + secretIBAN, "note": "private rent", "consent": true})
	call(t, c, "GET", srv.URL+"/api/v1/saved", nil)
	// a broken database makes the handlers log; that line must still not quote the data
	a.db.Close()
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))

	for _, bad := range []string{secretIBAN, "Ana Souza", "private rent", "99.99", key} {
		if strings.Contains(buf.String(), bad) {
			t.Fatalf("the log contains %q:\n%s", bad, buf.String())
		}
	}
}

func TestSavedDataNeverShowsThroughHop(t *testing.T) {
	a, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	call(t, c, "POST", srv.URL+"/api/v1/methods", epcMethod(true))
	call(t, c, "POST", srv.URL+"/api/v1/bills", map[string]any{"format": "epc", "receiver": "Ana Souza", "amount": "99.99", "payload": "BCD " + secretIBAN, "consent": true})
	_ = a

	for _, p := range []string{"/hop/health", "/hop/manifest", "/hop/stats", "/hop/users/1"} {
		res := signed(t, srv, "imperium", "GET", p, nil)
		b, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatalf("%s: %d", p, res.StatusCode)
		}
		for _, bad := range []string{secretIBAN, "Ana Souza", "99.99", "Rent", "BCD"} {
			if strings.Contains(string(b), bad) {
				t.Fatalf("%s shows %q: %s", p, bad, b)
			}
		}
	}
	res := signed(t, srv, "imperium", "GET", "/hop/manifest", nil)
	var man struct {
		Data struct {
			ContentTypes []any `json:"content_types"`
		} `json:"data"`
	}
	_ = json.NewDecoder(res.Body).Decode(&man)
	res.Body.Close()
	if len(man.Data.ContentTypes) != 0 {
		t.Fatalf("the manifest lists content types: %v", man.Data.ContentTypes)
	}
	// not even a count reaches the control center: accounts and sessions only
	res = signed(t, srv, "imperium", "GET", "/hop/stats", nil)
	st := decode(t, res)
	tot := st["data"].(map[string]any)["totals"].(map[string]any)
	for _, k := range []string{"users", "users_suspended", "sessions_live", "users_active_30d"} {
		if _, ok := tot[k]; !ok {
			t.Fatalf("stats lost %q: %v", k, tot)
		}
	}
	if len(tot) != 4 {
		t.Fatalf("stats must carry exactly the four account and session numbers: %v", tot)
	}
	for k := range tot {
		if strings.Contains(k, "method") || strings.Contains(k, "bill") || strings.Contains(k, "saved") {
			t.Fatalf("stats shows saved data: %v", tot)
		}
	}
}

func TestRejectsOversizedAndOddInput(t *testing.T) {
	_, srv, _ := newSavedApp(t)
	c := noRedirect()
	signIn(t, c, srv.URL, "1", "Ana", "j-1", "")
	huge := epcMethod(true)
	huge["values"] = map[string]string{"iban": strings.Repeat("A", maxFieldBytes+1)}
	manyKeys := map[string]string{}
	for i := 0; i <= maxFields; i++ {
		manyKeys[fmt.Sprintf("k%d", i)] = "v"
	}
	for name, body := range map[string]map[string]any{
		"long field": huge,
		"many keys":  {"format": "epc", "consent": true, "values": manyKeys},
		"no values":  {"format": "epc", "consent": true, "values": map[string]string{}},
		"long label": {"format": "epc", "consent": true, "label": strings.Repeat("x", maxLabel+1), "values": map[string]string{"iban": "x"}},
		"bad format": {"format": "visa", "consent": true, "values": map[string]string{"pan": "4111"}},
	} {
		if code, _ := call(t, c, "POST", srv.URL+"/api/v1/methods", body); code != 400 {
			t.Errorf("%s: %d", name, code)
		}
	}
	req, _ := http.NewRequest("POST", srv.URL+"/api/v1/methods", strings.NewReader(strings.Repeat("{", maxBody+10)))
	req.Header.Set("X-Requested-With", "payhop")
	res, _ := c.Do(req)
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Errorf("oversized body: %d", res.StatusCode)
	}
}

var _ = db.ErrLimit
