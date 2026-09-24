"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";
import { calculateBank, analyzeSession } from "@/lib/bank";
import { fmtHMCompact, fmtTimeWithSec, dayKey } from "@/lib/time";
import { signOut } from "@/lib/actions";
import { useCarryover } from "@/components/demo-provider";
import type { AppState } from "@/lib/types";

interface AppShellProps {
  email: string;
  state: AppState;
  children: React.ReactNode;
}

type TabId = "today" | "bank" | "history" | "plan" | "settings";

const TAB_PATHS: Record<TabId, string> = {
  today: "/today",
  bank: "/bank",
  history: "/history",
  plan: "/plan",
  settings: "/settings",
};

export function AppShell({ email, state: serverState, children }: AppShellProps) {
  const { state } = useCarryover(serverState);
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.policy.theme || "dark");
  }, [state.policy.theme]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [userMenuOpen]);

  const activeTab: TabId = useMemo(() => {
    if (pathname?.startsWith("/bank")) return "bank";
    if (pathname?.startsWith("/history")) return "history";
    if (pathname?.startsWith("/plan")) return "plan";
    if (pathname?.startsWith("/settings")) return "settings";
    return "today";
  }, [pathname]);

  const todayKey = dayKey(now);
  const todaySession = state.sessions[todayKey] || { events: [], closed: false };
  const sessionState = analyzeSession(todaySession.events, { now }).state;

  const bank = useMemo(
    () => calculateBank(state.sessions, state.plans, state.policy),
    [state.sessions, state.plans, state.policy],
  );
  const plansCount = Object.keys(state.plans).length;
  const initials = (email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <LogoMark size={30} radius={8} />
          <div>
            <div className="brand-name">Carryover</div>
          </div>
          <div className="brand-tag">WORK HOUR BANK · IST</div>
        </div>

        <div className="topbar-right">
          <span
            className={`dot ${
              sessionState === "off" ? "off" : sessionState === "break" ? "break" : ""
            }`}
          />
          <span>
            {sessionState === "working" && `Working · ${fmtTimeWithSec(now)}`}
            {sessionState === "break" && `On break · ${fmtTimeWithSec(now)}`}
            {sessionState === "off" &&
              (todaySession.closed
                ? `Closed · ${fmtTimeWithSec(now)}`
                : `Offline · ${fmtTimeWithSec(now)}`)}
          </span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span>
            Bank {bank.total >= 0 ? "+" : "−"}
            {fmtHMCompact(Math.abs(bank.total))}
          </span>

          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              className="user-chip"
              onClick={() => setUserMenuOpen((v) => !v)}
              type="button"
            >
              <div className="user-avatar">{initials}</div>
              <span className="mono" style={{ fontSize: 12 }}>
                {email.split("@")[0]}
              </span>
            </button>
            {userMenuOpen && (
              <div className="user-menu">
                <div className="user-menu-info">
                  <div style={{ fontWeight: 500, fontSize: 13 }}>Signed in</div>
                  <div className="email">{email}</div>
                </div>
                <button
                  className="user-menu-item"
                  onClick={() => {
                    router.push("/settings");
                    setUserMenuOpen(false);
                  }}
                >
                  Settings
                </button>
                <form action={signOut}>
                  <button className="user-menu-item danger" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="tabs-nav">
        <TabLink id="today" active={activeTab === "today"} label="Today" />
        <TabLink
          id="bank"
          active={activeTab === "bank"}
          label="Bank"
          badge={bank.total >= 0 ? "+" + fmtHMCompact(bank.total) : fmtHMCompact(bank.total)}
        />
        <TabLink
          id="history"
          active={activeTab === "history"}
          label="History"
          badge={String(bank.byDay.length)}
        />
        <TabLink
          id="plan"
          active={activeTab === "plan"}
          label="Plan"
          badge={plansCount ? String(plansCount) : undefined}
        />
        <TabLink id="settings" active={activeTab === "settings"} label="Settings" />
      </nav>

      {children}

      <footer className="footer">
        <div className="footer-left">
          <LogoMark size={18} radius={5} />
          <span>
            Built by{" "}
            <a href="https://github.com/khushramnani" target="_blank" rel="noopener noreferrer">
              Khush
            </a>{" "}
            for{" "}
            <strong style={{ color: "var(--text-dim)", fontWeight: 600 }}>Figmenta</strong>
          </span>
        </div>
        <div className="footer-right">
          <span>v1.0</span>
          <span className="footer-dot" />
          <span>IST · UTC+5:30</span>
          <span className="footer-dot" />
          <span>Supabase</span>
        </div>
      </footer>
    </div>
  );
}

function TabLink({
  id,
  active,
  label,
  badge,
}: {
  id: TabId;
  active: boolean;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      href={TAB_PATHS[id]}
      className={`tab-item ${active ? "active" : ""}`}
      prefetch
    >
      {label}
      {badge != null && <span className="badge">{badge}</span>}
    </Link>
  );
}
