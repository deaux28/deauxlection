import { LoginForm } from "./form";

export const metadata = { title: "Sign in · Deauxlection" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="mark"><span className="glyph" />Deauxlection</div>
        <h1>Your records, books and quotes.</h1>
        <p className="lede">We&apos;ll email you a link to sign in. No password needed.</p>
        {error && <p className="form-err">That sign-in link expired or was already used. Send a new one.</p>}
        <LoginForm />
      </div>
    </main>
  );
}
