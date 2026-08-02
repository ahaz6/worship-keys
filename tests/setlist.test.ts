import { describe, expect, it } from "vitest";

import {
  CURRENT_SCHEMA_VERSION,
  barDurationSeconds,
  beatDurationSeconds,
  formatTimeSignature,
  migratePersistedState,
} from "@/lib/storage/schema";
import {
  InMemorySetlistRepository,
  createPersistedState,
  toExportJson,
} from "@/lib/storage/setlist-repository";
import {
  activeSong,
  addSong,
  createSetlist,
  createSong,
  createStarterSetlist,
  duplicateSong,
  moveSong,
  neighbourSong,
  removeSong,
  selectSong,
  songPosition,
  updateSong,
} from "@/lib/storage/setlist-operations";

describe("setlist editing", () => {
  it("appends new songs instead of overwriting existing ones", () => {
    let setlist = createSetlist();
    setlist = addSong(setlist, createSong({ title: "First" }));
    setlist = addSong(setlist, createSong({ title: "Second" }));
    setlist = addSong(setlist, createSong({ title: "Third" }));
    expect(setlist.songs.map((song) => song.title)).toEqual(["First", "Second", "Third"]);
    // Distinct ids, so nothing can collide later.
    expect(new Set(setlist.songs.map((song) => song.id)).size).toBe(3);
  });

  it("makes the first added song active and leaves it alone afterwards", () => {
    let setlist = addSong(createSetlist(), createSong({ title: "First" }));
    const firstId = setlist.songs[0]!.id;
    setlist = addSong(setlist, createSong({ title: "Second" }));
    expect(setlist.activeSongId).toBe(firstId);
  });

  it("updates a song without changing its id", () => {
    let setlist = addSong(createSetlist(), createSong({ title: "Gathering" }));
    const id = setlist.songs[0]!.id;
    setlist = updateSong(setlist, id, { title: "Gathering (reprise)", concertKey: 7, id: "hacked" });
    expect(setlist.songs[0]).toMatchObject({ id, title: "Gathering (reprise)", concertKey: 7 });
  });

  it("duplicates a song directly after the original", () => {
    let setlist = createStarterSetlist();
    const id = setlist.songs[0]!.id;
    setlist = duplicateSong(setlist, id);
    expect(setlist.songs).toHaveLength(4);
    expect(setlist.songs[1]!.title).toBe("Gathering (copy)");
    expect(setlist.songs[1]!.id).not.toBe(id);
  });

  it("moves the active selection when the active song is removed", () => {
    let setlist = createStarterSetlist();
    const firstId = setlist.songs[0]!.id;
    setlist = removeSong(setlist, firstId);
    expect(setlist.songs).toHaveLength(2);
    expect(setlist.activeSongId).toBe(setlist.songs[0]!.id);
  });

  it("reorders songs and clamps at the ends", () => {
    let setlist = createStarterSetlist();
    const lastId = setlist.songs[2]!.id;
    setlist = moveSong(setlist, lastId, -2);
    expect(setlist.songs[0]!.id).toBe(lastId);
    setlist = moveSong(setlist, lastId, -5);
    expect(setlist.songs[0]!.id).toBe(lastId);
  });

  it("navigates the set without wrapping around", () => {
    let setlist = createStarterSetlist();
    setlist = selectSong(setlist, setlist.songs[0]!.id);
    expect(neighbourSong(setlist, -1)).toBeNull();
    expect(neighbourSong(setlist, 1)?.title).toBe("Prayer");
    setlist = selectSong(setlist, setlist.songs[2]!.id);
    expect(neighbourSong(setlist, 1)).toBeNull();
  });

  it("reports the position in the set", () => {
    const setlist = createStarterSetlist();
    expect(songPosition(setlist, setlist.songs[1]!.id)).toEqual({ position: 2, total: 3 });
  });

  it("falls back to the first song when the active id is stale", () => {
    const setlist = { ...createStarterSetlist(), activeSongId: "does-not-exist" };
    expect(activeSong(setlist)?.title).toBe("Gathering");
  });
});

describe("time signatures", () => {
  it("formats numerator and denominator separately", () => {
    expect(formatTimeSignature({ numerator: 6, denominator: 8 })).toBe("6/8");
    expect(formatTimeSignature({ numerator: 4, denominator: 16 })).toBe("4/16");
  });

  it("derives beat length from the denominator, not just the label", () => {
    // At 120 bpm a quarter note is 0.5 s; an eighth note is half of that.
    expect(beatDurationSeconds(120, { numerator: 4, denominator: 4 })).toBeCloseTo(0.5, 6);
    expect(beatDurationSeconds(120, { numerator: 4, denominator: 8 })).toBeCloseTo(0.25, 6);
    expect(beatDurationSeconds(120, { numerator: 4, denominator: 16 })).toBeCloseTo(0.125, 6);
  });

  it("derives bar length from beats per bar", () => {
    expect(barDurationSeconds(120, { numerator: 4, denominator: 4 })).toBeCloseTo(2, 6);
    expect(barDurationSeconds(120, { numerator: 6, denominator: 8 })).toBeCloseTo(1.5, 6);
    // 4/8 and 4/4 must not produce the same bar length.
    expect(barDurationSeconds(120, { numerator: 4, denominator: 8 })).not.toBeCloseTo(
      barDurationSeconds(120, { numerator: 4, denominator: 4 }),
      3,
    );
  });
});

describe("persistence", () => {
  it("round-trips a setlist through the repository", async () => {
    const repository = new InMemorySetlistRepository();
    expect(await repository.load()).toEqual({ status: "empty" });

    const state = createPersistedState(createStarterSetlist(), { notation: "flats" });
    await repository.save(state);
    const outcome = await repository.load();
    expect(outcome.status).toBe("loaded");
    if (outcome.status !== "loaded") return;
    expect(outcome.state.setlist.songs).toHaveLength(3);
    expect(outcome.state.preferences.notation).toBe("flats");
    expect(outcome.state.preferences.requireWakeWord).toBe(true);
  });

  it("accepts the current schema version", () => {
    const state = createPersistedState(createStarterSetlist());
    const result = migratePersistedState(state);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.migratedFrom).toBeNull();
  });

  it("refuses data written by a newer version instead of misreading it", () => {
    const state = { ...createPersistedState(createStarterSetlist()), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    const result = migratePersistedState(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("newer version");
  });

  it("rejects malformed data with a readable message", () => {
    expect(migratePersistedState({ schemaVersion: 1, setlist: { name: 5 } }).ok).toBe(false);
    expect(migratePersistedState(null).ok).toBe(false);
    expect(migratePersistedState({ setlist: {} }).ok).toBe(false);
  });

  it("rejects a song with an out-of-range key", () => {
    const state = createPersistedState(createStarterSetlist());
    const broken = structuredClone(state) as typeof state & { setlist: { songs: { concertKey: number }[] } };
    broken.setlist.songs[0]!.concertKey = 15;
    expect(migratePersistedState(broken).ok).toBe(false);
  });

  it("produces importable export json", () => {
    const state = createPersistedState(createStarterSetlist());
    const parsed = JSON.parse(toExportJson(state));
    expect(migratePersistedState(parsed).ok).toBe(true);
    expect(parsed.exportedAt).toBeTypeOf("string");
  });
});
