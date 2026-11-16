package app

import "testing"

// The Feedback link is built in the browser from the hub address and the version this answer carries.
// It is a plain link: the server gets no new route and keeps nothing.
func TestMeCarriesVersionAndHubAddressForFeedbackLink(t *testing.T) {
	_, srv := newTestApp(t, true)
	me := decode(t, mustGet(t, noRedirect(), srv.URL+"/api/v1/me"))
	if me["version"] != "test" {
		t.Fatalf("version = %v, want test", me["version"])
	}
	if me["hub_url"] != "https://hub.example.org" {
		t.Fatalf("hub_url = %v", me["hub_url"])
	}
}

func TestMeWithoutHubAddressGivesNoHubAddress(t *testing.T) {
	_, srv := newTestApp(t, false)
	me := decode(t, mustGet(t, noRedirect(), srv.URL+"/api/v1/me"))
	if _, has := me["hub_url"]; has {
		t.Fatalf("hub_url present without a hub: %v", me["hub_url"])
	}
}
