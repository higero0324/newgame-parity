"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ensureFriendIdForCurrentUser,
  getFriendIdFromUserMetadata,
  loadCurrentProfilePrefsFromProfiles,
  loadIconImageDataUrlFromProfiles,
  getProfilePrefsFromUserMetadata,
  saveIconImageDataUrlToProfiles,
  saveClipPrefsToSupabase,
} from "@/lib/profilePrefs";
import {
  getTitleById,
  loadAchievementStateForCurrentUser,
  saveEquippedTitlesForCurrentUser,
  type TitleDef,
  type TitleRarity,
} from "@/lib/achievements";

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

type CardTemplateId = "classic" | "lacquer" | "paper" | "modern" | "white";

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
  const [iconFrameId, setIconFrameId] = useState("");
  const [iconImageStatus, setIconImageStatus] = useState("");
  const [iconFileName, setIconFileName] = useState("");
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [clipsEditOpen, setClipsEditOpen] = useState(false);
  const [cardTemplate, setCardTemplate] = useState<CardTemplateId>("classic");
  const [unlockedTitleIds, setUnlockedTitleIds] = useState<string[]>([]);
  const [equippedTitleIds, setEquippedTitleIds] = useState<string[]>([]);
  const [titlePickerSlot, setTitlePickerSlot] = useState<0 | 1 | null>(null);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [friendId, setFriendId] = useState("");
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);

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
        setFriendId(getFriendIdFromUserMetadata(currentUser.user_metadata));

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
          setIconFrameId(loaded.prefs.iconFrameId);
        } else {
          setMatchNames({});
          setFeaturedIds([]);
          setStarredIdsForSave([]);
          setIconFrameId("");
          setStatus(`プロフィール設定の取得に失敗しました。詳細: ${loaded.reason}`);
        }
        setIconText(profilePrefs.iconText);
        const iconRes = await loadIconImageDataUrlFromProfiles();
        if (iconRes.ok) setIconImageDataUrl(iconRes.iconImageDataUrl);
        else setIconImageDataUrl(profilePrefs.iconImageDataUrl);

        const ach = await loadAchievementStateForCurrentUser();
        if (ach.ok) {
          setUnlockedTitleIds(ach.unlockedTitleIds);
          setEquippedTitleIds(ach.equippedTitleIds);
        }

        const ensured = await ensureFriendIdForCurrentUser();
        if (ensured.ok) setFriendId(ensured.friendId);

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
        // iOS Safari usually rejects lock; visual fallback is applied below.
      });
    }
    return () => {
      screenOrientation?.unlock?.();
    };
  }, [cardExpanded, viewport.width]);

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
            icon_frame_id: iconFrameId,
          },
          { onConflict: "user_id" },
        );
        if (profileError) {
          setStatus(`公開プロフィール同期に失敗しました。詳細: ${profileError.message}`);
          return;
        }
      }
      const titleSave = await saveEquippedTitlesForCurrentUser(equippedTitleIds);
      if (!titleSave.ok) {
        setStatus(`称号の保存に失敗しました。詳細: ${titleSave.reason}`);
        return;
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
  const isDarkCard = cardTemplate === "lacquer" || cardTemplate === "modern";
  const mutedTextColor = isDarkCard ? "rgba(255,245,230,0.85)" : "#555";
  const lightTextColor = isDarkCard ? "rgba(255,245,230,0.8)" : "#666";
  const editTextColor = isDarkCard ? "rgba(255,245,230,0.96)" : "#3f2b18";
  const editSubtleColor = isDarkCard ? "rgba(255,245,230,0.84)" : "#666";
  const equippedTitles = useMemo(() => {
    return equippedTitleIds.map(id => getTitleById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [equippedTitleIds]);
  const unlockedTitles = useMemo(() => {
    return unlockedTitleIds.map(id => getTitleById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [unlockedTitleIds]);
  const equippedSlots = useMemo(() => {
    return [equippedTitleIds[0] ?? "", equippedTitleIds[1] ?? ""] as [string, string];
  }, [equippedTitleIds]);
  const canUseSnowFrame = unlockedTitleIds.includes("extreme_emperor");

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

  const assignTitleToSlot = (slot: 0 | 1, titleId: string) => {
    const next: [string, string] = [equippedSlots[0], equippedSlots[1]];
    next[slot] = titleId;
    const uniqueOrdered = Array.from(new Set(next.filter(Boolean)));
    setEquippedTitleIds(uniqueOrdered);
  };

  const clearTitleSlot = (slot: 0 | 1) => {
    const next: [string, string] = [equippedSlots[0], equippedSlots[1]];
    next[slot] = "";
    setEquippedTitleIds(next.filter(Boolean));
  };

  const onPickIconImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>プロフィール</h1>
      {loadingProfile && (
        <div style={{ width: "100%", maxWidth: 760, fontSize: 14, color: "#666" }}>読み込み中...</div>
      )}

      {cardExpanded && <div style={profileCardBackdropStyle} aria-hidden />}
      <section
        style={{
          ...sectionStyle,
          ...profileCardBaseStyle,
          ...profileCardTemplateStyles[cardTemplate],
          ...(profileEditOpen ? profileCardEditOpenStyle : profileCardClosedShapeStyle),
          ...(cardExpanded ? profileCardExpandedStyle : null),
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>季士情報</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setCardExpanded(true)} style={btnStyle}>
                拡大
              </button>
              {profileEditOpen && (
                <button onClick={saveProfile} disabled={saving} style={btnStyle}>
                  {saving ? "保存中..." : "保存"}
                </button>
              )}
              <button style={btnStyle} onClick={() => setProfileEditOpen(v => !v)}>
                {profileEditOpen ? "×" : "編集"}
              </button>
            </div>
          </div>
        )}
        <div style={cardExpanded ? profileTopExpandedStyle : profileTopStyle}>
          <div style={profileInfoBlockStyle}>
            <div style={profileNameTextStyle}>{displayName || "（未設定）"}</div>
            <div style={{ ...profileMetaTextStyle, color: lightTextColor }}>
              {cardExpanded ? `フレンドID: ${friendId || "-"}` : `ログイン中: ${email || "(不明)"}`}
            </div>
            <div style={{ ...profileStatusTextStyle, color: mutedTextColor }}>{statusMessage || "（ステータスメッセージ未設定）"}</div>
          </div>
          {(equippedTitles.length > 0 || (profileEditOpen && !cardExpanded)) && (
            <div style={profileTitleBlockStyle}>
              <div style={{ ...equippedTitleListStyle, ...equippedTitleListUpperStyle, justifyItems: "end" }}>
                {[0, 1].map(i => {
                  const slot = i as 0 | 1;
                  const titleId = equippedSlots[slot];
                  const title = titleId ? getTitleById(titleId) : null;
                  const empty = !title;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        if (!profileEditOpen || cardExpanded) return;
                        setTitlePickerSlot(prev => (prev === slot ? null : slot));
                      }}
                      style={{
                        ...titleChipStyleBase,
                        ...(empty
                          ? emptyTitleSlotStyle
                          : {
                              ...titleChipStyleFor(title),
                              ...(isUpperTitle(title) ? titleChipUpperDisplayStyle : titleChipLowerDisplayStyle),
                              ...(cardExpanded ? expandedTitleChipDisplayStyle : null),
                            }),
                        cursor: profileEditOpen && !cardExpanded ? "pointer" : "default",
                      }}
                    >
                      {empty ? "＋ 称号を設定" : title.name}
                    </button>
                  );
                })}
              </div>
              {profileEditOpen && !cardExpanded && titlePickerSlot !== null && (
                <div style={titlePickerPanelStyle}>
                  <div style={{ fontSize: 13, color: mutedTextColor, fontWeight: 700 }}>
                    {titlePickerSlot + 1}枠目に設定する称号を選択
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <button
                      type="button"
                      style={{ ...titleSelectButtonStyle, ...titleSelectClearStyle }}
                      onClick={() => {
                        clearTitleSlot(titlePickerSlot);
                        setTitlePickerSlot(null);
                      }}
                    >
                      この枠を空にする
                    </button>
                    {unlockedTitles.length === 0 && (
                      <div style={{ fontSize: 13, color: "#666" }}>まだ称号を獲得していません。</div>
                    )}
                    {unlockedTitles.map(title => {
                      const anotherSlot = titlePickerSlot === 0 ? equippedSlots[1] : equippedSlots[0];
                      const selectedInThisSlot = equippedSlots[titlePickerSlot] === title.id;
                      const usedInOtherSlot = anotherSlot === title.id;
                      return (
                        <button
                          key={title.id}
                          type="button"
                          disabled={usedInOtherSlot}
                          style={{
                            ...titleSelectButtonStyle,
                            ...(selectedInThisSlot ? titleSelectButtonActiveStyle : null),
                            ...titleChipStyleFor(title),
                            ...(usedInOtherSlot ? titleSelectButtonDisabledStyle : null),
                          }}
                          onClick={() => {
                            assignTitleToSlot(titlePickerSlot, title.id);
                            setTitlePickerSlot(null);
                          }}
                        >
                          <span>{title.name}</span>
                          <span style={{ fontSize: 12, opacity: 0.9 }}>{title.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={profileIconBlockStyle}>
            <button
              type="button"
              onClick={() => {
                if (!profileEditOpen || cardExpanded) return;
                iconFileInputRef.current?.click();
              }}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: profileEditOpen && !cardExpanded ? "pointer" : "default",
                width: "fit-content",
              }}
              aria-label={profileEditOpen && !cardExpanded ? "アイコン画像を変更" : "プロフィールアイコン"}
            >
              <Avatar
                iconText={iconText}
                iconImageDataUrl={iconImageDataUrl}
                iconFrameId={iconFrameId}
                displayName={displayName}
                email={email}
                expanded={cardExpanded}
              />
            </button>
            {profileEditOpen && !cardExpanded && (
              <div style={{ fontSize: 12, color: mutedTextColor, textAlign: "left" }}>
                アイコンをタップして画像変更
              </div>
            )}
            <input
              ref={iconFileInputRef}
              type="file"
              accept="image/*"
              style={hiddenFileInputStyle}
              onChange={onPickIconImage}
            />
          </div>
        </div>
        {profileEditOpen && !cardExpanded && (
          <div style={{ ...profileEditPanelStyle, color: editTextColor }}>
            <label style={{ display: "grid", gap: 6, color: editTextColor }}>
              <span style={{ fontWeight: 700 }}>名前</span>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} placeholder="表示名を入力" />
            </label>
            <label style={{ display: "grid", gap: 6, color: editTextColor }}>
              <span style={{ fontWeight: 700 }}>ステータスメッセージ</span>
              <textarea
                value={statusMessage}
                onChange={e => setStatusMessage(e.target.value)}
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="ひとこと"
              />
            </label>
            <label style={{ display: "grid", gap: 6, color: editTextColor }}>
              <span style={{ fontWeight: 700 }}>アイコン文字（1〜2文字。空欄なら名前の頭文字）</span>
              <input value={iconText} onChange={e => setIconText(e.target.value)} style={inputStyle} placeholder="例: 😀 / H" />
            </label>
            <label style={{ display: "grid", gap: 6, color: editTextColor }}>
              <span style={{ fontWeight: 700 }}>カードテンプレート</span>
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
            <div style={{ fontSize: 12, color: editSubtleColor }}>
              称号は上のカード内の「称号枠」をタップして設定できます（最大2つ）。
            </div>
            <label style={{ display: "grid", gap: 6, color: editTextColor }}>
              <span style={{ fontWeight: 700 }}>アイコンフレーム</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setIconFrameId("")}
                  style={{ ...templateChipStyle, ...(iconFrameId === "" ? templateChipActiveStyle : null) }}
                >
                  なし
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canUseSnowFrame) return;
                    setIconFrameId("setsugekka_frame");
                  }}
                  disabled={!canUseSnowFrame}
                  style={{
                    ...templateChipStyle,
                    ...(iconFrameId === "setsugekka_frame" ? templateChipActiveStyle : null),
                    ...(canUseSnowFrame ? snowFrameChipStyle : snowFrameChipLockedStyle),
                  }}
                >
                  雪月花フレーム
                </button>
              </div>
              {!canUseSnowFrame && (
                <div style={{ fontSize: 12, color: editSubtleColor }}>
                  「雪月花」の称号を回収すると、雪月花フレームが解放されます。
                </div>
              )}
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
              <span style={{ fontSize: 12, color: editSubtleColor, alignSelf: "center" }}>
                {iconFileName ? `選択中: ${iconFileName}` : "画像未選択"}
              </span>
              {iconImageStatus && <span style={{ fontSize: 13, color: editSubtleColor }}>{iconImageStatus}</span>}
            </div>
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
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, fontWeight: 700 }}>保存季譜から選ぶ</div>
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
      </div>

      {status && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 760 }}>
          {status}
        </div>
      )}
    </main>
  );
}

function Avatar(props: { iconText: string; iconImageDataUrl: string; iconFrameId: string; displayName: string; email: string; expanded?: boolean }) {
  const trimmed = props.iconText.trim();
  const fallbackSource = props.displayName.trim() || props.email.trim() || "?";
  const fallback = fallbackSource.slice(0, 1).toUpperCase();
  const text = (trimmed || fallback).slice(0, 2);
  const wrapStyle = props.expanded ? avatarWrapExpandedStyle : avatarWrapStyle;
  const bodyStyle = props.expanded ? avatarExpandedStyle : avatarStyle;
  const frameStyle = props.expanded ? setsugekkaFrameExpandedStyle : setsugekkaFrameStyle;
  return (
    <div style={wrapStyle}>
      {props.iconImageDataUrl ? (
        <img
          src={props.iconImageDataUrl}
          alt="icon"
          style={{ ...bodyStyle, objectFit: "cover", borderRadius: "50%" }}
        />
      ) : (
        <div style={bodyStyle}>{text}</div>
      )}
      {props.iconFrameId === "setsugekka_frame" && <div style={frameStyle} aria-hidden />}
    </div>
  );
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
  color: "#2f1f12",
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

const profileTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content minmax(0, 1fr)",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 4,
  alignItems: "stretch",
  alignContent: "space-between",
  height: "100%",
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
  display: "grid",
  gap: 6,
};

const hiddenFileInputStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

function parseTemplate(value: string | undefined): CardTemplateId {
  if (value === "lacquer" || value === "paper" || value === "modern" || value === "white") return value;
  return "classic";
}

const cardTemplateOptions: Array<{ id: CardTemplateId; label: string }> = [
  { id: "white", label: "白磁カード" },
  { id: "classic", label: "欅木目カード" },
  { id: "paper", label: "和紙カード" },
  { id: "lacquer", label: "漆黒蒔絵カード" },
  { id: "modern", label: "雅紺カード" },
];

const profileCardBaseStyle: React.CSSProperties = {
  borderRadius: 16,
  borderWidth: 2,
  padding: "clamp(12px, 3vw, 20px)",
  boxShadow: "0 12px 28px rgba(35, 20, 10, 0.14)",
  overflow: "visible",
  position: "relative",
  containerType: "inline-size",
};

const profileCardClosedShapeStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  minHeight: "clamp(250px, 46vw, 360px)",
  aspectRatio: "auto",
  alignContent: "space-between",
  gridTemplateRows: "auto 1fr auto",
};

const profileCardEditOpenStyle: React.CSSProperties = {
  maxWidth: 760,
  minHeight: 0,
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

const profileEditPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  borderTop: "1px solid var(--line)",
  paddingTop: 10,
  marginTop: 2,
  background: "rgba(255,255,255,0.16)",
  borderRadius: 10,
  paddingInline: 8,
  paddingBottom: 8,
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

const snowFrameChipStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1b1f31 0%, #5b4f78 55%, #d9c7ff 100%)",
  color: "#fff",
  borderColor: "#7c67b2",
};

const snowFrameChipLockedStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const titleChipStyleBase: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid transparent",
  width: "fit-content",
};

const titleSelectButtonStyle: React.CSSProperties = {
  textAlign: "left",
  display: "grid",
  gap: 2,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "rgba(255,255,255,0.75)",
  cursor: "pointer",
};

const titleSelectButtonActiveStyle: React.CSSProperties = {
  boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6), 0 2px 0 rgba(120,80,40,0.2)",
};

const titleSelectButtonDisabledStyle: React.CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const titleSelectClearStyle: React.CSSProperties = {
  borderStyle: "dashed",
  background: "rgba(255,255,255,0.55)",
};

const emptyTitleSlotStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 10,
  border: "1px dashed rgba(90, 60, 30, 0.45)",
  background: "rgba(255,255,255,0.45)",
  color: "#6f5a40",
  fontWeight: 700,
  textAlign: "center",
  boxSizing: "border-box",
  padding: "clamp(8px, 2cqw, 12px) clamp(10px, 2.8cqw, 16px)",
  fontSize: "clamp(13px, 2.5cqw, 16px)",
  lineHeight: 1.25,
};

const titlePickerPanelStyle: React.CSSProperties = {
  marginTop: 6,
  display: "grid",
  gap: 8,
  border: "1px solid rgba(90, 60, 30, 0.25)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(255,255,255,0.68)",
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
