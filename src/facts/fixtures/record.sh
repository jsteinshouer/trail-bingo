#!/bin/sh
# Re-records the iNaturalist taxa responses the fact source tests run against.
# Run from this directory.
set -e
API="https://api.inaturalist.org/v1/taxa"
UA="trail-bingo (fixture recording)"
# Indiangrass, Eastern Fox Squirrel, Shaggy Mane.
curl -sf -A "$UA" "$API/122608,46020,47392?locale=en&per_page=30" > taxa.json; sleep 1
# Two moths: one with no summary and no photo, one with a summary but no photo.
curl -sf -A "$UA" "$API/127174,114077?locale=en&per_page=30" > taxa-missing.json; sleep 1
# A malformed ID list makes iNaturalist answer 422.
curl -s -A "$UA" "$API/abc?locale=en&per_page=30" > error-422.json
