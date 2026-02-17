"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadAchievementStateForCurrentUser } from "@/lib/achievements";

type MenuId = "battle" | "kishi" | "friend" | "learn" | "progress";

type HomeMenu = {
  id: MenuId;
  icon: string;
  label: string;
};

const MENUS: HomeMenu[] = [
  { id: "battle", icon: "⚔", label: "対局" },
  { id: "kishi", icon: "季", label: "季士情報" },
  { id: "friend", icon: "友", label: "友人" },
  { id: "learn", icon: "学", label: "学び" },
  { id: "progress", icon: "進", label: "進歩" },
];

export default function BottomMenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [achievementNotice, setAchievementNotice] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [edgeNoticeSide, setEdgeNoticeSide] = useState<"left" | "right" | null>(null);

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

  const hide = pathname === "/play" || pathname === "/cpu";
  const activeMenu = useMemo<MenuId>(() => {
    if (pathname === "/") return "battle";
    if (pathname.startsWith("/profile")) return "kishi";
    if (pathname.startsWith("/friends")) return "friend";
    if (pathname.startsWith("/achievements")) return "progress";
    if (pathname.startsWith("/hajimeni") || pathname.startsWith("/rules") || pathname.startsWith("/tutorial") || pathname.startsWith("/history")) {
      return "learn";
    }
    return "battle";
  }, [pathname]);

  if (hide) return null;

  const loopMenus = [...MENUS, ...MENUS, ...MENUS];

  useEffect(() => {
    if (!scrollEl) return;

    let raf = 0;
    const updateEdgeNotice = () => {
      if (!achievementNotice) {
        setEdgeNoticeSide(null);
        return;
      }
      const containerRect = scrollEl.getBoundingClientRect();
      const noticeEls = Array.from(scrollEl.querySelectorAll<HTMLElement>("[data-notice-item='1']"));
      if (noticeEls.length === 0) {
        setEdgeNoticeSide(null);
        return;
      }

      let visible = false;
      let nearestLeft = Number.POSITIVE_INFINITY;
      let nearestRight = Number.POSITIVE_INFINITY;

      for (const el of noticeEls) {
        const r = el.getBoundingClientRect();
        if (r.right > containerRect.left && r.left < containerRect.right) {
          visible = true;
          break;
        }
        if (r.right <= containerRect.left) {
          nearestLeft = Math.min(nearestLeft, containerRect.left - r.right);
        } else if (r.left >= containerRect.right) {
          nearestRight = Math.min(nearestRight, r.left - containerRect.right);
        }
      }

      if (visible) {
        setEdgeNoticeSide(null);
        return;
      }
      if (Number.isFinite(nearestLeft) && Number.isFinite(nearestRight)) {
        setEdgeNoticeSide(nearestLeft <= nearestRight ? "left" : "right");
        return;
      }
      if (Number.isFinite(nearestLeft)) {
        setEdgeNoticeSide("left");
        return;
      }
      if (Number.isFinite(nearestRight)) {
        setEdgeNoticeSide("right");
        return;
      }
      setEdgeNoticeSide(null);
    };

    const alignRightInMiddle = () => {
      const segment = scrollEl.scrollWidth / 3;
      if (!Number.isFinite(segment) || segment <= 0) return;
      const rightLean = Math.min(120, Math.max(0, segment * 0.15));
      scrollEl.scrollLeft = segment + rightLean;
      updateEdgeNotice();
    };

    const normalizeLoop = () => {
      const segment = scrollEl.scrollWidth / 3;
      if (!Number.isFinite(segment) || segment <= 0) return;
      const min = segment * 0.25;
      const max = segment * 1.75;
      if (scrollEl.scrollLeft < min) {
        scrollEl.scrollLeft += segment;
      } else if (scrollEl.scrollLeft > max) {
        scrollEl.scrollLeft -= segment;
      }
      updateEdgeNotice();
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(normalizeLoop);
    };

    alignRightInMiddle();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", alignRightInMiddle);
    updateEdgeNotice();
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", alignRightInMiddle);
    };
  }, [scrollEl, achievementNotice]);

  const onTapMenu = (id: MenuId) => {
    if (id === "battle") {
      router.push("/?menu=battle");
      return;
    }
    if (id === "learn") {
      router.push("/?menu=learn");
      return;
    }
    if (id === "kishi") {
      router.push(isLoggedIn ? "/profile" : "/login");
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
      <div ref={setScrollEl} style={bottomMenuScrollStyle}>
        {loopMenus.map((menu, i) => {
          const active = menu.id === activeMenu;
          const showNotice = menu.id === "progress" && isLoggedIn && achievementNotice;
          return (
            <button
              key={`${menu.id}-${i}`}
              onClick={() => onTapMenu(menu.id)}
              data-notice-item={showNotice ? "1" : undefined}
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
      {edgeNoticeSide === "left" && <span style={{ ...edgeNoticeStyle, left: 6 }}>!</span>}
      {edgeNoticeSide === "right" && <span style={{ ...edgeNoticeStyle, right: 6 }}>!</span>}
    </nav>
  );
}

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
  zIndex: 70,
  padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(120, 80, 40, 0.25)",
  background: "linear-gradient(180deg, rgba(255,250,241,0.66) 0%, rgba(245,230,202,0.72) 100%)",
  backdropFilter: "blur(10px)",
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

const edgeNoticeStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#d33",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 12,
  fontWeight: 800,
  pointerEvents: "none",
  zIndex: 1,
};
