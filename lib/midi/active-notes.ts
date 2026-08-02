/**
 * Sounding-note bookkeeping (spec section 9.2).
 *
 * A plain Set of pitch classes is not enough. The state has to survive repeated
 * strikes of the same note, sustain pedal holds, and a device disconnecting
 * mid-chord — all of which are ordinary things a keyboard player does.
 */

export type ActiveNote = {
  note: number;
  velocity: number;
  channel: number;
  /** How many Note On messages for this note are outstanding. */
  strikes: number;
  /** Physically held down right now. */
  pressed: boolean;
  /** Released, but still sounding because the sustain pedal is down. */
  heldBySustain: boolean;
  /** Performance clock reading of the most recent Note On, for stability windows. */
  startedAt: number;
};

export type ActiveNotesSnapshot = {
  /** Every note currently sounding, ascending. */
  sounding: number[];
  pressed: number[];
  sustained: number[];
  /** Lowest sounding note, or null. */
  bassNote: number | null;
  sustainDown: boolean;
  /** Most recent Note On time among sounding notes, or null. */
  lastNoteOnAt: number | null;
};

export class ActiveNotes {
  private readonly notes = new Map<number, ActiveNote>();
  private sustainDown = false;

  get isSustainDown(): boolean {
    return this.sustainDown;
  }

  noteOn(note: number, velocity: number, channel: number, at: number): void {
    const existing = this.notes.get(note);
    if (existing) {
      existing.strikes += 1;
      existing.velocity = velocity;
      existing.pressed = true;
      existing.heldBySustain = false;
      existing.startedAt = at;
      return;
    }
    this.notes.set(note, {
      note,
      velocity,
      channel,
      strikes: 1,
      pressed: true,
      heldBySustain: false,
      startedAt: at,
    });
  }

  noteOff(note: number): void {
    const existing = this.notes.get(note);
    if (!existing) return;
    existing.strikes = Math.max(0, existing.strikes - 1);
    if (existing.strikes > 0) return;
    existing.pressed = false;
    if (this.sustainDown) {
      existing.heldBySustain = true;
      return;
    }
    this.notes.delete(note);
  }

  setSustain(down: boolean): void {
    this.sustainDown = down;
    if (down) return;
    // Releasing the pedal silences everything that was only held by it.
    for (const [note, state] of this.notes) {
      if (state.heldBySustain) this.notes.delete(note);
    }
  }

  /** CC123, and the safety net when a device disappears mid-chord. */
  allNotesOff(): void {
    this.notes.clear();
  }

  /**
   * Panic reset used on device disconnect. Also clears the pedal, because a
   * disconnected keyboard will never send the pedal-up message.
   */
  reset(): void {
    this.notes.clear();
    this.sustainDown = false;
  }

  snapshot(): ActiveNotesSnapshot {
    const entries = [...this.notes.values()].sort((a, b) => a.note - b.note);
    const sounding = entries.map((entry) => entry.note);
    const lastNoteOnAt = entries.reduce<number | null>(
      (latest, entry) => (latest == null || entry.startedAt > latest ? entry.startedAt : latest),
      null,
    );
    return {
      sounding,
      pressed: entries.filter((entry) => entry.pressed).map((entry) => entry.note),
      sustained: entries.filter((entry) => entry.heldBySustain).map((entry) => entry.note),
      bassNote: sounding[0] ?? null,
      sustainDown: this.sustainDown,
      lastNoteOnAt,
    };
  }
}
