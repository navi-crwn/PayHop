// Package vault encrypts the few personal values an account may choose to
// keep here (saved payment methods, bill history) with AES-256-GCM.
//
// The key comes from the environment (PAYHOP_PROFILE_KEY, 32 bytes, base64).
// A second key (PAYHOP_PROFILE_KEY_PREV) is only for rotation: it can still
// open old rows while `payhop reencrypt` rewrites them under the current key.
// Every row gets its own random nonce, and the row's owner and kind are bound
// in as additional data, so a ciphertext copied to another row or account
// does not open.
package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const (
	keyLen  = 32
	version = 1
)

var (
	ErrOff     = errors.New("vault: no key configured")
	ErrCorrupt = errors.New("vault: cannot open this value with the configured keys")
)

// Vault holds the current key and, during a rotation, the previous one.
// The zero value and a nil *Vault are both "off".
type Vault struct {
	cur  cipher.AEAD
	prev cipher.AEAD
}

// ParseKey reads a 32 byte key written as base64 (standard or URL alphabet, padded or not).
// The error never contains the key text.
func ParseKey(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if b, err := enc.DecodeString(s); err == nil {
			if len(b) != keyLen {
				return nil, fmt.Errorf("the key must be %d bytes (base64 of 32 random bytes), got %d", keyLen, len(b))
			}
			return b, nil
		}
	}
	return nil, errors.New("the key is not valid base64")
}

func aead(key []byte) (cipher.AEAD, error) {
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(blk)
}

// New builds a vault. An empty cur means "off" (nil, nil). prev may be empty.
func New(cur, prev string) (*Vault, error) {
	if strings.TrimSpace(cur) == "" {
		if strings.TrimSpace(prev) != "" {
			return nil, errors.New("PAYHOP_PROFILE_KEY_PREV is set but PAYHOP_PROFILE_KEY is not")
		}
		return nil, nil
	}
	k, err := ParseKey(cur)
	if err != nil {
		return nil, fmt.Errorf("PAYHOP_PROFILE_KEY: %w", err)
	}
	v := &Vault{}
	if v.cur, err = aead(k); err != nil {
		return nil, err
	}
	if strings.TrimSpace(prev) != "" {
		pk, err := ParseKey(prev)
		if err != nil {
			return nil, fmt.Errorf("PAYHOP_PROFILE_KEY_PREV: %w", err)
		}
		if v.prev, err = aead(pk); err != nil {
			return nil, err
		}
	}
	return v, nil
}

// On reports whether saving is available.
func (v *Vault) On() bool { return v != nil && v.cur != nil }

// Seal encrypts plain under the current key: version byte, 12 byte random nonce, ciphertext+tag.
func (v *Vault) Seal(plain, aad []byte) ([]byte, error) {
	if !v.On() {
		return nil, ErrOff
	}
	nonce := make([]byte, v.cur.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	out := append([]byte{version}, nonce...)
	return v.cur.Seal(out, nonce, plain, aad), nil
}

// Open decrypts with the current key, then with the previous one.
// usedPrev tells the caller the row is still under the old key.
func (v *Vault) Open(blob, aad []byte) (plain []byte, usedPrev bool, err error) {
	if !v.On() {
		return nil, false, ErrOff
	}
	if len(blob) < 1+v.cur.NonceSize()+v.cur.Overhead() || blob[0] != version {
		return nil, false, ErrCorrupt
	}
	n := v.cur.NonceSize()
	nonce, ct := blob[1:1+n], blob[1+n:]
	if p, err := v.cur.Open(nil, nonce, ct, aad); err == nil {
		return p, false, nil
	}
	if v.prev != nil {
		if p, err := v.prev.Open(nil, nonce, ct, aad); err == nil {
			return p, true, nil
		}
	}
	return nil, false, ErrCorrupt
}

// AAD binds a value to its owner and its kind ("method", "bill").
func AAD(kind string, userID int64) []byte {
	return []byte(fmt.Sprintf("payhop:%s:%d", kind, userID))
}
