"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { isJoinCode, normaliseJoinCode, resolveCloudJoinCode } from "@/lib/session/join-code";

export function JoinCodeClient() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "resolving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isJoinCode(code) || status === "resolving") return;
    setStatus("resolving");
    setMessage(null);

    try {
      const viewerToken = await resolveCloudJoinCode(code);
      window.location.assign(`/join?cloud=1&t=${encodeURIComponent(viewerToken)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The session could not be opened.");
      setStatus("idle");
    }
  };

  return (
    <main className="centered-page join-code-page">
      <section className="card join-code-card" aria-labelledby="join-code-title">
        <BrandMark size={54} />
        <div className="join-code-copy">
          <span className="eyebrow">Worship Join</span>
          <h1 id="join-code-title">Join a live session</h1>
          <p>Enter the six-digit code shown by a Worship Keys Cloud Live host.</p>
        </div>

        <form className="join-code-form" onSubmit={submit}>
          <label className="label" htmlFor="join-code">Session code</label>
          <input
            id="join-code"
            className="join-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="go"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(normaliseJoinCode(event.target.value))}
            placeholder="000000"
            aria-describedby={message ? "join-code-message" : undefined}
            autoFocus
          />
          <button type="submit" className="btn-primary join-code-submit" disabled={!isJoinCode(code) || status === "resolving"}>
            {status === "resolving" ? "Finding session…" : "Join session"}
          </button>
        </form>

        {message ? <div id="join-code-message" className="callout tone-warn" role="alert">{message}</div> : null}

        <div className="join-code-install-note">
          <strong>Install as a separate iPhone app</strong>
          <span>In Safari choose Share → Add to Home Screen. For Offline Church, install Worship Join from the Mac&apos;s local `/join-app` address instead.</span>
        </div>
        <Link className="join-code-main-link" href="/">Open the main Worship Keys app</Link>
      </section>
    </main>
  );
}
