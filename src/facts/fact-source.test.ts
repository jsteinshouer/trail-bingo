import { describe, expect, it } from "vitest";
import type { Taxon } from "../game";
import { createInatFactSource } from "./index";
import taxa from "./fixtures/taxa.json";
import taxaMissing from "./fixtures/taxa-missing.json";
import error422 from "./fixtures/error-422.json";

/*
 * Recorded iNaturalist taxa responses (see fixtures/record.sh). The fake
 * server answers a taxa request with the recorded taxa it asks for, and a
 * photo request with a few bytes standing in for the JPEG.
 */

const INDIANGRASS: Taxon = { group: "plant", name: "Indiangrass", scientificName: "Sorghastrum nutans", taxonId: 122608 };
const FOX_SQUIRREL: Taxon = { group: "mammal", name: "Eastern Fox Squirrel", scientificName: "Sciurus niger", taxonId: 46020 };
const SHAGGY_MANE: Taxon = { group: "fungus", name: "Shaggy Mane", scientificName: "Coprinus comatus", taxonId: 47392 };
const NO_SUMMARY: Taxon = { group: "insect", name: "Cryptoblabes angustipennis", scientificName: "Cryptoblabes angustipennis", taxonId: 127174 };
const NO_PHOTO: Taxon = { group: "butterfly-or-moth", name: "Compassberg skolly", scientificName: "Thestor compassbergae", taxonId: 114077 };

/** Not recorded: a summary with the abbreviations and decimals Wikipedia leads often have, and no Wikipedia link. */
const TRICKY = {
  id: 1,
  wikipedia_url: null,
  default_photo: null,
  wikipedia_summary:
    "<b>White oak</b> (<i>Q. alba</i>) grows across the eastern U.S. and Canada, up to 30.5 m tall. Its acorns are eaten by deer, " +
    "e.g. white-tailed deer. It is the state tree of Illinois. It lives for centuries.",
};
const WHITE_OAK: Taxon = { group: "tree", name: "White oak", scientificName: "Quercus alba", taxonId: 1 };

const RECORDED = [...taxa.results, ...taxaMissing.results, TRICKY];

function fakeInat(options: { taxaStatus?: number; brokenPhotos?: boolean; unreachable?: boolean } = {}) {
  const requests: URL[] = [];
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    requests.push(url);
    if (options.unreachable) throw new TypeError("Failed to fetch");
    if (url.hostname === "api.inaturalist.org") {
      if (options.taxaStatus) return Response.json(error422, { status: options.taxaStatus });
      const ids = url.pathname.split("/").pop()!.split(",").map(Number);
      const results = RECORDED.filter((t) => ids.includes(t.id));
      return Response.json({ total_results: results.length, page: 1, per_page: 30, results });
    }
    if (options.brokenPhotos) return new Response("gone", { status: 404 });
    return new Response(new TextEncoder().encode(`jpeg:${url.pathname}`), { headers: { "content-type": "image/jpeg" } });
  };
  return { fetch, requests };
}

const textOf = async (blob: Blob | undefined) => (blob ? new TextDecoder().decode(await blob.arrayBuffer()) : undefined);

describe("iNaturalist fact source", () => {
  it("gives a taxon's Wikipedia summary as plain text, credited to Wikipedia", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([INDIANGRASS], { photoSize: "medium" });

    expect(facts.get("Sorghastrum nutans")).toMatchObject({
      summary:
        "Sorghastrum nutans, known as Indiangrass, is a North American prairie grass found in the United States and Canada, " +
        "especially in the Great Plains and tallgrass prairies. It is sometimes called Indian grass, yellow Indian-grass, or wood grass.",
      summarySource: { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Sorghastrum_nutans" },
    });
  });

  it("keeps a summary to three sentences, without a cut-off one", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([SHAGGY_MANE], { photoSize: "medium" });

    expect(facts.get("Coprinus comatus")?.summary).toBe(
      "Coprinus comatus, the shaggy ink cap, lawyer's wig, or shaggy mane, is a common fungus often seen growing on lawns, " +
        "along gravel roads and waste areas. The young fruit bodies first appear as white cylinders emerging from the ground, " +
        "then the bell-shaped caps open out. The caps are white, and covered with scales—this is the origin of the common names of the fungus.",
    );
  });

  it("splits sentences only at sentence ends, not at abbreviations or decimals", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([WHITE_OAK], { photoSize: "medium" });

    expect(facts.get("Quercus alba")?.summary).toBe(
      "White oak (Q. alba) grows across the eastern U.S. and Canada, up to 30.5 m tall. " +
        "Its acorns are eaten by deer, e.g. white-tailed deer. It is the state tree of Illinois.",
    );
  });

  it("credits Wikipedia for a summary even without a link to it", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([WHITE_OAK], { photoSize: "medium" });

    expect(facts.get("Quercus alba")?.summarySource).toEqual({ name: "Wikipedia" });
  });

  it("has no fact for a taxon iNaturalist doesn't return", async () => {
    const gone: Taxon = { ...INDIANGRASS, scientificName: "Gone", taxonId: 999_999 };
    const facts = await createInatFactSource(fakeInat()).factsFor([gone, FOX_SQUIRREL], { photoSize: "small" });

    expect(facts.has("Gone")).toBe(false);
    expect(facts.has("Sciurus niger")).toBe(true);
  });

  it("downloads the reference photo, with its credit, so it works offline", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([FOX_SQUIRREL], { photoSize: "medium" });
    const photo = facts.get("Sciurus niger")?.photo;

    expect(photo?.credit).toBe("(c) Tobin Brown, some rights reserved (CC BY-NC), uploaded by Tobin Brown");
    expect(await textOf(photo?.image)).toBe("jpeg:/photos/337444041/medium.jpeg");
  });

  it("downloads a smaller photo when asked", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([FOX_SQUIRREL], { photoSize: "small" });

    expect(await textOf(facts.get("Sciurus niger")?.photo?.image)).toBe("jpeg:/photos/337444041/small.jpeg");
  });

  it("asks for up to 30 taxa at a time", async () => {
    const inat = fakeInat();
    const many = Array.from({ length: 31 }, (_, i): Taxon => ({ ...INDIANGRASS, scientificName: `sp ${i}`, taxonId: 1000 + i }));
    await createInatFactSource(inat).factsFor(many, { photoSize: "small" });

    const taxaRequests = inat.requests.filter((u) => u.hostname === "api.inaturalist.org");
    expect(taxaRequests.map((u) => u.pathname.split("/").pop()!.split(",").length)).toEqual([30, 1]);
  });

  it("has no summary or photo for a taxon iNaturalist has none for", async () => {
    const facts = await createInatFactSource(fakeInat()).factsFor([NO_SUMMARY, NO_PHOTO], { photoSize: "medium" });

    expect(facts.get("Cryptoblabes angustipennis")).toEqual({});
    expect(facts.get("Thestor compassbergae")).toEqual({
      summary:
        "Thestor compassbergae, the Compassberg skolly, is a species of butterfly in the Lycaenidae family. " +
        "It is endemic to South Africa, where it is only known from grassy inclusions in Nama Karoo on the mountain slopes " +
        "of the Kompasberg, above Nieu-Bethesda in the East Cape.",
      summarySource: { name: "Wikipedia", url: expect.stringContaining("wikipedia.org") },
    });
  });

  it("keeps the summary when a photo can't be downloaded", async () => {
    const facts = await createInatFactSource(fakeInat({ brokenPhotos: true })).factsFor([FOX_SQUIRREL], { photoSize: "medium" });

    expect(facts.get("Sciurus niger")?.summary).toMatch(/^The fox squirrel/);
    expect(facts.get("Sciurus niger")?.photo).toBeUndefined();
  });

  it("skips taxa with no iNaturalist ID", async () => {
    const inat = fakeInat();
    const { taxonId: _, ...unknown } = INDIANGRASS;
    const facts = await createInatFactSource(inat).factsFor([unknown], { photoSize: "medium" });

    expect(facts.size).toBe(0);
    expect(inat.requests).toEqual([]);
  });

  it("reports how many taxa are done", async () => {
    const done: number[] = [];
    await createInatFactSource(fakeInat()).factsFor([INDIANGRASS, FOX_SQUIRREL, SHAGGY_MANE], {
      photoSize: "medium",
      onProgress: (n) => done.push(n),
    });

    expect(done.at(-1)).toBe(3);
    expect(done).toEqual([...done].sort((a, b) => a - b));
  });

  it("fails clearly when iNaturalist answers with an error", async () => {
    await expect(
      createInatFactSource(fakeInat({ taxaStatus: 422 })).factsFor([INDIANGRASS], { photoSize: "medium" }),
    ).rejects.toThrow(/iNaturalist.*422/);
  });

  it("fails clearly when iNaturalist can't be reached", async () => {
    await expect(
      createInatFactSource(fakeInat({ unreachable: true })).factsFor([INDIANGRASS], { photoSize: "medium" }),
    ).rejects.toThrow(/iNaturalist/);
  });
});
