#!/bin/sh
# Re-records the Nominatim search responses the place search tests run against.
# Run from this directory. Nominatim allows about one request per second.
set -e
API="https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=15&accept-language=en"
UA="trail-bingo (fixture recording)"
curl -sf -A "$UA" "$API&q=Platte%20River%20State%20Park" > search-platte-river.json; sleep 2
curl -sf -A "$UA" "$API&q=Elkhorn%2C%20Nebraska" > search-elkhorn.json; sleep 2
curl -sf -A "$UA" "$API&q=Moab" > search-moab.json; sleep 2
curl -sf -A "$UA" "$API&q=Bright%20Angel%20Trail" > search-bright-angel.json; sleep 2
curl -sf -A "$UA" "$API&q=Utah" > search-utah.json; sleep 2
curl -sf -A "$UA" "$API&q=Zzyzxqqq%20Trailhead" > search-nothing.json
