"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadAchievementStateForCurrentUser } from "@/lib/achievements";

const GUEST_MODE_KEY = "hisei_guest_mode";

export default function Home() {
  const router = useRouter();
  const [authLink, setAuthLink] = useState<{ href: string; label: string }>({
    href: "/login",
    label: "ログイン",
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [achievementNotice, setAchievementNotice] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setAuthLink({ href: "/profile", label: "プロフィール" });
        setIsLoggedIn(true);
        setIsGuestMode(false);
        const ach = await loadAchievementStateForCurrentUser();
        setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setAuthLink({ href: "/login", label: "ログイン" });
        setIsLoggedIn(false);
        setIsGuestMode(true);
        setAchievementNotice(false);
      }
      setAuthReady(true);
    };

    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setAuthLink({ href: "/profile", label: "プロフィール" });
        setIsLoggedIn(true);
        setIsGuestMode(false);
        loadAchievementStateForCurrentUser().then(ach => {
          setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
        });
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setAuthLink({ href: "/login", label: "ログイン" });
        setIsLoggedIn(false);
        setIsGuestMode(true);
        setAchievementNotice(false);
      }
      setAuthReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (!authReady) {
    return <main style={{ padding: 24, textAlign: "center", color: "#666" }}>読み込み中...</main>;
  }

  const linkStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    display: "inline-block",
    width: "fit-content",
    background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
    color: "var(--ink)",
    boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
    textDecoration: "none",
  };

  const noticeBadgeStyle: React.CSSProperties = {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#d33",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ fontWeight: 900, textAlign: "center", lineHeight: 1 }}>
        <span style={{ fontSize: 60, display: "block" }}>一正</span>
        <span style={{ fontSize: 15, display: "block", marginTop: 5, color: "#555" }}>～HISEI～</span>
      </h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/hajimeni" style={linkStyle}>初めに</Link>
        <Link href="/play" style={linkStyle}>対局を始める</Link>
        <Link href="/cpu" style={linkStyle}>CPU対戦</Link>
        <Link href={authLink.href} style={linkStyle}>{authLink.label}</Link>
        {isLoggedIn && <Link href="/friends" style={linkStyle}>フレンド</Link>}
        {isLoggedIn && (
          <Link href="/achievements" style={{ ...linkStyle, position: "relative" }}>
            アチーブメント
            {achievementNotice && <span style={noticeBadgeStyle}>!</span>}
          </Link>
        )}
        <Link href="/rules" style={linkStyle}>ルール説明</Link>
        <Link href="/tutorial" style={linkStyle}>チュートリアル</Link>
        <Link href="/history" style={linkStyle}>保存季譜（ログイン時）</Link>
      </div>
      <p style={{ color: "#555", textAlign: "center" }}>
        {isGuestMode
          ? "※ゲスト参加中です。プロフィール・フレンド・季譜保存・アチーブメントは利用できません。"
          : "※ログインは季譜保存用。ログインなしでも対局できます。"}
      </p>
    </main>
  );
}
