package app

import (
	"net/http"

	"github.com/navi-crwn/PayHop/web"
)

// changelogJSON serves the snapshot of the repository history that the
// /changelog page shows (scripts/build-changelog.py writes web/changelog.json;
// there is no GitHub call at run time).
func (a *App) changelogJSON(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write(web.Changelog)
}
