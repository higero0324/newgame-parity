"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import kisekiIcon from "@/app/kiseki.png";
import { claimPresentForCurrentUser, loadPresentBoxForCurrentUser, type PresentItem } from "@/lib/presents";

export default function PresentsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("読み込み中...");
  const [presents, setPresents] = useState<PresentItem[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ label: string; amount: number } | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadPresentBoxForCurrentUser();
      if (!loaded.ok) {
        router.replace("/login");
        return;
      }
      setPresents(loaded.presents);
      setStatus(loaded.presents.length > 0 ? "" : "受け取り可能なプレゼントはありません。");
    })();
  }, [router]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  const claimOne = async (presentId: string) => {
    if (claimingId) return;
    setClaimingId(presentId);
    setStatus("");
    const res = await claimPresentForCurrentUser(presentId);
    setClaimingId(null);
    if (!res.ok) {
      setStatus(`受け取りに失敗しました。詳細: ${res.reason}`);
      return;
    }
    setPresents(res.presents);
    setStatus(res.presents.length > 0 ? "" : "受け取り可能なプレゼントはありません。");
    setReveal({ label: res.claimed.title, amount: res.claimed.amount });
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
    }
    revealTimerRef.current = window.setTimeout(() => {
      setReveal(null);
      revealTimerRef.current = null;
    }, 1800);
  };

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>プレゼントボックス</h1>
      <section style={sectionStyle}>
        <div style={{ fontSize: 13, color: "#66513a" }}>受け取りたいプレゼントを押すと1件ずつ受け取れます。</div>
        <div style={{ display: "grid", gap: 8 }}>
          {presents.map(item => (
            <button
              key={item.id}
              type="button"
              style={presentRowButtonStyle}
              disabled={Boolean(claimingId)}
              onClick={() => claimOne(item.id)}
            >
              <div style={{ display: "grid", gap: 2, textAlign: "left" }}>
                <strong style={{ fontSize: 15 }}>{item.title}</strong>
                <span style={{ fontSize: 13, color: "#5f4a34" }}>{item.description}</span>
                <span style={{ fontSize: 12, color: "#7a6248" }}>配布日時: {item.distributedAt}</span>
              </div>
              <span style={presentAmountChipStyle}>
                <Image src={kisekiIcon} alt="季石" width={13} height={13} />
                +{item.amount}
              </span>
            </button>
          ))}
          {presents.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>プレゼントは空です。</div>}
        </div>
      </section>

      {status && <div style={sectionStyle}>{status}</div>}

      {reveal && (
        <div style={revealOverlayStyle} aria-live="polite">
          <div style={revealCardStyle}>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>獲得アイテム</div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, marginBottom: 10 }}>{reveal.label}</div>
            <div style={revealKisekiChipStyle}>
              <Image src={kisekiIcon} alt="季石" width={16} height={16} />
              季石 +{reveal.amount}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  display: "grid",
  gap: 8,
  padding: 12,
  border: "1px solid var(--line)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.62)",
  boxSizing: "border-box",
};

const presentRowButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  border: "1px solid rgba(122, 86, 45, 0.36)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
  cursor: "pointer",
};

const presentAmountChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 999,
  border: "1px solid #b8891f",
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
  fontWeight: 800,
  fontSize: 12,
  padding: "4px 9px",
  whiteSpace: "nowrap",
};

const revealOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  padding: 16,
};

const revealCardStyle: React.CSSProperties = {
  minWidth: "min(90vw, 320px)",
  textAlign: "center",
  border: "2px solid rgba(80, 50, 20, 0.35)",
  borderRadius: 14,
  background: "rgba(255, 251, 242, 0.96)",
  boxShadow: "0 14px 32px rgba(35, 20, 10, 0.32)",
  padding: "16px 20px",
};

const revealKisekiChipStyle: React.CSSProperties = {
  marginInline: "auto",
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #b8891f",
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
  fontWeight: 900,
};
