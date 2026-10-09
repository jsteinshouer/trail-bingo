/**
 * Where a Card is for. Only the rounded location goes to iNaturalist; no other
 * service learns where the player is. Ticket 06 adds searching for a place by name.
 */

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
