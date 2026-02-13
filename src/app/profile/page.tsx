"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ensureFriendIdForCurrentUser,
  loadCurrentProfilePrefsFromProfiles,
  loadIconImageDataUrlFromProfiles,
  getProfilePrefsFromUserMetadata,
  saveIconImageDataUrlToProfiles,
  saveClipPrefsToSupabase,
} from "@/lib/profilePrefs";

type MatchRow = {
  id: string;
  created_at: string;
  winner: string;
  moves_count: number;
  final_board: number[];
};

type UserMeta = {
  display_name?: string;
  status_message?: string;
  profile_card_template?: string;
};

type CardTemplateId = "classic" | "lacquer" | "paper";

export default function ProfilePage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [matchNames, setMatchNames] = useState<Record<string, string>>({});
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [starredIdsForSave, setStarredIdsForSave] = useState<string[]>([]);
  const [iconText, setIconText] = useState("");
  const [iconImageDataUrl, setIconImageDataUrl] = useState("");
  const [iconImageStatus, setIconImageStatus] = useState("");
  const [iconFileName, setIconFileName] = useState("");
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [clipsEditOpen, setClipsEditOpen] = useState(false);
  const [cardTemplate, setCardTemplate] = useState<CardTemplateId>("classic");

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          router.replace("/login");
          return;
        }
        const currentUser = sessionData.session.user;

        setUserId(currentUser.id);
        setEmail(currentUser.email ?? "");

        const meta = (currentUser.user_metadata ?? {}) as UserMeta;
        setDisplayName(meta.display_name ?? "");
        setStatusMessage(meta.status_message ?? "");
        setCardTemplate(parseTemplate(meta.profile_card_template));

        const profilePrefs = getProfilePrefsFromUserMetadata(currentUser.user_metadata);
        const loaded = await loadCurrentProfilePrefsFromProfiles();
        if (loaded.ok) {
          setMatchNames(loaded.prefs.matchNames);
          setFeaturedIds(loaded.prefs.featuredIds);
          setStarredIdsForSave(loaded.prefs.starredIds);
        } else {
          setMatchNames({});
          setFeaturedIds([]);
          setStarredIdsForSave([]);
          setStatus(`プロフィール設定の取得に失敗しました。詳細: ${loaded.reason}`);
        }
        setIconText(profilePrefs.iconText);
        const iconRes = await loadIconImageDataUrlFromProfiles();
        if (iconRes.ok) setIconImageDataUrl(iconRes.iconImageDataUrl);
        else setIconImageDataUrl(profilePrefs.iconImageDataUrl);

        const { data, error } = await supabase
          .from("matches")
          .select("id, created_at, winner, moves_count, final_board")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) {
          setStatus(`プロフィール読み込みに失敗しました。詳細: ${error.message}`);
          return;
        }

        setRows((data ?? []) as MatchRow[]);
      } catch (err) {
        const e = err as { message?: string };
        setStatus(`プロフィール読み込み中にエラーが発生しました。詳細: ${e.message ?? "unknown error"}`);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [router]);

  const featuredRows = useMemo(() => {
    const byId = new Map(rows.map(row => [row.id, row]));
    return featuredIds.map(id => byId.get(id)).filter((x): x is MatchRow => Boolean(x));
  }, [rows, featuredIds]);

  const saveProfile = async () => {
    setSaving(true);
    setStatus("");
    try {
      const imageRes = await saveIconImageDataUrlToProfiles(iconImageDataUrl);
      if (!imageRes.ok) {
        setStatus(`画像アイコンの保存に失敗しました。詳細: ${imageRes.reason}`);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          status_message: statusMessage.trim(),
          icon_text: iconText.trim().slice(0, 2),
          profile_card_template: cardTemplate,
          // Keep auth JWT small for mobile Safari by not storing image data in user_metadata.
          icon_image_data_url: "",
        },
      });
      if (error) {
        setStatus(`プロフィール保存に失敗しました。詳細: ${error.message}`);
        return;
      }
      if (userId) {
        const ensured = await ensureFriendIdForCurrentUser();
        if (!ensured.ok) {
          setStatus(`フレンドIDの準備に失敗しました。詳細: ${ensured.reason}`);
          return;
        }
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            user_id: userId,
            friend_id: ensured.friendId,
            display_name: displayName.trim(),
            status_message: statusMessage.trim(),
            icon_text: iconText.trim().slice(0, 2),
            profile_card_template: cardTemplate,
          },
          { onConflict: "user_id" },
        );
        if (profileError) {
          setStatus(`公開プロフィール同期に失敗しました。詳細: ${profileError.message}`);
          return;
        }
      }
      setStatus("プロフィールを保存しました。");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    setStatus("");
    try {
      const signOutResult = await Promise.race([
        supabase.auth.signOut(),
        new Promise<{ error: { message: string } }>(resolve =>
          setTimeout(() => resolve({ error: { message: "timeout" } }), 4000),
        ),
      ]);
      const { error } = signOutResult;
      if (error) {
        // Mobile Safari sometimes keeps stale state; fallback to hard navigate.
        window.location.href = "/";
        return;
      }
      router.push("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const frameRows = useMemo(() => {
    const slots: Array<MatchRow | null> = [null, null, null];
    for (let i = 0; i < 3; i += 1) {
      slots[i] = featuredRows[i] ?? null;
    }
    return slots;
  }, [featuredRows]);
  const isDarkCard = cardTemplate === "lacquer";
  const mutedTextColor = isDarkCard ? "rgba(255,245,230,0.85)" : "#555";
  const lightTextColor = isDarkCard ? "rgba(255,245,230,0.8)" : "#666";

  const onToggleFeaturedWithStar = (matchId: string) => {
    if (!userId) return;
    const current = [...featuredIds];
    let next: string[];
    if (current.includes(matchId)) {
      next = current.filter(id => id !== matchId);
    } else {
      if (current.length >= 3) {
        setStatus("厳選クリップは3件まで選択できます。");
        return;
      }
      next = [...current, matchId];
    }
    setFeaturedIds(next);
    saveClipPrefsToSupabase({ starredIds: starredIdsForSave, featuredIds: next }).then(res => {
      if (!res.ok) setStatus(`厳選クリップの保存に失敗しました。詳細: ${res.reason}`);
    });
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>プロフィール</h1>
      {loadingProfile && (
        <div style={{ width: "100%", maxWidth: 760, fontSize: 14, color: "#666" }}>読み込み中...</div>
      )}

      <section style={{ ...sectionStyle, ...profileCardTemplateStyles[cardTemplate] }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>基本情報</h2>
          <button style={btnStyle} onClick={() => setProfileEditOpen(v => !v)}>
            {profileEditOpen ? "編集を閉じる" : "編集"}
          </button>
        </div>
        <div style={profileTopStyle}>
          <Avatar iconText={iconText} iconImageDataUrl={iconImageDataUrl} displayName={displayName} email={email} />
          <div style={{ display: "grid", gap: 6, alignContent: "start", overflowWrap: "anywhere" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{displayName || "（未設定）"}</div>
            <div style={{ fontSize: 14, color: mutedTextColor }}>{statusMessage || "（ステータスメッセージ未設定）"}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: lightTextColor }}>ログイン中: {email || "(不明)"}</div>
        {profileEditOpen && (
          <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>名前</span>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} placeholder="表示名を入力" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>ステータスメッセージ</span>
              <textarea
                value={statusMessage}
                onChange={e => setStatusMessage(e.target.value)}
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="ひとこと"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>アイコン文字（1〜2文字。空欄なら名前の頭文字）</span>
              <input value={iconText} onChange={e => setIconText(e.target.value)} style={inputStyle} placeholder="例: 😀 / H" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>カードテンプレート</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {cardTemplateOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCardTemplate(opt.id)}
                    style={{
                      ...templateChipStyle,
                      ...(cardTemplate === opt.id ? templateChipActiveStyle : null),
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>アイコン画像（任意）</span>
              <label style={filePickLabelStyle}>
                画像を選ぶ
                <input
                  type="file"
                  accept="image/*"
                  style={hiddenFileInputStyle}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIconFileName(file.name);
                    try {
                      const dataUrl = await resizeImageToDataUrl(file);
                      setIconImageDataUrl(dataUrl);
                      setIconImageStatus("画像を設定しました。保存で反映されます。");
                    } catch {
                      setIconImageStatus("画像の読み込みに失敗しました。");
                    } finally {
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </label>
              <div style={{ fontSize: 12, color: "#666" }}>
                {iconFileName ? `選択中: ${iconFileName}` : "未選択"}
              </div>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={btnStyle}
                onClick={() => {
                  setIconImageDataUrl("");
                  setIconFileName("");
                  setIconImageStatus("画像アイコンを解除しました。");
                }}
              >
                画像を解除
              </button>
              {iconImageStatus && <span style={{ fontSize: 13, color: "#666" }}>{iconImageStatus}</span>}
            </div>
            <button onClick={saveProfile} disabled={saving} style={btnStyle}>
              {saving ? "保存中..." : "プロフィールを保存"}
            </button>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>厳選クリップ</h2>
          <button style={btnStyle} onClick={() => setClipsEditOpen(v => !v)}>
            {clipsEditOpen ? "編集を閉じる" : "編集"}
          </button>
        </div>
        <div style={{ fontSize: 14, color: "#666" }}>{featuredRows.length}/3 件</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {frameRows.map((row, idx) => (
            <div key={idx} style={frameStyle}>
              <div style={{ fontSize: 12, color: "#6c5331", fontWeight: 700 }}>CLIP {idx + 1}</div>
              {row ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{matchNames[row.id] || "（名前なし）"}</div>
                  <MiniBoard board={row.final_board} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    <Link href={`/history/${row.id}`} style={btnStyle}>再生</Link>
                    {clipsEditOpen && <button onClick={() => onToggleFeaturedWithStar(row.id)} style={btnStyle}>外す</button>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#666", minHeight: 120, display: "grid", placeItems: "center", textAlign: "center" }}>
                  まだ設定されていません
                </div>
              )}
            </div>
          ))}
        </div>
        {clipsEditOpen && (
          <>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, fontWeight: 700 }}>保存棋譜から選ぶ</div>
            <ul style={{ display: "grid", gap: 8, width: "100%", paddingLeft: 18 }}>
              {rows.map(row => {
                const selected = featuredIds.includes(row.id);
                return (
                  <li key={row.id}>
                    <div><b>{matchNames[row.id] || "（名前なし）"}</b></div>
                    <div style={{ fontSize: 13 }}>
                      {new Date(row.created_at).toLocaleString()} / 勝者: {row.winner === "p1" ? "先手" : "後手"} / 手数: {row.moves_count}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => onToggleFeaturedWithStar(row.id)} style={btnStyle}>
                        {selected ? "掲載を外す" : "厳選クリップに追加"}
                      </button>
                      <Link href={`/history/${row.id}`} style={btnStyle}>再生</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <div style={{ width: "100%", maxWidth: 760, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", boxSizing: "border-box" }}>
        <button onClick={logout} disabled={loggingOut} style={btnStyle}>
          {loggingOut ? "ログアウト中..." : "ログアウト"}
        </button>
        <Link href="/friends" style={btnStyle}>フレンド</Link>
        <Link href="/" style={btnStyle}>ホームへ戻る</Link>
        <Link href="/history" style={btnStyle}>保存棋譜へ</Link>
      </div>

      {status && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 760 }}>
          {status}
        </div>
      )}
    </main>
  );
}

function Avatar(props: { iconText: string; iconImageDataUrl: string; displayName: string; email: string }) {
  if (props.iconImageDataUrl) {
    return (
      <img
        src={props.iconImageDataUrl}
        alt="icon"
        style={{ ...avatarStyle, objectFit: "cover", borderRadius: "50%" }}
      />
    );
  }
  const trimmed = props.iconText.trim();
  const fallbackSource = props.displayName.trim() || props.email.trim() || "?";
  const fallback = fallbackSource.slice(0, 1).toUpperCase();
  const text = (trimmed || fallback).slice(0, 2);
  return <div style={avatarStyle}>{text}</div>;
}

async function resizeImageToDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const srcSize = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - srcSize) / 2);
  const sy = Math.floor((img.height - srcSize) / 2);
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function MiniBoard({ board }: { board: number[] }) {
  const cells = Array.isArray(board) && board.length === 25 ? board : Array.from({ length: 25 }, () => 0);
  return (
    <div style={miniBoardWrapStyle}>
      <div style={miniBoardStyle}>
        {cells.map((v, i) => (
          <div key={i} style={{ ...miniCellStyle, background: `rgba(120, 78, 40, ${0.08 + Math.min(5, Math.max(0, v)) * 0.14})` }}>
            <span style={{ fontSize: 9, color: v > 0 ? "#3b2713" : "#9b8a78" }}>{toShoTally(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toShoTally(value: number) {
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
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.9)",
  width: "100%",
  boxSizing: "border-box",
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

const miniBoardWrapStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: 4,
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

const profileTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(72px, 96px) 1fr",
  gap: 14,
  alignItems: "start",
};

const filePickLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
  cursor: "pointer",
  fontWeight: 700,
};

const hiddenFileInputStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

function parseTemplate(value: string | undefined): CardTemplateId {
  if (value === "lacquer" || value === "paper") return value;
  return "classic";
}

const cardTemplateOptions: Array<{ id: CardTemplateId; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "lacquer", label: "Lacquer" },
  { id: "paper", label: "Paper" },
];

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

const templateChipStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.9)",
  color: "var(--ink)",
  cursor: "pointer",
};

const templateChipActiveStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
  fontWeight: 700,
};
