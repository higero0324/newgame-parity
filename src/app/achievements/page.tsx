"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  type AchievementStats,
  buildAchievementProgress,
  claimTitleForCurrentUser,
  getTitleById,
  loadAchievementStateForCurrentUser,
  type TitleDef,
  type TitleRarity,
} from "@/lib/achievements";
import kisekiIcon from "@/app/kiseki.png";

type ClaimItem = {
  id: string;
  label: string;
  kind: "title" | "frame" | "kiseki" | "xp";
};

export default function AchievementsPage() {
  const [status, setStatus] = useState("読み込み中...");
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<string[]>([]);
  const [equippedTitleIds, setEquippedTitleIds] = useState<string[]>([]);
  const [claimableTitleIds, setClaimableTitleIds] = useState<string[]>([]);
  const [claimableKisekiTitleIds, setClaimableKisekiTitleIds] = useState<string[]>([]);
  const [claimableXpTitleIds, setClaimableXpTitleIds] = useState<string[]>([]);
  const [achievementKisekiReward, setAchievementKisekiReward] = useState(250);
  const [achievementXpReward, setAchievementXpReward] = useState(500);
  const [statsLoaded, setStatsLoaded] = useState<AchievementStats | null>(null);
  const [claimReveal, setClaimReveal] = useState<{ title: TitleDef; items: ClaimItem[] } | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadAchievementStateForCurrentUser();
      if (!loaded.ok) {
        setStatus(`アチーブメントの読み込みに失敗しました。詳細: ${loaded.reason}`);
        return;
      }
      setUnlockedTitleIds(loaded.unlockedTitleIds);
      setEquippedTitleIds(loaded.equippedTitleIds);
      setClaimableTitleIds(loaded.claimableTitleIds);
      setClaimableKisekiTitleIds(loaded.claimableKisekiTitleIds);
      setClaimableXpTitleIds(loaded.claimableXpTitleIds);
      setAchievementKisekiReward(loaded.achievementKisekiReward);
      setAchievementXpReward(loaded.achievementXpReward);
      setStatsLoaded(loaded.stats);
      setStatus("");
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  const equippedTitles = useMemo(() => {
    return equippedTitleIds.map(id => getTitleById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [equippedTitleIds]);

  const progressList = useMemo(() => {
    if (!statsLoaded) return [];
    return buildAchievementProgress(statsLoaded, unlockedTitleIds);
  }, [statsLoaded, unlockedTitleIds]);

  const claimableKisekiSet = useMemo(() => new Set(claimableKisekiTitleIds), [claimableKisekiTitleIds]);
  const claimableXpSet = useMemo(() => new Set(claimableXpTitleIds), [claimableXpTitleIds]);
  const claimableAnyCount = useMemo(
    () => new Set([...claimableTitleIds, ...claimableKisekiTitleIds, ...claimableXpTitleIds]).size,
    [claimableTitleIds, claimableKisekiTitleIds, claimableXpTitleIds],
  );
  const sortedProgressList = useMemo(() => {
    return progressList
      .map((item, index) => {
        const canClaim =
          item.done &&
          (!item.claimed || claimableKisekiSet.has(item.title.id) || claimableXpSet.has(item.title.id));
        const priority = canClaim ? 0 : item.done ? 2 : 1;
        return { item, index, priority };
      })
      .sort((a, b) => a.priority - b.priority || a.index - b.index)
      .map(x => x.item);
  }, [progressList, claimableKisekiSet, claimableXpSet]);

  const claim = async (titleId: string) => {
    const res = await claimTitleForCurrentUser(titleId);
    if (!res.ok) {
      setStatus(`回収に失敗しました。詳細: ${res.reason}`);
      return;
    }
    const loaded = await loadAchievementStateForCurrentUser();
    if (!loaded.ok) {
      setStatus(`再読み込みに失敗しました。詳細: ${loaded.reason}`);
      return;
    }
    setUnlockedTitleIds(loaded.unlockedTitleIds);
    setEquippedTitleIds(loaded.equippedTitleIds);
    setClaimableTitleIds(loaded.claimableTitleIds);
    setClaimableKisekiTitleIds(loaded.claimableKisekiTitleIds);
    setClaimableXpTitleIds(loaded.claimableXpTitleIds);
    setAchievementKisekiReward(loaded.achievementKisekiReward);
    setAchievementXpReward(loaded.achievementXpReward);
    setStatsLoaded(loaded.stats);

    const rewardParts: string[] = [];
    if (res.titleClaimedNow) rewardParts.push("称号");
    if (res.kisekiClaimedNow) rewardParts.push(`季石 +${res.kisekiReward}`);
    if (res.xpClaimedNow) rewardParts.push(`EXP +${res.xpReward}`);
    if (res.levelUps > 0) rewardParts.push(`ランクアップ +${res.levelUps}`);
    setStatus(rewardParts.length > 0 ? `回収しました: ${rewardParts.join(" / ")}` : "回収済みです。");

    const title = getTitleById(titleId);
    if (title) {
      setClaimReveal({
        title,
        items: buildClaimRevealItems(
          title,
          res.titleClaimedNow,
          res.kisekiClaimedNow,
          res.kisekiReward,
          res.xpClaimedNow,
          res.xpReward,
        ),
      });
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      revealTimerRef.current = window.setTimeout(() => {
        setClaimReveal(null);
        revealTimerRef.current = null;
      }, 1800);
    }
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>アチーブメント</h1>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>現在の称号</h2>
        {equippedTitles.length === 0 && <div style={{ color: "#666" }}>プロフィールで装備中の称号はありません。</div>}
        {equippedTitles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {equippedTitles.map(title => (
              <span key={title.id} style={{ ...titleChipStyleBase, ...titleChipStyleFor(title) }}>
                {title.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: "#666" }}>
          装備変更はプロフィールの設定画面から行えます（最大2つ）。
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>達成状況</h2>
        <div style={{ fontSize: 14, color: "#555" }}>回収済み: {unlockedTitleIds.length} / {progressList.length}</div>
        {claimableAnyCount > 0 && (
          <div style={{ fontSize: 13, color: "#8b3d4d", fontWeight: 700 }}>
            回収待ちの報酬があります（{claimableAnyCount}件）
          </div>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {sortedProgressList.map(item => {
            const hasPendingSubReward = claimableKisekiSet.has(item.title.id) || claimableXpSet.has(item.title.id);
            const canClaim = item.done && (!item.claimed || hasPendingSubReward);
            const isClaimedComplete = item.done && item.claimed && !hasPendingSubReward;

            return (
              <div
                key={item.id}
                style={{
                  ...achievementCardStyle,
                  ...(canClaim ? achievementClaimableCardStyle : null),
                  ...(isClaimedComplete ? achievementClaimedCardStyle : null),
                }}
                onClick={() => {
                  if (canClaim) claim(item.title.id);
                }}
                role={canClaim ? "button" : undefined}
                aria-label={canClaim ? `${item.name} の報酬を回収` : undefined}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    <b>{item.name}</b>
                    <span style={{ fontSize: 13, color: "#666" }}>{item.description}</span>
                  </div>
                  <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ ...titleChipStyleBase, ...titleChipStyleFor(item.title) }}>
                      {item.title.name}
                    </span>
                    <span style={kisekiRewardChipStyle}>
                      <Image src={kisekiIcon} alt="季石" width={12} height={12} />
                      +{achievementKisekiReward}
                    </span>
                    <span style={xpRewardChipStyle}>EXP +{achievementXpReward}</span>
                  </div>
                </div>
                <div style={progressTrackStyle}>
                  <div
                    style={{
                      ...progressFillStyle,
                      width: `${(item.progress / Math.max(1, item.target)) * 100}%`,
                      background: item.done
                        ? "linear-gradient(90deg, #7cbb6c 0%, #2c8a4a 100%)"
                        : "linear-gradient(90deg, #ccb07b 0%, #a27841 100%)",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  {!item.done ? `${item.progress} / ${item.target}` : canClaim ? "達成済み・タップで回収" : "達成・回収済み"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {status && <div style={sectionStyle}>{status}</div>}

      {claimReveal && (
        <div style={claimRevealOverlayStyle} aria-live="polite">
          <div style={claimRevealCardStyle}>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>獲得アイテム</div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
              {claimReveal.title.name}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {claimReveal.items.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...claimRevealItemStyle,
                    ...(item.kind === "title"
                      ? titleChipStyleFor(claimReveal.title)
                      : item.kind === "frame"
                        ? claimRevealFrameItemStyle
                        : item.kind === "kiseki"
                          ? claimRevealKisekiItemStyle
                          : claimRevealXpItemStyle),
                  }}
                >
                  {item.kind === "title" ? "称号: " : item.kind === "frame" ? "フレーム: " : item.kind === "xp" ? "EXP: " : ""}
                  {item.kind === "kiseki" && (
                    <Image src={kisekiIcon} alt="季石" width={14} height={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  )}
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

const achievementCardStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(255,255,255,0.72)",
  display: "grid",
  gap: 6,
};

const achievementClaimableCardStyle: React.CSSProperties = {
  cursor: "pointer",
  borderColor: "#d2a318",
  background: "linear-gradient(180deg, rgba(255,247,199,0.95) 0%, rgba(255,236,156,0.85) 100%)",
  boxShadow: "inset 0 0 0 1px rgba(255, 213, 79, 0.55)",
};

const achievementClaimedCardStyle: React.CSSProperties = {
  borderColor: "rgba(105, 105, 105, 0.35)",
  background: "linear-gradient(180deg, rgba(242,242,242,0.9) 0%, rgba(228,228,228,0.86) 100%)",
  color: "#5a5a5a",
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
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  border: "1px solid transparent",
  width: "fit-content",
};

const kisekiRewardChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  border: "1px solid #b8891f",
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
};

const xpRewardChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  border: "1px solid #5a6fb8",
  background: "linear-gradient(180deg, #ecf4ff 0%, #b7ccff 100%)",
  color: "#1f2d54",
};

const claimRevealOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  padding: 16,
};

const claimRevealCardStyle: React.CSSProperties = {
  minWidth: "min(90vw, 340px)",
  maxWidth: 520,
  textAlign: "center",
  border: "2px solid rgba(80, 50, 20, 0.35)",
  borderRadius: 14,
  background: "rgba(255, 251, 242, 0.96)",
  boxShadow: "0 14px 32px rgba(35, 20, 10, 0.32)",
  padding: "16px 20px",
};

const claimRevealItemStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: 800,
  fontSize: 14,
  textAlign: "center",
};

const claimRevealFrameItemStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1b1f31 0%, #5b4f78 55%, #d9c7ff 100%)",
  color: "#fff",
  borderColor: "#7c67b2",
  boxShadow: "inset 0 0 0 1px rgba(240, 228, 255, 0.35)",
};

const claimRevealKisekiItemStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
  borderColor: "#b8891f",
};

const claimRevealXpItemStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #ecf4ff 0%, #b7ccff 100%)",
  color: "#1f2d54",
  borderColor: "#5a6fb8",
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

function titleChipStyleFor(title: TitleDef): React.CSSProperties {
  if (title.id === "rookie_winner") {
    return {
      background: "linear-gradient(180deg, #ffe6ef 0%, #f7bfd1 100%)",
      color: "#6f2d43",
      borderColor: "#d78ea8",
      borderRadius: 999,
    };
  }
  if (title.id === "shogo_conqueror") {
    return {
      background: "linear-gradient(145deg, #250a0f 0%, #5c1320 56%, #2a090d 100%)",
      color: "#f4cf7b",
      borderColor: "#d9b35e",
      boxShadow: "inset 0 0 0 1px rgba(248, 223, 161, 0.24), 0 0 10px rgba(217, 179, 94, 0.25)",
      borderRadius: 8,
    };
  }
  const isUpper = title.rarity === "gold" || title.rarity === "obsidian";
  return {
    ...titleChipByRarity[title.rarity],
    borderRadius: isUpper ? 8 : 999,
  };
}

function buildClaimRevealItems(
  title: TitleDef,
  titleClaimedNow: boolean,
  kisekiClaimedNow: boolean,
  kisekiReward: number,
  xpClaimedNow: boolean,
  xpReward: number,
): ClaimItem[] {
  const items: ClaimItem[] = [];
  if (titleClaimedNow) {
    items.push({ id: `title:${title.id}`, label: title.name, kind: "title" });
  }
  if (title.id === "extreme_emperor" && titleClaimedNow) {
    items.push({ id: "frame:setsugekka_frame", label: "雪月花フレーム", kind: "frame" });
  }
  if (kisekiClaimedNow) {
    items.push({ id: `kiseki:${title.id}`, label: `季石 +${kisekiReward}`, kind: "kiseki" });
  }
  if (xpClaimedNow) {
    items.push({ id: `xp:${title.id}`, label: `+${xpReward}`, kind: "xp" });
  }
  if (items.length === 0) {
    items.push({ id: `title:${title.id}:noop`, label: "回収済み", kind: "title" });
  }
  return items;
}
