package vault

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"strings"
	"testing"
)

func newKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(b)
}

func TestRoundTrip(t *testing.T) {
	v, err := New(newKey(t), "")
	if err != nil || !v.On() {
		t.Fatalf("New: %v on=%v", err, v.On())
	}
	aad := AAD("method", 7)
	blob, err := v.Seal([]byte(`{"iban":"DE89370400440532013000"}`), aad)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(blob, []byte("DE89")) {
		t.Fatal("the ciphertext shows the plain text")
	}
	got, usedPrev, err := v.Open(blob, aad)
	if err != nil || usedPrev || string(got) != `{"iban":"DE89370400440532013000"}` {
		t.Fatalf("Open: %q prev=%v err=%v", got, usedPrev, err)
	}
}

func TestRandomNoncePerRow(t *testing.T) {
	v, _ := New(newKey(t), "")
	a, _ := v.Seal([]byte("same"), nil)
	b, _ := v.Seal([]byte("same"), nil)
	if bytes.Equal(a, b) || bytes.Equal(a[1:13], b[1:13]) {
		t.Fatal("two seals of the same text share a nonce or ciphertext")
	}
}

func TestWrongKeyAndTamper(t *testing.T) {
	v1, _ := New(newKey(t), "")
	v2, _ := New(newKey(t), "")
	blob, _ := v1.Seal([]byte("secret"), AAD("method", 1))
	if _, _, err := v2.Open(blob, AAD("method", 1)); err != ErrCorrupt {
		t.Fatalf("wrong key: %v", err)
	}
	if _, _, err := v1.Open(blob, AAD("method", 2)); err != ErrCorrupt {
		t.Fatalf("another owner's AAD opened it: %v", err)
	}
	if _, _, err := v1.Open(blob, AAD("bill", 1)); err != ErrCorrupt {
		t.Fatalf("another kind's AAD opened it: %v", err)
	}
	blob[len(blob)-1] ^= 1
	if _, _, err := v1.Open(blob, AAD("method", 1)); err != ErrCorrupt {
		t.Fatalf("tampered: %v", err)
	}
	if _, _, err := v1.Open([]byte{1, 2, 3}, nil); err != ErrCorrupt {
		t.Fatalf("short blob: %v", err)
	}
}

func TestRotationWithPrev(t *testing.T) {
	oldK, newK := newKey(t), newKey(t)
	before, _ := New(oldK, "")
	blob, _ := before.Seal([]byte("v"), nil)

	after, err := New(newK, oldK)
	if err != nil {
		t.Fatal(err)
	}
	p, usedPrev, err := after.Open(blob, nil)
	if err != nil || !usedPrev || string(p) != "v" {
		t.Fatalf("old row under the new vault: %q prev=%v err=%v", p, usedPrev, err)
	}
	re, _ := after.Seal(p, nil)
	_, usedPrev, err = after.Open(re, nil)
	if err != nil || usedPrev {
		t.Fatalf("re-encrypted row: prev=%v err=%v", usedPrev, err)
	}
	// without the previous key the old row is gone for good
	noPrev, _ := New(newK, "")
	if _, _, err := noPrev.Open(blob, nil); err != ErrCorrupt {
		t.Fatalf("old row without PREV: %v", err)
	}
}

func TestOffAndBadKeys(t *testing.T) {
	v, err := New("", "")
	if v != nil || err != nil {
		t.Fatalf("empty key: %v %v", v, err)
	}
	if v.On() {
		t.Fatal("nil vault says on")
	}
	if _, err := v.Seal([]byte("x"), nil); err != ErrOff {
		t.Fatalf("Seal on off: %v", err)
	}
	if _, err := New("", newKey(t)); err == nil {
		t.Fatal("PREV without a current key must fail")
	}
	short := base64.StdEncoding.EncodeToString(make([]byte, 16))
	secretish := "not-base64-" + strings.Repeat("z", 8)
	for _, bad := range []string{short, secretish} {
		_, err := New(bad, "")
		if err == nil {
			t.Fatalf("accepted %q", bad)
		}
		if strings.Contains(err.Error(), bad) {
			t.Fatalf("error repeats the key: %v", err)
		}
	}
}
