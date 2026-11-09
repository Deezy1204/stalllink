"use client";

import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/components/AuthProvider";
import { FullLogo } from "@/components/Brand";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { digitsOnly } from "@/lib/catalog";
import { auth } from "@/lib/firebase";
import { createProfile } from "@/lib/merchant";

function message(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Those details do not match an account.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/invalid-email":
      return "That email address does not look right.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/network-request-failed":
      return "No internet connection.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in the Firebase console.";
    default:
      return (e as Error)?.message ?? "Something went wrong.";
  }
}

/** Only same-site paths, so a crafted link cannot send people elsewhere after signing in. */
const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : null);

function Login() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { user, isAdmin, loading, error: authError } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Admins land in the admin console, everyone else in the merchant console.
  useEffect(() => {
    if (!loading && user && !busy) router.replace(next ?? (isAdmin ? "/" : "/merchant"));
  }, [loading, user, isAdmin, busy, next, router]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signin") return run(() => signInWithEmailAndPassword(auth(), email.trim(), password));
    if (!name.trim()) return setError("Enter your full name.");
    if (digitsOnly(phone).length < 7) return setError("Enter a valid phone number (buyers and Localink use it to reach you).");
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    return run(async () => {
      const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await createProfile(cred.user, { name: name.trim(), phone: phone.trim() });
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface to-brand-50 px-4 py-10">
      <Card className="w-full max-w-md animate-rise p-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <FullLogo className="h-32" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-ink-3">Merchant & admin console</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setInfo(null); }} className={`rounded-lg py-2 transition ${mode === m ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <p className="mb-5 text-sm text-ink-3">
          {mode === "signin" ? "Use the same account you use in the Localink app." : "Open a merchant account to run your shop from the web or the app."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <Input label="Full name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tendai Moyo" />
              <Input label="Phone / WhatsApp" type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 77 123 4567" />
            </>
          )}
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
          />
          {(error || authError) && <p className="animate-fade-in rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error ?? authError}</p>}
          {info && <p className="animate-fade-in rounded-xl bg-mint-100 px-3 py-2 text-sm text-mint-800">{info}</p>}
          <Button type="submit" className="h-11 w-full" loading={busy || loading}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <Button variant="secondary" className="h-11 w-full" disabled={busy} onClick={() => run(() => signInWithPopup(auth(), new GoogleAuthProvider()))}>
          <svg className="size-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
          Continue with Google
        </Button>
        {mode === "signin" && (
          <button
            className="mt-4 w-full text-center text-sm font-semibold text-brand hover:underline"
            onClick={() =>
              email.trim()
                ? run(async () => {
                    await sendPasswordResetEmail(auth(), email.trim());
                    setInfo("If that email has an account, a reset link is on its way.");
                  })
                : setError("Type your email above first.")
            }
          >
            Forgot password?
          </button>
        )}
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
      <Login />
    </Suspense>
  );
}
