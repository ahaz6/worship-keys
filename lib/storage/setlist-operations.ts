/**
 * Pure setlist edits (spec 14.3).
 *
 * All of these return a new setlist. The one behaviour worth stating out loud:
 * `+ Add song` always appends a fresh entry and can never overwrite a song that
 * is already in the list.
 */

import type { PitchClass } from "@/lib/music/pitch";
import type { Setlist, Song } from "./schema";

export function createSongId(): string {
  return `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSong(overrides: Partial<Song> = {}): Song {
  return {
    id: overrides.id ?? createSongId(),
    title: overrides.title ?? "New song",
    artist: overrides.artist,
    concertKey: overrides.concertKey ?? 0,
    mode: overrides.mode ?? "major",
    timeSignature: overrides.timeSignature ?? { numerator: 4, denominator: 4 },
    bpm: overrides.bpm,
    padPresetId: overrides.padPresetId ?? "aurora",
    mainVolume: overrides.mainVolume,
    shimmerLevel: overrides.shimmerLevel,
    padMotion: overrides.padMotion,
    tone: overrides.tone,
    crossfadeSeconds: overrides.crossfadeSeconds,
    fadeInSeconds: overrides.fadeInSeconds,
    fadeOutSeconds: overrides.fadeOutSeconds,
    notes: overrides.notes,
  };
}

export function createSetlist(name = "Sunday Morning"): Setlist {
  return { id: `set-${Date.now().toString(36)}`, name, songs: [], activeSongId: undefined };
}

export function addSong(setlist: Setlist, song: Song): Setlist {
  return { ...setlist, songs: [...setlist.songs, song], activeSongId: setlist.activeSongId ?? song.id };
}

export function updateSong(setlist: Setlist, songId: string, patch: Partial<Song>): Setlist {
  return {
    ...setlist,
    songs: setlist.songs.map((song) => (song.id === songId ? { ...song, ...patch, id: song.id } : song)),
  };
}

export function removeSong(setlist: Setlist, songId: string): Setlist {
  const songs = setlist.songs.filter((song) => song.id !== songId);
  const activeSongId = setlist.activeSongId === songId ? songs[0]?.id : setlist.activeSongId;
  return { ...setlist, songs, activeSongId };
}

export function duplicateSong(setlist: Setlist, songId: string): Setlist {
  const index = setlist.songs.findIndex((song) => song.id === songId);
  const original = setlist.songs[index];
  if (!original) return setlist;
  const copy: Song = { ...original, id: createSongId(), title: `${original.title} (copy)` };
  const songs = [...setlist.songs];
  songs.splice(index + 1, 0, copy);
  return { ...setlist, songs };
}

export function moveSong(setlist: Setlist, songId: string, offset: number): Setlist {
  const index = setlist.songs.findIndex((song) => song.id === songId);
  if (index < 0) return setlist;
  const target = Math.max(0, Math.min(setlist.songs.length - 1, index + offset));
  if (target === index) return setlist;
  const songs = [...setlist.songs];
  const [moved] = songs.splice(index, 1);
  if (!moved) return setlist;
  songs.splice(target, 0, moved);
  return { ...setlist, songs };
}

export function selectSong(setlist: Setlist, songId: string): Setlist {
  if (!setlist.songs.some((song) => song.id === songId)) return setlist;
  return { ...setlist, activeSongId: songId };
}

export function activeSong(setlist: Setlist): Song | null {
  if (!setlist.activeSongId) return setlist.songs[0] ?? null;
  return setlist.songs.find((song) => song.id === setlist.activeSongId) ?? setlist.songs[0] ?? null;
}

export function songPosition(setlist: Setlist, songId: string | undefined): { position: number; total: number } {
  const index = setlist.songs.findIndex((song) => song.id === songId);
  return { position: index < 0 ? 0 : index + 1, total: setlist.songs.length };
}

/** Next/previous song, without wrapping past the ends of the set. */
export function neighbourSong(setlist: Setlist, direction: 1 | -1): Song | null {
  const current = activeSong(setlist);
  if (!current) return null;
  const index = setlist.songs.findIndex((song) => song.id === current.id);
  return setlist.songs[index + direction] ?? null;
}

export type SongKey = { tonic: PitchClass; mode: "major" | "minor" };

export function songKey(song: Song): SongKey {
  return { tonic: song.concertKey as PitchClass, mode: song.mode };
}

/** A sample set so a first run is not an empty screen. */
export function createStarterSetlist(): Setlist {
  const setlist = createSetlist("Sunday Morning");
  const songs: Song[] = [
    createSong({ title: "Gathering", concertKey: 7, mode: "major", padPresetId: "aurora" }),
    createSong({ title: "Prayer", concertKey: 2, mode: "minor", padPresetId: "ground", timeSignature: { numerator: 3, denominator: 4 } }),
    createSong({ title: "Response", concertKey: 10, mode: "major", padPresetId: "cathedral", bpm: 72 }),
  ];
  return songs.reduce((accumulator, song) => addSong(accumulator, song), setlist);
}
