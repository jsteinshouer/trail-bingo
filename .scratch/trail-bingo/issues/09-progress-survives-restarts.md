# 09 — Progress survives restarts

**What to build:** The player's Card, marked Squares and Sighting photos are saved on the phone, so closing the app or a phone restart mid-hike loses nothing. Everything stays on the device.

**Blocked by:** 03 — Photo check on the demo Card

**Status:** ready-for-agent

- [ ] Store adapter saves and loads the active Card, its marks (Verified or Confirmed) and Sighting photos in IndexedDB
- [ ] Save and restore of a Card in progress is tested through the game module with an in-memory fake store
- [ ] Closing and reopening the app restores the Card exactly as it was, including Bingo count
- [ ] No Card data, location or photos are sent to any server
