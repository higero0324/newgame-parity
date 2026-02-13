"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [authLink, setAuthLink] = useState<{ href: string; label: string }>({
    href: "/login",
    label: "ログイン",
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        setAuthLink({ href: "/profile", label: "プロフィール" });
        setIsLoggedIn(true);
      } else {
        setAuthLink({ href: "/login", label: "ログイン" });
        setIsLoggedIn(false);
      }
    };

    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthLink({ href: "/profile", label: "プロフィール" });
        setIsLoggedIn(true);
      } else {
        setAuthLink({ href: "/login", label: "ログイン" });
        setIsLoggedIn(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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
        <Link href="/tutorial" style={linkStyle}>チュートリアル</Link>
        <Link href="/history" style={linkStyle}>保存棋譜（ログイン時）</Link>
      </div>
      <p style={{ color: "#555", textAlign: "center" }}>
        ※ログインは棋譜保存用。ログインなしでも対局できます。
      </p>
    </main>
  );
}
