"use client";
import { useActionState } from "react";
import { sendLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLink, {});
  if (state.ok) {
    return <p className="sent">Check <b>{state.email}</b> for a sign-in link. It works once and expires in an hour.</p>;
  }
  return (
    <form action={action} className="login-form">
      <label className="mono" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} placeholder="you@example.com" />
      {state.error && <p className="form-err">{state.error}</p>}
      <button className="btn ink" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
