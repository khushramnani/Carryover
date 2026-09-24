"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtTimeWithSec } from "@/lib/time";
import { LogoMark } from "@/components/logo-mark";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo";

const ERRORS: Record<string, string> = {
  "not-a-member":
    "That Discord account isn't in the Figmenta server. Ask an admin to add you, then sign in again.",
  beta: "Carryover is in private beta — your Discord account isn't on the list yet.",
  scope:
    "Discord didn't hand over the permissions we need. Try again and accept the request to see your servers.",
  "discord-unavailable":
    "Couldn't reach Discord to check your server membership. Give it a moment and try again.",
  config: "Carryover isn't finished setting up. Ping Khush — the server isn't configured.",
  profile: "Signed in, but your Carryover profile couldn't be created. Try again.",
  auth: "Sign-in failed. Try again.",
};

function DiscordMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.35-1.22.644-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

export function AuthForm({ error }: { error?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(error ? (ERRORS[error] ?? ERRORS.auth) : "");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const signIn = async () => {
    setErr("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // `guilds` is what lets the callback check Figmenta membership.
          scopes: "identify email guilds",
        },
      });
      if (oauthError) throw oauthError;
      // On success the browser is already navigating to Discord.
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
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
          <h2 className="auth-form-title">Sign in to Carryover</h2>
          <p className="auth-form-sub">
            Sign in with the Discord account you use on the Figmenta server.
            That membership is your access — no password to forget.
          </p>

          {err && <div className="auth-err">{err}</div>}

          <button
            className="btn primary full lg"
            type="button"
            onClick={signIn}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <DiscordMark />
            {busy ? "Opening Discord…" : "Continue with Discord"}
          </button>

          {demoEnabled() && (
            <>
              <div className="auth-divider">OR</div>
              <button
                className="btn full lg"
                type="button"
                onClick={() => {
                  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
                  // Full navigation so the middleware sees the new cookie.
                  window.location.href = "/today";
                }}
              >
                Try as test user
              </button>
              <p className="tiny" style={{ textAlign: "center", marginTop: 8 }}>
                No sign-in needed. Your data stays in this browser.
              </p>
            </>
          )}

          <div className="auth-legal">
            Access is granted by membership of the Figmenta Discord server. You
            can also clock in from your admin channel with{" "}
            <span className="mono">/in</span>. By signing in you agree to the{" "}
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
