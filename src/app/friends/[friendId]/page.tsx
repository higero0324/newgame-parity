"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTitleById, type TitleDef, type TitleRarity } from "@/lib/achievements";

type ProfileRow = {
  user_id: string;
  friend_id: string;
  display_name: string;
  status_message: string;
  icon_text: string;
  icon_image_data_url: string;
  icon_frame_id?: string;
  profile_card_template?: string;
  equipped_title_ids?: string[];
  featured_match_ids: string[];
  match_names: Record<string, string>;
};

type CardTemplateId = "classic" | "lacquer" | "paper" | "modern" | "white";

type MatchRow = {
  id: string;
  created_at: string;
  winner: string;
  moves_count: number;
  final_board: number[];
};

export default function FriendProfilePage() {
  const params = useParams<{ friendId: string }>();
  const friendId = (params?.friendId ?? "").toUpperCase();
  const [status, setStatus] = useState("読み込み中...");
  const [isFriend, setIsFriend] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [featuredRows, setFeaturedRows] = useState<MatchRow[]>([]);
  const [openTitleId, setOpenTitleId] = useState<string | null>(null);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const titleAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setStatus("ログインが必要です。");
        return;
      }

      const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("user_id, friend_id, display_name, status_message, icon_text, icon_image_data_url, icon_frame_id, profile_card_template, equipped_title_ids, featured_match_ids, match_names")
        .eq("friend_id", friendId)
        .maybeSingle();
      if (targetError) {
        setStatus(`プロフィール取得に失敗しました。詳細: ${targetError.message}`);
        return;
      }
      if (!target) {
        setStatus("そのフレンドIDは見つかりません。");
        return;
      }
      const p = target as ProfileRow;
      setProfile(p);

      if (p.user_id === auth.user.id) {
        setIsFriend(true);
      } else {
        const low = auth.user.id < p.user_id ? auth.user.id : p.user_id;
        const high = auth.user.id < p.user_id ? p.user_id : auth.user.id;
        const { data: frData, error: frError } = await supabase
          .from("friendships")
          .select("user_low_id")
          .eq("user_low_id", low)
          .eq("user_high_id", high)
          .maybeSingle();
        if (frError) {
          setStatus(`フレンド判定に失敗しました。詳細: ${frError.message}`);
          return;
        }
        setIsFriend(Boolean(frData));
      }

      const ids = Array.isArray(p.featured_match_ids) ? p.featured_match_ids.slice(0, 3) : [];
      if (ids.length === 0) {
        setFeaturedRows([]);
        setStatus("");
        return;
      }
      const { data: rows, error: rowsError } = await supabase
        .from("matches")
        .select("id, created_at, winner, moves_count, final_board")
        .eq("user_id", p.user_id)
        .in("id", ids);
      if (rowsError) {
        setStatus(`厳選クリップ取得に失敗しました。詳細: ${rowsError.message}`);
        return;
      }
      const map = new Map(((rows ?? []) as MatchRow[]).map(r => [r.id, r]));
      setFeaturedRows(ids.map(id => map.get(id)).filter((x): x is MatchRow => Boolean(x)));
      setStatus("");
    })();
  }, [friendId]);

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("hisei-bottom-menu-visible", {
        detail: { visible: !cardExpanded },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("hisei-bottom-menu-visible", {
          detail: { visible: true },
        }),
      );
    };
  }, [cardExpanded]);

  useEffect(() => {
    if (!cardExpanded) return;
    const screenOrientation = (screen as { orientation?: { lock?: (type: string) => Promise<void>; unlock?: () => void } }).orientation;
    if (viewport.width <= 900 && screenOrientation?.lock) {
      screenOrientation.lock("landscape").catch(() => {
        // iOS Safari fallback is visual rotation below.
      });
    }
    return () => {
      screenOrientation?.unlock?.();
    };
  }, [cardExpanded, viewport.width]);

  useEffect(() => {
    if (!openTitleId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!titleAreaRef.current?.contains(target)) {
        setOpenTitleId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openTitleId]);

  const displayName = profile?.display_name || "（表示名未設定）";
  const cardTemplate = parseTemplate(profile?.profile_card_template);
  const isDarkCard = cardTemplate === "lacquer" || cardTemplate === "modern";
  const matchNames = profile?.match_names ?? {};
  const equippedTitles = useMemo(() => {
    const ids = Array.isArray(profile?.equipped_title_ids) ? profile?.equipped_title_ids : [];
    return ids.map(id => getTitleById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)).slice(0, 2);
  }, [profile?.equipped_title_ids]);
  const frameRows = useMemo(() => {
    const slots: Array<MatchRow | null> = [null, null, null];
    for (let i = 0; i < 3; i += 1) slots[i] = featuredRows[i] ?? null;
    return slots;
  }, [featuredRows]);
  const isMobilePortraitWhileExpanded = cardExpanded && viewport.width <= 900 && viewport.height > viewport.width;

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>フレンドプロフィール</h1>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", justifyContent: "center" }}>
        <Link href="/friends" style={btnStyle}>友人ページへ戻る</Link>
      </div>

      {cardExpanded && <div style={profileCardBackdropStyle} aria-hidden />}
      <section
        style={{
          ...sectionStyle,
          ...profileCardBaseStyle,
          ...profileCardTemplateStyles[cardTemplate],
          ...profileCardClosedShapeStyle,
          ...(cardExpanded ? profileCardExpandedStyle : null),
          ...(isMobilePortraitWhileExpanded ? profileCardExpandedPortraitMobileStyle : null),
        }}
      >
        {cardExpanded && (
          <button
            type="button"
            onClick={() => setCardExpanded(false)}
            style={profileCardCloseButtonStyle}
            aria-label="拡大表示を閉じる"
          >
            ×
          </button>
        )}
        {!cardExpanded && (
          <button type="button" onClick={() => setCardExpanded(true)} style={profileCardExpandButtonStyle}>
            拡大
          </button>
        )}
        <div style={cardExpanded ? profileTopExpandedStyle : profileTopStyle}>
          <div style={{ ...profileInfoBlockStyle, ...(cardExpanded ? null : profileInfoOffsetForExpandButtonStyle) }}>
            <div style={{ ...profileNameTextStyle, overflowWrap: "anywhere" }}>{displayName}</div>
            <div style={{ ...profileMetaTextStyle, color: isDarkCard ? "rgba(255,245,230,0.8)" : "#666" }}>フレンドID: {profile?.friend_id ?? "-"}</div>
            <div style={{ ...profileStatusTextStyle, color: isDarkCard ? "rgba(255,245,230,0.85)" : "#555", overflowWrap: "anywhere" }}>
              {isFriend ? profile?.status_message || "（ステータスメッセージ未設定）" : "フレンドになると詳細が見られます。"}
            </div>
          </div>
          {isFriend && equippedTitles.length > 0 && (
            <div ref={titleAreaRef} style={profileTitleBlockStyle}>
              <div style={{ ...equippedTitleListStyle, ...equippedTitleListUpperStyle, justifyItems: "end" }}>
                {equippedTitles.map(title => (
                  <div key={title.id} style={titleChipWrapStyle}>
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setOpenTitleId(prev => (prev === title.id ? null : title.id));
                      }}
                      style={{
                        ...titleChipStyleBase,
                        ...titleChipButtonStyle,
                        ...titleChipStyleFor(title),
                        ...(isUpperTitle(title) ? titleChipUpperDisplayStyle : titleChipLowerDisplayStyle),
                        ...(cardExpanded ? expandedTitleChipDisplayStyle : null),
                      }}
                      aria-expanded={openTitleId === title.id}
                    >
                      {title.name}
                    </button>
                    {openTitleId === title.id && (
                      <div style={titlePopoverStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>獲得条件</div>
                        <div>{title.description}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={profileIconBlockStyle}>
            <Avatar
              iconText={profile?.icon_text ?? ""}
              iconImageDataUrl={profile?.icon_image_data_url ?? ""}
              iconFrameId={profile?.icon_frame_id ?? ""}
              displayName={displayName}
              expanded={cardExpanded}
            />
          </div>
        </div>
      </section>

      {isFriend && (
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>厳選クリップ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {frameRows.map((row, idx) => (
              <div key={idx} style={frameStyle}>
                <div style={{ fontSize: 12, color: "#6c5331", fontWeight: 700 }}>CLIP {idx + 1}</div>
                {row ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{matchNames[row.id] || "（名前なし）"}</div>
                    <MiniBoard board={row.final_board} />
                    <Link href={`/history/${row.id}`} style={btnStyle}>再生</Link>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#666", minHeight: 120, display: "grid", placeItems: "center", textAlign: "center" }}>
                    まだ設定されていません
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {status && <div style={sectionStyle}>{status}</div>}
    </main>
  );
}

function Avatar(props: { iconText: string; iconImageDataUrl: string; iconFrameId: string; displayName: string; expanded?: boolean }) {
  const fallback = props.displayName.trim().slice(0, 1).toUpperCase() || "?";
  const text = (props.iconText.trim() || fallback).slice(0, 2);
  const wrapStyle = props.expanded ? avatarWrapExpandedStyle : avatarWrapStyle;
  const bodyStyle = props.expanded ? avatarExpandedStyle : avatarStyle;
  const frameStyle = props.expanded ? setsugekkaFrameExpandedStyle : setsugekkaFrameStyle;
  return (
    <div style={wrapStyle}>
      {props.iconImageDataUrl ? (
        <img src={props.iconImageDataUrl} alt="icon" style={{ ...bodyStyle, objectFit: "cover", borderRadius: "50%" }} />
      ) : (
        <div style={bodyStyle}>{text}</div>
      )}
      {props.iconFrameId === "setsugekka_frame" && <div style={frameStyle} aria-hidden />}
    </div>
  );
}

function MiniBoard({ board }: { board: number[] }) {
  const cells = Array.isArray(board) && board.length === 25 ? board : Array.from({ length: 25 }, () => 0);
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 4 }}>
      <div style={miniBoardStyle}>
        {cells.map((v, i) => (
          <div key={i} style={{ ...miniCellStyle, background: `rgba(120, 78, 40, ${0.08 + Math.min(5, Math.max(0, v)) * 0.14})` }}>
            <span style={{ fontSize: 9, color: v > 0 ? "#3b2713" : "#9b8a78" }}>{toKanji(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toKanji(value: number) {
  if (value <= 0) return "";
  const v = Math.min(5, Math.floor(value));
  return ["", "一", "二", "三", "四", "五"][v] ?? "";
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
  width: "fit-content",
  justifySelf: "center",
};

const frameStyle: React.CSSProperties = {
  border: "8px solid #9b6e3f",
  borderRadius: 12,
  background: "linear-gradient(180deg, #f7e6cf 0%, #edd0a9 100%)",
  boxShadow: "inset 0 0 0 2px #c79f6e, 0 3px 0 rgba(90, 50, 20, 0.25)",
  padding: 8,
  display: "grid",
  gap: 6,
  alignContent: "start",
  textAlign: "center",
};

const miniBoardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 22px)",
  gap: 2,
  border: "2px solid #7a532e",
  padding: 4,
  background: "linear-gradient(180deg, #f5deb9 0%, #e8c89a 100%)",
  borderRadius: 6,
};

const miniCellStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  border: "1px solid rgba(122,83,46,0.45)",
  borderRadius: 3,
  display: "grid",
  placeItems: "center",
};

const avatarStyle: React.CSSProperties = {
  width: "clamp(74px, 18vw, 108px)",
  aspectRatio: "1 / 1",
  borderRadius: "50%",
  border: "3px solid #8f6337",
  background: "linear-gradient(180deg, #f8e9d3 0%, #e7c39a 100%)",
  color: "#5d3d1d",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: "clamp(28px, 5vw, 36px)",
  boxShadow: "0 2px 0 rgba(90, 50, 20, 0.25)",
};

const avatarWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "clamp(74px, 18vw, 108px)",
  aspectRatio: "1 / 1",
};

const avatarExpandedStyle: React.CSSProperties = {
  ...avatarStyle,
  width: "clamp(148px, 30vw, 216px)",
  fontSize: "clamp(52px, 9vw, 72px)",
  borderWidth: 4,
};

const avatarWrapExpandedStyle: React.CSSProperties = {
  ...avatarWrapStyle,
  width: "clamp(148px, 30vw, 216px)",
};

const setsugekkaFrameStyle: React.CSSProperties = {
  position: "absolute",
  inset: -1,
  borderRadius: "50%",
  border: "3px solid #cb9926",
  boxShadow:
    "0 0 0 1px rgba(92, 63, 14, 0.82), 0 2px 6px rgba(90, 62, 18, 0.34), 0 0 14px rgba(245, 207, 96, 0.62), inset 0 1px 2px rgba(255, 248, 220, 0.92), inset 0 -2px 4px rgba(112, 70, 9, 0.52)",
  background: "transparent",
  pointerEvents: "none",
};

const setsugekkaFrameExpandedStyle: React.CSSProperties = {
  ...setsugekkaFrameStyle,
  inset: -2,
  borderWidth: 4,
};

function parseTemplate(value: string | undefined): CardTemplateId {
  if (value === "lacquer" || value === "paper" || value === "modern" || value === "white") return value;
  return "classic";
}

const profileTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content minmax(0, 1fr)",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 4,
  alignItems: "stretch",
  alignContent: "space-between",
  height: "100%",
  position: "relative",
};

const profileTopExpandedStyle: React.CSSProperties = {
  ...profileTopStyle,
  gap: 4,
};

const profileInfoBlockStyle: React.CSSProperties = {
  gridColumn: "1 / 3",
  gridRow: 1,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignSelf: "start",
};

const profileTitleBlockStyle: React.CSSProperties = {
  gridColumn: 2,
  gridRow: 2,
  alignSelf: "end",
  justifySelf: "stretch",
  width: "100%",
  display: "grid",
  gap: 6,
};

const profileIconBlockStyle: React.CSSProperties = {
  gridColumn: 1,
  gridRow: 2,
  alignSelf: "end",
  justifySelf: "start",
};

const profileCardBaseStyle: React.CSSProperties = {
  borderRadius: 16,
  borderWidth: 2,
  padding: "clamp(12px, 3vw, 20px)",
  boxShadow: "0 12px 28px rgba(35, 20, 10, 0.14)",
  overflow: "hidden",
  position: "relative",
  containerType: "inline-size",
};

const profileCardClosedShapeStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  minHeight: "clamp(220px, 42vw, 320px)",
  aspectRatio: "1.9 / 1",
  alignContent: "space-between",
  gridTemplateRows: "auto 1fr auto",
};

const profileCardBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8, 6, 3, 0.55)",
  backdropFilter: "blur(3px)",
  zIndex: 90,
};

const profileCardExpandedStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(1240px, calc(100vw - 20px))",
  maxWidth: "min(1240px, calc(100vw - 20px))",
  height: "min(880px, calc(100dvh - 20px))",
  maxHeight: "min(880px, calc(100dvh - 20px))",
  margin: 0,
  zIndex: 91,
  overflowY: "auto",
};

const profileCardExpandedPortraitMobileStyle: React.CSSProperties = {
  width: "min(96vh, calc(100dvh - 18px))",
  maxWidth: "min(96vh, calc(100dvh - 18px))",
  height: "min(96vw, calc(100vw - 18px))",
  maxHeight: "min(96vw, calc(100vw - 18px))",
  transform: "translate(-50%, -50%) rotate(90deg)",
  transformOrigin: "center center",
};

const profileCardCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: 10,
  zIndex: 2,
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "1px solid rgba(60, 45, 25, 0.4)",
  background: "rgba(255,255,255,0.9)",
  color: "#2a1c10",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const profileCardExpandButtonStyle: React.CSSProperties = {
  ...btnStyle,
  position: "absolute",
  right: 10,
  top: 10,
  zIndex: 1,
};

const profileInfoOffsetForExpandButtonStyle: React.CSSProperties = {
  paddingTop: 36,
};

const profileCardTemplateStyles: Record<CardTemplateId, React.CSSProperties> = {
  white: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,246,246,0.96) 100%)",
    borderColor: "#d9d9d9",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.9), 0 10px 22px rgba(60,60,60,0.12)",
  },
  classic: {
    background:
      "linear-gradient(180deg, rgba(255,247,230,0.92) 0%, rgba(240,214,171,0.86) 100%), repeating-linear-gradient(8deg, rgba(127,83,42,0.14) 0px, rgba(127,83,42,0.14) 2px, rgba(170,120,70,0.1) 2.5px, rgba(170,120,70,0.1) 6px)",
    borderColor: "#9b6b38",
  },
  lacquer: {
    background:
      "radial-gradient(circle at 90% 10%, rgba(235,194,129,0.3) 0%, rgba(235,194,129,0) 42%), linear-gradient(135deg, #2d0f09 0%, #4b1f14 50%, #7f4325 100%)",
    color: "#fff7eb",
    borderColor: "#5f2f1c",
    boxShadow: "inset 0 0 0 1px rgba(255,220,180,0.24), inset 0 0 36px rgba(255,160,90,0.08), 0 12px 26px rgba(50, 24, 12, 0.4)",
  },
  paper: {
    background:
      "radial-gradient(circle at 12% 0%, rgba(255,224,186,0.25) 0%, rgba(255,224,186,0) 40%), repeating-linear-gradient(0deg, rgba(252,248,239,0.95) 0px, rgba(252,248,239,0.95) 22px, rgba(236,227,212,0.93) 23px), linear-gradient(180deg, #fbf4e7 0%, #efe5d5 100%)",
    borderColor: "#b8a17f",
    boxShadow: "inset 0 0 0 1px rgba(170,130,85,0.2), 0 8px 20px rgba(85,60,30,0.14)",
  },
  modern: {
    background:
      "radial-gradient(circle at 100% 100%, rgba(202,228,255,0.23) 0%, rgba(202,228,255,0) 45%), radial-gradient(circle at 12% 10%, rgba(176,201,255,0.2) 0%, rgba(176,201,255,0) 38%), linear-gradient(145deg, #1b2741 0%, #2f456f 52%, #5a78ad 100%)",
    borderColor: "#5673a8",
    color: "#edf4ff",
    boxShadow: "inset 0 0 0 1px rgba(213,233,255,0.24), 0 14px 30px rgba(24,33,56,0.35)",
  },
};

const titleChipStyleBase: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid transparent",
  width: "fit-content",
};

const titleChipButtonStyle: React.CSSProperties = {
  cursor: "pointer",
  textDecoration: "none",
  outline: "none",
};

const titleChipWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-grid",
};

const titlePopoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 30,
  minWidth: 190,
  maxWidth: 260,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(90,70,45,0.35)",
  background: "rgba(255,252,245,0.98)",
  boxShadow: "0 10px 20px rgba(45, 30, 15, 0.2)",
  fontSize: 12,
  lineHeight: 1.5,
  color: "#46331f",
  pointerEvents: "none",
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
  return {
    ...titleChipByRarity[title.rarity],
    borderRadius: isUpperTitle(title) ? 8 : 999,
  };
}

function isUpperTitle(title: TitleDef): boolean {
  return title.rarity === "gold" || title.rarity === "obsidian";
}

const profileNameTextStyle: React.CSSProperties = {
  fontSize: "clamp(18px, 4.2cqw, 24px)",
  fontWeight: 800,
  lineHeight: 1.2,
};

const profileStatusTextStyle: React.CSSProperties = {
  fontSize: "clamp(12px, 2.8cqw, 15px)",
  lineHeight: 1.45,
};

const profileMetaTextStyle: React.CSSProperties = {
  fontSize: "clamp(11px, 2.2cqw, 13px)",
  lineHeight: 1.4,
};

const equippedTitleListStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  maxWidth: "100%",
};

const equippedTitleListUpperStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  justifyItems: "stretch",
  width: "100%",
};

const titleChipUpperDisplayStyle: React.CSSProperties = {
  borderRadius: 8,
  padding: "clamp(10px, 2.4cqw, 14px) clamp(12px, 3.2cqw, 18px)",
  fontSize: "clamp(14px, 2.8cqw, 18px)",
  lineHeight: 1.25,
  width: "100%",
  minWidth: 0,
  textAlign: "center",
  boxSizing: "border-box",
};

const titleChipLowerDisplayStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "clamp(10px, 2.4cqw, 14px) clamp(12px, 3.2cqw, 18px)",
  fontSize: "clamp(14px, 2.8cqw, 18px)",
  lineHeight: 1.25,
  textAlign: "center",
  boxSizing: "border-box",
};

const expandedTitleChipDisplayStyle: React.CSSProperties = {
  minHeight: "clamp(72px, 11vh, 96px)",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
};

