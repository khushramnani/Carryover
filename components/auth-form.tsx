"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmtTimeWithSec } from "@/lib/time";
import { LogoMark } from "@/components/logo-mark";

const ALLOWED_DOMAINS = ["figmenta.com"];

type Mode = "password" | "magic";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const validDomain = (em: string) => {
    const m = em.trim().toLowerCase().match(/@([a-z0-9\-.]+)$/);
    return !!m && ALLOWED_DOMAINS.includes(m[1]);
  };

  const submitPassword = async (e?: FormEvent) => {
    e?.preventDefault();
    setErr("");
    setInfo("");
    if (!email.trim()) return setErr("Enter your company email");
    if (!validDomain(email))
      return setErr(`Only ${ALLOWED_DOMAINS.join(", ")} emails are allowed`);
    if (password.length < 6)
      return setErr("Password must be at least 6 characters");

    setBusy(true);
    const supabase = createClient();
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback`
                : undefined,
          },
        });
        if (error) throw error;
        setInfo(
          "Account created. Check your inbox to confirm your email, then sign in.",
        );
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/today");
        router.refresh();
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const sendMagic = async (e?: FormEvent) => {
    e?.preventDefault();
    setErr("");
    setInfo("");
    if (!email.trim()) return setErr("Enter your company email");
    if (!validDomain(email))
      return setErr(`Only ${ALLOWED_DOMAINS.join(", ")} emails are allowed`);

    setBusy(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const clockStr = fmtTimeWithSec(now);

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <LogoMark size={40} radius={10} />
          <div>
            <div className="brand-name" style={{ fontSize: 16 }}>
              Carryover
            </div>
            <div className="tiny">Work hour bank · IST</div>
          </div>
        </div>

        <div className="auth-hero">
          <div className="auth-eyebrow">Stop losing your extra hours.</div>
          <h1 className="auth-title">
            Every minute over 8 is{" "}
            <span className="mono credit-text">credit</span>.
            <br />
            Every minute under is{" "}
            <span className="mono debit-text">debit</span>.
          </h1>
          <p className="auth-sub">
            Carryover tracks your flexible work sessions against an 8-hour
            quota, banks your extra time, and lets you spend it on half-days,
            late starts, or full days off.
          </p>
        </div>

        <div className="auth-preview">
          <div className="auth-preview-card">
            <div className="auth-pc-head">
              <span className="pulse" />
              <span className="tiny">WORKED TODAY</span>
              <span className="spacer" />
              <span className="mono tiny">{clockStr} IST</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 42,
                letterSpacing: "-0.03em",
                fontWeight: 500,
              }}
            >
              06:42:18
            </div>
            <div className="auth-pc-bar">
              <div className="auth-pc-fill" style={{ width: "84%" }} />
            </div>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 14 }}
            >
              <div>
                <div className="tiny">BANK BALANCE</div>
                <div
                  className="mono credit-text"
                  style={{ fontSize: 22, fontWeight: 500 }}
                >
                  +14h 22m
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="tiny">LOG OUT AT</div>
                <div
                  className="mono"
                  style={{ fontSize: 22, fontWeight: 500 }}
                >
                  20:18
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-foot">
          <span>© {new Date().getFullYear()} Figmenta</span>
          <span className="auth-foot-links">
            <button className="link">Privacy</button>
            <button className="link">Policy</button>
            <button className="link">Support</button>
          </span>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="auth-mode">
            <button
              className={`auth-mode-btn ${mode === "password" ? "active" : ""}`}
              onClick={() => {
                setMode("password");
                setErr("");
                setInfo("");
                setMagicSent(false);
              }}
              type="button"
            >
              Password
            </button>
            <button
              className={`auth-mode-btn ${mode === "magic" ? "active" : ""}`}
              onClick={() => {
                setMode("magic");
                setErr("");
                setInfo("");
              }}
              type="button"
            >
              Magic link
            </button>
            <div
              className="auth-mode-indicator"
              style={{
                transform:
                  mode === "password" ? "translateX(0)" : "translateX(100%)",
              }}
            />
          </div>

          <h2 className="auth-form-title">
            {mode === "password"
              ? isSignUp
                ? "Create your Carryover account"
                : "Sign in to Carryover"
              : magicSent
                ? "Check your inbox"
                : "Send me a magic link"}
          </h2>
          <p className="auth-form-sub">
            {mode === "password"
              ? isSignUp
                ? "Use your company email and pick a password — at least 6 characters."
                : "Use your company email and password."
              : magicSent
                ? `We just emailed a sign-in link to ${email}. Click it from any device.`
                : "We'll email you a one-click sign-in link — no password needed."}
          </p>

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="auth-form">
              <label className="auth-field">
                <span>Company email</span>
                <input
                  className="input wide"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@figmenta.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="auth-field">
                <span
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>Password</span>
                  <button
                    type="button"
                    className="link small"
                    onClick={() => {
                      setIsSignUp((v) => !v);
                      setErr("");
                      setInfo("");
                    }}
                  >
                    {isSignUp ? "Have an account? Sign in" : "New? Create one"}
                  </button>
                </span>
                <input
                  className="input wide"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {err && <div className="auth-err">{err}</div>}
              {info && (
                <div
                  className="auth-err"
                  style={{
                    background:
                      "color-mix(in srgb, var(--accent) 14%, transparent)",
                    borderColor:
                      "color-mix(in srgb, var(--accent) 35%, var(--border))",
                    color: "var(--text)",
                  }}
                >
                  {info}
                </div>
              )}
              <button
                className="btn primary full lg"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? isSignUp
                    ? "Creating account…"
                    : "Signing in…"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          ) : !magicSent ? (
            <form onSubmit={sendMagic} className="auth-form">
              <label className="auth-field">
                <span>Company email</span>
                <input
                  className="input wide"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@figmenta.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {err && <div className="auth-err">{err}</div>}
              <button
                className="btn primary full lg"
                type="submit"
                disabled={busy}
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </form>
          ) : (
            <div className="auth-magic-note">
              <div className="tiny">EMAIL SENT</div>
              <p style={{ color: "var(--text)" }}>
                Open the link in your email to finish signing in.
              </p>
              <button
                type="button"
                className="btn ghost full"
                onClick={() => {
                  setMagicSent(false);
                  setErr("");
                }}
              >
                Use a different email
              </button>
            </div>
          )}

          <div className="auth-legal">
            Only <span className="mono">@figmenta.com</span> accounts can sign
            in. By signing in you agree to the{" "}
            <button type="button" className="link">
              Acceptable Use Policy
            </button>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
