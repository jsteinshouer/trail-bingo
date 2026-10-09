import { describe, expect, it } from "vitest";
import { createGame, type CardRequest, type Store } from "./index";
import { ALL_GROUPS, ELKHORN, fakeEncoder, fakeFacts, fakeSpecies, fakeStore, observed, photoOf, PLENTY, seeded } from "./testing";

/*
 * Saving and restoring a Card in progress, through the game module with an
 * in-memory store. A second game sharing the store stands in for the app
 * after it's closed or the phone restarts.
 */

const REQUEST: CardRequest = { place: ELKHORN, size: 3, groups: ALL_GROUPS };

function newGame(store: Store, near = PLENTY) {
  const encoder = fakeEncoder();
  const game = createGame({ encoder, species: fakeSpecies(near), facts: fakeFacts(), store, random: seeded(1) });
  return { game, encoder };
}

/** A Sighting photo: a few bytes standing in for the JPEG. */
const snapshot = (name: string) => new Blob([`jpeg:${name}`], { type: "image/jpeg" });
const textOf = async (blob: Blob | undefined) => (blob ? await blob.text() : undefined);

describe("restoring a Card", () => {
  it("finds nothing to restore before a Card has been built", async () => {
    const { game } = newGame(fakeStore());

    expect(await game.restore()).toBe(false);
    expect(game.hasCard()).toBe(false);
  });

  it("brings back a built Card, its facts and nothing marked", async () => {
    const store = fakeStore();
    const built = await newGame(store).game.buildCard(REQUEST);

    const { game } = newGame(store);
    expect(await game.restore()).toBe(true);
    expect(game.state()).toEqual(built);
    const species = built.squares.find((s) => s.kind === "species")!;
    if (species.kind !== "species") throw new Error("expected a species Square");
    expect(game.factFor(species)).toEqual({ summary: `All about ${species.name}.` });
  });

  it("brings back marks, likely species and Sighting photos exactly as they were, Bingo count included", async () => {
    const store = fakeStore();
    const first = newGame(store);
    const card = await first.game.buildCard({ ...REQUEST, groups: ["tree", "animal"] });
    const mammal = card.squares.findIndex((s) => s.kind === "animal" && s.group === "mammal");
    const tree = card.squares.findIndex((s) => s.kind === "species");

    // A sure Sighting marks the mammal Square as Verified, with its photo.
    const verified = await first.game.sighting(photoOf(first.encoder, "mammal sci 2"), snapshot("deer"));
    expect(verified).toMatchObject({ kind: "verified", index: mammal });
    // The player picks a tree from the guesses, with their photo.
    first.game.mark(tree, "confirmed", { photo: snapshot("oak") });
    // Then fills a whole line by hand, for a Bingo.
    for (const i of [0, 1, 2]) first.game.mark(i, "confirmed");
    await first.game.saved();
    const before = first.game.state();

    const { game } = newGame(store);
    await game.restore();
    const after = game.state();
    expect(after.squares.map((s) => s.mark)).toEqual(before.squares.map((s) => s.mark));
    expect(after.squares[mammal].found).toEqual(before.squares[mammal].found);
    expect(after.bingoCount).toBe(before.bingoCount);
    expect(after.bingoCount).toBeGreaterThan(0);
    expect(await textOf(after.squares[mammal].photo)).toBe("jpeg:deer");
    expect(await textOf(after.squares[tree].photo)).toBe("jpeg:oak");
  });

  it("checks Sightings on a restored Card without encoding the labels again", async () => {
    const store = fakeStore();
    const near = [...observed("tree", 30), ...observed("mammal", 3)];
    const first = newGame(store, near);
    await first.game.buildCard({ ...REQUEST, groups: ["tree", "animal"] });

    const { game, encoder } = newGame(store, near);
    await game.restore();
    // The restored game's encoder has encoded nothing, so aim the photo with the first game's axes.
    const outcome = await game.sighting(photoOf(first.encoder, "mammal sci 1"));

    expect(outcome).toMatchObject({ kind: "verified", taxon: { scientificName: "mammal sci 1" } });
    expect(encoder.labels).toEqual([]);
  });

  it("restores the newest Card, with none of the old one's progress", async () => {
    const store = fakeStore();
    const first = newGame(store);
    await first.game.buildCard(REQUEST);
    first.game.mark(0, "verified", { photo: snapshot("old") });
    const second = await first.game.buildCard({ ...REQUEST, size: 4 });

    const { game } = newGame(store);
    await game.restore();
    expect(game.state()).toEqual(second);
  });
});

describe("saving progress", () => {
  it("never puts the old Card's marks on a new one, even if they're saved while it's being saved", async () => {
    const store = fakeStore();
    const { game } = newGame(store);
    await game.buildCard(REQUEST);
    // Hold the new Card's save, and mark the old Card meanwhile.
    let release!: () => void;
    const saveCard = store.saveCard.bind(store);
    store.saveCard = async (card, vectors) => {
      await new Promise<void>((resolve) => (release = resolve));
      return saveCard(card, vectors);
    };
    const building = game.buildCard({ ...REQUEST, size: 4 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    game.mark(0, "verified", { photo: snapshot("old") });
    release();
    const second = await building;
    await game.saved().catch(() => {});

    const restored = newGame(store).game;
    await restored.restore();
    expect(restored.state()).toEqual(second);
  });

  it("says when a mark couldn't be saved, keeping it on the Card meanwhile", async () => {
    const store = fakeStore();
    const { game } = newGame(store);
    await game.buildCard(REQUEST);
    store.failSaves = new Error("QuotaExceededError");

    game.mark(0, "verified");
    await expect(game.saved()).rejects.toThrow("QuotaExceededError");
    expect(game.state().squares[0].mark).toBe("verified");
  });

  it("doesn't keep the Card if it can't be saved, so a restart never loses one silently", async () => {
    const store = fakeStore();
    store.failSaves = new Error("QuotaExceededError");
    const { game } = newGame(store);

    await expect(game.buildCard(REQUEST)).rejects.toThrow("QuotaExceededError");
    expect(game.hasCard()).toBe(false);
  });
});
