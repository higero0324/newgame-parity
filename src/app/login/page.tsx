"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const GUEST_MODE_KEY = "hisei_guest_mode";

function formatAuthError(err: unknown, fallback: string): string {
  const e = err as { message?: string };
  const raw = e?.message ?? "";
  if (!raw) return fallback;
  if (raw.includes("Invalid login credentials")) return "メールアドレスまたはパスワードが正しくありません。";
  if (raw.includes("Email not confirmed")) return "メール確認が未完了です。確認メールのリンクを開いてください。";
  if (raw.includes("signup is disabled")) return "現在、新規登録は無効化されています。";
  return `エラー: ${raw}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setCurrentUser(null);
      setStatus(formatAuthError(error, "ログイン状態の確認に失敗しました。"));
      return;
    }
    setCurrentUser(data.user?.email ?? null);
  };

  useEffect(() => {
    refreshUser().catch(err => {
      setStatus(formatAuthError(err, "ログイン機能は現在利用できません。"));
    });
  }, []);

  const signIn = async () => {
    if (!email || !password) {
      setStatus("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
      await refreshUser();
      setStatus("ログインしました。");
      setTimeout(() => {
        router.replace("/");
      }, 450);
    } catch (err) {
      setStatus(formatAuthError(err, "ログインに失敗しました。"));
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    if (!email || !password) {
      setStatus("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const redirectTo = "https://hisei.vercel.app/login";

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      if (!data.session) {
        setStatus("登録しました。確認メールを開いて認証を完了してください。");
      } else {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        await refreshUser();
        setStatus("登録してログインしました。");
        setTimeout(() => {
          router.replace("/");
        }, 450);
      }
    } catch (err) {
      setStatus(formatAuthError(err, "登録に失敗しました。"));
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setStatus("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCurrentUser(null);
      setStatus("ログアウトしました。");
    } catch (err) {
      setStatus(formatAuthError(err, "ログアウトに失敗しました。"));
    } finally {
      setLoading(false);
    }
  };

  const joinAsGuest = () => {
    const ok = window.confirm(
      "一部機能(プロフィール、フレンド、季譜保存、アチーブメント)が制限されますがよろしいですか？？（ゲスト参加後でもログインは可能です）",
    );
    if (!ok) return;
    window.localStorage.setItem(GUEST_MODE_KEY, "1");
    window.location.href = "/";
  };

  return (
    <main
      style={{
        padding: 16,
        display: "grid",
        gap: 12,
        width: "min(420px, 100%)",
        boxSizing: "border-box",
        justifyItems: "stretch",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: 0 }}>ログイン</h1>

      <div style={{ display: "grid", gap: 8, width: "100%" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>メールアドレス</span>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>パスワード</span>
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={signIn} disabled={loading} style={btnStyle}>ログイン</button>
        <button onClick={signUp} disabled={loading} style={btnStyle}>新規登録</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={joinAsGuest} disabled={loading} style={btnStyle}>ゲストで参加</button>
        <button onClick={signOut} disabled={loading} style={btnStyle}>ログアウト</button>
      </div>

      <div style={{ fontSize: 14, color: "#555", textAlign: "center", wordBreak: "break-word" }}>
        {currentUser ? `ログイン中: ${currentUser}` : "未ログインです。"}
      </div>

      {status && (
        <div
          style={{
            padding: 12,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.6)",
            width: "100%",
            boxSizing: "border-box",
            overflowWrap: "anywhere",
          }}
        >
          {status}
        </div>
      )}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--ink)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
  width: "100%",
  boxSizing: "border-box",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.8)",
  width: "100%",
  boxSizing: "border-box",
};
