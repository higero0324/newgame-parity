"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTitleById, type TitleRarity } from "@/lib/achievements";

type ProfileRow = {
  user_id: string;
  friend_id: string;
  display_name: string;
  status_message: string;
  icon_text: string;
  icon_image_data_url: string;
  profile_card_template?: string;
  equipped_title_ids?: string[];
  featured_match_ids: string[];
  match_names: Record<string, string>;
};

type CardTemplateId = "classic" | "lacquer" | "paper";

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

  useEffect(() => {
    (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setStatus("ログインが必要です。");
        return;
      }

      const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("user_id, friend_id, display_name, status_message, icon_text, icon_image_data_url, profile_card_template, equipped_title_ids, featured_match_ids, match_names")
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

  const displayName = profile?.display_name || "（名前未設定）";
  const cardTemplate = parseTemplate(profile?.profile_card_template);
  const isDarkCard = cardTemplate === "lacquer";
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

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>フレンドプロフィール</h1>

      <section style={{ ...sectionStyle, ...profileCardTemplateStyles[cardTemplate] }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(72px, 96px) 1fr", gap: 12 }}>
          <Avatar iconText={profile?.icon_text ?? ""} iconImageDataUrl={profile?.icon_image_data_url ?? ""} displayName={displayName} />
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 800, overflowWrap: "anywhere" }}>{displayName}</div>
            <div style={{ fontSize: 14, color: isDarkCard ? "rgba(255,245,230,0.85)" : "#555", overflowWrap: "anywhere" }}>
              {isFriend ? profile?.status_message || "（ステータスメッセージ未設定）" : "フレンドになると詳細が見られます。"}
            </div>
            {isFriend && equippedTitles.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {equippedTitles.map(title => (
                  <span key={title.id} style={{ ...titleChipStyleBase, ...titleChipByRarity[title.rarity] }}>
                    {title.name}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, color: isDarkCard ? "rgba(255,245,230,0.8)" : "#666" }}>フレンドID: {profile?.friend_id ?? "-"}</div>
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
                    未設定
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/friends" style={btnStyle}>フレンド一覧へ</Link>
        <Link href="/" style={btnStyle}>ホームへ戻る</Link>
      </div>

      {status && <div style={sectionStyle}>{status}</div>}
    </main>
  );
}

function Avatar(props: { iconText: string; iconImageDataUrl: string; displayName: string }) {
  if (props.iconImageDataUrl) {
    return <img src={props.iconImageDataUrl} alt="icon" style={{ ...avatarStyle, objectFit: "cover", borderRadius: "50%" }} />;
  }
  const fallback = props.displayName.trim().slice(0, 1).toUpperCase() || "?";
  const text = (props.iconText.trim() || fallback).slice(0, 2);
  return <div style={avatarStyle}>{text}</div>;
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
  width: 96,
  height: 96,
  borderRadius: "50%",
  border: "3px solid #8f6337",
  background: "linear-gradient(180deg, #f8e9d3 0%, #e7c39a 100%)",
  color: "#5d3d1d",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: 34,
  boxShadow: "0 2px 0 rgba(90, 50, 20, 0.25)",
};

function parseTemplate(value: string | undefined): CardTemplateId {
  if (value === "lacquer" || value === "paper") return value;
  return "classic";
}

const profileCardTemplateStyles: Record<CardTemplateId, React.CSSProperties> = {
  classic: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.62) 100%)",
  },
  lacquer: {
    background: "linear-gradient(135deg, rgba(77,36,24,0.9) 0%, rgba(124,74,48,0.82) 45%, rgba(204,150,105,0.8) 100%)",
    color: "#fff7eb",
    borderColor: "#6b3c26",
    boxShadow: "inset 0 0 0 1px rgba(255,220,180,0.2), 0 6px 16px rgba(70,35,20,0.25)",
  },
  paper: {
    background:
      "repeating-linear-gradient(0deg, rgba(255,252,245,0.95) 0px, rgba(255,252,245,0.95) 24px, rgba(236,226,209,0.95) 25px), linear-gradient(180deg, #faf2e4 0%, #efe3d0 100%)",
    borderColor: "#b99f74",
    boxShadow: "0 4px 0 rgba(140, 110, 70, 0.2)",
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
