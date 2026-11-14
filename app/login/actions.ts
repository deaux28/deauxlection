"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { ok?: boolean; error?: string; email?: string };

function checkEmail(raw: FormDataEntryValue | null): { email: string; error?: string } {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { email, error: "Enter a full email address." };
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(/[,;\s]+/).map((s) => s.trim().replace(/^["']+|["']+$/g, "").toLowerCase()).filter(Boolean);
  if (!allowed.length) return { email, error: "No sign-in addresses are set up yet. Add ALLOWED_EMAILS in Vercel, then redeploy." };
  if (!allowed.includes(email)) return { email, error: "That address isn't on the allowed list for this collection. Check ALLOWED_EMAILS in Vercel." };
  return { email };
}

export async function sendLink(_: LoginState, form: FormData): Promise<LoginState> {
  const { email, error: bad } = checkEmail(form.get("email"));
  if (bad) return { error: bad, email };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) {
    const limited = /rate limit|too many/i.test(error.message);
    return {
      error: limited
        ? "Too many sign-in emails were sent in the last hour. Use the most recent email you got, sign in with a password, or try again in an hour."
        : `The sign-in email didn't send: ${error.message}`,
      email,
    };
  }
  return { ok: true, email };
}

export async function signInPassword(_: LoginState, form: FormData): Promise<LoginState> {
  const { email, error: bad } = checkEmail(form.get("email"));
  if (bad) return { error: bad, email };
  const password = String(form.get("password") ?? "");
  if (!password) return { error: "Enter your password.", email };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: /invalid login credentials/i.test(error.message)
        ? "That email and password don't match. If you haven't set a password yet, create one in Supabase under Authentication → Users."
        : `Sign-in didn't work: ${error.message}`,
      email,
    };
  }
  redirect("/");
}
