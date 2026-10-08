# 10 — Installable and offline

**What to build:** The player installs Trail Bingo to their home screen and plays a whole game with no signal. A web app manifest and a service worker that caches the app shell make the installed app open offline; together with the stored model, Card data, facts and progress, the full play loop works in airplane mode.

**Blocked by:** 04 — First-launch model download; 05 — Build a Card from my location; 08 — Fact cards; 09 — Progress survives restarts

**Status:** ready-for-agent

- [ ] App has a web app manifest and icon and can be installed on Android Chrome
- [ ] Service worker caches the app shell; new app versions update cleanly without re-downloading the model
- [ ] With a Card built, in airplane mode: the installed app opens, Sightings are checked, Squares marked, fact cards shown, and progress saved
- [ ] Building a Card while offline shows a clear "needs signal" message
