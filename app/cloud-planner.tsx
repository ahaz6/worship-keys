"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DriveFolderPanel } from "@/components/setlist/drive-folder-panel";
import { SetlistRail } from "@/components/setlist/setlist-rail";
import { SetlistTransfer } from "@/components/setlist/setlist-transfer";
import { SongDialog } from "@/components/setlist/song-dialog";
import { spellKey } from "@/lib/music/notation";
import type { PitchClass } from "@/lib/music/pitch";
import { getSupabaseClient } from "@/lib/supabase/client";
import { migratePersistedState, type PersistedState, type Song } from "@/lib/storage/schema";
import {
  activeSong,
  addSong,
  createSong,
  createStarterSetlist,
  duplicateSong,
  removeSong,
  selectSong,
  updateSong,
} from "@/lib/storage/setlist-operations";
import { createPersistedState } from "@/lib/storage/setlist-repository";
import type { PadPreset } from "@/types/pads";

const CLOUD_PRESETS: readonly PadPreset[] = [
  {
    id: "sound-walls",
    name: "Sound Wall Pads",
    description: "The Worship Keys live pad pack.",
    mode: "neutral",
    keys: [],
  },
];

const DEFAULT_STATE = createPersistedState(createStarterSetlist());

function CloudBrand() {
  return (
    <div className="cloud-brand" aria-label="Worship Keys">
      <span className="cloud-brand-mark" aria-hidden="true">WK</span>
      <span><b>Worship</b><strong>Keys</strong></span>
    </div>
  );
}

function CloudAuth({ onNotice }: { onNotice: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (mode: "signin" | "signup") => {
    const supabase = getSupabaseClient();
    if (!supabase) return onNotice("Supabase is not configured for this deployment.");
    if (!email.trim() || password.length < 8) return onNotice("Enter your email and a password with at least 8 characters.");
    setBusy(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
    setBusy(false);
    if (result.error) return onNotice(result.error.message);
    if (mode === "signup" && !result.data.session) onNotice("Account created. Confirm the email, then sign in here.");
  };

  return (
    <main className="cloud-auth-shell">
      <section className="cloud-auth-card">
        <CloudBrand />
        <div>
          <span className="eyebrow">Cloud setlist planner</span>
          <h1>Prepare at home.<br />Play locally on Sunday.</h1>
          <p>Your setlist is private to your account and synchronised through Supabase.</p>
        </div>
        <label className="field">
          <span className="label">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="cloud-auth-actions">
          <button className="btn-primary" disabled={busy} onClick={() => void submit("signin")}>Sign in</button>
          <button className="btn" disabled={busy} onClick={() => void submit("signup")}>Create account</button>
        </div>
        <small>The live audio host and QR session stay on the church Mac and are never exposed publicly.</small>
      </section>
    </main>
  );
}

export function CloudPlanner() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "saving" | "offline" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<{ song: Song; isNew: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => getSupabaseClient(), []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session || !supabase) return;
    void supabase
      .from("worship_key_sets")
      .select("state, revision")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setSyncState("error");
          showNotice(error.message);
          return;
        }
        if (data) {
          const migrated = migratePersistedState(data.state);
          if (migrated.ok) setState(migrated.state);
          else showNotice(migrated.message);
          setRevision(Number(data.revision) || 1);
        }
        setLoaded(true);
        setSyncState("saved");
      });
  }, [session, showNotice, supabase]);

  useEffect(() => {
    if (!loaded || !session || !supabase) return;
    const timer = setTimeout(() => {
      if (!navigator.onLine) {
        setSyncState("offline");
        return;
      }
      setSyncState("saving");
      const nextRevision = revision + 1;
      void supabase
        .from("worship_key_sets")
        .upsert({ user_id: session.user.id, state, revision: nextRevision, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) {
            setSyncState("error");
            showNotice(`Cloud save failed: ${error.message}`);
          } else {
            setRevision(nextRevision);
            setSyncState("saved");
          }
        });
    }, 700);
    return () => clearTimeout(timer);
    // Revision is intentionally not a trigger: it is bookkeeping for the saved snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, session, showNotice, state, supabase]);

  if (!authReady) return <main className="cloud-loading">Loading Worship Keys…</main>;
  if (!session) return <><CloudAuth onNotice={showNotice} />{notice ? <div className="cloud-toast">{notice}</div> : null}</>;

  const setlist = state.setlist;
  const song = activeSong(setlist);
  const patchSetlist = (next: typeof setlist | ((current: typeof setlist) => typeof setlist)) => {
    setState((current) => ({
      ...current,
      setlist: typeof next === "function" ? next(current.setlist) : next,
    }));
  };

  const saveSong = (next: Song) => {
    patchSetlist((current) => editingSong?.isNew ? addSong(current, next) : updateSong(current, next.id, next));
    setEditingSong(null);
  };

  return (
    <div className="cloud-planner-shell">
      <aside className="cloud-planner-rail">
        <CloudBrand />
        <SetlistRail
          setlist={setlist}
          activeSongId={setlist.activeSongId}
          onSelect={(songId) => patchSetlist((current) => selectSong(current, songId))}
          onAddSong={() => setEditingSong({ song: createSong(), isNew: true })}
          onEditSong={(songId) => {
            const found = setlist.songs.find((entry) => entry.id === songId);
            if (found) setEditingSong({ song: found, isNew: false });
          }}
          onRename={(name) => patchSetlist((current) => ({ ...current, name: name || "Untitled setlist" }))}
          unsaved={syncState === "saving" || syncState === "offline"}
          showEditButtons
        />
        <div className="cloud-account">
          <span className={`sync-dot is-${syncState}`} />
          <span>{syncState === "saved" ? "Saved to cloud" : syncState === "saving" ? "Saving…" : syncState === "offline" ? "Offline" : syncState === "error" ? "Sync error" : "Loading…"}</span>
          <button className="btn tone-quiet" onClick={() => void supabase?.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="cloud-planner-main">
        <header className="cloud-planner-header">
          <div>
            <span className="eyebrow">Worship Keys · Cloud</span>
            <h1>{setlist.name}</h1>
            <p>Prepare the set here. On Sunday, load the mirrored file on the church Mac and start the local QR session.</p>
          </div>
          <span className="cloud-badge">Cloud planner</span>
        </header>

        {notice ? <div className="callout cloud-notice">{notice}</div> : null}

        <section className="cloud-song-card">
          {song ? (
            <>
              <div className="cloud-song-number">{String(setlist.songs.findIndex((entry) => entry.id === song.id) + 1).padStart(2, "0")}</div>
              <div>
                <span className="eyebrow">Current selection</span>
                <h2>{song.title}</h2>
                <p>{song.artist || "No artist"}</p>
              </div>
              <dl className="cloud-song-meta">
                <div><dt>Key</dt><dd>{spellKey(song.concertKey as PitchClass, song.mode)}</dd></div>
                <div><dt>Tempo</dt><dd>{song.bpm ?? 70} BPM</dd></div>
                <div><dt>Meter</dt><dd>{song.timeSignature.numerator}/{song.timeSignature.denominator}</dd></div>
              </dl>
              <button className="btn is-active" onClick={() => setEditingSong({ song, isNew: false })}>Edit song</button>
            </>
          ) : (
            <div className="cloud-empty"><h2>No songs yet</h2><p>Add the first song to prepare Sunday&apos;s set.</p></div>
          )}
        </section>

        <section className="cloud-sync-grid">
          <div className="cloud-info-card">
            <span className="eyebrow">1 · Cloud source</span>
            <h3>Supabase keeps the working setlist</h3>
            <p>Changes are saved privately to your account. This is the canonical preparation copy.</p>
            <SetlistTransfer state={state} onImport={(next) => setState(next)} onNotice={showNotice} />
          </div>
          <div className="cloud-info-card">
            <span className="eyebrow">2 · Church handoff</span>
            <h3>Mirror into Google Drive</h3>
            <p>Select the local Google Drive folder once in Chrome. Every later change is written to the same offline-ready file.</p>
            <DriveFolderPanel state={state} onImport={(next) => setState(next)} onNotice={showNotice} autoSave />
          </div>
          <div className="cloud-info-card cloud-live-card">
            <span className="eyebrow">3 · Sunday live host</span>
            <h3>Open Worship Keys locally on the Mac</h3>
            <p>Load the Drive file, enable audio, then show the join code. The QR points to the Mac&apos;s current LAN address—not to Vercel.</p>
            <div className="cloud-flow"><span>Drive file</span><b>→</b><span>Church Mac</span><b>→</b><span>Local QR</span></div>
          </div>
        </section>
      </main>

      {editingSong ? (
        <SongDialog
          key={editingSong.song.id}
          song={editingSong.song}
          presets={CLOUD_PRESETS}
          isNew={editingSong.isNew}
          onSave={saveSong}
          onDelete={() => {
            patchSetlist((current) => removeSong(current, editingSong.song.id));
            setEditingSong(null);
          }}
          onDuplicate={() => {
            patchSetlist((current) => duplicateSong(current, editingSong.song.id));
            setEditingSong(null);
          }}
          onClose={() => setEditingSong(null)}
        />
      ) : null}
    </div>
  );
}
