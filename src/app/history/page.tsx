"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  loadCurrentProfilePrefsFromProfiles,
  saveClipPrefsToSupabase,
  saveMatchNamesToSupabase,
} from "@/lib/profilePrefs";

type MatchRow = {
  id: string;
  created_at: string;
  winner: string;
  moves_count: number;
};

function toHistoryErrorMessage(error: unknown): string {
  const e = error as { message?: string };
  const raw = e?.message ?? "unknown error";
  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return "季譜の取得に失敗しました。RLSポリシーでSELECTが許可されていません。";
  }
  return `季譜の取得に失敗しました。詳細: ${raw}`;
}

export default function HistoryPage() {
  const [status, setStatus] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [featured, setFeatured] = useState<Set<string>>(new Set());
  const [matchNames, setMatchNames] = useState<Record<string, string>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          setStatus("未ログインです。ログインすると保存季譜を見られます。");
          return;
        }
        const user = sessionData.session.user;
        setUserId(user.id);
        const loaded = await loadCurrentProfilePrefsFromProfiles();
        if (loaded.ok) {
          setMatchNames(loaded.prefs.matchNames);
          setStarred(new Set(loaded.prefs.starredIds));
          setFeatured(new Set(loaded.prefs.featuredIds));
        } else {
          setMatchNames({});
          setStarred(new Set());
          setFeatured(new Set());
        }

        const { data, error } = await supabase
          .from("matches")
          .select("id, created_at, winner, moves_count")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) {
          setStatus(toHistoryErrorMessage(error));
          return;
        }

        const list = (data ?? []) as MatchRow[];
        setRows(list);
        const nextDrafts: Record<string, string> = {};
        for (const row of list) {
          nextDrafts[row.id] = (loaded.ok ? loaded.prefs.matchNames[row.id] : "") ?? "";
        }
        setDraftNames(nextDrafts);
        setStatus(list.length === 0 ? "保存季譜がまだありません。" : "");
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
    if (!userId) return;
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const featuredIds = Array.from(featured);
      const nextStarred = Array.from(next);
      saveClipPrefsToSupabase({ starredIds: nextStarred, featuredIds }).then(res => {
        if (!res.ok) setStatus(`お気に入りの保存に失敗しました。詳細: ${res.reason}`);
      });
      return next;
    });
  };

  const saveName = (matchId: string) => {
    if (!userId) return;
    const raw = draftNames[matchId] ?? "";
    const trimmed = raw.trim();
    const nextNames = { ...matchNames };
    if (trimmed) nextNames[matchId] = trimmed;
    else delete nextNames[matchId];
    setMatchNames(nextNames);
    setDraftNames(prev => ({ ...prev, [matchId]: nextNames[matchId] ?? "" }));
    saveMatchNamesToSupabase(nextNames).then(res => {
      if (!res.ok) {
        setStatus(`季譜名の保存に失敗しました。詳細: ${res.reason}`);
        return;
      }
      setStatus("季譜名を保存しました。");
    });
  };

  const toggleFeatured = (matchId: string) => {
    if (!userId) return;
    const current = Array.from(featured);
    let nextFeatured: string[];
    if (current.includes(matchId)) {
      nextFeatured = current.filter(id => id !== matchId);
    } else {
      if (current.length >= 3) {
        setStatus("プロフィール掲載は最大3件までです。");
        return;
      }
      nextFeatured = [...current, matchId];
    }
    setFeatured(new Set(nextFeatured));
    saveClipPrefsToSupabase({ starredIds: Array.from(starred), featuredIds: nextFeatured }).then(res => {
      if (!res.ok) {
        setStatus(`プロフィール掲載の保存に失敗しました。詳細: ${res.reason}`);
        return;
      }
      setStatus(nextFeatured.includes(matchId) ? "プロフィール掲載に追加しました。" : "プロフィール掲載から外しました。");
    });
  };

  const toggleEditPanel = (id: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>保存季譜</h1>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          保存数 {rows.length}/30
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", justifyContent: "center" }}>
        <Link href="/?menu=learn" style={btnStyle}>学びへ戻る</Link>
      </div>

      {status && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 720, boxSizing: "border-box" }}>
          {status}
        </div>
      )}

      <ul style={{ display: "grid", gap: 8, width: "100%", maxWidth: 720 }}>
        {sortedRows.map(r => {
          const isStarred = starred.has(r.id);
          const isFeatured = featured.has(r.id);
          const isEditing = editingIds.has(r.id);
          const displayName = matchNames[r.id] || "（名前なし）";
          return (
            <li key={r.id} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", boxSizing: "border-box", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <b>{displayName}</b>
                  <div style={{ fontSize: 13, color: "#555" }}>{new Date(r.created_at).toLocaleString()}</div>
                  <div style={{ fontSize: 13 }}>
                    勝者: {r.winner === "p1" ? "先手" : "後手"} / 手数: {r.moves_count}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {isStarred && <span style={badgeStyle}>お気に入り</span>}
                    {isFeatured && <span style={badgeStyle}>プロフィール掲載</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/history/${r.id}`} style={btnStyle}>再生</Link>
                  <button style={btnStyle} onClick={() => toggleEditPanel(r.id)}>
                    {isEditing ? "編集を閉じる" : "編集"}
                  </button>
                </div>
              </div>
              {isEditing && (
                <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{ ...btnStyle, padding: "4px 10px", borderRadius: 999 }}
                      onClick={() => toggleStar(r.id)}
                      aria-pressed={isStarred}
                      title={isStarred ? "お気に入りを解除" : "お気に入りに追加"}
                    >
                      {isStarred ? "★ お気に入り" : "☆ お気に入り"}
                    </button>
                    <button
                      style={btnStyle}
                      onClick={() => toggleFeatured(r.id)}
                      title={isFeatured ? "プロフィール掲載から外す" : "プロフィール掲載に追加"}
                    >
                      {isFeatured ? "掲載中（プロフィール）" : "プロフィールに掲載"}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={draftNames[r.id] ?? ""}
                      onChange={e => setDraftNames(prev => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="季譜名を入力"
                      style={inputStyle}
                    />
                    <button style={btnStyle} onClick={() => saveName(r.id)}>名前を保存</button>
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>季譜ID: {r.id}</div>
                  <div>
                    <button
                      style={btnStyle}
                      disabled={deletingId === r.id}
                      onClick={async () => {
                        const ok = window.confirm("この季譜を削除します。よろしいですか？");
                        if (!ok) return;
                        setDeletingId(r.id);
                        setStatus("");
                        const { error } = await supabase.from("matches").delete().eq("id", r.id);
                        setDeletingId(null);
                        if (error) {
                          setStatus(`季譜の削除に失敗しました。詳細: ${error.message}`);
                          return;
                        }
                        setRows(prev => {
                          const next = prev.filter(x => x.id !== r.id);
                          setStatus(next.length === 0 ? "保存季譜がまだありません。" : "");
                          return next;
                        });
                        setEditingIds(prev => {
                          const next = new Set(prev);
                          next.delete(r.id);
                          return next;
                        });
                        if (userId) {
                          const nextNames = { ...matchNames };
                          delete nextNames[r.id];
                          setMatchNames(nextNames);
                          saveMatchNamesToSupabase(nextNames).then(res => {
                            if (!res.ok) setStatus(`削除後の季譜名保存に失敗しました。詳細: ${res.reason}`);
                          });
                        }
                        setStarred(prev => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id);
                          saveClipPrefsToSupabase({
                            starredIds: Array.from(next),
                            featuredIds: Array.from(featured).filter(id => id !== r.id),
                          }).then(res => {
                            if (!res.ok) setStatus(`削除後の設定保存に失敗しました。詳細: ${res.reason}`);
                          });
                          return next;
                        });
                        setFeatured(prev => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id);
                          return next;
                        });
                      }}
                    >
                      {deletingId === r.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                </div>
              )}
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
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  fontWeight: 700,
  fontSize: 16,
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  minWidth: 0,
  width: "100%",
  flex: "1 1 180px",
  background: "rgba(255,255,255,0.9)",
  boxSizing: "border-box",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--line)",
  background: "rgba(245, 223, 187, 0.45)",
};
