/**
 * Where a Card is for: the device's location, and a name for it from
 * OpenStreetMap's Nominatim. Ticket 06 adds searching by name.
 */

const REVERSE = "https://nominatim.openstreetmap.org/reverse";

export interface PlaceName {
  /** Town, neighbourhood or county: the Card's title. */
  name: string;
  /** State, or country where there's no state. */
  region: string;
}

interface NominatimAddress {
  suburb?: string;
  village?: string;
  town?: string;
  hamlet?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}

export function createPlaceNamer({ fetch }: { fetch: typeof globalThis.fetch }) {
  return {
    /** A name for the coordinates, or null where there's no address (open water, say). */
    async nameOf(lat: number, lng: number): Promise<PlaceName | null> {
      const url = new URL(REVERSE);
      // Zoom 14 names a neighbourhood or town rather than the whole city around it.
      url.search = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "14",
        "accept-language": "en",
      }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Couldn't name the place (HTTP ${response.status})`);
      const { address }: { address?: NominatimAddress } = await response.json();
      if (!address) return null;
      const name = address.suburb ?? address.village ?? address.town ?? address.hamlet ?? address.city ?? address.county;
      const region = address.state ?? address.country ?? "";
      return name ? { name, region } : null;
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

/** The device's location. A rough fix is plenty for a 10 km search area. */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new LocationError("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
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
