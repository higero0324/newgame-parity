"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAllTitles, loadAchievementStateForCurrentUser, type TitleDef, type TitleRarity } from "@/lib/achievements";
import { loadCurrentProfilePrefsFromProfiles } from "@/lib/profilePrefs";

type CardTemplateId = "classic" | "lacquer" | "paper" | "modern" | "white";
type WarehouseItemType = "title" | "frame" | "template";

type WarehouseItem = {
  id: string;
  type: WarehouseItemType;
  name: string;
  summary: string;
  unlocked: boolean;
  equipped: boolean;
  rarity?: TitleRarity;
  templateId?: CardTemplateId;
};

const CARD_TEMPLATE_ITEMS: Array<{ id: CardTemplateId; label: string; summary: string }> = [
  { id: "white", label: "白磁カード", summary: "透明感のある白基調のカード。" },
  { id: "classic", label: "欅木目カード", summary: "温かい木目調の定番カード。" },
  { id: "paper", label: "和紙カード", summary: "和紙の風合いを重視した上品なカード。" },
  { id: "lacquer", label: "漆黒蒔絵カード", summary: "重厚で高級感のある漆黒カード。" },
  { id: "modern", label: "雅紺カード", summary: "現代的な紺色グラデーションのカード。" },
];

export default function WarehousePage() {
  const router = useRouter();
  const [status, setStatus] = useState("読み込み中...");
  const [equippedTitleIds, setEquippedTitleIds] = useState<string[]>([]);
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<string[]>([]);
  const [equippedFrameId, setEquippedFrameId] = useState("");
  const [equippedTemplate, setEquippedTemplate] = useState<CardTemplateId>("classic");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.replace("/login");
        return;
      }

      const ach = await loadAchievementStateForCurrentUser();
      if (!ach.ok) {
        setStatus(`倉庫データの取得に失敗しました。詳細: ${ach.reason}`);
        return;
      }
      setUnlockedTitleIds(ach.unlockedTitleIds);
      setEquippedTitleIds(ach.equippedTitleIds);

      const prefs = await loadCurrentProfilePrefsFromProfiles();
      if (prefs.ok) setEquippedFrameId(prefs.prefs.iconFrameId);

      const rawTemplate = String(sessionData.session.user.user_metadata?.profile_card_template ?? "classic");
      if (rawTemplate === "white" || rawTemplate === "classic" || rawTemplate === "paper" || rawTemplate === "lacquer" || rawTemplate === "modern") {
        setEquippedTemplate(rawTemplate);
      }

      setStatus("");
    })();
  }, [router]);

  const items = useMemo<WarehouseItem[]>(() => {
    const allTitles = getAllTitles();
    const titleItems: WarehouseItem[] = allTitles.map((title: TitleDef) => ({
      id: `title:${title.id}`,
      type: "title",
      name: title.name,
      summary: title.description,
      unlocked: unlockedTitleIds.includes(title.id),
      equipped: equippedTitleIds.includes(title.id),
      rarity: title.rarity,
    }));

    const frameItems: WarehouseItem[] = [
      { id: "frame:none", type: "frame", name: "フレームなし", summary: "通常のアイコン表示。", unlocked: true, equipped: equippedFrameId === "" },
      {
        id: "frame:setsugekka_frame",
        type: "frame",
        name: "雪月花フレーム",
        summary: "「夜と雪月花」回収で解放される特別フレーム。",
        unlocked: unlockedTitleIds.includes("extreme_emperor"),
        equipped: equippedFrameId === "setsugekka_frame",
      },
    ];

    const templateItems: WarehouseItem[] = CARD_TEMPLATE_ITEMS.map(t => ({
      id: `template:${t.id}`,
      type: "template",
      name: t.label,
      summary: t.summary,
      unlocked: true,
      equipped: equippedTemplate === t.id,
      templateId: t.id,
    }));

    return [...titleItems, ...frameItems, ...templateItems].filter(item => item.unlocked);
  }, [equippedFrameId, equippedTemplate, equippedTitleIds, unlockedTitleIds]);

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>倉庫</h1>

      <section style={sectionStyle}>
        <div style={{ fontSize: 13, color: "#666" }}>アイテムを押すとその場で詳細が表示されます。</div>
        <div style={gridStyle}>
          {items.map(item => (
            <div key={item.id} style={slotAnchorStyle}>
              <button
                type="button"
                onClick={() => setSelectedItemId(prev => (prev === item.id ? null : item.id))}
                style={{
                  ...slotStyle,
                  ...(selectedItemId === item.id ? selectedSlotStyle : null),
                }}
              >
                <span style={previewWrapStyle}>{renderSlotPreview(item)}</span>
                {item.equipped && <span style={slotBadgeStyle}>使用中</span>}
              </button>
              {selectedItemId === item.id && (
                <div style={slotPopoverStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.25 }}>
                      {item.type === "title" ? "称号" : item.type === "frame" ? "フレーム" : "カードテンプレート"}
                      {" / "}
                      {item.name}
                    </div>
                    <button type="button" onClick={() => setSelectedItemId(null)} style={miniCloseBtnStyle}>×</button>
                  </div>
                  <div style={{ fontSize: 12, color: "#555" }}>{item.summary}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {status && <div style={sectionStyle}>{status}</div>}
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid var(--line)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.6)",
  boxSizing: "border-box",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 96px))",
  justifyContent: "start",
  gap: 7,
  overflow: "visible",
};

const slotStyle: React.CSSProperties = {
  border: "1px solid rgba(90, 60, 30, 0.25)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.78)",
  aspectRatio: "1 / 1",
  width: 96,
  height: 96,
  padding: 6,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  textAlign: "left",
  cursor: "pointer",
};

const selectedSlotStyle: React.CSSProperties = {
  boxShadow: "inset 0 0 0 2px rgba(173, 127, 71, 0.42)",
};

const slotBadgeStyle: React.CSSProperties = {
  justifySelf: "center",
  fontSize: 9,
  borderRadius: 999,
  border: "1px solid rgba(90, 60, 30, 0.35)",
  background: "rgba(245, 223, 187, 0.48)",
  padding: "1px 6px",
  fontWeight: 700,
};

const previewWrapStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  placeItems: "center",
  minHeight: 32,
};

const slotAnchorStyle: React.CSSProperties = {
  position: "relative",
  overflow: "visible",
};

const slotPopoverStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 20,
  top: "calc(100% + 6px)",
  left: 0,
  width: 200,
  maxWidth: "min(72vw, 220px)",
  borderRadius: 10,
  border: "1px solid rgba(120, 80, 40, 0.38)",
  background: "rgba(255, 252, 245, 0.98)",
  boxShadow: "0 10px 24px rgba(40, 24, 12, 0.25)",
  padding: 8,
  display: "grid",
  gap: 6,
};

const miniCloseBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  cursor: "pointer",
  color: "var(--ink)",
  fontWeight: 800,
  lineHeight: 1,
};

const tinyTitleChipByRarity: Record<TitleRarity, React.CSSProperties> = {
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

const tinyTitleChipStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 11,
  fontWeight: 700,
  maxWidth: "100%",
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
};

const framePreviewBaseStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "2px solid #8f6337",
  background: "linear-gradient(180deg, #f8e9d3 0%, #e7c39a 100%)",
  position: "relative",
};

const framePreviewSetsugekkaStyle: React.CSSProperties = {
  position: "absolute",
  inset: -2,
  borderRadius: "50%",
  border: "3px solid #cb9926",
  boxShadow:
    "0 0 0 1px rgba(92, 63, 14, 0.82), 0 0 10px rgba(245, 207, 96, 0.52), inset 0 1px 2px rgba(255, 248, 220, 0.92)",
};

const templatePreviewBaseStyle: React.CSSProperties = {
  width: 44,
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(90, 60, 30, 0.35)",
  boxShadow: "0 2px 4px rgba(35, 20, 10, 0.18)",
};

const templatePreviewStyles: Record<CardTemplateId, React.CSSProperties> = {
  white: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,246,246,0.96) 100%)",
    borderColor: "#d9d9d9",
  },
  classic: {
    background:
      "linear-gradient(180deg, rgba(255,247,230,0.92) 0%, rgba(240,214,171,0.86) 100%), repeating-linear-gradient(8deg, rgba(127,83,42,0.14) 0px, rgba(127,83,42,0.14) 2px, rgba(170,120,70,0.1) 2.5px, rgba(170,120,70,0.1) 6px)",
    borderColor: "#9b6b38",
  },
  lacquer: {
    background:
      "radial-gradient(circle at 90% 10%, rgba(235,194,129,0.3) 0%, rgba(235,194,129,0) 42%), linear-gradient(135deg, #2d0f09 0%, #4b1f14 50%, #7f4325 100%)",
    borderColor: "#5f2f1c",
  },
  paper: {
    background:
      "radial-gradient(circle at 12% 0%, rgba(255,224,186,0.25) 0%, rgba(255,224,186,0) 40%), repeating-linear-gradient(0deg, rgba(252,248,239,0.95) 0px, rgba(252,248,239,0.95) 22px, rgba(236,227,212,0.93) 23px), linear-gradient(180deg, #fbf4e7 0%, #efe5d5 100%)",
    borderColor: "#b8a17f",
  },
  modern: {
    background:
      "radial-gradient(circle at 100% 100%, rgba(202,228,255,0.23) 0%, rgba(202,228,255,0) 45%), radial-gradient(circle at 12% 10%, rgba(176,201,255,0.2) 0%, rgba(176,201,255,0) 38%), linear-gradient(145deg, #1b2741 0%, #2f456f 52%, #5a78ad 100%)",
    borderColor: "#5673a8",
  },
};

function renderSlotPreview(item: WarehouseItem) {
  if (item.type === "title") {
    const rarity = item.rarity ?? "bronze";
    return (
      <span style={{ ...tinyTitleChipStyle, ...tinyTitleChipByRarity[rarity], borderRadius: rarity === "gold" || rarity === "obsidian" ? 6 : 999 }}>
        {item.name}
      </span>
    );
  }

  if (item.type === "frame") {
    const isSnow = item.id === "frame:setsugekka_frame";
    return (
      <span style={{ ...framePreviewBaseStyle, opacity: item.unlocked ? 1 : 0.6 }}>
        {isSnow && <span style={framePreviewSetsugekkaStyle} />}
      </span>
    );
  }

  const templateId = item.templateId ?? "classic";
  return <span style={{ ...templatePreviewBaseStyle, ...templatePreviewStyles[templateId] }} />;
}
