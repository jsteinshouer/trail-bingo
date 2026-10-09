import { describe, expect, it } from "vitest";
import { createPlaceNamer } from "./index";
import elkhorn from "./fixtures/reverse-elkhorn.json";
import yellowstone from "./fixtures/reverse-yellowstone.json";
import ocean from "./fixtures/reverse-ocean.json";

/* Recorded Nominatim reverse-geocoding responses (see fixtures/record.sh). */

function fakeNominatim(status: number, json: unknown) {
  const urls: URL[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, urls };
}

describe("naming a place from its coordinates", () => {
  it("asks OpenStreetMap's Nominatim about the coordinates, in English", async () => {
    const nominatim = fakeNominatim(200, elkhorn);
    await createPlaceNamer({ fetch: nominatim.fetch }).nameOf(41.2864, -96.237);

    const [url] = nominatim.urls;
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/reverse");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ lat: "41.2864", lon: "-96.237", "accept-language": "en" });
  });

  it("names the nearest town or neighbourhood, with its state", async () => {
    const namer = createPlaceNamer({ fetch: fakeNominatim(200, elkhorn).fetch });

    expect(await namer.nameOf(41.2864, -96.237)).toEqual({ name: "Elkhorn", region: "Nebraska" });
  });

  it("falls back to the county out in the backcountry", async () => {
    const namer = createPlaceNamer({ fetch: fakeNominatim(200, yellowstone).fetch });

    expect(await namer.nameOf(44.6, -110.5)).toEqual({ name: "Park County", region: "Wyoming" });
  });

  it("has no name for somewhere with no address", async () => {
    const namer = createPlaceNamer({ fetch: fakeNominatim(200, ocean).fetch });

    expect(await namer.nameOf(0, -140)).toBeNull();
  });

  it("fails when Nominatim answers with an error", async () => {
    const namer = createPlaceNamer({ fetch: fakeNominatim(503, { error: "busy" }).fetch });

    await expect(namer.nameOf(41.2864, -96.237)).rejects.toThrow(/503/);
  });
});
