"use client";
import { useActionState, useState } from "react";
import { sendLink, signInPassword, type LoginState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendLink, {});
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInPassword, {});

  if (mode === "link" && linkState.ok) {
    return (
      <div className="login-form">
        <p className="sent">Check <b>{linkState.email}</b> for a sign-in link. It works once and expires in an hour. Check spam if it isn&apos;t there in a minute.</p>
        <button type="button" className="linkish" style={{ justifySelf: "start" }} onClick={() => setMode("password")}>Sign in with a password instead</button>
      </div>
    );
  }

  const state = mode === "link" ? linkState : pwState;
  const pending = mode === "link" ? linkPending : pwPending;

  return (
    <form action={mode === "link" ? linkAction : pwAction} className="login-form" key={mode}>
      <label className="mono" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email ?? linkState.email ?? pwState.email} placeholder="you@example.com" />
      {mode === "password" && (
        <>
          <label className="mono" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </>
      )}
      {state.error && <p className="form-err">{state.error}</p>}
      <button className="btn ink" disabled={pending}>
        {mode === "link" ? (pending ? "Sending…" : "Email me a sign-in link") : (pending ? "Signing in…" : "Sign in")}
      </button>
      <button type="button" className="linkish" style={{ justifySelf: "start", marginTop: 4 }} onClick={() => setMode(mode === "link" ? "password" : "link")}>
        {mode === "link" ? "Sign in with a password instead" : "Email me a link instead"}
      </button>
    </form>
  );
}
