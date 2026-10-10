/**
 * Where a Card is for: a place found by name, or the player's own location.
 * The device location only ever goes to iNaturalist, rounded; the place search
 * sends OpenStreetMap's Nominatim the typed name and nothing else.
 */

import type { Place } from "../game";
import { NoSignalError } from "../signal";

const API = "https://nominatim.openstreetmap.org/search";

/** How many places a search shows. */
const SHOWN = 8;

/** A place that matched a search: where a Card could be built. */
export interface FoundPlace extends Omit<Place, "radiusKm"> {
  name: string;
  /** State; country for a place with no state, or for a state itself. */
  region: string;
  /** What and where it is, to tell same-named places apart: "Nature reserve · Cass County, Nebraska, United States". */
  detail: string;
}

export interface PlaceSearch {
  /** Trails, parks and towns matching a name, best first. */
  search(name: string): Promise<FoundPlace[]>;
}

interface NominatimResult {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  category: string;
  type: string;
  addresstype?: string;
  address?: Partial<Record<(typeof ADDRESS_PARTS)[number], string>>;
}

/** Address parts that say where a place is, smallest first. */
const ADDRESS_PARTS = ["village", "town", "city", "county", "state", "country"] as const;

/** Ways you can hike. Other roads that share a trail's name ("Bright Angel Trail" in a suburb) aren't places to build a Card. */
const TRAILS = new Set(["path", "footway", "track", "bridleway", "cycleway", "steps"]);

const isRoad = (result: NominatimResult) => result.category === "highway" && !TRAILS.has(result.type);

function toPlace(result: NominatimResult): FoundPlace {
  const name = result.name || result.display_name.split(",")[0];
  const address = result.address ?? {};
  const kind = result.category === "highway" ? "trail" : (result.addresstype ?? result.type).replace(/_/g, " ");
  const where = ADDRESS_PARTS.flatMap((part) => (address[part] && address[part] !== name ? [address[part]] : []));
  return {
    name,
    region: (address.state !== name && address.state) || address.country || "",
    lat: Number(result.lat),
    lng: Number(result.lon),
    detail: [kind.charAt(0).toUpperCase() + kind.slice(1), where.join(", ")].filter(Boolean).join(" · "),
  };
}

/**
 * Finds trails, parks and towns by name. Nominatim's usage policy rules out
 * searching as the player types, and asks for answers to be reused, so this
 * runs once per submitted search and remembers what it found.
 */
export function createPlaceSearch({ fetch }: { fetch: typeof globalThis.fetch }): PlaceSearch {
  const answered = new Map<string, FoundPlace[]>();

  return {
    async search(name) {
      const query = name.trim();
      if (!query) return [];
      const key = query.toLowerCase();
      const known = answered.get(key);
      if (known) return known;

      const url = new URL(API);
      // More than are shown, since roads that share a trail's name are dropped.
      url.search = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "15",
        "accept-language": "en",
      }).toString();
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        throw new NoSignalError("Couldn't reach the place search. Check your connection, then try again.");
      }
      if (!response.ok) throw new Error(`The place search couldn't answer (HTTP ${response.status}). Try again in a minute.`);
      const places = ((await response.json()) as NominatimResult[])
        .filter((result) => !isRoad(result))
        .slice(0, SHOWN)
        .map(toPlace);
      answered.set(key, places);
      return places;
    },
  };
}

/** Why the device location couldn't be found, in words a hiker can act on. */
export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationError";
  }
}

/** About 1 km: plenty for a 10 km search area, and no more precise than that leaves the phone. */
const roughly = (degrees: number) => Math.round(degrees * 100) / 100;

/** The device's location, rounded: a rough fix is all a Card needs. */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new LocationError("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: roughly(coords.latitude), lng: roughly(coords.longitude) }),
      (error) =>
        reject(
          new LocationError(
            error.code === error.PERMISSION_DENIED
              ? "Trail Bingo isn't allowed to use your location. Allow it in your browser's site settings, then try again."
              : "Your location couldn't be found. Check that location is on, then try again.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 5 * 60_000 },
    );
  });
}
