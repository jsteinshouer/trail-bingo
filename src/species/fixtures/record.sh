#!/bin/sh
# Re-records the iNaturalist responses the species source tests run against:
# Elkhorn, NE, 10 km, September–November. Run from this directory.
set -e
API="https://api.inaturalist.org/v1/observations/species_counts?quality_grade=research&rank=species&locale=en&month=9,10,11&radius=10&per_page=25"
UA="trail-bingo (fixture recording)"
curl -sf -A "$UA" "$API&lat=41.2864&lng=-96.237&iconic_taxa=Plantae,Fungi" > plants-fungi.json; sleep 1
curl -sf -A "$UA" "$API&lat=41.2864&lng=-96.237&iconic_taxa=Mammalia,Aves,Reptilia,Amphibia,Insecta,Arachnida" > animals.json; sleep 1
# Open Pacific: nothing observed.
curl -sf -A "$UA" "$API&lat=0&lng=-140&iconic_taxa=Plantae,Fungi" > empty.json; sleep 1
# An out-of-range latitude makes iNaturalist answer 500.
curl -s -A "$UA" "$API&lat=999&lng=-96.237&iconic_taxa=Plantae,Fungi" > error-500.json
