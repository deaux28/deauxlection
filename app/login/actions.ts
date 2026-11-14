"use server";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { ok?: boolean; error?: string; email?: string };

export async function sendLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a full email address.", email };

  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(/[,;\s]+/).map((s) => s.trim().replace(/^["']+|["']+$/g, "").toLowerCase()).filter(Boolean);
  if (!allowed.length) return { error: "No sign-in addresses are set up yet. Add ALLOWED_EMAILS in Vercel, then redeploy.", email };
  if (!allowed.includes(email)) return { error: "That address isn't on the allowed list for this collection. Check ALLOWED_EMAILS in Vercel.", email };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: `The sign-in email didn't send: ${error.message}`, email };
  return { ok: true, email };
}
