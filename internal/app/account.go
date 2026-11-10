package app

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/navi-crwn/PayHop/internal/db"
	"github.com/navi-crwn/PayHop/internal/vault"
)

// What an account may keep here, and only because the person chose to:
// saved payment methods (one row each, explicit consent per method) and the
// last bills. Both are sealed with AES-256-GCM before they reach the database
// (package vault, key PAYHOP_PROFILE_KEY). A guest never writes anything.
// Nothing here is logged, and nothing here is reachable through /hop/*.

const (
	MaxMethods = 20
	KeepBills  = 200

	maxBody       = 16 << 10
	maxFields     = 12
	maxFieldBytes = 400
	maxLabel      = 60
	maxPayload    = 2048
	maxNote       = 200
)

var payFormats = map[string]bool{"paypal": true, "cashapp": true, "venmo": true, "solana": true, "upi": true, "epc": true, "promptpay": true, "vietqr": true}

type methodPlain struct {
	Label  string            `json:"label"`
	Values map[string]string `json:"values"`
}

type methodIn struct {
	Format  string            `json:"format"`
	Label   string            `json:"label"`
	Values  map[string]string `json:"values"`
	Consent bool              `json:"consent"`
}

type methodOut struct {
	ID        int64             `json:"id"`
	Format    string            `json:"format"`
	Label     string            `json:"label"`
	Values    map[string]string `json:"values"`
	CreatedAt int64             `json:"created_at"`
	ConsentAt int64             `json:"consent_at"`
}

type billPlain struct {
	Format   string `json:"format"`
	Receiver string `json:"receiver"`
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
	Payload  string `json:"payload"`
	Note     string `json:"note"`
}

type billOut struct {
	billPlain
	ID        int64 `json:"id"`
	CreatedAt int64 `json:"created_at"`
}

func (a *App) accountRoutes(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/saved", a.savedList)
	m.HandleFunc("POST /api/v1/methods", a.methodAdd)
	m.HandleFunc("DELETE /api/v1/methods/{id}", a.methodDelete)
	m.HandleFunc("DELETE /api/v1/methods", a.methodsDeleteAll)
	m.HandleFunc("POST /api/v1/bills", a.billAdd)
	m.HandleFunc("DELETE /api/v1/bills/{id}", a.billDelete)
	m.HandleFunc("DELETE /api/v1/bills", a.billsDeleteAll)
}

func apiErr(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

// guard returns the signed-in account for a request that reads or changes saved data,
// or answers the error itself. Writes need a header a cross-site form cannot send.
func (a *App) guard(w http.ResponseWriter, r *http.Request, needVault bool) *db.User {
	if r.Method != http.MethodGet && r.Header.Get("X-Requested-With") != "payhop" {
		apiErr(w, http.StatusForbidden, "forbidden")
		return nil
	}
	u := a.verifiedUser(r)
	if u == nil {
		apiErr(w, http.StatusUnauthorized, "signin")
		return nil
	}
	if needVault && !a.cfg.Vault.On() {
		apiErr(w, http.StatusServiceUnavailable, "storage_off")
		return nil
	}
	return u
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil || json.Unmarshal(body, v) != nil {
		apiErr(w, http.StatusBadRequest, "bad_request")
		return false
	}
	return true
}

func tooLong(s string, n int) bool { return len(s) > n || !utf8.ValidString(s) }

// savedList is everything the account keeps, decrypted for its owner. With no key the
// answer says so (enabled:false) and lists nothing.
func (a *App) savedList(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, false)
	if u == nil {
		return
	}
	out := map[string]any{"enabled": a.cfg.Vault.On(), "max_methods": MaxMethods, "keep_bills": KeepBills,
		"methods": []methodOut{}, "bills": []billOut{}, "unreadable": 0}
	if !a.cfg.Vault.On() {
		writeJSON(w, http.StatusOK, out)
		return
	}
	bad := 0
	ms, err := a.db.ListMethods(u.ID)
	if err != nil {
		serverErr(w, "list methods", err)
		return
	}
	methods := []methodOut{}
	for _, row := range ms {
		plain, _, err := a.cfg.Vault.Open(row.Data, vault.AAD("method", u.ID))
		var p methodPlain
		if err != nil || json.Unmarshal(plain, &p) != nil {
			bad++
			continue
		}
		methods = append(methods, methodOut{ID: row.ID, Format: row.Format, Label: p.Label, Values: p.Values, CreatedAt: row.CreatedAt, ConsentAt: row.ConsentAt})
	}
	bs, err := a.db.ListBills(u.ID)
	if err != nil {
		serverErr(w, "list bills", err)
		return
	}
	bills := []billOut{}
	for _, row := range bs {
		plain, _, err := a.cfg.Vault.Open(row.Data, vault.AAD("bill", u.ID))
		var p billPlain
		if err != nil || json.Unmarshal(plain, &p) != nil {
			bad++
			continue
		}
		bills = append(bills, billOut{billPlain: p, ID: row.ID, CreatedAt: row.CreatedAt})
	}
	out["methods"], out["bills"], out["unreadable"] = methods, bills, bad
	writeJSON(w, http.StatusOK, out)
}

func (a *App) methodAdd(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, true)
	if u == nil {
		return
	}
	var in methodIn
	if !readJSON(w, r, &in) {
		return
	}
	// consent is the person's own tick for this one method, never assumed
	if !in.Consent {
		apiErr(w, http.StatusBadRequest, "consent_required")
		return
	}
	if !payFormats[in.Format] || len(in.Values) == 0 || len(in.Values) > maxFields || tooLong(in.Label, maxLabel) {
		apiErr(w, http.StatusBadRequest, "bad_request")
		return
	}
	for k, v := range in.Values {
		if k == "" || tooLong(k, 40) || tooLong(v, maxFieldBytes) {
			apiErr(w, http.StatusBadRequest, "bad_request")
			return
		}
	}
	plain, _ := json.Marshal(methodPlain{Label: in.Label, Values: in.Values})
	sealed, err := a.cfg.Vault.Seal(plain, vault.AAD("method", u.ID))
	if err != nil {
		serverErr(w, "seal method", err)
		return
	}
	id, err := a.db.AddMethod(u.ID, in.Format, sealed, MaxMethods)
	if errors.Is(err, db.ErrLimit) {
		apiErr(w, http.StatusConflict, "limit_methods")
		return
	}
	if err != nil {
		serverErr(w, "add method", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func (a *App) methodDelete(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, false)
	if u == nil {
		return
	}
	id, ok := pathID(r)
	if !ok {
		apiErr(w, http.StatusNotFound, "not_found")
		return
	}
	deleted(w, a.db.DeleteMethod(u.ID, id), "delete method")
}

func (a *App) methodsDeleteAll(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, false)
	if u == nil {
		return
	}
	n, err := a.db.DeleteMethods(u.ID)
	if err != nil {
		serverErr(w, "delete methods", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"deleted": n})
}

func (a *App) billAdd(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, true)
	if u == nil {
		return
	}
	var in struct {
		billPlain
		Consent bool `json:"consent"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if !in.Consent {
		apiErr(w, http.StatusBadRequest, "consent_required")
		return
	}
	p := in.billPlain
	if !payFormats[p.Format] || p.Payload == "" || tooLong(p.Payload, maxPayload) || tooLong(p.Note, maxNote) ||
		tooLong(p.Receiver, maxFieldBytes) || tooLong(p.Amount, 40) || tooLong(p.Currency, 40) {
		apiErr(w, http.StatusBadRequest, "bad_request")
		return
	}
	plain, _ := json.Marshal(p)
	sealed, err := a.cfg.Vault.Seal(plain, vault.AAD("bill", u.ID))
	if err != nil {
		serverErr(w, "seal bill", err)
		return
	}
	id, err := a.db.AddBill(u.ID, sealed, KeepBills)
	if err != nil {
		serverErr(w, "add bill", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (a *App) billDelete(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, false)
	if u == nil {
		return
	}
	id, ok := pathID(r)
	if !ok {
		apiErr(w, http.StatusNotFound, "not_found")
		return
	}
	deleted(w, a.db.DeleteBill(u.ID, id), "delete bill")
}

func (a *App) billsDeleteAll(w http.ResponseWriter, r *http.Request) {
	u := a.guard(w, r, false)
	if u == nil {
		return
	}
	n, err := a.db.DeleteBills(u.ID)
	if err != nil {
		serverErr(w, "delete bills", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"deleted": n})
}

func deleted(w http.ResponseWriter, err error, what string) {
	if errors.Is(err, db.ErrNotFound) {
		apiErr(w, http.StatusNotFound, "not_found")
		return
	}
	if err != nil {
		serverErr(w, what, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// serverErr logs which step failed, never what was being saved: the driver's
// error text can quote SQL arguments, so it is not logged at all.
func serverErr(w http.ResponseWriter, what string, _ error) {
	log.Printf("saved data: %s failed", what)
	apiErr(w, http.StatusInternalServerError, "server_error")
}

// Reencrypt rewrites every stored row under the current key (rotation:
// PAYHOP_PROFILE_KEY = the new key, PAYHOP_PROFILE_KEY_PREV = the old one).
// It returns how many rows it rewrote and how many were already current.
func Reencrypt(d *db.DB, v *vault.Vault) (rewritten, current int, err error) {
	if !v.On() {
		return 0, 0, vault.ErrOff
	}
	rewritten, err = d.Reseal(func(kind string, userID int64, data []byte) ([]byte, error) {
		plain, usedPrev, err := v.Open(data, vault.AAD(kind, userID))
		if err != nil {
			return nil, err
		}
		if !usedPrev {
			current++
			return nil, nil
		}
		return v.Seal(plain, vault.AAD(kind, userID))
	})
	if err != nil {
		return 0, 0, err
	}
	return rewritten, current, nil
}
