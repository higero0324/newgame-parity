"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAllTitles, loadAchievementStateForCurrentUser, type TitleDef, type TitleRarity } from "@/lib/achievements";
import { loadCurrentProfilePrefsFromProfiles } from "@/lib/profilePrefs";
import { getAllGachaItems, getOwnedGachaItemsFromMetadata } from "@/lib/gacha";

type CardTemplateId =
  | "classic"
  | "lacquer"
  | "paper"
  | "modern"
  | "white"
  | "gacha_template_kacho"
  | "gacha_template_suiboku"
  | "gacha_template_kinran";
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
  { id: "gacha_template_kacho", label: "花鳥風月カード", summary: "柔らかな桜色と和柄の上品カード。" },
  { id: "gacha_template_suiboku", label: "水墨カード", summary: "墨の流れを思わせる静謐なカード。" },
  { id: "gacha_template_kinran", label: "金襴カード", summary: "金糸のきらめきが映える豪華カード。" },
];

export default function WarehousePage() {
  const router = useRouter();
  const [status, setStatus] = useState("読み込み中...");
  const [equippedTitleIds, setEquippedTitleIds] = useState<string[]>([]);
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<string[]>([]);
  const [equippedFrameId, setEquippedFrameId] = useState("");
  const [equippedTemplate, setEquippedTemplate] = useState<CardTemplateId>("classic");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | WarehouseItemType>("all");
  const [equippedOnly, setEquippedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"default" | "name_asc" | "name_desc">("default");
  const [ownedGacha, setOwnedGacha] = useState<{ frameIds: string[]; templateIds: string[]; titleIds: string[] }>({
    frameIds: [],
    templateIds: [],
    titleIds: [],
  });

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
      if (
        rawTemplate === "white" ||
        rawTemplate === "classic" ||
        rawTemplate === "paper" ||
        rawTemplate === "lacquer" ||
        rawTemplate === "modern" ||
        rawTemplate === "gacha_template_kacho" ||
        rawTemplate === "gacha_template_suiboku" ||
        rawTemplate === "gacha_template_kinran"
      ) {
        setEquippedTemplate(rawTemplate);
      }
      setOwnedGacha(getOwnedGachaItemsFromMetadata(sessionData.session.user.user_metadata));

      setStatus("");
    })();
  }, [router]);

  const items = useMemo<WarehouseItem[]>(() => {
    const allTitles = getAllTitles();
    const gachaMap = new Map(getAllGachaItems().map(x => [x.id, x]));
    const titleItems: WarehouseItem[] = allTitles.map((title: TitleDef) => ({
      id: `title:${title.id}`,
      type: "title",
      name: title.name,
      summary: title.description,
      unlocked: unlockedTitleIds.includes(title.id),
      equipped: equippedTitleIds.includes(title.id),
      rarity: title.rarity,
    }));
    const gachaTitleItems: WarehouseItem[] = ownedGacha.titleIds
      .map(id => gachaMap.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .map(item => ({
        id: `title:${item.id}`,
        type: "title" as const,
        name: item.name,
        summary: "祈願で獲得した称号。",
        unlocked: true,
        equipped: false,
        rarity: "bronze" as const,
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
      ...ownedGacha.frameIds
        .map(id => gachaMap.get(id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map(item => ({
          id: `frame:${item.id}`,
          type: "frame" as const,
          name: item.name,
          summary: "祈願で獲得したアイコンフレーム。",
          unlocked: true,
          equipped: equippedFrameId === item.id,
        })),
    ];

    const templateItems: WarehouseItem[] = CARD_TEMPLATE_ITEMS
      .filter(t => {
        if (t.id === "gacha_template_kacho" || t.id === "gacha_template_suiboku" || t.id === "gacha_template_kinran") {
          return ownedGacha.templateIds.includes(t.id);
        }
        return true;
      })
      .map(t => ({
        id: `template:${t.id}`,
        type: "template" as const,
        name: t.label,
        summary: t.summary,
        unlocked: true,
        equipped: equippedTemplate === t.id,
        templateId: t.id,
      }));

    return [...titleItems, ...gachaTitleItems, ...frameItems, ...templateItems].filter(item => item.unlocked);
  }, [equippedFrameId, equippedTemplate, equippedTitleIds, unlockedTitleIds, ownedGacha]);

  const filteredSortedItems = useMemo(() => {
    let next = items.slice();
    if (filterType !== "all") {
      next = next.filter(item => item.type === filterType);
    }
    if (equippedOnly) {
      next = next.filter(item => item.equipped);
    }
    if (sortMode === "name_asc") {
      next.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    } else if (sortMode === "name_desc") {
      next.sort((a, b) => b.name.localeCompare(a.name, "ja"));
    }
    return next;
  }, [items, filterType, equippedOnly, sortMode]);

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>倉庫</h1>

      <section style={sectionStyle}>
        <div style={{ fontSize: 13, color: "#666" }}>アイテムを押すとその場で詳細が表示されます。</div>
        <div style={toolbarStyle}>
          <label style={toolbarFieldStyle}>
            <span style={toolbarLabelStyle}>絞り込み</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value as "all" | WarehouseItemType)} style={toolbarSelectStyle}>
              <option value="all">すべて</option>
              <option value="title">称号</option>
              <option value="frame">フレーム</option>
              <option value="template">カード</option>
            </select>
          </label>
          <label style={toolbarFieldStyle}>
            <span style={toolbarLabelStyle}>並び替え</span>
            <select value={sortMode} onChange={e => setSortMode(e.target.value as "default" | "name_asc" | "name_desc")} style={toolbarSelectStyle}>
              <option value="default">標準</option>
              <option value="name_asc">名前順（昇順）</option>
              <option value="name_desc">名前順（降順）</option>
            </select>
          </label>
          <label style={toolbarCheckStyle}>
            <input type="checkbox" checked={equippedOnly} onChange={e => setEquippedOnly(e.target.checked)} />
            装備中のみ
          </label>
          <div style={toolbarCountStyle}>{filteredSortedItems.length} 件</div>
        </div>
        <div style={gridStyle}>
          {filteredSortedItems.map(item => (
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
  gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
  justifyContent: "start",
  gap: 7,
  overflow: "visible",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "end",
  padding: "6px 0 2px",
};

const toolbarFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const toolbarLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6a5a46",
  fontWeight: 700,
};

const toolbarSelectStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 8,
  border: "1px solid rgba(120, 80, 40, 0.35)",
  background: "rgba(255,255,255,0.9)",
  color: "var(--ink)",
  padding: "0 8px",
};

const toolbarCheckStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  height: 30,
  fontSize: 12,
  color: "#5e4a33",
  marginLeft: 2,
};

const toolbarCountStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 12,
  color: "#6a5a46",
  fontWeight: 700,
};

const slotStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(90, 60, 30, 0.25)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.78)",
  aspectRatio: "1 / 1",
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
  width: "100%",
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

const framePreviewSakuraStyle: React.CSSProperties = {
  position: "absolute",
  inset: -2,
  borderRadius: "50%",
  border: "3px solid #d79db7",
  boxShadow: "0 0 0 1px rgba(106, 58, 74, 0.72), 0 0 12px rgba(237, 176, 205, 0.7)",
};

const framePreviewGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: -2,
  borderRadius: "50%",
  border: "3px solid #fff",
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
  gacha_template_kacho: {
    background:
      "radial-gradient(circle at 85% 20%, rgba(255,176,194,0.26) 0%, rgba(255,176,194,0) 40%), linear-gradient(145deg, #fdf1e2 0%, #f7d9c4 52%, #efc1a6 100%)",
    borderColor: "#c98c72",
  },
  gacha_template_suiboku: {
    background:
      "repeating-linear-gradient(18deg, rgba(40,40,40,0.18) 0px, rgba(40,40,40,0.18) 2px, rgba(240,240,240,0.9) 2px, rgba(240,240,240,0.9) 8px), linear-gradient(180deg, #f4f4f4 0%, #dedede 100%)",
    borderColor: "#9ea4aa",
  },
  gacha_template_kinran: {
    background:
      "radial-gradient(circle at 10% 0%, rgba(255,238,187,0.35) 0%, rgba(255,238,187,0) 45%), linear-gradient(135deg, #4a1f09 0%, #7a3816 45%, #c99737 100%)",
    borderColor: "#9d6a26",
  },
};

function renderSlotPreview(item: WarehouseItem) {
  if (item.type === "title") {
    if (item.id === "title:shogo_conqueror") {
      return (
        <span
          style={{
            ...tinyTitleChipStyle,
            background: "linear-gradient(145deg, #250a0f 0%, #5c1320 56%, #2a090d 100%)",
            color: "#f4cf7b",
            borderColor: "#d9b35e",
            borderRadius: 6,
            boxShadow: "inset 0 0 0 1px rgba(248, 223, 161, 0.24), 0 0 8px rgba(217, 179, 94, 0.22)",
          }}
        >
          {item.name}
        </span>
      );
    }
    const rarity = item.rarity ?? "bronze";
    return (
      <span style={{ ...tinyTitleChipStyle, ...tinyTitleChipByRarity[rarity], borderRadius: rarity === "gold" || rarity === "obsidian" ? 6 : 999 }}>
        {item.name}
      </span>
    );
  }

  if (item.type === "frame") {
    const isSnow = item.id === "frame:setsugekka_frame";
    const isSakura = item.id === "frame:sakura_frame";
    const isGlowRed = item.id === "frame:glow_red_frame";
    const isGlowBlue = item.id === "frame:glow_blue_frame";
    const isGlowGreen = item.id === "frame:glow_green_frame";
    return (
      <span style={{ ...framePreviewBaseStyle, opacity: item.unlocked ? 1 : 0.6 }}>
        {isSnow && <span style={framePreviewSetsugekkaStyle} />}
        {isSakura && <span style={framePreviewSakuraStyle} />}
        {isGlowRed && <span style={{ ...framePreviewGlowStyle, borderColor: "#dd3e46", boxShadow: "0 0 10px #dd3e46" }} />}
        {isGlowBlue && <span style={{ ...framePreviewGlowStyle, borderColor: "#3f8cff", boxShadow: "0 0 10px #3f8cff" }} />}
        {isGlowGreen && <span style={{ ...framePreviewGlowStyle, borderColor: "#2da46f", boxShadow: "0 0 10px #2da46f" }} />}
      </span>
    );
  }

  const templateId = item.templateId ?? "classic";
  return <span style={{ ...templatePreviewBaseStyle, ...templatePreviewStyles[templateId] }} />;
}
