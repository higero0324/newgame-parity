"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  buildAchievementProgress,
  getTitleById,
  loadAchievementStateForCurrentUser,
  type TitleRarity,
} from "@/lib/achievements";

export default function AchievementsPage() {
  const [status, setStatus] = useState("読み込み中...");
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<string[]>([]);
  const [equippedTitleIds, setEquippedTitleIds] = useState<string[]>([]);
  const [statsLoaded, setStatsLoaded] = useState<{
    cpu_wins: { easy: number; medium: number; hard: number; extreme: number };
    total_cpu_wins: number;
    saved_matches: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadAchievementStateForCurrentUser();
      if (!loaded.ok) {
        setStatus(`アチーブメントの読み込みに失敗しました。詳細: ${loaded.reason}`);
        return;
      }
      setUnlockedTitleIds(loaded.unlockedTitleIds);
      setEquippedTitleIds(loaded.equippedTitleIds);
      setStatsLoaded(loaded.stats);
      setStatus("");
    })();
  }, []);

  const equippedTitles = useMemo(() => {
    return equippedTitleIds.map(id => getTitleById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [equippedTitleIds]);

  const progressList = useMemo(() => {
    if (!statsLoaded) return [];
    return buildAchievementProgress(statsLoaded, unlockedTitleIds);
  }, [statsLoaded, unlockedTitleIds]);

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>アチーブメント</h1>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>現在の称号</h2>
        {equippedTitles.length === 0 && <div style={{ color: "#666" }}>プロフィールで装備中の称号はありません。</div>}
        {equippedTitles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {equippedTitles.map(title => (
              <span key={title.id} style={{ ...titleChipStyleBase, ...titleChipByRarity[title.rarity] }}>
                {title.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: "#666" }}>
          装備変更はプロフィールの編集から行えます（最大2つ）。
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>達成状況</h2>
        <div style={{ fontSize: 14, color: "#555" }}>解除済み: {unlockedTitleIds.length} / {progressList.length}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {progressList.map(item => (
            <div key={item.id} style={achievementCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <b>{item.name}</b>
                  <span style={{ fontSize: 13, color: "#666" }}>{item.description}</span>
                </div>
                <span style={{ ...titleChipStyleBase, ...titleChipByRarity[item.title.rarity] }}>
                  {item.title.name}
                </span>
              </div>
              <div style={progressTrackStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${(item.progress / Math.max(1, item.target)) * 100}%`,
                    background: item.done ? "linear-gradient(90deg, #7cbb6c 0%, #2c8a4a 100%)" : "linear-gradient(90deg, #ccb07b 0%, #a27841 100%)",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {item.done ? "達成済み" : `${item.progress} / ${item.target}`}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/profile" style={btnStyle}>プロフィールへ</Link>
        <Link href="/" style={btnStyle}>ホームへ戻る</Link>
      </div>

      {status && <div style={sectionStyle}>{status}</div>}
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  display: "grid",
  gap: 8,
  padding: 12,
  border: "1px solid var(--line)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.6)",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--ink)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};

const achievementCardStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(255,255,255,0.72)",
  display: "grid",
  gap: 6,
};

const progressTrackStyle: React.CSSProperties = {
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(80,70,50,0.15)",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 220ms ease",
};

const titleChipStyleBase: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid transparent",
  width: "fit-content",
};

const titleChipByRarity: Record<TitleRarity, React.CSSProperties> = {
  bronze: {
    background: "linear-gradient(180deg, #f3d7bf 0%, #d6a274 100%)",
    color: "#5c3514",
    borderColor: "#b27a47",
  },
  silver: {
    background: "linear-gradient(180deg, #f4f6f8 0%, #c9d1d9 100%)",
    color: "#213243",
    borderColor: "#9aa6b2",
  },
  gold: {
    background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
    color: "#4b3510",
    borderColor: "#b8891f",
  },
  obsidian: {
    background: "linear-gradient(135deg, #131313 0%, #3a2a1a 45%, #c8a15f 100%)",
    color: "#fff2d9",
    borderColor: "#a57b3d",
    boxShadow: "inset 0 0 0 1px rgba(255,230,180,0.25)",
  },
};
