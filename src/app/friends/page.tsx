"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getFriendIdFromUserMetadata } from "@/lib/profilePrefs";

type ProfileRow = {
  user_id: string;
  friend_id: string;
  display_name: string;
  status_message?: string;
  icon_text?: string;
  icon_image_data_url?: string;
};

type IncomingRequestRow = {
  id: string;
  from_user_id: string;
  created_at: string;
};

type FriendshipRow = {
  user_low_id: string;
  user_high_id: string;
};

export default function FriendsPage() {
  const [status, setStatus] = useState("");
  const [me, setMe] = useState<{ userId: string; friendId: string } | null>(null);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ProfileRow | null>(null);
  const [friends, setFriends] = useState<ProfileRow[]>([]);
  const [incoming, setIncoming] = useState<Array<IncomingRequestRow & { fromProfile?: ProfileRow }>>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [openedFriendMenuId, setOpenedFriendMenuId] = useState<string | null>(null);

  const myFriendId = me?.friendId ?? "";
  const myUserId = me?.userId ?? "";

  const existingFriendIds = useMemo(() => new Set(friends.map(x => x.user_id)), [friends]);

  const reload = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setStatus("ログインが必要です。");
      return;
    }
    const auth = sessionData.session.user;
    let friendId = getFriendIdFromUserMetadata(auth.user_metadata);
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("friend_id")
      .eq("user_id", auth.id)
      .maybeSingle();
    if (!friendId && myProfile) {
      friendId = ((myProfile as { friend_id?: string }).friend_id ?? "").toUpperCase();
    }
    setMe({ userId: auth.id, friendId });

    const { data: relData, error: relError } = await supabase
      .from("friendships")
      .select("user_low_id, user_high_id")
      .or(`user_low_id.eq.${auth.id},user_high_id.eq.${auth.id}`);
    if (relError) {
      setStatus(`フレンド一覧取得に失敗しました。詳細: ${relError.message}`);
      return;
    }

    const relRows = (relData ?? []) as FriendshipRow[];
    const friendUserIds = relRows.map(row => (row.user_low_id === auth.id ? row.user_high_id : row.user_low_id));
    if (friendUserIds.length > 0) {
      const { data: profileRows, error: profError } = await supabase
        .from("profiles")
        .select("user_id, friend_id, display_name, status_message, icon_text, icon_image_data_url")
        .in("user_id", friendUserIds);
      if (profError) {
        setStatus(`フレンドプロフィール取得に失敗しました。詳細: ${profError.message}`);
        return;
      }
      setFriends((profileRows ?? []) as ProfileRow[]);
    } else {
      setFriends([]);
    }

    const { data: reqRows, error: reqError } = await supabase
      .from("friend_requests")
      .select("id, from_user_id, created_at")
      .eq("to_user_id", auth.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (reqError) {
      setStatus(`申請一覧取得に失敗しました。詳細: ${reqError.message}`);
      return;
    }

    const pending = (reqRows ?? []) as IncomingRequestRow[];
    if (pending.length > 0) {
      const fromIds = pending.map(r => r.from_user_id);
      const { data: fromProfiles } = await supabase
        .from("profiles")
        .select("user_id, friend_id, display_name, status_message, icon_text, icon_image_data_url")
        .in("user_id", fromIds);
      const map = new Map((fromProfiles ?? []).map(p => [p.user_id, p as ProfileRow]));
      setIncoming(pending.map(r => ({ ...r, fromProfile: map.get(r.from_user_id) })));
    } else {
      setIncoming([]);
    }
    setStatus("");
  };

  useEffect(() => {
    reload();
  }, []);

  const searchByFriendId = async () => {
    const target = query.trim().toUpperCase();
    if (!target) return;
    setLoading(true);
    setSearchResult(null);
    setStatus("");
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, friend_id, display_name, status_message, icon_text, icon_image_data_url")
      .eq("friend_id", target)
      .maybeSingle();
    setLoading(false);
    if (error) {
      setStatus(`検索に失敗しました。詳細: ${error.message}`);
      return;
    }
    if (!data) {
      setStatus("該当するフレンドIDが見つかりません。");
      return;
    }
    setSearchResult(data as ProfileRow);
  };

  const sendRequest = async () => {
    if (!searchResult || !myUserId) return;
    if (searchResult.user_id === myUserId) {
      setStatus("自分には申請できません。");
      return;
    }
    if (existingFriendIds.has(searchResult.user_id)) {
      setStatus("すでにフレンドです。");
      return;
    }
    const { error } = await supabase.from("friend_requests").insert({
      from_user_id: myUserId,
      to_user_id: searchResult.user_id,
      status: "pending",
    });
    if (error) {
      setStatus(`申請送信に失敗しました。詳細: ${error.message}`);
      return;
    }
    setStatus("フレンド申請を送信しました。");
  };

  const acceptRequest = async (requestId: string, fromUserId: string) => {
    if (!myUserId) return;
    const low = myUserId < fromUserId ? myUserId : fromUserId;
    const high = myUserId < fromUserId ? fromUserId : myUserId;
    const { error: reqError } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId)
      .eq("to_user_id", myUserId);
    if (reqError) {
      setStatus(`承諾処理に失敗しました。詳細: ${reqError.message}`);
      return;
    }
    const { error: frError } = await supabase
      .from("friendships")
      .upsert({ user_low_id: low, user_high_id: high }, { onConflict: "user_low_id,user_high_id" });
    if (frError) {
      setStatus(`フレンド登録に失敗しました。詳細: ${frError.message}`);
      return;
    }
    await reload();
    setStatus("フレンド申請を承諾しました。");
  };

  const rejectRequest = async (requestId: string) => {
    if (!myUserId) return;
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("to_user_id", myUserId);
    if (error) {
      setStatus(`拒否処理に失敗しました。詳細: ${error.message}`);
      return;
    }
    await reload();
    setStatus("フレンド申請を拒否しました。");
  };

  const removeFriend = async (friendUserId: string, friendName: string) => {
    if (!myUserId) return;
    const ok = window.confirm(`${friendName || "このユーザー"}をフレンドから削除しますか？`);
    if (!ok) return;
    const low = myUserId < friendUserId ? myUserId : friendUserId;
    const high = myUserId < friendUserId ? friendUserId : myUserId;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("user_low_id", low)
      .eq("user_high_id", high);
    if (error) {
      setStatus(`フレンド削除に失敗しました。詳細: ${error.message}`);
      return;
    }
    await reload();
    setStatus("フレンドを削除しました。");
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>フレンド</h1>
      <section style={sectionStyle}>
        <div><b>あなたのフレンドID:</b> {myFriendId || "読み込み中..."}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button style={btnStyle} onClick={() => setShowSearch(v => !v)}>
            {showSearch ? "ID検索を閉じる" : "ID検索を開く"}
          </button>
          <button style={{ ...btnStyle, position: "relative" }} onClick={() => setShowInbox(v => !v)}>
            {showInbox ? "申請ボックスを閉じる" : "申請ボックスを開く"}
            {incoming.length > 0 && <span style={alertBadgeStyle}>!</span>}
          </button>
        </div>
      </section>

      {showSearch && (
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>フレンドID検索</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="例: HSABCDEFGH" style={inputStyle} />
            <button onClick={searchByFriendId} disabled={loading} style={btnStyle}>{loading ? "検索中..." : "検索"}</button>
          </div>
          {searchResult && (
            <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 10, background: "rgba(255,255,255,0.65)" }}>
              <div><b>{searchResult.display_name || "（名前未設定）"}</b></div>
              <div style={{ fontSize: 13, color: "#666" }}>ID: {searchResult.friend_id}</div>
              <button style={{ ...btnStyle, marginTop: 8 }} onClick={sendRequest}>フレンド申請</button>
            </div>
          )}
        </section>
      )}

      {showInbox && (
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>フレンド申請ボックス</h2>
          {incoming.length === 0 && <div>届いている申請はありません。</div>}
          <ul style={{ display: "grid", gap: 8, paddingLeft: 18, margin: 0 }}>
            {incoming.map(req => (
              <li key={req.id}>
                <div><b>{req.fromProfile?.display_name || "（名前未設定）"}</b></div>
                <div style={{ fontSize: 13, color: "#666" }}>ID: {req.fromProfile?.friend_id ?? "-"}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <button style={btnStyle} onClick={() => acceptRequest(req.id, req.from_user_id)}>承諾</button>
                  <button style={btnStyle} onClick={() => rejectRequest(req.id)}>拒否</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>フレンド一覧</h2>
        {friends.length === 0 && <div>まだフレンドがいません。</div>}
        <ul style={{ display: "grid", gap: 8, paddingLeft: 18, margin: 0 }}>
          {friends.map(fr => (
            <li key={fr.user_id}>
              <button
                style={friendHeaderButtonStyle}
                onClick={() => setOpenedFriendMenuId(prev => (prev === fr.user_id ? null : fr.user_id))}
                aria-expanded={openedFriendMenuId === fr.user_id}
              >
                <Avatar iconText={fr.icon_text ?? ""} iconImageDataUrl={fr.icon_image_data_url ?? ""} displayName={fr.display_name || "?"} />
                <b style={{ textAlign: "left" }}>{fr.display_name || "（名前未設定）"}</b>
              </button>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{fr.status_message || "（ステータスメッセージ未設定）"}</div>
              <div style={{ fontSize: 13, color: "#666" }}>ID: {fr.friend_id}</div>
              {openedFriendMenuId === fr.user_id && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <Link href={`/friends/${fr.friend_id}`} style={{ ...btnStyle, display: "inline-block" }}>
                    プロフィールを見る
                  </Link>
                  <button style={btnStyle} onClick={() => removeFriend(fr.user_id, fr.display_name)}>
                    フレンド削除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {status && (
        <div style={statusStyle}>{status}</div>
      )}
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

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.9)",
  minWidth: 0,
  width: "100%",
  flex: "1 1 220px",
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

const statusStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  padding: 12,
  border: "1px solid var(--line)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.6)",
  boxSizing: "border-box",
};

const alertBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#d33",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 12,
  fontWeight: 800,
};

const avatarStyle: React.CSSProperties = {
  width: 39,
  height: 39,
  borderRadius: "50%",
  border: "1px solid #8f6337",
  background: "linear-gradient(180deg, #f8e9d3 0%, #e7c39a 100%)",
  color: "#5d3d1d",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: 18,
};

const friendHeaderButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
};
