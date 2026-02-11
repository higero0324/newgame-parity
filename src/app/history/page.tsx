"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MatchRow = {
  id: string;
  created_at: string;
  winner: string;
  moves_count: number;
};

const STAR_STORAGE_KEY = "hisei_starred_matches";

function toHistoryErrorMessage(error: unknown): string {
  const e = error as { message?: string };
  const raw = e?.message ?? "unknown error";
  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return "棋譜の取得に失敗しました。RLSポリシーでSELECTが許可されていません。";
  }
  return `棋譜の取得に失敗しました。詳細: ${raw}`;
}

function loadStarred(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(STAR_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set<string>();
  }
}

function saveStarred(starred: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(Array.from(starred)));
}

export default function HistoryPage() {
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStarred(loadStarred());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) {
          setStatus(`認証確認に失敗しました。詳細: ${authError.message}`);
          return;
        }
        if (!auth.user) {
          setStatus("未ログインです。ログインすると保存棋譜を見られます。");
          return;
        }

        const { data, error } = await supabase
          .from("matches")
          .select("id, created_at, winner, moves_count")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) {
          setStatus(toHistoryErrorMessage(error));
          return;
        }

        const list = (data ?? []) as MatchRow[];
        setRows(list);
        setStatus(list.length === 0 ? "保存棋譜がまだありません。" : "");
      } catch (err) {
        setStatus(toHistoryErrorMessage(err));
      }
    })();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aStar = starred.has(a.id) ? 1 : 0;
      const bStar = starred.has(b.id) ? 1 : 0;
      if (aStar !== bStar) return bStar - aStar;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, starred]);

  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveStarred(next);
      return next;
    });
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 12, justifyItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, position: "relative", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>保存棋譜</h1>
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          保存数 {rows.length}/30
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/" style={btnStyle}>ホームへ戻る</Link>
      </div>

      {status && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 720 }}>
          {status}
        </div>
      )}

      <ul style={{ display: "grid", gap: 8, width: "100%", maxWidth: 720 }}>
        {sortedRows.map(r => {
          const isStarred = starred.has(r.id);
          return (
            <li key={r.id} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <b>{new Date(r.created_at).toLocaleString()}</b>
                <button
                  style={{ ...btnStyle, padding: "4px 10px", borderRadius: 999 }}
                  onClick={() => toggleStar(r.id)}
                  aria-pressed={isStarred}
                  title={isStarred ? "お気に入りを解除" : "お気に入りに追加"}
                >
                  {isStarred ? "★ お気に入り" : "☆ お気に入り"}
                </button>
              </div>
              <div>勝者: {r.winner === "p1" ? "先手" : "後手"} / 手数: {r.moves_count}</div>
              <div style={{ fontSize: 12, color: "#666" }}>棋譜ID: {r.id}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/history/${r.id}`} style={btnStyle}>盤面で再生</Link>
                <button
                  style={btnStyle}
                  disabled={deletingId === r.id}
                  onClick={async () => {
                    const ok = window.confirm("この棋譜を削除します。よろしいですか？");
                    if (!ok) return;
                    setDeletingId(r.id);
                    setStatus("");
                    const { error } = await supabase.from("matches").delete().eq("id", r.id);
                    setDeletingId(null);
                    if (error) {
                      setStatus(`棋譜の削除に失敗しました。詳細: ${error.message}`);
                      return;
                    }
                    setRows(prev => {
                      const next = prev.filter(x => x.id !== r.id);
                      setStatus(next.length === 0 ? "保存棋譜がまだありません。" : "");
                      return next;
                    });
                    setStarred(prev => {
                      const next = new Set(prev);
                      if (next.has(r.id)) {
                        next.delete(r.id);
                        saveStarred(next);
                      }
                      return next;
                    });
                  }}
                >
                  {deletingId === r.id ? "削除中..." : "削除"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  color: "var(--ink)",
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};
