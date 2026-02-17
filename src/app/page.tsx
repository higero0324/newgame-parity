"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  const goAction = (action: MenuAction) => {
    if (action.requiresAuth && !isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(action.href);
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 14, justifyItems: "center" }}>
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
