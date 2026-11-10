/* When the page should make the one quiet trip through the hub (the server says the session is "stale":
   alive here, but the hub has not vouched for it lately). Pure, so it is tested without a browser.

   - never when the page was just opened by the hub's return (_rc): a second trip would loop when cookies are blocked,
     the page says so instead;
   - never when the hub is down: the server then does not send `stale` at all, so there is no trip to nowhere;
   - only on page load: the caller does not repeat it. */
export function recheckAction({ stale, justBack }) {
  if (justBack && stale) return 'cookies'; // came back from the hub and the session is still not readable
  if (stale && !justBack) return 'recheck';
  return 'none';
}
