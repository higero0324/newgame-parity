"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import kisekiIcon from "@/app/kiseki.png";
import { getLevelUpKisekiReward, getRequiredXpForNextRank, loadPlayerRankStateForCurrentUser, type PlayerRankState } from "@/lib/playerRank";

const GUEST_MODE_KEY = "hisei_guest_mode";

type MenuId = "battle" | "kishi" | "friend" | "learn" | "progress";

type MenuAction = {
  label: string;
  href: string;
  requiresAuth?: boolean;
};

type HomeMenu = {
  id: MenuId;
  icon: string;
  label: string;
  actions: MenuAction[];
};

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [homeMenu, setHomeMenu] = useState<"battle" | "learn">("battle");
  const [rankState, setRankState] = useState<PlayerRankState>({ rank: 1, xp: 0, kiseki: 0 });
  const [rankPopoverOpen, setRankPopoverOpen] = useState(false);

  useEffect(() => {
    const readFromQuery = () => {
      const q = new URLSearchParams(window.location.search).get("menu");
      setHomeMenu(q === "learn" ? "learn" : "battle");
    };
    const onMenuChange = (event: Event) => {
      const custom = event as CustomEvent<{ menu?: string }>;
      const m = custom.detail?.menu;
      if (m === "learn") setHomeMenu("learn");
      else if (m === "battle") setHomeMenu("battle");
      else readFromQuery();
    };
    readFromQuery();
    window.addEventListener("popstate", readFromQuery);
    window.addEventListener("hisei-menu-change", onMenuChange as EventListener);
    return () => {
      window.removeEventListener("popstate", readFromQuery);
      window.removeEventListener("hisei-menu-change", onMenuChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setIsLoggedIn(true);
        setIsGuestMode(false);
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setIsLoggedIn(false);
        setIsGuestMode(true);
      }
      setAuthReady(true);
    };

    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setIsLoggedIn(true);
        setIsGuestMode(false);
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setIsLoggedIn(false);
        setIsGuestMode(true);
      }
      setAuthReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!isLoggedIn) {
        if (alive) setRankState({ rank: 1, xp: 0, kiseki: 0 });
        return;
      }
      const loaded = await loadPlayerRankStateForCurrentUser();
      if (!alive || !loaded.ok) return;
      setRankState(loaded.state);
    };
    if (authReady) load();
    return () => {
      alive = false;
    };
  }, [authReady, isLoggedIn]);

  const menus = useMemo<HomeMenu[]>(
    () => [
      {
        id: "battle",
        icon: "⚔",
        label: "対局",
        actions: [
          { label: "通常対局", href: "/play" },
          { label: "CPU対局", href: "/cpu" },
        ],
      },
      {
        id: "kishi",
        icon: "季",
        label: "季士情報",
        actions: [{ label: "プロフィール", href: "/profile", requiresAuth: true }],
      },
      {
        id: "friend",
        icon: "友",
        label: "友人",
        actions: [{ label: "フレンド", href: "/friends", requiresAuth: true }],
      },
      {
        id: "learn",
        icon: "学",
        label: "学び",
        actions: [
          { label: "初めに", href: "/hajimeni" },
          { label: "ルール説明", href: "/rules" },
          { label: "チュートリアル", href: "/tutorial" },
          { label: "保存季譜", href: "/history", requiresAuth: true },
        ],
      },
      {
        id: "progress",
        icon: "進",
        label: "進歩",
        actions: [{ label: "アチーブメント", href: "/achievements", requiresAuth: true }],
      },
    ],
    [],
  );

  if (!authReady) {
    return <main style={{ padding: 24, textAlign: "center", color: "#666" }}>読み込み中...</main>;
  }

  const activeMenu: MenuId = homeMenu;
  const selectedMenu = menus.find(m => m.id === activeMenu) ?? menus[0];
  const requiredXp = getRequiredXpForNextRank(rankState.rank);
  const xpToNext = Math.max(0, requiredXp - rankState.xp);
  const isMaxRank = rankState.rank >= 99;

  const goAction = (action: MenuAction) => {
    if (action.requiresAuth && !isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(action.href);
  };

  return (
    <>
      <section style={statusBarWrapStyle}>
        <button
          type="button"
          onClick={() => setRankPopoverOpen(prev => !prev)}
          style={{ ...statusItemRowStyle, ...statusRankItemStyle }}
        >
          <span style={statusRankLabelStyle}>ランク</span>
          <strong style={statusRankValueStyle}>{rankState.rank}</strong>
        </button>
        <div style={{ ...statusItemRowStyle, ...statusWideItemStyle, ...statusKisekiItemStyle }}>
          <span style={statusIconLabelStyle} aria-label="所持季石" title="所持季石">
            <Image src={kisekiIcon} alt="季石" width={28} height={28} />
          </span>
          <strong style={{ ...statusValueStyle, ...statusLongValueStyle }}>{rankState.kiseki}</strong>
        </div>
        {rankPopoverOpen && (
          <div style={rankPopoverStyle}>
            {isMaxRank ? (
              <div style={{ fontSize: 13 }}>ランク上限（99）に到達しています。</div>
            ) : (
              <>
                <div style={{ fontSize: 13 }}>次のランクまで: {xpToNext} EXP</div>
                <div style={{ fontSize: 13 }}>ランクアップ報酬: 季石 +{getLevelUpKisekiReward()}</div>
              </>
            )}
          </div>
        )}
      </section>

      <main
        style={{
          margin: "calc(56px + env(safe-area-inset-top)) auto 24px",
          padding: "24px",
          display: "grid",
          gap: 14,
          justifyItems: "center",
        }}
      >
      <h1 style={{ fontWeight: 900, textAlign: "center", lineHeight: 1 }}>
        <span style={{ fontSize: 60, display: "block" }}>一正</span>
        <span style={{ fontSize: 15, display: "block", marginTop: 5, color: "#555" }}>～HISEI～</span>
      </h1>

      <section style={{ width: "100%", maxWidth: 760, display: "grid", gap: 10 }}>
        {selectedMenu.actions.length > 1 ? (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {selectedMenu.actions.map(action => (
              <button key={action.label} onClick={() => goAction(action)} style={bigActionButtonStyle}>
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#666", fontSize: 14 }}>
            下のメニューを押すと画面を開きます。
          </div>
        )}
      </section>

      </main>
      {rankPopoverOpen && <button type="button" aria-label="閉じる" style={rankPopoverBackdropStyle} onClick={() => setRankPopoverOpen(false)} />}
    </>
  );
}

const bigActionButtonStyle: React.CSSProperties = {
  padding: "18px 14px",
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  color: "var(--ink)",
  fontWeight: 800,
  fontSize: 20,
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};

const statusBarWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: "max(6px, env(safe-area-inset-top))",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 30,
  width: "calc(100% - 12px)",
  maxWidth: 760,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: 5,
  padding: "1px 4px",
  borderRadius: 14,
  borderTop: "1px solid rgba(120, 80, 40, 0.25)",
  border: "1px solid rgba(120, 80, 40, 0.22)",
  background: "linear-gradient(180deg, rgba(255,250,241,0.66) 0%, rgba(245,230,202,0.72) 100%)",
  backdropFilter: "blur(10px)",
  overflow: "hidden",
};

const statusItemRowStyle: React.CSSProperties = {
  position: "relative",
  flex: "0 1 auto",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  padding: "5px 6px",
  marginTop: 0,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.72)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.2)",
  minHeight: 30,
};

const statusRankItemStyle: React.CSSProperties = {
  cursor: "pointer",
  flex: "0 1 112px",
  minWidth: 82,
  justifyContent: "flex-start",
  gap: 10,
  border: "none",
  background: "transparent",
  boxShadow: "none",
  padding: "2px 2px",
};

const statusWideItemStyle: React.CSSProperties = {
  flex: "0 1 148px",
  minWidth: 126,
};

const statusRightAlignedItemStyle: React.CSSProperties = {
  justifyContent: "flex-end",
};

const statusKisekiItemStyle: React.CSSProperties = {
  justifyContent: "space-between",
  paddingLeft: 2,
  marginLeft: "auto",
};

const statusLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#5b4d39",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const statusIconLabelStyle: React.CSSProperties = {
  minHeight: 16,
  display: "inline-grid",
  placeItems: "center",
  color: "#5b4d39",
  lineHeight: 1,
  fontSize: 16,
  whiteSpace: "nowrap",
};

const statusValueStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const statusLongValueStyle: React.CSSProperties = {
  minWidth: "6ch",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const statusRankLabelStyle: React.CSSProperties = {
  fontSize: 24,
  color: "#4b3a27",
  lineHeight: 1.2,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const statusRankValueStyle: React.CSSProperties = {
  fontSize: 19,
  lineHeight: 1,
  color: "#2f2318",
  whiteSpace: "nowrap",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const rankPopoverBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  zIndex: 34,
  cursor: "default",
};

const rankPopoverStyle: React.CSSProperties = {
  position: "fixed",
  top: "calc(max(6px, env(safe-area-inset-top)) + 40px)",
  left: 12,
  zIndex: 35,
  display: "grid",
  gap: 4,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(120, 80, 40, 0.35)",
  background: "rgba(255, 252, 245, 0.98)",
  boxShadow: "0 10px 24px rgba(40, 24, 12, 0.22)",
};
