package db

import (
	"database/sql"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

// A database made before sessions.verified_at existed opens, gains the column
// once, and its old sessions count as never verified (so they are re-checked).
func TestOpenMigratesOldSessionsTable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")
	old, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL)`,
		`CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)`,
		`INSERT INTO users (id, sub, created_at, seen_at) VALUES (1, 'a', 1, 1)`,
		`INSERT INTO sessions VALUES ('h-old', 1, ` + strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10) + `)`,
	} {
		if _, err := old.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	old.Close()

	for i := 0; i < 2; i++ { // twice: the migration is idempotent
		d, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		at, err := d.SessionVerifiedAt("h-old")
		if err != nil || at.Unix() != 0 {
			t.Fatalf("old session: %v %v", at, err)
		}
		if err := d.CreateSession("h-new", 1, time.Hour); err != nil {
			t.Fatal(err)
		}
		if at, err = d.SessionVerifiedAt("h-new"); err != nil || time.Since(at) > time.Minute {
			t.Fatalf("new session: %v %v", at, err)
		}
		_ = d.DeleteSession("h-new")
		d.Close()
	}
}

// A database from before saved methods existed gains the two tables, and
// opening it again keeps whatever was saved in between (the migration is
// idempotent and never touches rows).
func TestOpenAddsSavedTablesOnceAndKeepsRows(t *testing.T) {
	path := filepath.Join(t.TempDir(), "v1.db")
	old, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL)`,
		`CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, verified_at INTEGER NOT NULL DEFAULT 0)`,
		`CREATE TABLE events (id TEXT PRIMARY KEY, at INTEGER NOT NULL)`,
		`INSERT INTO users (id, sub, created_at, seen_at) VALUES (1, 'a', 1, 1)`,
	} {
		if _, err := old.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	old.Close()

	for i := 0; i < 3; i++ {
		d, err := Open(path)
		if err != nil {
			t.Fatalf("open #%d: %v", i, err)
		}
		if i == 0 {
			if _, err := d.AddMethod(1, "epc", []byte("sealed"), 20); err != nil {
				t.Fatal(err)
			}
			if _, err := d.AddBill(1, []byte("sealed"), 200); err != nil {
				t.Fatal(err)
			}
		}
		ms, err := d.ListMethods(1)
		if err != nil || len(ms) != 1 || string(ms[0].Data) != "sealed" {
			t.Fatalf("open #%d: methods %v %v", i, ms, err)
		}
		d.Close()
	}
}

func TestSavedRowsGoWithTheAccountAndHonourLimits(t *testing.T) {
	d, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	u, _ := d.UpsertUser("s", "a@example.org", "A")
	for i := 0; i < 3; i++ {
		if _, err := d.AddMethod(u.ID, "epc", []byte{byte(i)}, 3); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := d.AddMethod(u.ID, "epc", []byte{9}, 3); err != ErrLimit {
		t.Fatalf("4th with max 3: %v", err)
	}
	for i := 0; i < 7; i++ {
		if _, err := d.AddBill(u.ID, []byte{byte(i)}, 5); err != nil {
			t.Fatal(err)
		}
	}
	bs, _ := d.ListBills(u.ID)
	if len(bs) != 5 || bs[0].Data[0] != 6 || bs[4].Data[0] != 2 {
		t.Fatalf("bills kept: %d first %v", len(bs), bs)
	}
	if err := d.DeleteUser("s"); err != nil {
		t.Fatal(err)
	}
	if s, _ := d.SavedCounts(); s.Methods != 0 || s.Bills != 0 {
		t.Fatalf("rows survived the account: %+v", s)
	}
}
