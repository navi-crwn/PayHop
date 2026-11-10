package db

import (
	"errors"
	"time"
)

// Saved payment methods and bill history. The data column is always ciphertext
// made by package vault; the plain columns hold nothing personal (the payment
// format, timestamps). Rows go with their account (ON DELETE CASCADE).

var ErrLimit = errors.New("limit reached")

// Row is one stored item: its id, the sealed data and when it was made.
type Row struct {
	ID        int64
	Format    string // methods only
	Data      []byte
	ConsentAt int64 // methods only
	CreatedAt int64
}

// AddMethod stores a sealed method unless the account already has max of them.
func (d *DB) AddMethod(userID int64, format string, data []byte, max int) (int64, error) {
	tx, err := d.sql.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var n int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM methods WHERE user_id = ?`, userID).Scan(&n); err != nil {
		return 0, err
	}
	if n >= max {
		return 0, ErrLimit
	}
	now := time.Now().Unix()
	res, err := tx.Exec(`INSERT INTO methods (user_id, format, data, consent_at, created_at) VALUES (?, ?, ?, ?, ?)`,
		userID, format, data, now, now)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return id, tx.Commit()
}

func (d *DB) ListMethods(userID int64) ([]Row, error) {
	rows, err := d.sql.Query(`SELECT id, format, data, consent_at, created_at FROM methods WHERE user_id = ? ORDER BY id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.Format, &r.Data, &r.ConsentAt, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) DeleteMethod(userID, id int64) error {
	res, err := d.sql.Exec(`DELETE FROM methods WHERE id = ? AND user_id = ?`, id, userID)
	return mustTouch(res, err)
}

func (d *DB) DeleteMethods(userID int64) (int64, error) {
	res, err := d.sql.Exec(`DELETE FROM methods WHERE user_id = ?`, userID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// AddBill stores a sealed bill and drops the account's oldest ones beyond keep.
func (d *DB) AddBill(userID int64, data []byte, keep int) (int64, error) {
	tx, err := d.sql.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`INSERT INTO bills (user_id, data, created_at) VALUES (?, ?, ?)`, userID, data, time.Now().Unix())
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	if _, err := tx.Exec(`DELETE FROM bills WHERE user_id = ? AND id NOT IN
		(SELECT id FROM bills WHERE user_id = ? ORDER BY id DESC LIMIT ?)`, userID, userID, keep); err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

func (d *DB) ListBills(userID int64) ([]Row, error) {
	rows, err := d.sql.Query(`SELECT id, data, created_at FROM bills WHERE user_id = ? ORDER BY id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.Data, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) DeleteBill(userID, id int64) error {
	res, err := d.sql.Exec(`DELETE FROM bills WHERE id = ? AND user_id = ?`, id, userID)
	return mustTouch(res, err)
}

func (d *DB) DeleteBills(userID int64) (int64, error) {
	res, err := d.sql.Exec(`DELETE FROM bills WHERE user_id = ?`, userID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// Resealed is a row whose data was rewritten: kind is "method" or "bill".
type Resealed struct {
	Kind   string
	ID     int64
	UserID int64
	Data   []byte
}

// Reseal walks every stored row in one transaction and lets fn return new
// ciphertext for it (nil keeps the row as it is). It is what `payhop reencrypt`
// uses after a key rotation. It returns how many rows were rewritten; any
// error rolls everything back.
func (d *DB) Reseal(fn func(kind string, userID int64, data []byte) ([]byte, error)) (int, error) {
	tx, err := d.sql.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var all []Resealed
	for _, kind := range []string{"method", "bill"} {
		table := map[string]string{"method": "methods", "bill": "bills"}[kind]
		rows, err := tx.Query(`SELECT id, user_id, data FROM ` + table)
		if err != nil {
			return 0, err
		}
		for rows.Next() {
			var r Resealed
			r.Kind = kind
			if err := rows.Scan(&r.ID, &r.UserID, &r.Data); err != nil {
				rows.Close()
				return 0, err
			}
			all = append(all, r)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return 0, err
		}
		rows.Close()
	}
	changed := 0
	for _, r := range all {
		nd, err := fn(r.Kind, r.UserID, r.Data)
		if err != nil {
			return 0, err
		}
		if nd == nil {
			continue
		}
		table := map[string]string{"method": "methods", "bill": "bills"}[r.Kind]
		if _, err := tx.Exec(`UPDATE `+table+` SET data = ? WHERE id = ?`, nd, r.ID); err != nil {
			return 0, err
		}
		changed++
	}
	return changed, tx.Commit()
}
