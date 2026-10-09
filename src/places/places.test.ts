import { describe, expect, it } from "vitest";
import { createPlaceSearch } from "./index";
import platteRiver from "./fixtures/search-platte-river.json";
import elkhorn from "./fixtures/search-elkhorn.json";
import moab from "./fixtures/search-moab.json";
import nothing from "./fixtures/search-nothing.json";

/* Recorded Nominatim search responses (see fixtures/record.sh). */

function fakeNominatim(status: number, json: unknown) {
  const urls: URL[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, urls };
}

const searchWith = (status: number, json: unknown) => createPlaceSearch({ fetch: fakeNominatim(status, json).fetch });

describe("searching for a place by name", () => {
  it("asks OpenStreetMap's Nominatim for the typed name, in English", async () => {
    const nominatim = fakeNominatim(200, platteRiver);
    await createPlaceSearch({ fetch: nominatim.fetch }).search("Platte River State Park");

    const [url] = nominatim.urls;
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "Platte River State Park",
      format: "jsonv2",
      "accept-language": "en",
    });
  });

  it("finds a park, with where it is", async () => {
    const places = await searchWith(200, platteRiver).search("Platte River State Park");

    expect(places).toEqual([
      {
        name: "Platte River State Park",
        region: "Nebraska",
        lat: 40.9927802,
        lng: -96.2237527,
        detail: "Nature reserve · Cass County, Nebraska, United States",
      },
    ]);
  });

  it("finds a town, best match first", async () => {
    const places = await searchWith(200, elkhorn).search("Elkhorn, Nebraska");

    expect(places.map((p) => p.name)).toEqual(["Elkhorn", "Elkhorn River"]);
    expect(places[0]).toMatchObject({ region: "Nebraska", detail: "Suburb · Omaha, Douglas County, Nebraska, United States" });
  });

  it("tells same-named places apart by where they are", async () => {
    const places = await searchWith(200, moab).search("Moab");

    expect(places[0]).toMatchObject({ name: "Moab", region: "Utah", detail: "City · Grand County, Utah, United States" });
    expect(places[2]).toMatchObject({ name: "Moab", region: "Philippines" });
  });

  it("finds nothing for a name no place has", async () => {
    expect(await searchWith(200, nothing).search("Zzyzxqqq Trailhead")).toEqual([]);
  });

  it("doesn't search for a blank name", async () => {
    const nominatim = fakeNominatim(200, platteRiver);

    expect(await createPlaceSearch({ fetch: nominatim.fetch }).search("   ")).toEqual([]);
    expect(nominatim.urls).toEqual([]);
  });

  it("fails clearly when Nominatim answers with an error", async () => {
    await expect(searchWith(503, { error: "busy" }).search("Moab")).rejects.toThrow(/503/);
  });

  it("fails clearly when Nominatim can't be reached", async () => {
    const search = createPlaceSearch({
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(search.search("Moab")).rejects.toThrow(/couldn't reach/i);
  });
});
