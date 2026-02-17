"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadAchievementStateForCurrentUser } from "@/lib/achievements";

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
  const [achievementNotice, setAchievementNotice] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuId>("battle");

  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setIsLoggedIn(true);
        setIsGuestMode(false);
        const ach = await loadAchievementStateForCurrentUser();
        setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setIsLoggedIn(false);
        setIsGuestMode(true);
        setAchievementNotice(false);
      }
      setAuthReady(true);
    };

    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MODE_KEY);
        setIsLoggedIn(true);
        setIsGuestMode(false);
        loadAchievementStateForCurrentUser().then(ach => {
          setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
        });
      } else {
        const guestEnabled = typeof window !== "undefined" && window.localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (!guestEnabled) {
          router.replace("/login");
          return;
        }
        setIsLoggedIn(false);
        setIsGuestMode(true);
        setAchievementNotice(false);
      }
      setAuthReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

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

  const selectedMenu = menus.find(m => m.id === activeMenu) ?? menus[0];

  const goAction = (action: MenuAction) => {
    if (action.requiresAuth && !isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(action.href);
  };

  const onTapMenu = (menu: HomeMenu) => {
    if (menu.actions.length === 1) {
      goAction(menu.actions[0]);
      return;
    }
    setActiveMenu(menu.id);
  };

  return (
    <main style={{ padding: 24, paddingBottom: 132, display: "grid", gap: 14, justifyItems: "center" }}>
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

      <p style={{ color: "#555", textAlign: "center" }}>
        {isGuestMode
          ? "※ゲスト参加中です。プロフィール・フレンド・季譜保存・アチーブメントは利用できません。"
          : "※ログインは季譜保存用。ログインなしでも対局できます。"}
      </p>

      <nav style={bottomMenuWrapStyle}>
        <div style={bottomMenuScrollStyle}>
          {menus.map(menu => {
            const active = menu.id === activeMenu;
            const showNotice = menu.id === "progress" && isLoggedIn && achievementNotice;
            return (
              <button
                key={menu.id}
                onClick={() => onTapMenu(menu)}
                style={{
                  ...menuIconButtonStyle,
                  ...(active ? menuIconButtonActiveStyle : null),
                }}
              >
                <span style={menuIconStyle}>{menu.icon}</span>
                <span style={menuLabelStyle}>{menu.label}</span>
                {showNotice && <span style={noticeBadgeStyle}>!</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

const bigActionButtonStyle: React.CSSProperties = {
  padding: "18px 14px",
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  color: "var(--ink)",
  fontWeight: 800,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};

const noticeBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 5,
  right: 5,
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

const bottomMenuWrapStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(120, 80, 40, 0.25)",
  background: "linear-gradient(180deg, rgba(255,250,241,0.95) 0%, rgba(245,230,202,0.98) 100%)",
  backdropFilter: "blur(6px)",
};

const bottomMenuScrollStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "thin",
  paddingBottom: 2,
};

const menuIconButtonStyle: React.CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
  minWidth: 84,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.72)",
  color: "var(--ink)",
  display: "grid",
  gap: 2,
  justifyItems: "center",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.2)",
};

const menuIconButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  borderColor: "#ad7f47",
};

const menuIconStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1,
};

const menuLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};
