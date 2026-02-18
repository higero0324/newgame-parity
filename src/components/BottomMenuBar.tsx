"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadAchievementStateForCurrentUser } from "@/lib/achievements";

type MenuId = "battle" | "learn" | "kishi" | "warehouse" | "friend" | "progress";

type HomeMenu = {
  id: MenuId;
  icon: string;
  label: string;
};

const MENUS: HomeMenu[] = [
  { id: "battle", icon: "🏠", label: "ホーム" },
  { id: "learn", icon: "学", label: "学び" },
  { id: "kishi", icon: "季", label: "季士情報" },
  { id: "warehouse", icon: "倉", label: "倉庫" },
  { id: "friend", icon: "友", label: "友人" },
  { id: "progress", icon: "進", label: "進歩" },
];

export default function BottomMenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [achievementNotice, setAchievementNotice] = useState(false);
  const [homeActiveMenu, setHomeActiveMenu] = useState<"battle" | "learn">("battle");
  const [externallyHidden, setExternallyHidden] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.auth.getSession();
      const loggedIn = Boolean(!error && data.session?.user);
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        setAchievementNotice(false);
        return;
      }
      const ach = await loadAchievementStateForCurrentUser();
      setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
    };
    refresh();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = Boolean(session?.user);
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        setAchievementNotice(false);
      } else {
        loadAchievementStateForCurrentUser().then(ach => {
          setAchievementNotice(Boolean(ach.ok && ach.claimableTitleIds.length > 0));
        });
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const hide = pathname === "/play" || pathname === "/cpu" || pathname === "/login";

  useEffect(() => {
    if (pathname !== "/") return;
    const readFromQuery = () => {
      const q = new URLSearchParams(window.location.search).get("menu");
      setHomeActiveMenu(q === "learn" ? "learn" : "battle");
    };
    readFromQuery();
    window.addEventListener("popstate", readFromQuery);
    return () => window.removeEventListener("popstate", readFromQuery);
  }, [pathname]);

  useEffect(() => {
    const onVisibility = (event: Event) => {
      const custom = event as CustomEvent<{ visible?: boolean }>;
      setExternallyHidden(custom.detail?.visible === false);
    };
    window.addEventListener("hisei-bottom-menu-visible", onVisibility as EventListener);
    return () => window.removeEventListener("hisei-bottom-menu-visible", onVisibility as EventListener);
  }, []);

  const activeMenu = useMemo<MenuId>(() => {
    if (pathname === "/") return homeActiveMenu;
    if (pathname.startsWith("/profile")) return "kishi";
    if (pathname.startsWith("/warehouse")) return "warehouse";
    if (pathname.startsWith("/friends")) return "friend";
    if (pathname.startsWith("/achievements")) return "progress";
    if (pathname.startsWith("/hajimeni") || pathname.startsWith("/rules") || pathname.startsWith("/tutorial") || pathname.startsWith("/history")) {
      return "learn";
    }
    return "battle";
  }, [pathname, homeActiveMenu]);

  if (hide || externallyHidden) return null;

  const onTapMenu = (id: MenuId) => {
    if (id === "battle") {
      setHomeActiveMenu("battle");
      router.push("/?menu=battle");
      window.dispatchEvent(new CustomEvent("hisei-menu-change", { detail: { menu: "battle" } }));
      return;
    }
    if (id === "learn") {
      setHomeActiveMenu("learn");
      router.push("/?menu=learn");
      window.dispatchEvent(new CustomEvent("hisei-menu-change", { detail: { menu: "learn" } }));
      return;
    }
    if (id === "kishi") {
      router.push(isLoggedIn ? "/profile" : "/login");
      return;
    }
    if (id === "warehouse") {
      router.push(isLoggedIn ? "/warehouse" : "/login");
      return;
    }
    if (id === "friend") {
      router.push(isLoggedIn ? "/friends" : "/login");
      return;
    }
    router.push(isLoggedIn ? "/achievements" : "/login");
  };

  return (
    <nav style={bottomMenuWrapStyle}>
      <div style={bottomMenuRowStyle}>
        {MENUS.map(menu => {
          const active = menu.id === activeMenu;
          const showNotice = menu.id === "progress" && isLoggedIn && achievementNotice;
          return (
            <button
              key={menu.id}
              onClick={() => onTapMenu(menu.id)}
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
  );
}

const noticeBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: "#d33",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 800,
};

const bottomMenuWrapStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  width: "calc(100% - 12px)",
  margin: "0 6px calc(4px + env(safe-area-inset-bottom))",
  borderRadius: 14,
  padding: "1px 8px calc(2px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(120, 80, 40, 0.25)",
  border: "1px solid rgba(120, 80, 40, 0.22)",
  background: "linear-gradient(180deg, rgba(255,250,241,0.66) 0%, rgba(245,230,202,0.72) 100%)",
  backdropFilter: "blur(10px)",
  overflow: "visible",
};

const bottomMenuRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "stretch",
  gap: 5,
  width: "100%",
  paddingBottom: 0,
  overflow: "visible",
};

const menuIconButtonStyle: React.CSSProperties = {
  position: "relative",
  flex: "1 1 0",
  minWidth: 0,
  padding: "8px 6px",
  marginTop: -6,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.72)",
  color: "var(--ink)",
  display: "grid",
  gap: 1,
  justifyItems: "center",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.2)",
};

const menuIconButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  borderColor: "#ad7f47",
};

const menuIconStyle: React.CSSProperties = {
  fontSize: 21,
  fontWeight: 900,
  lineHeight: 1,
};

const menuLabelStyle: React.CSSProperties = {
  fontSize: "clamp(10px, 2.4vw, 12px)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
