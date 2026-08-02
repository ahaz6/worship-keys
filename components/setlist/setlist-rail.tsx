"use client";

import { spellKeyShort } from "@/lib/music/notation";
import type { PitchClass } from "@/lib/music/pitch";
import { formatTimeSignature, type Setlist } from "@/lib/storage/schema";

/**
 * Left rail: brand anchor, the one strongest action, then the setlist
 * (Design-Art.md 7.2). Songs are compact — title, key, meter — so the whole set
 * stays visible during a service.
 */
export function SetlistRail({
  setlist,
  activeSongId,
  onSelect,
  onAddSong,
  onEditSong,
  onRename,
  unsaved,
}: {
  setlist: Setlist;
  activeSongId: string | undefined;
  onSelect: (songId: string) => void;
  onAddSong: () => void;
  onEditSong: (songId: string) => void;
  onRename: (name: string) => void;
  unsaved: boolean;
}) {
  return (
    <>
      <button type="button" className="btn-primary" onClick={onAddSong}>
        <span className="glyph" aria-hidden="true">
          +
        </span>
        Add song
      </button>

      <div>
        <div className="section-title">
          <span>Setlist</span>
          <span>{unsaved ? "Unsaved" : "Saved"}</span>
        </div>
        <input
          className="setlist-name"
          value={setlist.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Setlist name"
        />
      </div>

      <div className="setlist" role="list">
        {setlist.songs.length === 0 ? (
          <p className="hint" style={{ padding: "0 8px" }}>
            No songs yet. Add the first one to set its key, mode and time signature.
          </p>
        ) : null}
        {setlist.songs.map((song, index) => (
          <div key={song.id} role="listitem" style={{ position: "relative" }}>
            <button
              type="button"
              className={`song-row${song.id === activeSongId ? " is-active" : ""}`}
              onClick={() => onSelect(song.id)}
              onDoubleClick={() => onEditSong(song.id)}
              aria-current={song.id === activeSongId ? "true" : undefined}
            >
              <span className="index mono">{String(index + 1).padStart(2, "0")}</span>
              <span className="copy">
                <strong>{song.title}</strong>
                <small>
                  {song.artist ? `${song.artist} · ` : ""}
                  {formatTimeSignature(song.timeSignature)}
                  {song.bpm ? ` · ${song.bpm} bpm` : ""}
                </small>
              </span>
              <span className="key-chip">{spellKeyShort(song.concertKey as PitchClass, song.mode)}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
