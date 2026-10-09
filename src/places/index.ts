/**
 * Where a Card is for: a place found by name, or the player's own location.
 * The device location only ever goes to iNaturalist, rounded; the place search
 * sends OpenStreetMap's Nominatim the typed name and nothing else.
 */

const SEARCH = "https://nominatim.openstreetmap.org/search";

/** A place that matched a search. */
export interface FoundPlace {
  name: string;
  /** State, or country where there's no state. */
  region: string;
  lat: number;
  lng: number;
  /** What and where it is, to tell same-named places apart: "Nature reserve · Cass County, Nebraska, United States". */
  detail: string;
}

interface NominatimResult {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  addresstype?: string;
  address?: Partial<Record<"village" | "town" | "city" | "county" | "state" | "country", string>>;
}

const LOCALITY = ["village", "town", "city", "county", "state", "country"] as const;

function toPlace(result: NominatimResult): FoundPlace {
  const name = result.name || result.display_name.split(",")[0];
  const address = result.address ?? {};
  const kind = (result.addresstype ?? result.type).replace(/_/g, " ");
  const where = LOCALITY.flatMap((part) => (address[part] && address[part] !== name ? [address[part]] : []));
  return {
    name,
    region: address.state ?? address.country ?? "",
    lat: Number(result.lat),
    lng: Number(result.lon),
    detail: [kind.charAt(0).toUpperCase() + kind.slice(1), where.join(", ")].filter(Boolean).join(" · "),
  };
}

/**
 * Finds trails, parks and towns by name. Nominatim's usage policy rules out
 * searching as the player types, so this runs once per submitted search.
 */
export function createPlaceSearch({ fetch }: { fetch: typeof globalThis.fetch }) {
  return {
    async search(query: string): Promise<FoundPlace[]> {
      if (!query.trim()) return [];
      const url = new URL(SEARCH);
      url.search = new URLSearchParams({
        q: query.trim(),
        format: "jsonv2",
        addressdetails: "1",
        limit: "8",
        "accept-language": "en",
      }).toString();
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        throw new Error("Couldn't reach the place search. Check your connection, then try again.");
      }
      if (!response.ok) throw new Error(`The place search couldn't answer (HTTP ${response.status}). Try again in a minute.`);
      return ((await response.json()) as NominatimResult[]).map(toPlace);
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
