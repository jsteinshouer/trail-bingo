#!/bin/sh
# Re-records the Nominatim reverse-geocoding responses the place tests run against.
# Run from this directory. Nominatim allows about one request per second.
set -e
API="https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=en"
UA="trail-bingo (fixture recording)"
curl -sf -A "$UA" "$API&lat=41.2864&lon=-96.237" > reverse-elkhorn.json; sleep 2
curl -sf -A "$UA" "$API&lat=44.6&lon=-110.5" > reverse-yellowstone.json; sleep 2
# Open Pacific: no address.
curl -sf -A "$UA" "$API&lat=0&lon=-140" > reverse-ocean.json
